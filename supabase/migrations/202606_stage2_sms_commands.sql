begin;

alter table public.leads
  add column if not exists assigned_to uuid references public.team_members(id) on delete set null,
  add column if not exists quote_price numeric(10, 2),
  add column if not exists appointment_text text,
  add column if not exists completed_at timestamptz;

alter table public.leads
  drop constraint if exists leads_quote_price_check;

alter table public.leads
  add constraint leads_quote_price_check
  check (quote_price is null or quote_price > 0);

create index if not exists leads_assigned_to_idx on public.leads(assigned_to);

create table if not exists public.lead_updates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  update_type text not null,
  message text not null,
  created_by_team_member_id uuid references public.team_members(id) on delete set null,
  raw_command text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lead_updates_type_check
    check (update_type in ('claim', 'quote', 'book', 'done', 'note'))
);

create index if not exists lead_updates_lead_id_idx
  on public.lead_updates(lead_id, created_at desc);

create table if not exists public.sms_command_events (
  id uuid primary key default gen_random_uuid(),
  twilio_message_sid text not null unique,
  twilio_account_sid text,
  team_member_id uuid references public.team_members(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  from_phone text not null,
  to_phone text not null,
  body text not null,
  parsed_command text,
  status text not null default 'processing',
  response_text text,
  error text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_command_events_status_check
    check (status in ('processing', 'completed', 'failed', 'rejected'))
);

create index if not exists sms_command_events_team_member_idx
  on public.sms_command_events(team_member_id, created_at desc);

create index if not exists sms_command_events_lead_idx
  on public.sms_command_events(lead_id, created_at desc);

drop trigger if exists sms_command_events_set_updated_at on public.sms_command_events;
create trigger sms_command_events_set_updated_at
before update on public.sms_command_events
for each row execute function public.set_updated_at();

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
  v_status text;
  v_assigned_name text;
  v_quote_price numeric(10, 2);
  v_appointment_text text;
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

  select lead.id, lead.customer_id, customer.name, customer.phone
  into v_lead_id, v_customer_id, v_customer_name, v_customer_phone
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
    when 'claim' then
      update public.leads
      set
        assigned_to = v_team_member_id,
        status = 'claimed'
      where id = v_lead_id;

      v_update_message := format('Claimed by %s', v_team_member_name);
      v_response_text := format(
        'Lead #%s claimed by %s.',
        p_lead_number,
        v_team_member_name
      );
      v_team_update_text := format(
        'Nova update: %s #%s was claimed by %s.',
        v_customer_name,
        p_lead_number,
        v_team_member_name
      );

    when 'quote' then
      if p_amount is null or p_amount <= 0 then
        raise exception 'A valid quote amount is required';
      end if;

      update public.leads
      set
        quote_price = p_amount,
        status = 'quoted'
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
      if nullif(trim(p_argument), '') is null then
        raise exception 'Booking details are required';
      end if;

      update public.leads
      set
        appointment_text = trim(p_argument),
        status = 'booked'
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

  if p_command in ('claim', 'quote', 'book', 'done', 'note') then
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
          'argument', p_argument
        )
      )
    );
  end if;

  select
    lead.status,
    assigned.name,
    lead.quote_price,
    lead.appointment_text
  into
    v_status,
    v_assigned_name,
    v_quote_price,
    v_appointment_text
  from public.leads as lead
  left join public.team_members as assigned on assigned.id = lead.assigned_to
  where lead.id = v_lead_id;

  if p_command = 'status' then
    v_response_text := concat_ws(
      E'\n',
      format('#%s %s', p_lead_number, v_customer_name),
      format('Status: %s', upper(v_status)),
      format('Phone: %s', v_customer_phone),
      format('Assigned: %s', coalesce(v_assigned_name, 'Unassigned')),
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

alter table public.lead_updates enable row level security;
alter table public.sms_command_events enable row level security;

revoke all on table public.lead_updates from anon, authenticated;
revoke all on table public.sms_command_events from anon, authenticated;
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

grant all on table public.lead_updates to service_role;
grant all on table public.sms_command_events to service_role;
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
