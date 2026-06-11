import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DateTime } from 'luxon';
import {
  CrmActionError,
  isSameOriginCrmRequest,
  validateCrmActionPayload,
} from '../src/netlify/lib/crmActions.js';
import { handler as crmActionHandler } from '../src/netlify/functions/crm-action.js';

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const expectedUpdatedAt = '2026-06-11T12:00:00.000Z';
const now = DateTime.fromISO('2026-06-11T09:00:00', {
  zone: 'America/Halifax',
});

function payload(overrides = {}) {
  return {
    leadNumber: 1000,
    action: 'note',
    requestId,
    expectedUpdatedAt,
    note: 'Customer requested pet-hair removal.',
    ...overrides,
  };
}

test('validates dashboard note, status, and quote actions', () => {
  assert.deepEqual(validateCrmActionPayload(payload(), now), {
    leadNumber: 1000,
    action: 'note',
    requestId,
    expectedUpdatedAt,
    note: 'Customer requested pet-hair removal.',
    amount: null,
    status: null,
    appointmentAt: null,
    appointmentText: null,
  });

  assert.equal(
    validateCrmActionPayload(
      payload({ action: 'status', status: 'waiting', note: undefined }),
      now,
    ).status,
    'waiting',
  );
  assert.equal(
    validateCrmActionPayload(
      payload({ action: 'quote', amount: '180.50', note: undefined }),
      now,
    ).amount,
    180.5,
  );
});

test('accepts every approved quick action', () => {
  for (const action of ['no_reply', 'paid', 'done', 'cancel']) {
    const result = validateCrmActionPayload(
      payload({ action, note: undefined }),
      now,
    );

    assert.equal(result.action, action);
    assert.equal(result.leadNumber, 1000);
  }
});

test('normalizes a Halifax-local dashboard booking', () => {
  const result = validateCrmActionPayload(
    payload({
      action: 'book',
      appointmentLocal: '2026-06-12T12:00',
      note: undefined,
    }),
    now,
  );

  assert.equal(result.appointmentAt, '2026-06-12T15:00:00.000Z');
  assert.equal(result.appointmentText, 'Fri, Jun 12, 2026 at 12:00 PM');
});

test('rejects invalid dashboard action input', () => {
  for (const invalidPayload of [
    payload({ action: 'quote', amount: '0', note: undefined }),
    payload({ action: 'quote', amount: '12.345', note: undefined }),
    payload({ action: 'status', status: 'completed', note: undefined }),
    payload({
      action: 'book',
      appointmentLocal: '2026-06-10T12:00',
      note: undefined,
    }),
    payload({ requestId: 'not-a-uuid' }),
  ]) {
    assert.throws(
      () => validateCrmActionPayload(invalidPayload, now),
      CrmActionError,
    );
  }
});

test('accepts only same-origin dashboard write requests', () => {
  assert.equal(
    isSameOriginCrmRequest({
      headers: {
        origin: 'https://thenovadetailing.ca',
        host: 'thenovadetailing.ca',
        'x-forwarded-proto': 'https',
      },
    }),
    true,
  );
  assert.equal(
    isSameOriginCrmRequest({
      headers: {
        origin: 'https://example.com',
        host: 'thenovadetailing.ca',
        'x-forwarded-proto': 'https',
      },
    }),
    false,
  );
  assert.equal(isSameOriginCrmRequest({ headers: {} }), false);
});

test('dashboard migration leaves the existing SMS RPC definitions untouched', async () => {
  const migration = await readFile(
    new URL(
      '../supabase/migrations/202606_stage4_v1_1_crm_actions.sql',
      import.meta.url,
    ),
    'utf8',
  );

  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.execute_lead_sms_/i,
  );
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+public\.apply_crm_dashboard_lead_action/i,
  );
  assert.match(
    migration,
    /revoke\s+all\s+on\s+function\s+public\.apply_crm_dashboard_lead_action[\s\S]+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+public\.apply_crm_dashboard_lead_action[\s\S]+to\s+service_role/i,
  );
  assert.match(migration, /elijahkroezen@gmail\.com/i);
  assert.doesNotMatch(migration, /elijahkrozen@gmail\.com/i);
});

test('CRM action endpoint rejects non-POST methods without touching data', async () => {
  const response = await crmActionHandler({
    httpMethod: 'GET',
    headers: {},
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: 'Method not allowed.',
  });
});
