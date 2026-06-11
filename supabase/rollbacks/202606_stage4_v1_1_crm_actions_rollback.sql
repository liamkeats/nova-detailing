begin;

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
) from service_role;

drop function if exists public.apply_crm_dashboard_lead_action(
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
);

-- The additive identity, audit, and archive columns intentionally remain.
-- Keeping them preserves any Stage 4 V1.1 history and soft-archived leads.
-- The Stage 2 SMS RPCs do not need restoration because V1.1 never replaces them.

commit;
