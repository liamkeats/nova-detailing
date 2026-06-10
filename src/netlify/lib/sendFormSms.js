import twilio from 'twilio';
import { normalizeNorthAmericanPhone } from './phone.js';

const DEFAULT_MESSAGE = 'New detailing request submitted! Check your Google Sheet.';
const DEFAULT_RECIPIENTS = ['+19026700224', '+19023001267'];

function getRecipients() {
  const configured = String(process.env.TEAM_NOTIFICATION_NUMBERS || '')
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean);
  const recipients = configured.length ? configured : DEFAULT_RECIPIENTS;

  try {
    return [...new Set(recipients.map(normalizeNorthAmericanPhone))];
  } catch {
    console.error('Invalid TEAM_NOTIFICATION_NUMBERS value; using the two owners.');
    return DEFAULT_RECIPIENTS;
  }
}

export async function sendFormSmsNotification(messageBody = DEFAULT_MESSAGE) {
  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH;
  const fromNumber = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials are missing.');
  }

  const client = twilio(accountSid, authToken);
  const recipients = getRecipients();
  const results = await Promise.allSettled(
    recipients.map((number) =>
      client.messages.create({
        body: messageBody,
        from: fromNumber,
        to: number,
      }),
    ),
  );
  const sentCount = results.filter((result) => result.status === 'fulfilled').length;
  const failedCount = results.length - sentCount;

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('Detailed form SMS notification failed', {
        recipient: recipients[index],
        error: result.reason?.message || String(result.reason),
      });
    }
  });

  return {
    sentCount,
    failedCount,
  };
}
