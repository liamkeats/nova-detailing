import { parseBookingDate } from './appointmentDate.js';

const HELP_TEXT = [
  'Nova CRM Commands:',
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

  if (normalized === 'commands') {
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

  if (normalized === 'today') {
    return {
      type: 'global',
      command: 'today',
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

  if (/^no[\s_-]*reply$/i.test(commandText)) {
    return {
      type: 'lead',
      leadNumber,
      command: 'no_reply',
    };
  }

  if (lowerCommandText === 'paid') {
    return {
      type: 'lead',
      leadNumber,
      command: 'paid',
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
