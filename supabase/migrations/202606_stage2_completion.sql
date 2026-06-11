begin;

alter table public.leads
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz;

alter table public.leads
  drop constraint if exists leads_payment_status_check;

alter table public.leads
  add constraint leads_payment_status_check
  check (payment_status in ('unpaid', 'paid'));

alter table public.leads
  drop constraint if exists leads_payment_timestamp_check;

alter table public.leads
  add constraint leads_payment_timestamp_check
  check (
    (payment_status = 'unpaid' and paid_at is null)
    or (payment_status = 'paid' and paid_at is not null)
  );

alter table public.lead_updates
  drop constraint if exists lead_updates_type_check;

alter table public.lead_updates
  add constraint lead_updates_type_check
  check (
    update_type in (
      'quote',
      'book',
      'done',
      'note',
      'cancel',
      'no_reply',
      'paid'
    )
  );

create or replace function public.execute_lead_sms_followup_command(
  p_twilio_message_sid text,
  p_twilio_account_sid text,
  p_from_phone text,
  p_to_phone text,
  p_body text,
  p_raw_payload jsonb,
  p_lead_number bigint,
  p_command text,
  p_argument text default null,
  p_amount numeric default null
)
returns table (
  lead_id uuid,
  response_text text,
  team_update_text text,
  is_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_team_member_id uuid;
  v_team_member_name text;
  v_lead_id uuid;
  v_customer_id uuid;
  v_customer_name text;
  v_current_status text;
  v_current_payment_status text;
  v_paid_at timestamptz;
  v_update_message text;
  v_response_text text;
  v_team_update_text text;
  v_existing_response text;
begin
  if p_command not in ('no_reply', 'paid') then
    raise exception 'Unsupported follow-up command';
  end if;

  select member.id, member.name
  into v_team_member_id, v_team_member_name
  from public.team_members as member
  where member.normalized_phone = p_from_phone
    and member.active = true;

  if v_team_member_id is null then
    raise exception 'Unauthorized team phone number';
  end if;

  insert into public.sms_command_events (
    twilio_message_sid,
    twilio_account_sid,
    team_member_id,
    from_phone,
    to_phone,
    body,
    parsed_command,
    status,
    raw_payload
  )
  values (
    p_twilio_message_sid,
    p_twilio_account_sid,
    v_team_member_id,
    p_from_phone,
    p_to_phone,
    p_body,
    p_command,
    'processing',
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (twilio_message_sid) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.lead_id, event.response_text
    into v_lead_id, v_existing_response
    from public.sms_command_events as event
    where event.twilio_message_sid = p_twilio_message_sid;

    return query
    select
      v_lead_id,
      coalesce(v_existing_response, 'Command is already processing.'),
      null::text,
      true;
    return;
  end if;

  select
    lead.id,
    lead.customer_id,
    lead.status,
    lead.payment_status,
    customer.name
  into
    v_lead_id,
    v_customer_id,
    v_current_status,
    v_current_payment_status,
    v_customer_name
  from public.leads as lead
  join public.customers as customer on customer.id = lead.customer_id
  where lead.lead_number = p_lead_number;

  if v_lead_id is null then
    v_response_text := format('Lead #%s was not found.', p_lead_number);

    update public.sms_command_events
    set
      status = 'failed',
      response_text = v_response_text,
      error = 'lead_not_found'
    where id = v_event_id;

    return query
    select null::uuid, v_response_text, null::text, false;
    return;
  end if;

  update public.sms_command_events
  set lead_id = v_lead_id
  where id = v_event_id;

  insert into public.messages (
    lead_id,
    customer_id,
    direction,
    body
  )
  values (
    v_lead_id,
    v_customer_id,
    'inbound_team',
    p_body
  );

  case p_command
    when 'no_reply' then
      if v_current_status in ('completed', 'cancelled') then
        v_response_text := format(
          'Lead #%s is %s and cannot be marked no reply.',
          p_lead_number,
          upper(v_current_status)
        );
      elsif v_current_status = 'no_reply' then
        v_response_text := format(
          'Lead #%s is already marked no reply.',
          p_lead_number
        );
      else
        update public.leads
        set
          status = 'no_reply',
          completed_at = null
        where id = v_lead_id;

        v_update_message := format(
          'Marked no reply by %s',
          v_team_member_name
        );
        v_response_text := format(
          'Lead #%s marked no reply.',
          p_lead_number
        );
        v_team_update_text := format(
          'Nova update: %s #%s was marked no reply by %s.',
          v_customer_name,
          p_lead_number,
          v_team_member_name
        );
      end if;

    when 'paid' then
      if v_current_status = 'cancelled' then
        v_response_text := format(
          'Lead #%s is cancelled and cannot be marked paid.',
          p_lead_number
        );
      elsif v_current_status not in ('booked', 'completed') then
        v_response_text := format(
          'Lead #%s must be booked or completed before marking it paid.',
          p_lead_number
        );
      elsif v_current_payment_status = 'paid' then
        v_response_text := format(
          'Lead #%s is already marked paid.',
          p_lead_number
        );
      else
        v_paid_at := now();

        update public.leads
        set
          payment_status = 'paid',
          paid_at = v_paid_at
        where id = v_lead_id;

        v_update_message := format(
          'Marked paid by %s',
          v_team_member_name
        );
        v_response_text := format(
          'Lead #%s marked paid.',
          p_lead_number
        );
        v_team_update_text := format(
          'Nova update: %s #%s was marked paid by %s.',
          v_customer_name,
          p_lead_number,
          v_team_member_name
        );
      end if;
  end case;

  if v_update_message is not null then
    insert into public.lead_updates (
      lead_id,
      update_type,
      message,
      created_by_team_member_id,
      raw_command,
      metadata
    )
    values (
      v_lead_id,
      p_command,
      v_update_message,
      v_team_member_id,
      p_body,
      jsonb_strip_nulls(
        jsonb_build_object(
          'status',
          case when p_command = 'no_reply' then 'no_reply' end,
          'payment_status',
          case when p_command = 'paid' then 'paid' end,
          'paid_at',
          v_paid_at
        )
      )
    );
  end if;

  update public.sms_command_events
  set
    status = 'completed',
    response_text = v_response_text,
    error = null
  where id = v_event_id;

  return query
  select v_lead_id, v_response_text, v_team_update_text, false;
end;
$$;

revoke all on function public.execute_lead_sms_followup_command(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  bigint,
  text,
  text,
  numeric
) from public, anon, authenticated;

grant execute on function public.execute_lead_sms_followup_command(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  bigint,
  text,
  text,
  numeric
) to service_role;

commit;
