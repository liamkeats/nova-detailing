# Stage 4 V1.1 CRM Actions

Stage 4 V1.1 adds authenticated lead updates to the private `/crm` dashboard.
It does not change the existing Stage 2 SMS RPC definitions.

## Migration

Run:

```text
supabase/migrations/202606_stage4_v1_1_crm_actions.sql
```

The migration:

- maps Liam and Elijah's Supabase Auth users to their existing team records;
- adds dashboard audit fields to `lead_updates`;
- adds `status` as an allowed history update type;
- adds duplicate-request protection;
- creates the service-role-only `apply_crm_dashboard_lead_action` function.

It does not modify customers, existing leads, existing history, or either
`execute_lead_sms_*` function.

## Supported actions

- Add note
- Change status
- Save quote
- Book appointment
- Mark no reply
- Mark paid
- Mark completed
- Cancel lead

All actions require:

- a verified Supabase Auth session;
- an email in `CRM_ALLOWED_EMAILS`;
- a matching active `team_members` record;
- a same-origin JSON request;
- the lead's current `updated_at` value;
- a unique request ID.

## Audit records

Successful mutations create:

- one `lead_updates` history record;
- one `messages` record with direction `inbound_team`;
- actor team member, Auth user, email, source, request ID, and before/after
  values.

No fake Twilio event is created.

## Rollback

Application rollback remains production commit `40ef700` and Netlify deploy
`6a2a1d77b09464ef05db6d84`.

The non-destructive database rollback is:

```text
supabase/rollbacks/202606_stage4_v1_1_crm_actions_rollback.sql
```

It removes the dashboard action function while preserving audit records and
additive identity columns. No Stage 2 SMS function restoration is needed.
