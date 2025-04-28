import twilio from 'twilio';

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH;
const fromNumber = process.env.TWILIO_PHONE;

const client = twilio(accountSid, authToken);

export async function handler(event) {
  try {
    const data = JSON.parse(event.body);
    const { name, phone, message } = data;

    const msgBody = `📩 New Website Chat Message\n\nFrom: ${name}\nPhone: ${phone}\n\n"${message}"`;

    const recipients = [
      '+19026700224', // Your number
      '+19023001267',
      '+19023850723', // Coworker's number
    ];

    await Promise.all(
      recipients.map(number =>
        client.messages.create({
          body: msgBody,
          from: fromNumber,
          to: number,
        })
      )
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("SMS Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
}
