import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DateTime } from 'luxon';
import { handler as manualLeadEditHandler } from '../src/netlify/functions/crm-manual-lead-edit.js';
import { handler as manualLeadHandler } from '../src/netlify/functions/crm-manual-lead.js';
import {
  CrmManualLeadError,
  formatManualLeadNotification,
  validateManualLeadEditPayload,
  validateManualLeadPayload,
} from '../src/netlify/lib/crmManualLead.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const now = DateTime.fromISO('2026-06-11T09:00:00', {
  zone: 'America/Halifax',
});

function payload(overrides = {}) {
  return {
    requestId,
    customerName: 'John Smith',
    phone: '902-555-0100',
    serviceRequested: 'Interior detail with pet hair removal',
    status: 'new',
    paymentStatus: 'unpaid',
    ...overrides,
  };
}

test('validates the minimum manual Add Lead payload', () => {
  const result = validateManualLeadPayload(payload(), now);

  assert.equal(result.requestId, requestId);
  assert.equal(result.customerName, 'John Smith');
  assert.equal(result.phone, '(902) 555-0100');
  assert.equal(result.normalizedPhone, '+19025550100');
  assert.equal(result.serviceRequested, 'Interior detail with pet hair removal');
  assert.equal(result.status, 'new');
  assert.equal(result.source, 'manual');
  assert.equal(result.paymentStatus, 'unpaid');
  assert.equal(result.quotePrice, null);
  assert.equal(result.appointmentAt, null);
});

test('normalizes manual quote, booking, location, and payment fields', () => {
  const quoted = validateManualLeadPayload(
    payload({ quotePrice: '180.50' }),
    now,
  );
  assert.equal(quoted.status, 'quoted');
  assert.equal(quoted.quotePrice, 180.5);

  const booked = validateManualLeadPayload(
    payload({
      appointmentLocal: '2026-06-12T12:00',
      locationText: 'Halifax pickup',
      preferredDate: '2026-06-13',
    }),
    now,
  );
  assert.equal(booked.status, 'booked');
  assert.equal(booked.appointmentAt, '2026-06-12T15:00:00.000Z');
  assert.equal(booked.appointmentText, 'Fri, Jun 12, 2026 at 12:00 PM');
  assert.equal(booked.locationText, 'Halifax pickup');
  assert.equal(booked.preferredDate, '2026-06-13');

  const paid = validateManualLeadPayload(
    payload({ paymentStatus: 'paid' }),
    now,
  );
  assert.equal(paid.status, 'completed');
  assert.equal(paid.paymentStatus, 'paid');
});

test('validates manual lead edits and keeps phone matching normalized', () => {
  for (const phone of ['9026700224', '(902) 670-0224', '+19026700224']) {
    const result = validateManualLeadEditPayload(
      {
        leadNumber: 1010,
        requestId,
        expectedUpdatedAt: '2026-06-11T12:00:00.000Z',
        customerName: 'hello hi',
        phone,
        email: 'OWNER@Example.com',
        serviceRequested: 'helol',
        vehicleYear: '2020',
        vehicleMake: 'Ford',
        vehicleModel: 'F-150',
        vehicleColor: 'Black',
        locationText: 'Timberlea',
        quotePrice: '180',
        appointmentLocal: '2026-06-12T12:00',
        paymentStatus: 'unpaid',
      },
      now,
    );

    assert.equal(result.phone, '(902) 670-0224');
    assert.equal(result.normalizedPhone, '+19026700224');
    assert.equal(result.email, 'owner@example.com');
    assert.equal(result.appointmentAt, '2026-06-12T15:00:00.000Z');
  }
});

test('rejects invalid manual lead edits', () => {
  const validEdit = {
    leadNumber: 1010,
    requestId,
    expectedUpdatedAt: '2026-06-11T12:00:00.000Z',
    customerName: 'hello hi',
    phone: '9026700224',
    serviceRequested: 'helol',
    paymentStatus: 'unpaid',
  };

  for (const invalidPayload of [
    { ...validEdit, leadNumber: 0 },
    { ...validEdit, requestId: 'not-a-uuid' },
    { ...validEdit, expectedUpdatedAt: 'not-a-date' },
    { ...validEdit, customerName: '' },
    { ...validEdit, phone: '555' },
    { ...validEdit, email: 'not-an-email' },
    { ...validEdit, serviceRequested: '' },
    { ...validEdit, paymentStatus: 'maybe' },
    { ...validEdit, quotePrice: '0' },
    { ...validEdit, appointmentLocal: '2026-06-10T12:00' },
  ]) {
    assert.throws(
      () => validateManualLeadEditPayload(invalidPayload, now),
      CrmManualLeadError,
    );
  }
});

