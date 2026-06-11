begin;

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
) from public, anon, authenticated, service_role;

drop function if exists public.execute_lead_sms_followup_command(
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
);

-- Keep payment columns and expanded history values to avoid destructive data loss.
-- Redeploy the previous application commit after running this rollback.

commit;
