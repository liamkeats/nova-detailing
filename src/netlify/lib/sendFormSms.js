import twilio from 'twilio';

const DEFAULT_MESSAGE = 'New detailing request submitted! Check your Google Sheet.';
const RECIPIENTS = [
  '+19026700224',
  '+19023001267',
  '+19023850723',
];

export async function sendFormSmsNotification(messageBody = DEFAULT_MESSAGE) {
  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH;
  const fromNumber = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials are missing.');
  }

  const client = twilio(accountSid, authToken);

  await Promise.all(
    RECIPIENTS.map((number) =>
      client.messages.create({
        body: messageBody,
        from: fromNumber,
        to: number,
      }),
    ),
  );
}
