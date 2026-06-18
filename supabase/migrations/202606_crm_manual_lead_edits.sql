begin;

alter table public.customers
  add column if not exists email text;

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
      'manual_edit',
      'notification'
    )
  );

create or replace function public.update_crm_manual_lead(
  p_auth_user_id uuid,
  p_auth_email text,
  p_lead_number bigint,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_customer_name text,
  p_phone text,
  p_normalized_phone text,
  p_email text default null,
  p_service_requested text default null,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_year text default null,
  p_vehicle_color text default null,
  p_location_text text default null,
  p_quote_price numeric default null,
  p_appointment_at timestamptz default null,
  p_appointment_text text default null,
  p_payment_status text default 'unpaid'
)
returns table (
  lead_id uuid,
  lead_number bigint,
  response_text text,
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
  v_lead_id uuid;
  v_current_customer_id uuid;
  v_next_customer_id uuid;
  v_current_customer_name text;
  v_current_phone text;
  v_current_normalized_phone text;
  v_current_email text;
  v_current_source text;
  v_current_status text;
  v_current_service_requested text;
  v_current_vehicle_make text;
  v_current_vehicle_model text;
  v_current_vehicle_year text;
  v_current_vehicle_color text;
  v_current_location_text text;
  v_current_quote_price numeric(10, 2);
  v_current_appointment_at timestamptz;
  v_current_appointment_text text;
  v_current_payment_status text;
  v_current_paid_at timestamptz;
  v_current_completed_at timestamptz;
  v_current_updated_at timestamptz;
  v_next_status text;
  v_next_quote_price numeric(10, 2);
  v_next_payment_status text;
  v_next_paid_at timestamptz;
  v_next_completed_at timestamptz;
  v_updated_at timestamptz;
  v_existing_actor uuid;
  v_existing_update_type text;
  v_existing_lead_id uuid;
  v_existing_lead_number bigint;
  v_existing_updated_at timestamptz;
  v_changed_fields text[] := array[]::text[];
  v_update_message text;
begin
  if p_auth_user_id is null or nullif(lower(trim(p_auth_email)), '') is null then
    raise exception 'crm_forbidden: authenticated CRM user is required';
  end if;

  if p_request_id is null then
    raise exception 'crm_invalid: request ID is required';
  end if;

  if p_expected_updated_at is null then
    raise exception 'crm_invalid: expected lead update time is required';
  end if;

  if p_lead_number is null or p_lead_number < 1 then
    raise exception 'crm_invalid: valid lead number is required';
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
    lead.updated_at
  into
    v_existing_actor,
    v_existing_update_type,
    v_existing_lead_id,
    v_existing_lead_number,
    v_existing_updated_at
  from public.lead_updates as update_log
  join public.leads as lead on lead.id = update_log.lead_id
  where update_log.request_id = p_request_id;

  if v_existing_lead_id is not null then
    if v_existing_actor is distinct from p_auth_user_id
      or v_existing_update_type is distinct from 'manual_edit'
      or v_existing_lead_number is distinct from p_lead_number then
      raise exception 'crm_conflict: request ID was already used for another CRM action';
    end if;

    return query
    select
      v_existing_lead_id,
      v_existing_lead_number,
      format('Request already applied to lead #%s.', v_existing_lead_number),
      v_existing_updated_at,
      true;
    return;
  end if;

  select
    lead.id,
    lead.customer_id,
    customer.name,
    customer.phone,
    customer.normalized_phone,
    customer.email,
    lead.source,
    lead.status,
    lead.service_requested,
    lead.vehicle_make,
    lead.vehicle_model,
    lead.vehicle_year,
    lead.vehicle_color,
    lead.location_text,
    lead.quote_price,
    lead.appointment_at,
    lead.appointment_text,
    lead.payment_status,
    lead.paid_at,
    lead.completed_at,
    lead.updated_at
  into
    v_lead_id,
    v_current_customer_id,
    v_current_customer_name,
    v_current_phone,
    v_current_normalized_phone,
    v_current_email,
    v_current_source,
    v_current_status,
    v_current_service_requested,
    v_current_vehicle_make,
    v_current_vehicle_model,
    v_current_vehicle_year,
    v_current_vehicle_color,
    v_current_location_text,
    v_current_quote_price,
    v_current_appointment_at,
    v_current_appointment_text,
    v_current_payment_status,
    v_current_paid_at,
    v_current_completed_at,
    v_current_updated_at
  from public.leads as lead
  join public.customers as customer on customer.id = lead.customer_id
  where lead.lead_number = p_lead_number
  for update of lead;

  if v_lead_id is null then
    raise exception 'crm_not_found: lead was not found';
  end if;

  if v_current_source not in ('manual', 'in_person') then
    raise exception 'crm_forbidden: only manually added leads can be edited here';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'crm_conflict: lead changed after it was opened; refresh and try again';
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

  v_next_payment_status := lower(coalesce(nullif(trim(p_payment_status), ''), 'unpaid'));

  if v_next_payment_status not in ('unpaid', 'paid') then
    raise exception 'crm_invalid: payment status must be unpaid or paid';
  end if;

  if p_quote_price is not null and (p_quote_price <= 0 or p_quote_price > 999999.99) then
    raise exception 'crm_invalid: quote must be between $0.01 and $999,999.99';
  end if;

  if p_appointment_at is not null then
    if p_appointment_at <= now() then
      raise exception 'crm_invalid: appointment must be in the future';
    end if;

    if nullif(trim(p_appointment_text), '') is null then
      raise exception 'crm_invalid: appointment text is required';
    end if;
  end if;

  v_next_status := v_current_status;
  v_next_quote_price := case
    when p_quote_price is null then null
    else round(p_quote_price, 2)
  end;
  v_next_paid_at := v_current_paid_at;
  v_next_completed_at := v_current_completed_at;

  if v_next_payment_status = 'paid' then
    v_next_status := 'completed';
    v_next_paid_at := coalesce(v_current_paid_at, now());
    v_next_completed_at := coalesce(v_current_completed_at, now());
  elsif v_current_payment_status = 'paid' then
    v_next_paid_at := null;
  end if;

  if v_next_payment_status = 'unpaid'
    and v_current_status not in ('completed', 'cancelled') then
    if p_appointment_at is not null then
      v_next_status := 'booked';
    elsif v_next_quote_price is not null
      and v_current_status in ('new', 'contacted', 'waiting', 'no_reply') then
      v_next_status := 'quoted';
    end if;
  end if;

  if v_current_customer_name is distinct from trim(p_customer_name) then
    v_changed_fields := array_append(v_changed_fields, 'customer name');
  end if;

  if v_current_phone is distinct from trim(p_phone)
    or v_current_normalized_phone is distinct from trim(p_normalized_phone) then
    v_changed_fields := array_append(v_changed_fields, 'phone');
  end if;

  if coalesce(v_current_email, '') is distinct from coalesce(nullif(trim(p_email), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'email');
  end if;

  if coalesce(v_current_service_requested, '') is distinct from trim(p_service_requested) then
    v_changed_fields := array_append(v_changed_fields, 'service/request');
  end if;

  if coalesce(v_current_vehicle_year, '') is distinct from coalesce(nullif(trim(p_vehicle_year), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'vehicle year');
  end if;

  if coalesce(v_current_vehicle_make, '') is distinct from coalesce(nullif(trim(p_vehicle_make), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'vehicle make');
  end if;

  if coalesce(v_current_vehicle_model, '') is distinct from coalesce(nullif(trim(p_vehicle_model), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'vehicle model');
  end if;

  if coalesce(v_current_vehicle_color, '') is distinct from coalesce(nullif(trim(p_vehicle_color), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'vehicle color');
  end if;

  if coalesce(v_current_location_text, '') is distinct from coalesce(nullif(trim(p_location_text), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'address/location');
  end if;

  if v_current_quote_price is distinct from v_next_quote_price then
    v_changed_fields := array_append(v_changed_fields, 'quote');
  end if;

  if v_current_appointment_at is distinct from p_appointment_at
    or coalesce(v_current_appointment_text, '') is distinct from coalesce(nullif(trim(p_appointment_text), ''), '') then
    v_changed_fields := array_append(v_changed_fields, 'appointment');
  end if;

  if v_current_payment_status is distinct from v_next_payment_status then
    v_changed_fields := array_append(v_changed_fields, 'payment status');
  end if;

  insert into public.customers (
    name,
    phone,
    normalized_phone,
    email
  )
  values (
    trim(p_customer_name),
    trim(p_phone),
    trim(p_normalized_phone),
    nullif(trim(p_email), '')
  )
  on conflict (normalized_phone) do update
  set
    name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    updated_at = now()
  returning public.customers.id into v_next_customer_id;

  update public.leads as target
  set
    customer_id = v_next_customer_id,
    status = v_next_status,
    service_requested = trim(p_service_requested),
    vehicle_make = nullif(trim(p_vehicle_make), ''),
    vehicle_model = nullif(trim(p_vehicle_model), ''),
    vehicle_year = nullif(trim(p_vehicle_year), ''),
    vehicle_color = nullif(trim(p_vehicle_color), ''),
    location_text = nullif(trim(p_location_text), ''),
    quote_price = v_next_quote_price,
    appointment_at = p_appointment_at,
    appointment_text = nullif(trim(p_appointment_text), ''),
    payment_status = v_next_payment_status,
    paid_at = v_next_paid_at,
    completed_at = v_next_completed_at,
    updated_at = now()
  where target.id = v_lead_id
  returning target.updated_at into v_updated_at;

  v_update_message := case
    when coalesce(array_length(v_changed_fields, 1), 0) = 0
      then format('Manual lead edit saved by %s: no field changes', v_team_member_name)
    else format(
      'Manual lead edited by %s: %s',
      v_team_member_name,
      array_to_string(v_changed_fields, ', ')
    )
  end;

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
    'manual_edit',
    v_update_message,
    v_team_member_id,
    'crm_dashboard:manual_edit',
    jsonb_strip_nulls(
      jsonb_build_object(
        'changed_fields', to_jsonb(v_changed_fields),
        'previous_customer_id', v_current_customer_id,
        'customer_id', v_next_customer_id,
        'previous_customer_name', v_current_customer_name,
        'customer_name', trim(p_customer_name),
        'previous_phone', v_current_phone,
        'phone', trim(p_phone),
        'previous_normalized_phone', v_current_normalized_phone,
        'normalized_phone', trim(p_normalized_phone),
        'previous_email', v_current_email,
        'email', nullif(trim(p_email), ''),
        'previous_status', v_current_status,
        'status', v_next_status,
        'previous_service_requested', v_current_service_requested,
        'service_requested', trim(p_service_requested),
        'previous_vehicle_year', v_current_vehicle_year,
        'vehicle_year', nullif(trim(p_vehicle_year), ''),
        'previous_vehicle_make', v_current_vehicle_make,
        'vehicle_make', nullif(trim(p_vehicle_make), ''),
        'previous_vehicle_model', v_current_vehicle_model,
        'vehicle_model', nullif(trim(p_vehicle_model), ''),
        'previous_vehicle_color', v_current_vehicle_color,
        'vehicle_color', nullif(trim(p_vehicle_color), ''),
        'previous_location_text', v_current_location_text,
        'location_text', nullif(trim(p_location_text), ''),
        'previous_quote_price', v_current_quote_price,
        'quote_price', v_next_quote_price,
        'previous_appointment_at', v_current_appointment_at,
        'appointment_at', p_appointment_at,
        'previous_appointment_text', v_current_appointment_text,
        'appointment_text', nullif(trim(p_appointment_text), ''),
        'previous_payment_status', v_current_payment_status,
        'payment_status', v_next_payment_status,
        'previous_paid_at', v_current_paid_at,
        'paid_at', v_next_paid_at,
        'previous_completed_at', v_current_completed_at,
        'completed_at', v_next_completed_at
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
    v_next_customer_id,
    'inbound_team',
    format('CRM dashboard manual edit by %s: %s', v_team_member_name, v_update_message)
  );

  return query
  select
    v_lead_id,
    p_lead_number,
    case
      when coalesce(array_length(v_changed_fields, 1), 0) = 0
        then format('Lead #%s saved. No field changes were detected.', p_lead_number)
      else format('Lead #%s manual details updated.', p_lead_number)
    end,
    v_updated_at,
    false;
end;
$$;

revoke all on function public.update_crm_manual_lead(
  uuid,
  text,
  bigint,
  uuid,
  timestamptz,
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
  numeric,
  timestamptz,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.update_crm_manual_lead(
  uuid,
  text,
  bigint,
  uuid,
  timestamptz,
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
  numeric,
  timestamptz,
  text,
  text
) to service_role;

commit;
