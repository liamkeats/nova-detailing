import { randomUUID } from 'node:crypto';
import twilio from 'twilio';
import {
  formatNorthAmericanPhone,
  normalizeNorthAmericanPhone,
} from '../lib/phone.js';
import {
  createWebsiteChatLead,
  markWebsiteChatNotification,
} from '../lib/websiteChatLead.js';

const DEFAULT_RECIPIENTS = ['+19026700224', '+19023001267'];
const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_NOTIFICATION_MESSAGE_LENGTH = 700;

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

function validateSubmission(data) {
  const name = cleanText(data.name);
  const phone = cleanText(data.phone);
  const message = cleanText(data.message);

  if (!name || !phone || !message) {
    throw new Error('Name, phone number, and message are required.');
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw new Error('Name is too long.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Message is too long.');
  }

  const normalizedPhone = normalizeNorthAmericanPhone(phone);
  const submittedId = cleanText(data.submissionId);
  const submissionId =
    submittedId && submittedId.length <= 128 ? submittedId : randomUUID();

  return {
    name,
    phone,
    normalizedPhone,
    message,
    submissionId,
  };
}

function getTeamRecipients() {
  const configuredRecipients = cleanText(process.env.TEAM_NOTIFICATION_NUMBERS)
    .split(',')
    .map((number) => number.trim())
    .filter(Boolean);
  const recipients = configuredRecipients.length ? configuredRecipients : DEFAULT_RECIPIENTS;
  let hasInvalidRecipient = false;
  const normalizedRecipients = recipients.flatMap((number) => {
    try {
      return [normalizeNorthAmericanPhone(number)];
    } catch {
      hasInvalidRecipient = true;
      console.error('Ignoring invalid team notification number.');
      return [];
    }
  });

  if (hasInvalidRecipient) {
    return DEFAULT_RECIPIENTS;
  }

  return [...new Set(normalizedRecipients)];
}

function truncateForNotification(message) {
  if (message.length <= MAX_NOTIFICATION_MESSAGE_LENGTH) {
    return message;
  }

  return `${message.slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH - 3)}...`;
}

function buildSavedLeadNotification({ leadNumber, name, phone, message }) {
  return [
    `New website chat lead #${leadNumber}`,
    `Name: ${name}`,
    `Phone: ${formatNorthAmericanPhone(phone)}`,
    `Message: "${truncateForNotification(message)}"`,
    '',
    'Reply later:',
    `${leadNumber} quote 180`,
    `${leadNumber} book Friday at noon`,
    `${leadNumber} note ...`,
    `${leadNumber} status`,
    `${leadNumber} done`,
    `${leadNumber} cancel`,
  ].join('\n');
}

function buildFallbackNotification({ name, phone, message, submissionId }) {
  return [
    'New website chat lead (CRM save failed)',
    `Name: ${name}`,
    `Phone: ${formatNorthAmericanPhone(phone)}`,
    `Message: "${truncateForNotification(message)}"`,
    '',
    `Submission: ${submissionId}`,
    'Please save this lead manually.',
  ].join('\n');
}

function createTwilioClient() {
  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH;
  const fromNumber = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials are missing.');
  }

  return {
    client: twilio(accountSid, authToken),
    fromNumber,
  };
}

async function sendTeamNotification(body) {
  const recipients = getTeamRecipients();

  if (!recipients.length) {
    throw new Error('No valid team notification numbers are configured.');
  }

  const { client, fromNumber } = createTwilioClient();
  const results = await Promise.allSettled(
    recipients.map((number) =>
      client.messages.create({
        body,
        from: fromNumber,
        to: number,
      }),
    ),
  );
  const sentCount = results.filter((result) => result.status === 'fulfilled').length;
  const failedCount = results.length - sentCount;

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('Team SMS notification failed', {
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

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {
      success: false,
      error: 'Method not allowed.',
    });
  }

  let submission;

  try {
    submission = validateSubmission(parseEventBody(event));
  } catch (error) {
    return jsonResponse(400, {
      success: false,
      error: error.message,
    });
  }

  let savedLead = null;

  try {
    savedLead = await createWebsiteChatLead(submission);
  } catch (error) {
    console.error('Website chat CRM save failed', {
      submissionId: submission.submissionId,
      error: error.message,
    });
  }

  if (
    savedLead?.isDuplicate &&
    savedLead.notificationStatus === 'sent'
  ) {
    return jsonResponse(200, {
      success: true,
      crmSaved: true,
      leadNumber: savedLead.leadNumber,
      duplicate: true,
      notificationSent: true,
    });
  }

  const notificationBody = savedLead
    ? buildSavedLeadNotification({
        ...submission,
        leadNumber: savedLead.leadNumber,
      })
    : buildFallbackNotification(submission);

  let notificationResult;

  try {
    notificationResult = await sendTeamNotification(notificationBody);
  } catch (error) {
    console.error('Website chat team notification failed', {
      submissionId: submission.submissionId,
      error: error.message,
    });

    return jsonResponse(502, {
      success: false,
      crmSaved: Boolean(savedLead),
      leadNumber: savedLead?.leadNumber,
      error: savedLead
        ? 'Your request was saved, but the team notification failed. Please call us if your request is urgent.'
        : 'Unable to send your request right now. Please try again.',
    });
  }

  if (savedLead) {
    const notificationStatus = notificationResult.sentCount === 0
      ? 'failed'
      : notificationResult.failedCount === 0
        ? 'sent'
        : 'partial';

    try {
      await markWebsiteChatNotification({
        submissionId: submission.submissionId,
        status: notificationStatus,
        ...notificationResult,
      });
    } catch (error) {
      console.error('Unable to record website chat notification result', {
        submissionId: submission.submissionId,
        error: error.message,
      });
    }
  }

  if (notificationResult.sentCount === 0) {
    return jsonResponse(502, {
      success: false,
      crmSaved: Boolean(savedLead),
      leadNumber: savedLead?.leadNumber,
      error: 'Unable to notify the Nova Detailing team right now. Please try again.',
    });
  }

  return jsonResponse(200, {
    success: true,
    crmSaved: Boolean(savedLead),
    leadNumber: savedLead?.leadNumber,
    duplicate: Boolean(savedLead?.isDuplicate),
    notificationSent: true,
    notificationPartial: notificationResult.failedCount > 0,
  });
}
