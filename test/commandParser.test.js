import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommandHelp, parseSmsCommand } from '../src/netlify/lib/commandParser.js';

test('supports the final Stage 2 global commands', () => {
  assert.deepEqual(parseSmsCommand('commands'), {
    type: 'global',
    command: 'commands',
  });
  assert.deepEqual(parseSmsCommand('open'), {
    type: 'global',
    command: 'open',
  });
  assert.deepEqual(parseSmsCommand('today'), {
    type: 'global',
    command: 'today',
  });
});

test('does not expose help, menu, or claim as CRM commands', () => {
  for (const command of ['help', 'menu', '1000 claim']) {
    assert.equal(parseSmsCommand(command).type, 'invalid');
  }
});

test('supports the final Stage 2 lead commands', () => {
  assert.equal(parseSmsCommand('1000 status').command, 'status');
  assert.equal(parseSmsCommand('1000 quote 180').command, 'quote');
  assert.equal(parseSmsCommand('1000 book Friday 10').command, 'book');
  assert.equal(
    parseSmsCommand('1000 note customer wants pet hair removed').command,
    'note',
  );
  assert.equal(parseSmsCommand('1000 done').command, 'done');
  assert.equal(parseSmsCommand('1000 cancel').command, 'cancel');
  assert.equal(parseSmsCommand('1000 no reply').command, 'no_reply');
  assert.equal(parseSmsCommand('1000 no-reply').command, 'no_reply');
  assert.equal(parseSmsCommand('1000 paid').command, 'paid');
});

test('command help lists only the supported Stage 2 command surface', () => {
  const help = getCommandHelp();

  for (const command of [
    'open',
    'today',
    '1000 status',
    '1000 quote 180',
    '1000 book Friday 10',
    '1000 note customer wants pet hair removed',
    '1000 done',
    '1000 cancel',
    '1000 no reply',
    '1000 paid',
  ]) {
    assert.ok(help.includes(command));
  }

  assert.doesNotMatch(help, /\bhelp\b/i);
  assert.doesNotMatch(help, /\bclaim\b/i);
});
