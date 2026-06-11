import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import {
  formatTodayJobs,
  getLeadCommandRpcName,
  getTodayRange,
} from '../src/netlify/lib/crmCommands.js';

test('routes only follow-up commands through the Stage 2 completion RPC', () => {
  assert.equal(
    getLeadCommandRpcName('no_reply'),
    'execute_lead_sms_followup_command',
  );
  assert.equal(
    getLeadCommandRpcName('paid'),
    'execute_lead_sms_followup_command',
  );
  assert.equal(getLeadCommandRpcName('book'), 'execute_lead_sms_command');
  assert.equal(getLeadCommandRpcName('quote'), 'execute_lead_sms_command');
});

test('builds today boundaries in the Halifax timezone', () => {
  const now = DateTime.fromISO('2026-06-10T15:30:00', {
    zone: 'America/Halifax',
  });
  const range = getTodayRange(now);

  assert.equal(range.start, '2026-06-10T03:00:00.000Z');
  assert.equal(range.end, '2026-06-11T03:00:00.000Z');
});

test('formats an empty today schedule', () => {
  assert.equal(formatTodayJobs([]), 'No jobs booked for today.');
});

test('formats booked jobs for an SMS response', () => {
  const response = formatTodayJobs([
    {
      lead_number: 1000,
      appointment_at: '2026-06-10T13:00:00.000Z',
      payment_status: 'paid',
      service_requested: 'Interior Detailing',
      vehicle_year: '2022',
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      customers: { name: 'Test Customer' },
    },
  ]);

  assert.equal(
    response,
    [
      "Today's booked jobs:",
      '10:00 AM - #1000 Test Customer - Interior Detailing - 2022 Honda Civic - PAID',
    ].join('\n'),
  );
});
