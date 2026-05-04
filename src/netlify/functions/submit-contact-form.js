import axios from 'axios';
import { sendFormSmsNotification } from '../lib/sendFormSms.js';

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSetKRNgTfaF5WI2zMEsjEZ0hipHPEgjCvcgIKbVAYSwYwOK4Q/formResponse';

const SERVICE_FIELD = 'entry.2144809380';
const NOTES_FIELD = 'entry.1161262287';

const SERVICE_VALUE_MAP = {
  'Basic Detail': 'Full Detail(Interior and Exterior)',
  'Standard Detail': 'Full Detail(Interior and Exterior)',
  'Premium Detail': 'Full Detail(Interior and Exterior)',
  'Exterior Detailing': 'Exterior Detailing',
  'Paint Correction': 'Scratch Removal',
  'Ceramic Coating / Vehicle Protection': 'New Vehicle Prep',
  'New Vehicle Detailing': 'New Vehicle Prep',
  'Recurring Maintenance': 'Full Detail(Interior and Exterior)',
  'Not Sure Yet': 'Full Detail(Interior and Exterior)',
};

const REQUIRED_FIELDS = [
  SERVICE_FIELD,
  'entry.1977954969',
  'entry.1289566118',
  'entry.153198611',
  'entry.1562851891',
  'entry.362240232',
];

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function parseEventBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function buildNotes(selectedService, mappedService, currentNotes = '') {
  const trimmedNotes = String(currentNotes || '').trim();
  const lines = [`Requested service: ${selectedService}`];

  if (mappedService && mappedService !== selectedService) {
    lines.push(`Google Form category: ${mappedService}`);
  }

  if (trimmedNotes) {
    lines.push('', trimmedNotes);
  }

  return lines.join('\n');
}

function validatePayload(payload) {
  for (const field of REQUIRED_FIELDS) {
    if (!String(payload[field] ?? '').trim()) {
      return false;
    }
  }

  return true;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  const rawPayload = parseEventBody(event);
  const payload = { ...rawPayload };

  if (!validatePayload(payload)) {
    return jsonResponse(400, {
      success: false,
      error: 'Please fill out the required contact form fields.',
    });
  }

  const selectedService = String(payload[SERVICE_FIELD]).trim();
  const mappedService = SERVICE_VALUE_MAP[selectedService] || selectedService;

  payload[SERVICE_FIELD] = mappedService;
  payload[NOTES_FIELD] = buildNotes(selectedService, mappedService, payload[NOTES_FIELD]);

  try {
    const response = await axios.post(
      GOOGLE_FORM_URL,
      new URLSearchParams(payload),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
        validateStatus: () => true,
      },
    );

    if (response.status < 200 || response.status >= 300) {
      console.error('Google Form rejected contact submission', {
        status: response.status,
        selectedService,
        mappedService,
      });

      return jsonResponse(502, {
        success: false,
        error: 'Google Form rejected the request. Please try again or use Chat Now.',
      });
    }

    let notificationSent = true;

    try {
      await sendFormSmsNotification();
    } catch (smsError) {
      notificationSent = false;
      console.error('SMS notification failed after Google Form success:', smsError);
    }

    return jsonResponse(200, {
      success: true,
      notificationSent,
    });
  } catch (error) {
    console.error('Contact form submit failed:', error);

    return jsonResponse(500, {
      success: false,
      error: 'Unable to submit the request right now. Please try again or use Chat Now.',
    });
  }
}
