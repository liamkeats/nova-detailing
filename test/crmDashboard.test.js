import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DateTime } from 'luxon';
import {
  CRM_STATUS_GROUPS,
  getAppointmentBuckets,
  getCrmStatusGroup,
  normalizeCrmLead,
  normalizeCrmLeadSummary,
} from '../src/netlify/lib/crmDashboard.js';

function createLead(overrides = {}) {
  return {
    id: 'lead-id',
    lead_number: 1000,
    status: 'new',
    source: 'website_chat',
    lead_type: 'quick_chat',
    quote_price: null,
    payment_status: 'unpaid',
    paid_at: null,
    appointment_text: null,
    appointment_at: null,
    service_requested: null,
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    vehicle_color: null,
    location_text: null,
    preferred_date: null,
    request_notes: null,
    created_at: '2026-06-10T12:00:00.000Z',
    updated_at: '2026-06-10T12:00:00.000Z',
    completed_at: null,
    archived_at: null,
    archived_by_team_member_id: null,
    customers: {
      name: 'Test Customer',
      phone: '+19025550100',
      email: 'test@example.com',
    },
    ...overrides,
  };
}

test('maps CRM statuses into the approved board columns', () => {
  assert.deepEqual(
    CRM_STATUS_GROUPS.map((group) => group.label),
    [
      'New',
      'Contacted / Waiting',
      'Quoted',
      'Booked',
      'Completed - Unpaid',
      'Completed - Paid',
      'No Reply',
      'Cancelled',
    ],
  );
  assert.equal(getCrmStatusGroup('new'), 'new');
  assert.equal(getCrmStatusGroup('contacted'), 'contacted');
  assert.equal(getCrmStatusGroup('waiting'), 'contacted');
  assert.equal(getCrmStatusGroup('quoted'), 'quoted');
  assert.equal(getCrmStatusGroup('booked'), 'booked');
  assert.equal(
    getCrmStatusGroup('completed', 'unpaid'),
    'completed_unpaid',
  );
  assert.equal(
    getCrmStatusGroup('completed', 'paid'),
    'completed_paid',
  );
  assert.equal(getCrmStatusGroup('no_reply'), 'no_reply');
  assert.equal(getCrmStatusGroup('cancelled'), 'cancelled');
});

test('normalizes a Supabase lead into a dashboard card', () => {
  const lead = normalizeCrmLead(
    createLead({
      quote_price: '180.00',
      service_requested: 'Interior Detailing',
      vehicle_year: '2022',
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      location_text: 'Halifax pickup',
    }),
    {
      latestNote: 'Customer asked about pet hair.',
    },
  );

  assert.equal(lead.leadNumber, 1000);
  assert.equal(lead.quotePrice, 180);
  assert.equal(lead.vehicle, '2022 Honda Civic');
  assert.equal(lead.location, 'Halifax pickup');
  assert.equal(lead.customer.name, 'Test Customer');
  assert.equal(lead.latestActivity, 'Customer asked about pet hair.');
  assert.equal(lead.archivedAt, null);
});

test('overview summaries expose only fields needed by the board', () => {
  const lead = normalizeCrmLeadSummary(
    createLead({
      quote_price: '180.00',
      service_requested: 'Interior Detailing',
      vehicle_year: '2022',
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      request_notes: 'Private request details',
    }),
  );

  assert.equal(lead.leadNumber, 1000);
  assert.equal(lead.quotePrice, 180);
  assert.equal(lead.vehicle, '2022 Honda Civic');
  assert.equal(lead.customer.name, 'Test Customer');
  assert.equal(lead.customer.phone, '+19025550100');
  assert.equal('id' in lead, false);
  assert.equal('requestNotes' in lead, false);
  assert.equal('latestActivity' in lead, false);
  assert.equal('email' in lead.customer, false);
});

