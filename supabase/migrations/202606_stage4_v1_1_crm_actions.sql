begin;

alter table public.team_members
  add column if not exists auth_user_id uuid,
  add column if not exists auth_email text;

create unique index if not exists team_members_auth_user_id_unique
  on public.team_members(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists team_members_auth_email_unique
  on public.team_members(lower(auth_email))
  where auth_email is not null;

update public.team_members as member
set
  auth_user_id = auth_user.id,
  auth_email = lower(auth_user.email),
  updated_at = now()
from auth.users as auth_user
where
  (
    member.normalized_phone = '+19026700224'
    and lower(auth_user.email) = 'keatsliam@gmail.com'
  )
  or (
    member.normalized_phone = '+19023001267'
    and lower(auth_user.email) = 'elijahkroezen@gmail.com'
  );

do $$
begin
  if not exists (
    select 1
    from public.team_members
    where normalized_phone = '+19026700224'
      and auth_user_id is not null
      and auth_email = 'keatsliam@gmail.com'
      and active = true
  ) then
    raise exception 'Liam CRM Auth user could not be mapped to team_members';
  end if;

  if not exists (
    select 1
    from public.team_members
    where normalized_phone = '+19023001267'
      and auth_user_id is not null
      and auth_email = 'elijahkroezen@gmail.com'
      and active = true
  ) then
    raise exception 'Elijah CRM Auth user could not be mapped to team_members';
  end if;
end;
$$;

alter table public.lead_updates
  add column if not exists action_source text not null default 'sms',
  add column if not exists actor_auth_user_id uuid,
  add column if not exists actor_email text,
  add column if not exists request_id uuid;

alter table public.lead_updates
  drop constraint if exists lead_updates_action_source_check;

alter table public.lead_updates
  add constraint lead_updates_action_source_check
  check (action_source in ('sms', 'crm_dashboard', 'system'));

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
      'status'
    )
  );

create unique index if not exists lead_updates_request_id_unique
  on public.lead_updates(request_id)
  where request_id is not null;

