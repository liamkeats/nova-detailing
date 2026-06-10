begin;

alter table public.leads
  add column if not exists appointment_at timestamptz;

create index if not exists leads_appointment_at_idx
  on public.leads(appointment_at)
  where appointment_at is not null;

create or replace function public.execute_lead_sms_command(
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
  v_customer_phone text;
  v_current_status text;
  v_status text;
  v_quote_price numeric(10, 2);
  v_appointment_text text;
  v_appointment_at timestamptz;
  v_update_message text;
  v_response_text text;
  v_team_update_text text;
  v_existing_response text;
begin
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
    customer.name,
    customer.phone
  into
    v_lead_id,
    v_customer_id,
    v_current_status,
    v_customer_name,
    v_customer_phone
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

  if v_current_status in ('completed', 'cancelled')
    and p_command not in ('status', 'note') then
    if v_current_status = 'completed' and p_command = 'done' then
      v_response_text := format('Lead #%s is already completed.', p_lead_number);
    elsif v_current_status = 'cancelled' and p_command = 'cancel' then
      v_response_text := format('Lead #%s is already cancelled.', p_lead_number);
    else
      v_response_text := format(
        'Lead #%s is %s and cannot be changed. Status and notes still work.',
        p_lead_number,
        upper(v_current_status)
      );
    end if;

    update public.sms_command_events
    set
      status = 'completed',
      response_text = v_response_text,
      error = null
    where id = v_event_id;

    return query
    select v_lead_id, v_response_text, null::text, false;
    return;
  end if;

  case p_command
    when 'quote' then
      if p_amount is null or p_amount <= 0 then
        raise exception 'A valid quote amount is required';
      end if;

      update public.leads
      set
        quote_price = p_amount,
        status = case when status = 'booked' then 'booked' else 'quoted' end,
        completed_at = null
      where id = v_lead_id;

      v_update_message := format('Quote set to $%s', p_amount);
      v_response_text := format(
        'Lead #%s quote saved at $%s.',
        p_lead_number,
        p_amount
      );
      v_team_update_text := format(
        'Nova update: %s #%s was quoted $%s by %s.',
        v_customer_name,
        p_lead_number,
        p_amount,
        v_team_member_name
      );

    when 'book' then
      if nullif(trim(p_argument), '') is null
        or nullif(p_raw_payload ->> '_crmAppointmentAt', '') is null then
        raise exception 'A valid booking date and time are required';
      end if;

      begin
        v_appointment_at := (p_raw_payload ->> '_crmAppointmentAt')::timestamptz;
      exception
        when others then
          raise exception 'A valid booking date and time are required';
      end;

      update public.leads
      set
        appointment_text = trim(p_argument),
        appointment_at = v_appointment_at,
        status = 'booked',
        completed_at = null
      where id = v_lead_id;

      v_update_message := format('Booked for %s', trim(p_argument));
      v_response_text := format(
        'Lead #%s booked for %s.',
        p_lead_number,
        trim(p_argument)
      );
      v_team_update_text := format(
        'Nova update: %s #%s was booked by %s for %s.',
        v_customer_name,
        p_lead_number,
        v_team_member_name,
        trim(p_argument)
      );

    when 'done' then
      update public.leads
      set
        status = 'completed',
        completed_at = now()
      where id = v_lead_id;

      v_update_message := format('Marked completed by %s', v_team_member_name);
      v_response_text := format('Lead #%s marked completed.', p_lead_number);
      v_team_update_text := format(
        'Nova update: %s #%s was marked completed by %s.',
        v_customer_name,
        p_lead_number,
        v_team_member_name
      );

    when 'cancel' then
      update public.leads
      set
        status = 'cancelled',
        completed_at = null
      where id = v_lead_id;

      v_update_message := format('Cancelled by %s', v_team_member_name);
      v_response_text := format(
        'Lead #%s cancelled and removed from open leads.',
        p_lead_number
      );
      v_team_update_text := format(
        'Nova update: %s #%s was cancelled by %s.',
        v_customer_name,
        p_lead_number,
        v_team_member_name
      );

    when 'note' then
      if nullif(trim(p_argument), '') is null then
        raise exception 'Note text is required';
      end if;

      update public.leads
      set updated_at = now()
      where id = v_lead_id;

      v_update_message := trim(p_argument);
      v_response_text := format('Note added to lead #%s.', p_lead_number);
      v_team_update_text := format(
        'Nova note: %s added to #%s by %s: %s',
        v_customer_name,
        p_lead_number,
        v_team_member_name,
        trim(p_argument)
      );

    when 'status' then
      null;

    else
      raise exception 'Unsupported CRM command';
  end case;

  if p_command in ('quote', 'book', 'done', 'note', 'cancel') then
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
          'quote_price', p_amount,
          'argument', p_argument,
          'appointment_at', v_appointment_at
        )
      )
    );
  end if;

  select
    lead.status,
    lead.quote_price,
    lead.appointment_text,
    lead.appointment_at
  into
    v_status,
    v_quote_price,
    v_appointment_text,
    v_appointment_at
  from public.leads as lead
  where lead.id = v_lead_id;

  if p_command = 'status' then
    v_response_text := concat_ws(
      E'\n',
      format('#%s %s', p_lead_number, v_customer_name),
      format('Status: %s', upper(v_status)),
      format('Phone: %s', v_customer_phone),
      case
        when v_quote_price is not null then format('Quote: $%s', v_quote_price)
      end,
      case
        when nullif(v_appointment_text, '') is not null
          then format('Booking: %s', v_appointment_text)
      end
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

revoke all on function public.execute_lead_sms_command(
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

grant execute on function public.execute_lead_sms_command(
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
