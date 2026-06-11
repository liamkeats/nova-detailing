import twilio from 'twilio';
import { getCommandHelp, parseSmsCommand } from '../lib/commandParser.js';
import {
  completeCommandEvent,
  executeLeadCommand,
  findActiveTeamMember,
  formatTodayJobs,
  getOpenLeads,
  getOtherActiveTeamMembers,
  getTodayJobs,
  reserveCommandEvent,
} from '../lib/crmCommands.js';
import { normalizeNorthAmericanPhone } from '../lib/phone.js';

const CONTENT_TYPE_XML = 'text/xml; charset=utf-8';
const MAX_COMMAND_LENGTH = 1000;

function xmlResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': CONTENT_TYPE_XML,
    },
    body,
  };
}

function twimlMessage(message) {
  const response = new twilio.twiml.MessagingResponse();

  if (message) {
    response.message(message);
  }

  return response.toString();
}

function parseFormBody(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';

  return Object.fromEntries(new URLSearchParams(body).entries());
}

function getHeader(event, name) {
  const target = name.toLowerCase();
  const entry = Object.entries(event.headers || {}).find(
    ([key]) => key.toLowerCase() === target,
  );

  return entry?.[1] || '';
}

function getWebhookUrl(event) {
  if (process.env.TWILIO_INBOUND_WEBHOOK_URL) {
    return process.env.TWILIO_INBOUND_WEBHOOK_URL;
  }

  if (event.rawUrl) {
    return event.rawUrl;
  }

  const host = getHeader(event, 'host');
  const path = event.rawPath || event.path || '/.netlify/functions/twilio-inbound';

  return host ? `https://${host}${path}` : '';
}

function validateTwilioWebhook(event, payload) {
  const authToken = process.env.TWILIO_AUTH;
  const signature = getHeader(event, 'x-twilio-signature');
  const webhookUrl = getWebhookUrl(event);

  if (!authToken || !signature || !webhookUrl) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, webhookUrl, payload);
}

function formatOpenLeads({ leads, total }) {
  if (!leads.length) {
    return 'No open leads.';
  }

  const lines = leads.map((lead) => {
    const customer = lead.customers?.name || 'Unknown';
    const vehicle = [
      lead.vehicle_year,
      lead.vehicle_make,
      lead.vehicle_model,
    ]
      .filter(Boolean)
      .join(' ');
    const extras = [
      lead.service_requested || null,
      vehicle || null,
      lead.quote_price == null ? null : `$${lead.quote_price}`,
      lead.payment_status === 'paid' ? 'PAID' : null,
      lead.appointment_text || null,
    ].filter(Boolean);

    return `#${lead.lead_number} ${customer} - ${lead.status.toUpperCase()}${
      extras.length ? ` - ${extras.join(' - ')}` : ''
    }`;
  });

  if (total > leads.length) {
    lines.push(`Showing ${leads.length} of ${total} open leads.`);
  }

  return lines.join('\n');
}

