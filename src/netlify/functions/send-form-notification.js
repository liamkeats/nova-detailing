import { sendFormSmsNotification } from '../lib/sendFormSms.js';

export async function handler(event) {
  try {
    await sendFormSmsNotification();

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
}
