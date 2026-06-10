import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { normalizeNorthAmericanPhone } from '../lib/phone.js';
import { sendFormSmsNotification } from '../lib/sendFormSms.js';
import {
  createWebsiteContactLead,
  markWebsiteContactNotification,
} from '../lib/websiteContactLead.js';

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSetKRNgTfaF5WI2zMEsjEZ0hipHPEgjCvcgIKbVAYSwYwOK4Q/formResponse';

const FIELDS = {
  service: 'entry.2144809380',
  firstName: 'entry.1977954969',
  lastName: 'entry.1289566118',
  phone: 'entry.153198611',
  email: 'entry.1562851891',
  vehicleMake: 'entry.1548587124',
  vehicleModel: 'entry.1550545176',
  vehicleYear: 'entry.1033767936',
  vehicleColor: 'entry.1297957681',
  preferredDate: 'entry.362240232',
  notes: 'entry.1161262287',
};

const SERVICE_VALUE_MAP = {
  'Interior Detailing': 'Interior Detailing',
  'Exterior Detailing': 'Exterior Detailing',
  'Full Detail': 'Full Detail(Interior and Exterior)',
  'Executive Detail': 'Full Detail(Interior and Exterior)',
  'Recurring Detailing': 'Full Detail(Interior and Exterior)',
  'Protection / Correction': 'New Vehicle Prep',
  'Other / Not Sure': 'Full Detail(Interior and Exterior)',
};

const REQUIRED_FIELDS = [
  FIELDS.service,
  FIELDS.firstName,
  FIELDS.lastName,
  FIELDS.phone,
  FIELDS.email,
  FIELDS.preferredDate,
];
const MAX_NOTIFICATION_LENGTH = 300;

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

function cleanText(value) {
  return String(value || '').trim();
}

function buildGoogleNotes(selectedService, mappedService, currentNotes = '') {
  const trimmedNotes = cleanText(currentNotes);
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
    if (!cleanText(payload[field])) {
      throw new Error('Please fill out the required contact form fields.');
    }
  }

  normalizeNorthAmericanPhone(payload[FIELDS.phone]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(payload[FIELDS.preferredDate]))) {
    throw new Error('Please choose a valid preferred date.');
  }
}

function getSubmission(rawPayload) {
  validatePayload(rawPayload);

  const submittedId = cleanText(rawPayload.submissionId);
  const firstName = cleanText(rawPayload[FIELDS.firstName]);
  const lastName = cleanText(rawPayload[FIELDS.lastName]);
  const service = cleanText(rawPayload[FIELDS.service]);
  const vehicleMake = cleanText(rawPayload[FIELDS.vehicleMake]);
  const vehicleModel = cleanText(rawPayload[FIELDS.vehicleModel]);
  const vehicleYear = cleanText(rawPayload[FIELDS.vehicleYear]);
  const vehicleColor = cleanText(rawPayload[FIELDS.vehicleColor]);
  const preferredDate = cleanText(rawPayload[FIELDS.preferredDate]);
  const notes = cleanText(rawPayload[FIELDS.notes]);
  const phone = cleanText(rawPayload[FIELDS.phone]);
  const email = cleanText(rawPayload[FIELDS.email]);
  const name = `${firstName} ${lastName}`.trim();
  const submissionId =
    submittedId && submittedId.length <= 128
      ? submittedId
      : `contact-${randomUUID()}`;
  const vehicle = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');
  const message = [
    `Service: ${service}`,
    vehicle ? `Vehicle: ${vehicle}` : null,
    vehicleColor ? `Color: ${vehicleColor}` : null,
    `Preferred date: ${preferredDate}`,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    submissionId,
    name,
    phone,
    normalizedPhone: normalizeNorthAmericanPhone(phone),
    email,
    service,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    preferredDate,
    notes,
    message,
    rawPayload,
  };
}

function buildGooglePayload(rawPayload, selectedService) {
  const mappedService = SERVICE_VALUE_MAP[selectedService] || selectedService;
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([key]) => key.startsWith('entry.')),
  );

  payload[FIELDS.service] = mappedService;
  payload[FIELDS.notes] = buildGoogleNotes(
    selectedService,
    mappedService,
    rawPayload[FIELDS.notes],
  );

  return {
    payload,
    mappedService,
  };
}

