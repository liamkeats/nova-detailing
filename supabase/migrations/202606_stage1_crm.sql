begin;

create extension if not exists pgcrypto;

create sequence if not exists public.lead_number_seq
  as bigint
  start with 1000
  increment by 1
  minvalue 1000
  no maxvalue
  cache 1;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  normalized_phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_normalized_phone_format
    check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  normalized_phone text not null unique,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_normalized_phone_format
    check (normalized_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_number bigint not null default nextval('public.lead_number_seq'::regclass),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'new',
  source text not null,
  lead_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_lead_number_unique unique (lead_number),
  constraint leads_status_check
    check (status in ('new', 'claimed', 'contacted', 'quoted', 'booked', 'completed', 'waiting', 'no_reply', 'cancelled')),
  constraint leads_source_check
    check (source in ('website_chat', 'website_contact', 'google_form', 'manual')),
  constraint leads_type_check
    check (lead_type in ('quick_chat', 'detailed_request', 'manual'))
);

alter sequence public.lead_number_seq owned by public.leads.lead_number;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  direction text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_direction_check
    check (direction in ('inbound_website', 'inbound_team', 'outbound_team'))
);

create table if not exists public.intake_events (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null unique,
  provider text not null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'processing',
  result jsonb not null default '{}'::jsonb,
  error text,
  notification_status text not null default 'pending',
  notification_result jsonb not null default '{}'::jsonb,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_events_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint intake_events_notification_status_check
    check (notification_status in ('pending', 'sent', 'partial', 'failed'))
);

create index if not exists leads_customer_id_idx on public.leads(customer_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists messages_lead_id_idx on public.messages(lead_id);
create index if not exists messages_customer_id_idx on public.messages(customer_id);
create index if not exists intake_events_lead_id_idx on public.intake_events(lead_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
before update on public.team_members
for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists intake_events_set_updated_at on public.intake_events;
create trigger intake_events_set_updated_at
before update on public.intake_events
for each row execute function public.set_updated_at();

create or replace function public.create_website_chat_lead(
  p_submission_id text,
  p_name text,
  p_phone text,
  p_normalized_phone text,
  p_message text
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

  insert into public.intake_events (
    submission_id,
    provider,
    status
  )
  values (
    trim(p_submission_id),
    'website_chat',
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
    normalized_phone
  )
  values (
    trim(p_name),
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
    lead_type
  )
  values (
    v_customer_id,
    'new',
    'website_chat',
    'quick_chat'
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
    p_message
  );

  update public.intake_events
  set
    customer_id = v_customer_id,
    lead_id = v_lead_id,
    status = 'completed',
    result = jsonb_build_object('lead_number', v_lead_number),
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

insert into public.team_members (
  name,
  phone,
  normalized_phone,
  role,
  active
)
values
  ('Liam', '+1 902-670-0224', '+19026700224', 'owner/admin', true),
  ('Elijah', '+1 902-300-1267', '+19023001267', 'owner/admin', true)
on conflict (normalized_phone) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();

alter table public.customers enable row level security;
alter table public.team_members enable row level security;
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.intake_events enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.leads from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.intake_events from anon, authenticated;
revoke all on sequence public.lead_number_seq from anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.create_website_chat_lead(text, text, text, text, text) from public, anon, authenticated;

grant all on table public.customers to service_role;
grant all on table public.team_members to service_role;
grant all on table public.leads to service_role;
grant all on table public.messages to service_role;
grant all on table public.intake_events to service_role;
grant usage, select on sequence public.lead_number_seq to service_role;
grant execute on function public.create_website_chat_lead(text, text, text, text, text) to service_role;

commit;
