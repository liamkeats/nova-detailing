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
- adds archive timestamps and actor ownership to `leads`;
- adds dashboard status, reopen, payment reversal, and archive history types;
- adds duplicate-request protection;
- adds overview/detail query indexes for CRM reads;
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
- Mark unpaid
- Mark completed
- Cancel lead
- Reopen a completed lead
- Archive / remove a lead from the normal board
- Show archived leads on demand and restore them to the board

`done` records that the work is complete without changing payment. `paid`
records payment and also completes any non-cancelled lead that is not already
complete. The board shows completed unpaid and completed paid work in separate
columns. Reopening a paid completed lead also marks it unpaid so that paid
always implies completed.

Archiving is a soft removal only. It hides the lead from normal CRM overview,
detail, search, filters, and appointment lists while preserving the customer,
messages, notes, history, SMS command events, and intake records.

The `Show archived` toggle is off by default. When enabled, archived leads
appear in their previous workflow columns with an Archived label and can be
searched or opened. Restoring clears the archive fields and records the
authenticated team member in history. Archived bookings never appear in Today
or Upcoming.

## Performance

The overview endpoint uses one trimmed Supabase query containing only the
fields needed for board cards, summary counts, and appointment sections.
Messages, history, command events, and full customer/lead details load only
after a lead is opened.

The browser initially renders at most 40 cards per column. Larger columns can
be expanded in 40-card batches, and off-screen cards use browser rendering
containment. Archived leads remain excluded from the overview query unless
`Show archived` is enabled.

All actions require:

- a verified Supabase Auth session;
- an email in `CRM_ALLOWED_EMAILS`;
- a matching active `team_members` record;
- a same-origin JSON request;
- the lead's current `updated_at` value;
- a unique request ID.

The approved team emails are `keatsliam@gmail.com` and
`elijahkroezen@gmail.com`.

## Audit records

Successful mutations create:

- one `lead_updates` history record;
- one `messages` record with direction `inbound_team`;
- actor team member, Auth user, email, source, request ID, and before/after
  values.

No fake Twilio event is created.

## Future manual lead import

A later CRM stage should add a reviewed manual add/import workflow for existing
customers and leads. It is intentionally outside V1.1 so this release stays
focused on safely editing, reversing, and archiving existing records.

## Rollback

Application rollback remains production commit `40ef700` and Netlify deploy
`6a2a1d77b09464ef05db6d84`.

The non-destructive database rollback is:

```text
supabase/rollbacks/202606_stage4_v1_1_crm_actions_rollback.sql
```

It removes the dashboard action function while preserving audit records and
additive identity columns. No Stage 2 SMS function restoration is needed.
