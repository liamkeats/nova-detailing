const twilio = require('twilio');

exports.handler = async (event) => {
  try {
    const accountSid = process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_AUTH;
    const fromNumber = process.env.TWILIO_PHONE;

    const client = twilio(accountSid, authToken);

    const msgBody = `🚗 New detailing request submitted! Check your Google Sheet.`; 

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("❌ SMS Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