test('rejects invalid manual Add Lead payloads', () => {
  for (const invalidPayload of [
    payload({ customerName: '' }),
    payload({ phone: '555' }),
    payload({ serviceRequested: '' }),
    payload({ requestId: 'not-a-uuid' }),
    payload({ status: 'cancelled' }),
    payload({ status: 'quoted' }),
    payload({ status: 'booked' }),
    payload({ quotePrice: '0' }),
    payload({ appointmentLocal: '2026-06-10T12:00' }),
  ]) {
    assert.throws(
      () => validateManualLeadPayload(invalidPayload, now),
      CrmManualLeadError,
    );
  }
});

test('formats the manual lead owner SMS notification', () => {
  const message = formatManualLeadNotification({
    actorName: 'Liam',
    lead: {
      leadNumber: 1010,
      customerName: 'John Smith',
      serviceRequested: 'Interior detail',
      phone: '902-555-0100',
    },
  });

  assert.equal(
    message,
    'Liam added a new lead: #1010 John Smith - Interior detail - 902-555-0100',
  );
});

test('manual Add Lead migration is isolated from SMS commands', async () => {
  const [createMigration, editMigration] = await Promise.all([
    readFile(
      new URL(
        '../supabase/migrations/202606_crm_manual_leads.sql',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(
      new URL(
        '../supabase/migrations/202606_crm_manual_lead_edits.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  ]);
  const migration = `${createMigration}\n${editMigration}`;

  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.execute_lead_sms_/i,
  );
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.create_crm_manual_lead/i,
  );
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.update_crm_manual_lead/i,
  );
  assert.match(migration, /add\s+column\s+if\s+not\s+exists\s+location_text/i);
  assert.match(migration, /'manual_create'/);
  assert.match(migration, /'manual_edit'/);
  assert.match(migration, /'notification'/);
  assert.match(migration, /on\s+conflict\s*\(\s*normalized_phone\s*\)/i);
  assert.match(migration, /request_id\s*=\s*p_request_id/i);
  assert.match(migration, /v_current_source\s+not\s+in\s*\('manual',\s*'in_person'\)/i);
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.create_crm_manual_lead[\s\S]+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.create_crm_manual_lead[\s\S]+to\s+service_role/i,
  );
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.update_crm_manual_lead[\s\S]+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.update_crm_manual_lead[\s\S]+to\s+service_role/i,
  );
});

test('manual Add Lead endpoint rejects non-POST methods without touching data', async () => {
  const response = await manualLeadHandler({
    httpMethod: 'GET',
    headers: {},
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: 'Method not allowed.',
  });
});

test('manual lead edit endpoint rejects non-POST methods without touching data', async () => {
  const response = await manualLeadEditHandler({
    httpMethod: 'GET',
    headers: {},
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: 'Method not allowed.',
  });
});

test('dashboard exposes the manual Add Lead workflow', async () => {
  const [script, page] = await Promise.all([
    readFile(
      new URL('../public/js/crm-dashboard.js', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../src/pages/crm/index.astro', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(page, /id="crm-add-lead"/);
  assert.match(page, /id="crm-add-lead-form"/);
  assert.match(page, /name="customerName"/);
  assert.match(page, /data-format-phone/);
  assert.match(page, /name="serviceRequested"/);
  assert.match(page, /name="appointmentLocal"/);
  assert.match(page, /Saving creates a manual CRM lead/);
  assert.match(script, /\/api\/crm-manual-lead/);
  assert.match(script, /state\.addLeadRequestId\s*=\s*crypto\.randomUUID\(\)/);
  assert.match(
    script,
    /const\s+payload\s*=\s*getAddLeadPayload\(form\)[\s\S]+setAddLeadPending\(true\)[\s\S]+body:\s*JSON\.stringify\(payload\)/,
  );
  assert.doesNotMatch(
    script,
    /body:\s*JSON\.stringify\(getAddLeadPayload\(form\)\)/,
  );
  assert.match(script, /loadOverview\(\{\s*silent:\s*true\s*\}\)/);
  assert.match(script, /renderLeadDetail\(data\.lead\)/);
  assert.match(script, /data\.notification/);
  assert.match(script, /function\s+formatPhoneDisplay/);
  assert.match(script, /\/api\/crm-manual-lead-edit/);
  assert.match(script, /function\s+renderManualEditSection/);
  assert.match(script, /\['manual',\s*'in_person'\]\.includes/);
  assert.match(script, /data-crm-manual-edit-form/);
  assert.match(script, /crm-manual-edit-cta/);
  assert.match(script, /Edit Here/);
  assert.match(script, /Only manual leads can be edited here/);
});