test('server-side CRM reads require an explicit archived opt-in', async () => {
  const [dashboardModule, overviewEndpoint, leadEndpoint] =
    await Promise.all([
      readFile(
        new URL('../src/netlify/lib/crmDashboard.js', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/netlify/functions/crm-overview.js', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/netlify/functions/crm-lead.js', import.meta.url),
        'utf8',
      ),
    ]);

  assert.equal(
    dashboardModule.match(/\.is\('archived_at',\s*null\)/g)?.length,
    2,
  );
  assert.match(
    dashboardModule,
    /getCrmOverview\(\{\s*includeArchived\s*=\s*false\s*\}/,
  );
  assert.match(
    dashboardModule,
    /getCrmLeadDetail\([\s\S]+includeArchived\s*=\s*false/,
  );
  assert.match(overviewEndpoint, /includeArchived\s*===\s*'true'/);
  assert.match(leadEndpoint, /includeArchived\s*===\s*'true'/);
  assert.match(dashboardModule, /'archived_at'/);
  assert.match(dashboardModule, /'archived_by_team_member_id'/);

  const overviewSource =
    dashboardModule.match(
      /export async function getCrmOverview[\s\S]+?(?=export async function getCrmLeadDetail)/,
    )?.[0] || '';
  const detailSource =
    dashboardModule.match(/export async function getCrmLeadDetail[\s\S]+/)?.[0] ||
    '';

  assert.doesNotMatch(
    overviewSource,
    /\.from\('(messages|lead_updates|sms_command_events|intake_events)'\)/,
  );
  assert.doesNotMatch(detailSource, /\.from\('intake_events'\)/);
  assert.doesNotMatch(detailSource, /metadata|parsed_command/);
  assert.match(detailSource, /Manual lead created by/);
});

test('board columns use fixed widths and independent vertical scrolling', async () => {
  const [styles, script] = await Promise.all([
    readFile(
      new URL('../public/styles/crm.css', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../public/js/crm-dashboard.js', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(styles, /grid-template-columns:\s*repeat\(8,\s*280px\)/);
  assert.match(styles, /\.crm-column-cards\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(
    styles,
    /\[data-status-column="completed_paid"\][\s\S]*\.crm-card-preview\s*\{[\s\S]*display:\s*none/,
  );
  assert.match(styles, /content-visibility:\s*auto/);
  assert.match(script, /DEFAULT_COLUMN_CARD_LIMIT\s*=\s*40/);
  assert.match(script, /data-load-more-column/);
});

test('splits completed leads by payment status', () => {
  const unpaid = normalizeCrmLead(
    createLead({ status: 'completed', payment_status: 'unpaid' }),
  );
  const paid = normalizeCrmLead(
    createLead({ status: 'completed', payment_status: 'paid' }),
  );

  assert.equal(unpaid.statusGroup, 'completed_unpaid');
  assert.equal(paid.statusGroup, 'completed_paid');
});

test('groups Halifax-local today and upcoming appointments', () => {
  const now = DateTime.fromISO('2026-06-10T09:00:00', {
    zone: 'America/Halifax',
  });
  const leads = [
    normalizeCrmLead(
      createLead({
        id: 'today',
        lead_number: 1001,
        status: 'booked',
        appointment_at: '2026-06-10T15:00:00.000Z',
      }),
    ),
    normalizeCrmLead(
      createLead({
        id: 'upcoming',
        lead_number: 1002,
        status: 'booked',
        appointment_at: '2026-06-11T15:00:00.000Z',
      }),
    ),
    normalizeCrmLead(
      createLead({
        id: 'completed',
        lead_number: 1003,
        status: 'completed',
        appointment_at: '2026-06-10T17:00:00.000Z',
      }),
    ),
    normalizeCrmLead(
      createLead({
        id: 'archived-booking',
        lead_number: 1004,
        status: 'booked',
        appointment_at: '2026-06-10T16:00:00.000Z',
        archived_at: '2026-06-10T17:00:00.000Z',
      }),
    ),
  ];
  const buckets = getAppointmentBuckets(leads, now);

  assert.deepEqual(
    buckets.today.map((lead) => lead.leadNumber),
    [1001],
  );
  assert.deepEqual(
    buckets.upcoming.map((lead) => lead.leadNumber),
    [1002],
  );
});
