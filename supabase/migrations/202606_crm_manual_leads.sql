begin;

alter table public.leads
  add column if not exists location_text text;

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
      'paid',
      'unpaid',
      'status',
      'reopen',
      'archive',
      'restore',
      'manual_create',
      'notification'
    )
  );

create or replace function public.create_crm_manual_lead(
  p_auth_user_id uuid,
  p_auth_email text,
  p_request_id uuid,
  p_customer_name text,
  p_phone text,
  p_normalized_phone text,
  p_service_requested text,
  p_status text default 'new',
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_year text default null,
  p_vehicle_color text default null,
  p_location_text text default null,
  p_preferred_date date default null,
  p_quote_price numeric default null,
  p_appointment_at timestamptz default null,
  p_appointment_text text default null,
  p_payment_status text default 'unpaid',
  p_internal_note text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (
  lead_id uuid,
  lead_number bigint,
  customer_id uuid,
  created_by_team_member_id uuid,
  created_by_name text,
  updated_at timestamptz,
  is_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_member_id uuid;
  v_team_member_name text;
  v_customer_id uuid;
  v_lead_id uuid;
  v_lead_number bigint;
  v_status text;
  v_payment_status text;
  v_paid_at timestamptz;
  v_completed_at timestamptz;
  v_updated_at timestamptz;
  v_existing_lead_id uuid;
  v_existing_lead_number bigint;
  v_existing_customer_id uuid;
  v_existing_actor uuid;
  v_existing_update_type text;
  v_existing_updated_at timestamptz;
  v_create_message text;
begin
  if p_auth_user_id is null or nullif(lower(trim(p_auth_email)), '') is null then
    raise exception 'crm_forbidden: authenticated CRM user is required';
  end if;

  if p_request_id is null then
    raise exception 'crm_invalid: request ID is required';
  end if;

  select member.id, member.name
  into v_team_member_id, v_team_member_name
  from public.team_members as member
  where member.auth_user_id = p_auth_user_id
    and lower(member.auth_email) = lower(trim(p_auth_email))
    and member.active = true;

  if v_team_member_id is null then
    raise exception 'crm_forbidden: CRM user is not mapped to an active team member';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 0)
  );

  select
    update_log.actor_auth_user_id,
    update_log.update_type,
    update_log.lead_id,
    lead.lead_number,
    lead.customer_id,
    lead.updated_at
  into
    v_existing_actor,
    v_existing_update_type,
    v_existing_lead_id,
    v_existing_lead_number,
    v_existing_customer_id,
    v_existing_updated_at
  from public.lead_updates as update_log
  join public.leads as lead on lead.id = update_log.lead_id
  where update_log.request_id = p_request_id;

  if v_existing_lead_id is not null then
    if v_existing_actor is distinct from p_auth_user_id
      or v_existing_update_type is distinct from 'manual_create' then
      raise exception 'crm_conflict: request ID was already used for another CRM action';
    end if;

    return query
    select
      v_existing_lead_id,
      v_existing_lead_number,
      v_existing_customer_id,
      v_team_member_id,
      v_team_member_name,
      v_existing_updated_at,
      true;
    return;
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'crm_invalid: customer name is required';
  end if;

  if nullif(trim(p_phone), '') is null
    or nullif(trim(p_normalized_phone), '') is null then
    raise exception 'crm_invalid: customer phone number is required';
  end if;

  if nullif(trim(p_service_requested), '') is null then
    raise exception 'crm_invalid: service or request details are required';
  end if;

  v_status := lower(coalesce(nullif(trim(p_status), ''), 'new'));
  v_payment_status := lower(coalesce(nullif(trim(p_payment_status), ''), 'unpaid'));

  if v_payment_status not in ('unpaid', 'paid') then
    raise exception 'crm_invalid: payment status must be unpaid or paid';
  end if;

  if v_payment_status = 'paid' then
    v_status := 'completed';
    v_paid_at := now();
    v_completed_at := now();
  elsif v_status not in ('new', 'contacted', 'waiting', 'quoted', 'booked') then
    raise exception 'crm_invalid: manual lead status must be new, contacted, waiting, quoted, or booked';
  end if;

  if p_quote_price is not null and (p_quote_price <= 0 or p_quote_price > 999999.99) then
    raise exception 'crm_invalid: quote must be between $0.01 and $999,999.99';
  end if;

  if v_status = 'quoted' and p_quote_price is null then
    raise exception 'crm_invalid: quoted manual leads need a quote amount';
  end if;

  if p_appointment_at is not null then
    if p_appointment_at <= now() then
      raise exception 'crm_invalid: appointment must be in the future';
    end if;

    if nullif(trim(p_appointment_text), '') is null then
      raise exception 'crm_invalid: appointment text is required';
    end if;
  end if;

  if v_status = 'booked' and p_appointment_at is null then
    raise exception 'crm_invalid: booked manual leads need an appointment date and time';
  end if;

  insert into public.customers (
    name,
    phone,
    normalized_phone
  )
  values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_normalized_phone)
  )
  on conflict (normalized_phone) do update
  set
    name = case
      when nullif(trim(excluded.name), '') is not null then excluded.name
      else public.customers.name
    end,
    phone = excluded.phone,
    updated_at = now()
  returning public.customers.id into v_customer_id;

  insert into public.leads (
    customer_id,
    status,
    source,
    lead_type,
    service_requested,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_color,
    location_text,
    preferred_date,
    quote_price,
    appointment_at,
    appointment_text,
    payment_status,
    paid_at,
    completed_at,
    intake_payload
  )
  values (
    v_customer_id,
    v_status,
    'manual',
    'manual',
    trim(p_service_requested),
    nullif(trim(p_vehicle_make), ''),
    nullif(trim(p_vehicle_model), ''),
    nullif(trim(p_vehicle_year), ''),
    nullif(trim(p_vehicle_color), ''),
    nullif(trim(p_location_text), ''),
    p_preferred_date,
    case when p_quote_price is null then null else round(p_quote_price, 2) end,
    p_appointment_at,
    nullif(trim(p_appointment_text), ''),
    v_payment_status,
    v_paid_at,
    v_completed_at,
    jsonb_strip_nulls(
      coalesce(p_raw_payload, '{}'::jsonb) ||
      jsonb_build_object(
        'source', 'manual',
        'created_by_team_member_id', v_team_member_id,
        'created_by_name', v_team_member_name,
        'created_by_auth_user_id', p_auth_user_id,
        'created_by_email', lower(trim(p_auth_email))
      )
    )
  )
  returning public.leads.id, public.leads.lead_number, public.leads.updated_at
  into v_lead_id, v_lead_number, v_updated_at;

  v_create_message := format(
    'Manual lead created by %s: %s - %s - %s',
    v_team_member_name,
    trim(p_customer_name),
    trim(p_service_requested),
    trim(p_phone)
  );

  insert into public.lead_updates (
    lead_id,
    update_type,
    message,
    created_by_team_member_id,
    raw_command,
    metadata,
    action_source,
    actor_auth_user_id,
    actor_email,
    request_id
  )
  values (
    v_lead_id,
    'manual_create',
    format('Manual lead created by %s', v_team_member_name),
    v_team_member_id,
    'crm_dashboard:manual_create',
    jsonb_strip_nulls(
      jsonb_build_object(
        'customer_name', trim(p_customer_name),
        'phone', trim(p_phone),
        'normalized_phone', trim(p_normalized_phone),
        'service_requested', trim(p_service_requested),
        'status', v_status,
        'payment_status', v_payment_status,
        'quote_price', p_quote_price,
        'appointment_at', p_appointment_at,
        'appointment_text', nullif(trim(p_appointment_text), ''),
        'preferred_date', p_preferred_date,
        'location_text', nullif(trim(p_location_text), '')
      )
    ),
    'crm_dashboard',
    p_auth_user_id,
    lower(trim(p_auth_email)),
    p_request_id
  );

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
    v_create_message
  );

  if nullif(trim(p_internal_note), '') is not null then
    insert into public.lead_updates (
      lead_id,
      update_type,
      message,
      created_by_team_member_id,
      raw_command,
      metadata,
      action_source,
      actor_auth_user_id,
      actor_email
    )
    values (
      v_lead_id,
      'note',
      trim(p_internal_note),
      v_team_member_id,
      'crm_dashboard:manual_create_note',
      jsonb_build_object('action', 'manual_create_note'),
      'crm_dashboard',
      p_auth_user_id,
      lower(trim(p_auth_email))
    );

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
      format('CRM dashboard note by %s: %s', v_team_member_name, trim(p_internal_note))
    );
  end if;

  return query
  select
    v_lead_id,
    v_lead_number,
    v_customer_id,
    v_team_member_id,
    v_team_member_name,
    v_updated_at,
    false;
end;
$$;

revoke all on function public.create_crm_manual_lead(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  numeric,
  timestamptz,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_crm_manual_lead(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  numeric,
  timestamptz,
  text,
  text,
  text,
  jsonb
) to service_role;

commit;
