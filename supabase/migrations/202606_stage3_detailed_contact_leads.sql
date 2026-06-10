begin;

alter table public.customers
  add column if not exists email text;

alter table public.leads
  add column if not exists service_requested text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year text,
  add column if not exists vehicle_color text,
  add column if not exists preferred_date date,
  add column if not exists request_notes text,
  add column if not exists intake_payload jsonb not null default '{}'::jsonb;

create index if not exists leads_preferred_date_idx
  on public.leads(preferred_date)
  where preferred_date is not null;

create or replace function public.create_website_contact_lead(
  p_submission_id text,
  p_name text,
  p_phone text,
  p_normalized_phone text,
  p_email text,
  p_service_requested text,
  p_vehicle_make text,
  p_vehicle_model text,
  p_vehicle_year text,
  p_vehicle_color text,
  p_preferred_date date,
  p_notes text,
  p_message text,
  p_raw_payload jsonb
)
returns table (
  customer_id uuid,
  lead_id uuid,
  lead_number bigint,
  is_duplicate boolean,
  notification_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intake_event_id uuid;
  v_customer_id uuid;
  v_lead_id uuid;
  v_lead_number bigint;
  v_notification_status text;
begin
  if nullif(trim(p_submission_id), '') is null then
    raise exception 'submission_id is required';
  end if;

  if nullif(trim(p_name), '') is null
    or nullif(trim(p_normalized_phone), '') is null
    or nullif(trim(p_service_requested), '') is null
    or p_preferred_date is null then
    raise exception 'required detailed lead fields are missing';
  end if;

  insert into public.intake_events (
    submission_id,
    provider,
    status
  )
  values (
    trim(p_submission_id),
    'website_contact',
    'processing'
  )
  on conflict (submission_id) do nothing
  returning id into v_intake_event_id;

  if v_intake_event_id is null then
    select
      event.customer_id,
      event.lead_id,
      event.notification_status
    into
      v_customer_id,
      v_lead_id,
      v_notification_status
    from public.intake_events as event
    where event.submission_id = trim(p_submission_id);

    if v_lead_id is null then
      raise exception 'submission is already being processed';
    end if;

    select lead.lead_number
    into v_lead_number
    from public.leads as lead
    where lead.id = v_lead_id;

    return query
    select
      v_customer_id,
      v_lead_id,
      v_lead_number,
      true,
      v_notification_status;
    return;
  end if;

  insert into public.customers (
    name,
    phone,
    normalized_phone,
    email
  )
  values (
    trim(p_name),
    trim(p_phone),
    trim(p_normalized_phone),
    nullif(trim(p_email), '')
  )
  on conflict (normalized_phone) do update
  set
    name = case
      when nullif(trim(excluded.name), '') is not null then excluded.name
      else public.customers.name
    end,
    phone = excluded.phone,
    email = coalesce(excluded.email, public.customers.email),
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
    preferred_date,
    request_notes,
    intake_payload
  )
  values (
    v_customer_id,
    'new',
    'website_contact',
    'detailed_request',
    trim(p_service_requested),
    nullif(trim(p_vehicle_make), ''),
    nullif(trim(p_vehicle_model), ''),
    nullif(trim(p_vehicle_year), ''),
    nullif(trim(p_vehicle_color), ''),
    p_preferred_date,
    nullif(trim(p_notes), ''),
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  returning public.leads.id, public.leads.lead_number
  into v_lead_id, v_lead_number;

  insert into public.messages (
    lead_id,
    customer_id,
    direction,
    body
  )
  values (
    v_lead_id,
    v_customer_id,
    'inbound_website',
    coalesce(nullif(trim(p_message), ''), trim(p_service_requested))
  );

  update public.intake_events
  set
    customer_id = v_customer_id,
    lead_id = v_lead_id,
    status = 'completed',
    result = jsonb_build_object(
      'lead_number', v_lead_number,
      'source', 'website_contact'
    ),
    error = null,
    updated_at = now()
  where id = v_intake_event_id;

  return query
  select
    v_customer_id,
    v_lead_id,
    v_lead_number,
    false,
    'pending'::text;
end;
$$;

revoke all on function public.create_website_contact_lead(
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
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_website_contact_lead(
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
  text,
  text,
  jsonb
) to service_role;

commit;