async function notifyOtherTeamMembers(senderId, body) {
  if (!body) {
    return;
  }

  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH;
  const fromNumber = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio outbound credentials are missing.');
  }

  const recipients = await getOtherActiveTeamMembers(senderId);
  const client = twilio(accountSid, authToken);
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      client.messages.create({
        body,
        from: fromNumber,
        to: recipient.normalized_phone,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error('CRM team update SMS failed', {
        recipient: recipients[index]?.normalized_phone,
        error: result.reason?.message || String(result.reason),
      });
    }
  });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return xmlResponse(twimlMessage(), 405);
  }

  const payload = parseFormBody(event);

  if (!validateTwilioWebhook(event, payload)) {
    console.error('Rejected invalid Twilio webhook signature.');
    return xmlResponse(twimlMessage(), 403);
  }

  const accountSid = String(payload.AccountSid || '').trim();
  const messageSid = String(payload.MessageSid || '').trim();
  const body = String(payload.Body || '').trim();
  let fromPhone;
  let toPhone;

  try {
    fromPhone = normalizeNorthAmericanPhone(payload.From);
    toPhone = normalizeNorthAmericanPhone(payload.To);
  } catch {
    return xmlResponse(twimlMessage());
  }

  const expectedAccountSid = String(process.env.TWILIO_SID || '').trim();
  let expectedToPhone;

  try {
    expectedToPhone = normalizeNorthAmericanPhone(process.env.TWILIO_PHONE);
  } catch {
    console.error('Twilio inbound environment variables are missing.');
    return xmlResponse(twimlMessage(), 500);
  }

  if (
    !messageSid ||
    accountSid !== expectedAccountSid ||
    toPhone !== expectedToPhone ||
    body.length > MAX_COMMAND_LENGTH
  ) {
    console.error('Rejected invalid Twilio command payload.');
    return xmlResponse(twimlMessage());
  }

  let teamMember;

  try {
    teamMember = await findActiveTeamMember(fromPhone);
  } catch (error) {
    console.error('Unable to authorize Twilio command sender', {
      messageSid,
      error: error.message,
    });
    return xmlResponse(twimlMessage('Nova CRM is temporarily unavailable.'));
  }

  if (!teamMember) {
    try {
      await reserveCommandEvent({
        accountSid,
        messageSid,
        teamMemberId: null,
        fromPhone,
        toPhone,
        body,
        parsedCommand: 'unauthorized',
        rawPayload: payload,
        status: 'rejected',
      });
    } catch (error) {
      console.error('Unable to record rejected Twilio command', {
        messageSid,
        error: error.message,
      });
    }

    return xmlResponse(twimlMessage());
  }

  const parsed = parseSmsCommand(body);

  if (parsed.type === 'lead') {
    try {
      const result = await executeLeadCommand({
        accountSid,
        messageSid,
        fromPhone,
        toPhone,
        body,
        rawPayload: payload,
        parsed,
      });

      if (!result.isDuplicate && result.teamUpdateText) {
        try {
          await notifyOtherTeamMembers(teamMember.id, result.teamUpdateText);
        } catch (error) {
          console.error('Unable to notify other CRM team members', {
            messageSid,
            error: error.message,
          });
        }
      }

      return xmlResponse(twimlMessage(result.responseText));
    } catch (error) {
      console.error('CRM lead command failed', {
        messageSid,
        error: error.message,
      });
      return xmlResponse(twimlMessage('CRM command failed. Please try again.'));
    }
  }

  let reservation;

  try {
    reservation = await reserveCommandEvent({
      accountSid,
      messageSid,
      teamMemberId: teamMember.id,
      fromPhone,
      toPhone,
      body,
      parsedCommand: parsed.command || 'invalid',
      rawPayload: payload,
    });
  } catch (error) {
    console.error('Unable to reserve global CRM command', {
      messageSid,
      error: error.message,
    });
    return xmlResponse(twimlMessage('CRM command failed. Please try again.'));
  }

  if (!reservation.reserved) {
    return xmlResponse(twimlMessage(reservation.responseText));
  }

  let responseText;

  try {
    if (parsed.type === 'invalid') {
      responseText = parsed.error;
    } else if (parsed.command === 'commands') {
      responseText = getCommandHelp();
    } else if (parsed.command === 'open') {
      responseText = formatOpenLeads(await getOpenLeads());
    } else if (parsed.command === 'today') {
      responseText = formatTodayJobs(await getTodayJobs());
    } else {
      responseText = getCommandHelp();
    }

    await completeCommandEvent({
      messageSid,
      responseText,
    });
  } catch (error) {
    console.error('Global CRM command failed', {
      messageSid,
      error: error.message,
    });

    responseText = 'CRM command failed. Please try again.';

    try {
      await completeCommandEvent({
        messageSid,
        responseText,
        status: 'failed',
        error: error.message,
      });
    } catch (updateError) {
      console.error('Unable to record failed global CRM command', {
        messageSid,
        error: updateError.message,
      });
    }
  }

  return xmlResponse(twimlMessage(responseText));
}
