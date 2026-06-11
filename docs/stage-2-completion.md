# Stage 2 Completion

This checkpoint finalizes the internal SMS command surface:

```text
commands
open
today
1000 status
1000 quote 180
1000 book Friday 10
1000 note customer wants pet hair removed
1000 done
1000 cancel
1000 no reply
1000 paid
```

`help`, `menu`, and `claim` are not CRM commands.

## Deployment Order

1. Open the Supabase SQL Editor for the production project.
2. Run the complete contents of:
   `supabase/migrations/202606_stage2_completion.sql`
3. Confirm the SQL transaction completed successfully.
4. Deploy the application to Netlify.
5. Run the SMS tests below from an active team phone.

The SQL must run before the application deploy because the updated server code
selects `payment_status` and calls the new follow-up command function.

## SMS Tests

Create two disposable test leads through the website chat form. Replace
`<ACTIVE_LEAD>` and `<CANCEL_LEAD>` below with their lead numbers.

Run these from Liam's or Elijah's authorized phone:

```text
commands
open
today
<ACTIVE_LEAD> status
<ACTIVE_LEAD> quote 180
<ACTIVE_LEAD> note customer wants pet hair removed
<ACTIVE_LEAD> no reply
<ACTIVE_LEAD> book Friday 10
<ACTIVE_LEAD> paid
<ACTIVE_LEAD> status
<ACTIVE_LEAD> done
<ACTIVE_LEAD> status
<CANCEL_LEAD> cancel
<CANCEL_LEAD> status
```

To test a positive `today` result, book a disposable lead for a time later on
the current Halifax date:

```text
<ACTIVE_LEAD> book today at 10pm
today
```

Replace `10pm` with a time that is still in the future when testing.

## Supabase Verification

Replace the lead numbers in these queries before running them.

```sql
select
  lead_number,
  status,
  quote_price,
  appointment_text,
  appointment_at,
  payment_status,
  paid_at,
  created_at,
  updated_at,
  completed_at
from public.leads
where lead_number in (<ACTIVE_LEAD>, <CANCEL_LEAD>)
order by lead_number;
```

Expected:

- `no reply` temporarily sets `status = 'no_reply'`.
- `book` sets `status = 'booked'` and stores `appointment_at`.
- `paid` sets `payment_status = 'paid'` and a non-null `paid_at`.
- `done` sets `status = 'completed'` and `completed_at`.
- `cancel` sets the second lead to `status = 'cancelled'`.

```sql
select
  lead.lead_number,
  update_log.update_type,
  update_log.message,
  member.name as created_by,
  update_log.raw_command,
  update_log.metadata,
  update_log.created_at
from public.lead_updates as update_log
join public.leads as lead on lead.id = update_log.lead_id
left join public.team_members as member
  on member.id = update_log.created_by_team_member_id
where lead.lead_number in (<ACTIVE_LEAD>, <CANCEL_LEAD>)
order by update_log.created_at;
```

Expected update types include `quote`, `note`, `no_reply`, `book`, `paid`,
`done`, and `cancel`.

```sql
select
  lead.lead_number,
  message.direction,
  message.body,
  message.created_at
from public.messages as message
left join public.leads as lead on lead.id = message.lead_id
where lead.lead_number in (<ACTIVE_LEAD>, <CANCEL_LEAD>)
order by message.created_at;
```

Each lead command should have an `inbound_team` message.

```sql
select
  parsed_command,
  status,
  lead_id,
  response_text,
  error,
  created_at
from public.sms_command_events
where created_at >= now() - interval '1 hour'
order by created_at;
```

`commands`, `open`, and `today` should be completed with `lead_id` null.
Lead commands should be completed with the matching `lead_id`.

```sql
select
  lead.lead_number,
  lead.appointment_at,
  customer.name
from public.leads as lead
join public.customers as customer on customer.id = lead.customer_id
where lead.status = 'booked'
  and (lead.appointment_at at time zone 'America/Halifax')::date
    = (now() at time zone 'America/Halifax')::date
order by lead.appointment_at;
```

This result should match the jobs returned by `today`.

## Rollback

Use a non-destructive rollback:

1. Redeploy commit `fb98961a8c8dcba993e36644b1ab096330423ade`.
2. Run:
   `supabase/rollback/202606_stage2_completion_rollback.sql`
3. Test `commands`, `open`, and an existing lead `status` command.

The rollback intentionally keeps `payment_status`, `paid_at`, and any new
history rows so payment or follow-up data is not destroyed.
