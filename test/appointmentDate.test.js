import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { parseBookingDate } from '../src/netlify/lib/appointmentDate.js';

const NOW = DateTime.fromISO('2026-06-10T09:00:00', {
  zone: 'America/Halifax',
});

function parsedDate(value) {
  return DateTime.fromISO(parseBookingDate(value, NOW).appointmentAt, {
    setZone: true,
  });
}

test('parses a month and day at noon', () => {
  const appointment = parsedDate('June 12 at noon');

  assert.equal(appointment.toFormat('yyyy-MM-dd HH:mm'), '2026-06-12 12:00');
});

test('parses an upcoming weekday and numbered date at noon', () => {
  const appointment = parsedDate('Friday 12 at noon');

  assert.equal(appointment.toFormat('yyyy-MM-dd HH:mm'), '2026-06-12 12:00');
});

test('parses natural ordinal and weekday variants', () => {
  assert.equal(
    parsedDate('Friday the 12th at noon').toFormat('yyyy-MM-dd HH:mm'),
    '2026-06-12 12:00',
  );
  assert.equal(
    parsedDate('Friday, June 12th at noon').toFormat('yyyy-MM-dd HH:mm'),
    '2026-06-12 12:00',
  );
});

test('preserves weekday time shorthand', () => {
  const appointment = parsedDate('Friday 10');

  assert.equal(appointment.toFormat('yyyy-MM-dd HH:mm'), '2026-06-12 10:00');
});

test('parses relative dates and midnight', () => {
  assert.equal(
    parsedDate('tomorrow at noon').toFormat('yyyy-MM-dd HH:mm'),
    '2026-06-11 12:00',
  );
  assert.equal(
    parsedDate('June 12 at midnight').toFormat('yyyy-MM-dd HH:mm'),
    '2026-06-12 00:00',
  );
});

test('rejects a weekday and numbered date that do not agree', () => {
  assert.throws(
    () => parseBookingDate('Friday 13 at noon', NOW),
    /not the 13/,
  );
});