create or replace function public.apply_crm_dashboard_lead_action(
  p_auth_user_id uuid,
  p_auth_email text,
  p_lead_number bigint,
  p_action text,
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_note text default null,
  p_amount numeric default null,
  p_status text default null,
  p_appointment_at timestamptz default null,
  p_appointment_text text default null
)
returns table (
  lead_id uuid,
  lead_number bigint,
  action text,
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
  v_customer_id uuid;
  v_customer_name text;
  v_current_status text;
  v_current_quote_price numeric(10, 2);
  v_current_payment_status text;
  v_current_paid_at timestamptz;
  v_current_appointment_text text;
  v_current_appointment_at timestamptz;
  v_current_completed_at timestamptz;
  v_current_updated_at timestamptz;
  v_next_status text;
  v_next_quote_price numeric(10, 2);
  v_next_payment_status text;
  v_next_paid_at timestamptz;
  v_next_appointment_text text;
  v_next_appointment_at timestamptz;
  v_next_completed_at timestamptz;
  v_update_type text;
  v_update_message text;
  v_response_text text;
  v_message_body text;
  v_existing_actor uuid;
  v_existing_action text;
  v_existing_message text;
  v_existing_lead_id uuid;
  v_existing_lead_number bigint;
  v_existing_updated_at timestamptz;
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

  if p_action is null or p_action not in (
    'note',
    'status',
    'quote',
    'book',
    'no_reply',
    'paid',
    'done',
    'cancel'
  ) then
    raise exception 'crm_invalid: unsupported dashboard action';
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
    update_log.message,
    update_log.lead_id,
    lead.lead_number,
    lead.updated_at
  into
    v_existing_actor,
    v_existing_action,
    v_existing_message,
    v_existing_lead_id,
    v_existing_lead_number,
    v_existing_updated_at
  from public.lead_updates as update_log
  join public.leads as lead on lead.id = update_log.lead_id
  where update_log.request_id = p_request_id;

  if v_existing_lead_id is not null then
    if v_existing_actor is distinct from p_auth_user_id
      or v_existing_action is distinct from p_action
      or v_existing_lead_number is distinct from p_lead_number then
      raise exception 'crm_conflict: request ID was already used for another action';
    end if;

    return query
    select
      v_existing_lead_id,
      v_existing_lead_number,
      p_action,
      format('Request already applied: %s', v_existing_message),
      v_existing_updated_at,
      true;
    return;
  end if;

  select
    lead.id,
    lead.customer_id,
    customer.name,
    lead.status,
    lead.quote_price,
    lead.payment_status,
    lead.paid_at,
    lead.appointment_text,
    lead.appointment_at,
    lead.completed_at,
    lead.updated_at
  into
    v_lead_id,
    v_customer_id,
    v_customer_name,
    v_current_status,
    v_current_quote_price,
    v_current_payment_status,
    v_current_paid_at,
    v_current_appointment_text,
    v_current_appointment_at,
    v_current_completed_at,
    v_current_updated_at
  from public.leads as lead
  join public.customers as customer on customer.id = lead.customer_id
  where lead.lead_number = p_lead_number
  for update of lead;

  if v_lead_id is null then
    raise exception 'crm_not_found: lead was not found';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'crm_conflict: lead changed after it was opened; refresh and try again';
  end if;

  if v_current_status = 'cancelled' and p_action <> 'note' then
    if p_action = 'cancel' then
      return query
      select
        v_lead_id,
        p_lead_number,
        p_action,
        format('Lead #%s is already cancelled.', p_lead_number),
        v_current_updated_at,
        false;
      return;
    end if;

    raise exception 'crm_conflict: cancelled leads can only receive notes';
  end if;

  if v_current_status = 'completed'
    and v_current_payment_status = 'paid'
    and p_action <> 'note' then
    raise exception 'crm_conflict: completed paid leads can only receive notes';
  end if;

  if v_current_status = 'completed'
    and p_action not in ('note', 'paid', 'done') then
    raise exception 'crm_conflict: completed leads can only receive notes or payment updates';
  end if;

  if v_current_status = 'completed' and p_action = 'done' then
    return query
    select
      v_lead_id,
      p_lead_number,
      p_action,
      format('Lead #%s is already completed.', p_lead_number),
      v_current_updated_at,
      false;
    return;
  end if;

  v_next_status := v_current_status;
  v_next_quote_price := v_current_quote_price;
  v_next_payment_status := v_current_payment_status;
  v_next_paid_at := v_current_paid_at;
  v_next_appointment_text := v_current_appointment_text;
  v_next_appointment_at := v_current_appointment_at;
  v_next_completed_at := v_current_completed_at;

  case p_action
    when 'note' then
      if nullif(trim(p_note), '') is null then
        raise exception 'crm_invalid: note text is required';
      end if;

      if length(trim(p_note)) > 2000 then
        raise exception 'crm_invalid: note must be 2,000 characters or fewer';
      end if;

      v_update_type := 'note';
      v_update_message := trim(p_note);
      v_response_text := format('Note added to lead #%s.', p_lead_number);

    when 'status' then
      if p_status is null
        or p_status not in ('new', 'contacted', 'waiting', 'quoted', 'booked') then
        raise exception 'crm_invalid: select an allowed lead status';
      end if;

      if p_status = v_current_status then
        return query
        select
          v_lead_id,
          p_lead_number,
          p_action,
          format('Lead #%s is already %s.', p_lead_number, upper(p_status)),
          v_current_updated_at,
          false;
        return;
      end if;

      if p_status = 'quoted' and v_current_quote_price is null then
        raise exception 'crm_invalid: save a quote before changing the status to quoted';
      end if;

      if p_status = 'booked' and v_current_appointment_at is null then
        raise exception 'crm_invalid: book an appointment before changing the status to booked';
      end if;

      if v_current_payment_status = 'paid' and p_status <> 'booked' then
        raise exception 'crm_conflict: a paid lead cannot be moved out of booked status';
      end if;

      v_next_status := p_status;
      v_next_completed_at := null;
      v_update_type := 'status';
      v_update_message := format(
        'Status changed from %s to %s by %s',
        upper(v_current_status),
        upper(p_status),
        v_team_member_name
      );
      v_response_text := format(
        'Lead #%s status changed to %s.',
        p_lead_number,
        upper(p_status)
      );

    when 'quote' then
      if p_amount is null or p_amount <= 0 or p_amount > 999999.99 then
        raise exception 'crm_invalid: enter a quote between $0.01 and $999,999.99';
      end if;

      v_next_quote_price := round(p_amount, 2);
      v_next_status := case
        when v_current_status = 'booked' then 'booked'
        else 'quoted'
      end;
      v_next_completed_at := null;
      v_update_type := 'quote';
      v_update_message := format('Quote set to $%s', round(p_amount, 2));
      v_response_text := format(
        'Lead #%s quote saved at $%s.',
        p_lead_number,
        round(p_amount, 2)
      );

    when 'book' then
      if p_appointment_at is null or p_appointment_at <= now() then
        raise exception 'crm_invalid: choose a future appointment date and time';
      end if;

      if nullif(trim(p_appointment_text), '') is null
        or length(trim(p_appointment_text)) > 160 then
        raise exception 'crm_invalid: valid appointment text is required';
      end if;

      v_next_appointment_at := p_appointment_at;
      v_next_appointment_text := trim(p_appointment_text);
      v_next_status := 'booked';
      v_next_completed_at := null;
      v_update_type := 'book';
      v_update_message := format('Booked for %s', trim(p_appointment_text));
      v_response_text := format(
        'Lead #%s booked for %s.',
        p_lead_number,
        trim(p_appointment_text)
      );

    when 'no_reply' then
      if v_current_status = 'no_reply' then
        return query
        select
          v_lead_id,
          p_lead_number,
          p_action,
          format('Lead #%s is already marked no reply.', p_lead_number),
          v_current_updated_at,
          false;
        return;
      end if;

      v_next_status := 'no_reply';
      v_next_completed_at := null;
      v_update_type := 'no_reply';
      v_update_message := format('Marked no reply by %s', v_team_member_name);
      v_response_text := format('Lead #%s marked no reply.', p_lead_number);

    when 'paid' then
      if v_current_payment_status = 'paid' then
        return query
        select
          v_lead_id,
          p_lead_number,
          p_action,
          format('Lead #%s is already marked paid.', p_lead_number),
          v_current_updated_at,
          false;
        return;
      end if;

      v_next_status := 'completed';
      v_next_payment_status := 'paid';
      v_next_paid_at := now();
      v_next_completed_at := coalesce(v_current_completed_at, now());
      v_update_type := 'paid';
      v_update_message := case
        when v_current_status = 'completed'
          then format('Marked paid by %s', v_team_member_name)
        else format('Marked paid and completed by %s', v_team_member_name)
      end;
      v_response_text := case
        when v_current_status = 'completed'
          then format('Lead #%s marked paid.', p_lead_number)
        else format('Lead #%s marked paid and completed.', p_lead_number)
      end;

    when 'done' then
      v_next_status := 'completed';
      v_next_completed_at := now();
      v_update_type := 'done';
      v_update_message := format('Marked completed by %s', v_team_member_name);
      v_response_text := format('Lead #%s marked completed.', p_lead_number);

    when 'cancel' then
      v_next_status := 'cancelled';
      v_next_completed_at := null;
      v_update_type := 'cancel';
      v_update_message := format('Cancelled by %s', v_team_member_name);
      v_response_text := format(
        'Lead #%s cancelled and removed from open leads.',
        p_lead_number
      );
  end case;

  update public.leads as target
  set
    status = v_next_status,
    quote_price = v_next_quote_price,
    payment_status = v_next_payment_status,
    paid_at = v_next_paid_at,
    appointment_text = v_next_appointment_text,
    appointment_at = v_next_appointment_at,
    completed_at = v_next_completed_at,
    updated_at = now()
  where target.id = v_lead_id
  returning target.updated_at into v_current_updated_at;

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
    v_update_type,
    v_update_message,
    v_team_member_id,
    format('crm_dashboard:%s', p_action),
    jsonb_strip_nulls(
      jsonb_build_object(
        'action', p_action,
        'previous_status', v_current_status,
        'status', v_next_status,
        'previous_quote_price', v_current_quote_price,
        'quote_price', v_next_quote_price,
        'previous_payment_status', v_current_payment_status,
        'payment_status', v_next_payment_status,
        'previous_paid_at', v_current_paid_at,
        'paid_at', v_next_paid_at,
        'previous_appointment_text', v_current_appointment_text,
        'appointment_text', v_next_appointment_text,
        'previous_appointment_at', v_current_appointment_at,
        'appointment_at', v_next_appointment_at,
        'previous_completed_at', v_current_completed_at,
        'completed_at', v_next_completed_at
      )
    ),
    'crm_dashboard',
    p_auth_user_id,
    lower(trim(p_auth_email)),
    p_request_id
  );

  v_message_body := format(
    'CRM dashboard update by %s: %s',
    v_team_member_name,
    v_update_message
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
    v_message_body
  );

  return query
  select
    v_lead_id,
    p_lead_number,
    p_action,
    v_response_text,
    v_current_updated_at,
    false;
end;
$$;

revoke all on function public.apply_crm_dashboard_lead_action(
  uuid,
  text,
  bigint,
  text,
  uuid,
  timestamptz,
  text,
  numeric,
  text,
  timestamptz,
  text
) from public, anon, authenticated;

grant execute on function public.apply_crm_dashboard_lead_action(
  uuid,
  text,
  bigint,
  text,
  uuid,
  timestamptz,
  text,
  numeric,
  text,
  timestamptz,
  text
) to service_role;

commit;