function toSmsText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 @_$!"#%&'()*+,\-./:;<=>?\n\r]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const text = toSmsText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatPreferredDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function appendOptionalLine(lines, footer, label, value, maxValueLength) {
  if (!value) {
    return;
  }

  const remaining = MAX_NOTIFICATION_LENGTH
    - lines.join('\n').length
    - footer.join('\n').length
    - label.length
    - 3;

  if (remaining < 12) {
    return;
  }

  lines.push(`${label}${truncateText(value, Math.min(maxValueLength, remaining))}`);
}

function buildNotification(submission, savedLead) {
  const vehicle = [
    submission.vehicleYear,
    submission.vehicleMake,
    submission.vehicleModel,
  ]
    .filter(Boolean)
    .join(' ');
  const heading = savedLead
    ? `New detailed lead #${savedLead.leadNumber}`
    : 'New detailed request (CRM save failed)';
  const footer = savedLead
    ? [
        `Text ${savedLead.leadNumber} status for full details.`,
        'Text commands for all options.',
      ]
    : ['The Google Sheet was saved. Add this lead to the CRM manually.'];
  const detailLines = [
    heading,
    `Name: ${truncateText(submission.name, 35)}`,
    `Phone: ${truncateText(submission.phone, 20)}`,
    `Service: ${truncateText(submission.service, 30)}`,
    vehicle ? `Vehicle: ${truncateText(vehicle, 45)}` : null,
    `Preferred: ${formatPreferredDate(submission.preferredDate)}`,
  ].filter(Boolean);

  appendOptionalLine(detailLines, footer, 'Email: ', submission.email, 60);
  appendOptionalLine(detailLines, footer, 'Color: ', submission.vehicleColor, 25);
  appendOptionalLine(detailLines, footer, 'Notes: ', submission.notes, 120);

  return [
    ...detailLines,
    '',
    ...footer,
  ]
    .join('\n');
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  const rawPayload = parseEventBody(event);
  let submission;

  try {
    submission = getSubmission(rawPayload);
  } catch (error) {
    return jsonResponse(400, {
      success: false,
      error: error.message,
    });
  }

  const { payload: googlePayload, mappedService } = buildGooglePayload(
    rawPayload,
    submission.service,
  );

  try {
    const response = await axios.post(
      GOOGLE_FORM_URL,
      new URLSearchParams(googlePayload),
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
        selectedService: submission.service,
        mappedService,
      });

      return jsonResponse(502, {
        success: false,
        error: 'Google Form rejected the request. Please try again or use Chat Now.',
      });
    }

    let savedLead = null;

    try {
      savedLead = await createWebsiteContactLead(submission);
    } catch (error) {
      console.error('Detailed website CRM save failed', {
        submissionId: submission.submissionId,
        error: error.message,
      });
    }

    if (savedLead?.isDuplicate && savedLead.notificationStatus === 'sent') {
      return jsonResponse(200, {
        success: true,
        crmSaved: true,
        leadNumber: savedLead.leadNumber,
        duplicate: true,
        notificationSent: true,
      });
    }

    let notificationResult = {
      sentCount: 0,
      failedCount: 0,
    };

    try {
      notificationResult = await sendFormSmsNotification(
        buildNotification(submission, savedLead),
      );
    } catch (smsError) {
      console.error('SMS notification failed after Google Form success:', smsError);
    }

    if (savedLead) {
      const notificationStatus = notificationResult.sentCount === 0
        ? 'failed'
        : notificationResult.failedCount === 0
          ? 'sent'
          : 'partial';

      try {
        await markWebsiteContactNotification({
          submissionId: submission.submissionId,
          status: notificationStatus,
          ...notificationResult,
        });
      } catch (error) {
        console.error('Unable to record detailed lead notification result', {
          submissionId: submission.submissionId,
          error: error.message,
        });
      }
    }

    return jsonResponse(200, {
      success: true,
      crmSaved: Boolean(savedLead),
      leadNumber: savedLead?.leadNumber,
      duplicate: Boolean(savedLead?.isDuplicate),
      notificationSent: notificationResult.sentCount > 0,
      notificationPartial: notificationResult.failedCount > 0,
    });
  } catch (error) {
    console.error('Contact form submit failed:', error);

    return jsonResponse(500, {
      success: false,
      error: 'Unable to submit the request right now. Please try again or use Chat Now.',
    });
  }
}
