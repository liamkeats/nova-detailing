import { parseBookingDate } from './appointmentDate.js';

const HELP_TEXT = [
  'Nova CRM commands',
  'Replace 1000 with the lead number:',
  '',
  '1000 quote 180',
  '1000 book Friday at noon',
  '1000 book June 12 at 2pm',
  '1000 note customer called',
  '1000 status',
  '1000 done',
  '1000 cancel',
  '',
  'open - list active leads',
  'commands - show this menu',
].join('\n');

function cleanCommand(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getCommandHelp() {
  return HELP_TEXT;
}

export function parseSmsCommand(value) {
  const raw = cleanCommand(value);
  const normalized = raw.toLowerCase();

  if (!raw) {
    return {
      type: 'invalid',
      error: `Empty command.\n${HELP_TEXT}`,
    };
  }

  if (normalized === 'commands' || normalized === 'menu') {
    return {
      type: 'global',
      command: 'commands',
    };
  }

  if (normalized === 'open') {
    return {
      type: 'global',
      command: 'open',
    };
  }

  const leadMatch = raw.match(/^#?(\d+)\s+(.+)$/);

  if (!leadMatch) {
    return {
      type: 'invalid',
      error: `Command not recognized.\n${HELP_TEXT}`,
    };
  }

  const leadNumber = Number(leadMatch[1]);
  const commandText = leadMatch[2].trim();
  const lowerCommandText = commandText.toLowerCase();

  if (!Number.isSafeInteger(leadNumber) || leadNumber < 1) {
    return {
      type: 'invalid',
      error: 'Invalid lead number.',
    };
  }

  const quoteMatch = commandText.match(/^quote\s+\$?(\d+(?:\.\d{1,2})?)$/i);

  if (quoteMatch) {
    const amount = Number(quoteMatch[1]);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      return {
        type: 'invalid',
        error: 'Quote amount is invalid.',
      };
    }

    return {
      type: 'lead',
      leadNumber,
      command: 'quote',
      amount,
    };
  }

  const bookMatch = commandText.match(/^book\s+(.+)$/i);

  if (bookMatch) {
    let booking;

    try {
      booking = parseBookingDate(bookMatch[1]);
    } catch (error) {
      return {
        type: 'invalid',
        error: error.message,
      };
    }

    return {
      type: 'lead',
      leadNumber,
      command: 'book',
      argument: booking.displayText,
      appointmentAt: booking.appointmentAt,
    };
  }

  if (lowerCommandText === 'done') {
    return {
      type: 'lead',
      leadNumber,
      command: 'done',
    };
  }

  if (lowerCommandText === 'cancel') {
    return {
      type: 'lead',
      leadNumber,
      command: 'cancel',
    };
  }

  const noteMatch = commandText.match(/^note\s+(.+)$/i);

  if (noteMatch) {
    return {
      type: 'lead',
      leadNumber,
      command: 'note',
      argument: noteMatch[1].trim(),
    };
  }

  if (lowerCommandText === 'status') {
    return {
      type: 'lead',
      leadNumber,
      command: 'status',
    };
  }

  return {
    type: 'invalid',
    error: `Command not recognized.\n${HELP_TEXT}`,
  };
}
