import { DateTime } from 'luxon';
import twilio from 'twilio';
import { normalizeNorthAmericanPhone } from './phone.js';
import { getSupabaseAdminClient } from './supabase.js';

const CRM_TIME_ZONE = 'America/Halifax';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_CREATE_STATUSES = new Set([
  'new',
  'contacted',
  'waiting',
  'quoted',
  'booked',
]);

export class CrmManualLeadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CrmManualLeadError';
    this.statusCode = statusCode;
  }
}

function textValue(value, maxLength, label, { required = false } = {}) {
  const text = String(value || '').trim();

  if (required && !text) {
    throw new CrmManualLeadError(`${label} is required.`);
  }

  if (text.length > maxLength) {
    throw new CrmManualLeadError(
      `${label} must be ${maxLength.toLocaleString('en-CA')} characters or fewer.`,
    );
  }

  return text || null;
}

function parseQuote(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(text)) {
    throw new CrmManualLeadError(
      'Enter a quote between $0.01 and $999,999.99.',
    );
  }

  const amount = Number(text);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
    throw new CrmManualLeadError(
      'Enter a quote between $0.01 and $999,999.99.',
    );
  }

  return amount;
}

function parsePreferredDate(value) {
  const text = String(value || '').trim();

  if (!text) {
    return null;
  }

  const parsed = DateTime.fromISO(text, {
    zone: CRM_TIME_ZONE,
  });

  if (!parsed.isValid) {
    throw new CrmManualLeadError('Choose a valid preferred date.');
  }

  return parsed.toISODate();
}

function parseAppointment(value, nowValue) {
  const text = String(value || '').trim();

  if (!text) {
    return {
      appointmentAt: null,
      appointmentText: null,
    };
  }

  const appointment = DateTime.fromFormat(text, "yyyy-MM-dd'T'HH:mm", {
    zone: CRM_TIME_ZONE,
  });
  const now = DateTime.isDateTime(nowValue)
    ? nowValue.setZone(CRM_TIME_ZONE)
    : DateTime.fromJSDate(nowValue, { zone: CRM_TIME_ZONE });

  if (!appointment.isValid || appointment <= now) {
    throw new CrmManualLeadError(
      'Choose a future appointment date and time.',
    );
  }

  return {
    appointmentAt: appointment.toUTC().toISO(),
    appointmentText: appointment.toFormat("ccc, LLL d, yyyy 'at' h:mm a"),
  };
}

function mapManualLeadRpcError(error) {
  const message = String(error?.message || '');
  const mappings = [
    ['crm_forbidden:', 403],
    ['crm_conflict:', 409],
    ['crm_invalid:', 400],
  ];
  const match = mappings.find(([prefix]) => message.includes(prefix));

  if (match) {
    const [prefix, statusCode] = match;
    return new CrmManualLeadError(
      message.slice(message.indexOf(prefix) + prefix.length).trim(),
      statusCode,
    );
  }

  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new CrmManualLeadError(
      'The manual Add Lead database migration has not been applied.',
      503,
    );
  }

  if (error?.code === '42703' || error?.code === '23514') {
    return new CrmManualLeadError(
      'The manual Add Lead database migration is incomplete.',
      503,
    );
  }

  return new Error(
    `Unable to create manual CRM lead: ${message || 'Unknown error'}`,
  );
}

export function validateManualLeadPayload(
  payload,
  nowValue = DateTime.now().setZone(CRM_TIME_ZONE),
) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CrmManualLeadError('A valid manual lead is required.');
  }

  const requestId = String(payload.requestId || '').trim();

  if (!UUID_PATTERN.test(requestId)) {
    throw new CrmManualLeadError('A valid create request ID is required.');
  }

  const customerName = textValue(payload.customerName, 120, 'Customer name', {
    required: true,
  });
  const phone = textValue(payload.phone, 40, 'Phone number', {
    required: true,
  });
  let normalizedPhone;

  try {
    normalizedPhone = normalizeNorthAmericanPhone(phone);
  } catch (error) {
    throw new CrmManualLeadError(error.message);
  }

  const serviceRequested = textValue(
    payload.serviceRequested,
    500,
    'Service or request details',
    { required: true },
  );
  const vehicleMake = textValue(payload.vehicleMake, 80, 'Vehicle make');
  const vehicleModel = textValue(payload.vehicleModel, 80, 'Vehicle model');
  const vehicleYear = textValue(payload.vehicleYear, 20, 'Vehicle year');
  const vehicleColor = textValue(payload.vehicleColor, 80, 'Vehicle color');
  const locationText = textValue(
    payload.locationText,
    220,
    'Address or location',
  );
  const internalNote = textValue(
    payload.internalNote,
    2000,
    'Internal note',
  );
  const preferredDate = parsePreferredDate(payload.preferredDate);
  const quotePrice = parseQuote(payload.quotePrice);
  const { appointmentAt, appointmentText } = parseAppointment(
    payload.appointmentLocal,
    nowValue,
  );
  const paymentStatus = String(payload.paymentStatus || 'unpaid')
    .trim()
    .toLowerCase();

  if (!['unpaid', 'paid'].includes(paymentStatus)) {
    throw new CrmManualLeadError('Payment status must be unpaid or paid.');
  }

  let status = String(payload.status || 'new').trim().toLowerCase();

  if (!ACTIVE_CREATE_STATUSES.has(status)) {
    throw new CrmManualLeadError(
      'Lead status must be new, contacted, waiting, quoted, or booked.',
    );
  }

  if (appointmentAt) {
    status = 'booked';
  } else if (quotePrice != null && status === 'new') {
    status = 'quoted';
  }

  if (paymentStatus === 'paid') {
    status = 'completed';
  }

  if (status === 'quoted' && quotePrice == null) {
    throw new CrmManualLeadError(
      'Quoted manual leads need a quote amount.',
    );
  }

  if (status === 'booked' && !appointmentAt) {
    throw new CrmManualLeadError(
      'Booked manual leads need an appointment date and time.',
    );
  }

  return {
    requestId,
    customerName,
    phone,
    normalizedPhone,
    serviceRequested,
    status,
    source: 'manual',
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    locationText,
    preferredDate,
    quotePrice,
    appointmentAt,
    appointmentText,
    paymentStatus,
    internalNote,
    rawPayload: {
      customerName,
      phone,
      normalizedPhone,
      serviceRequested,
      status,
      source: 'manual',
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      locationText,
      preferredDate,
      quotePrice,
      appointmentAt,
      appointmentText,
      paymentStatus,
      hasInternalNote: Boolean(internalNote),
    },
  };
}

export async function executeManualLeadCreate(user, lead) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('create_crm_manual_lead', {
    p_auth_user_id: user.id,
    p_auth_email: user.email,
    p_request_id: lead.requestId,
    p_customer_name: lead.customerName,
    p_phone: lead.phone,
    p_normalized_phone: lead.normalizedPhone,
    p_service_requested: lead.serviceRequested,
    p_status: lead.status,
    p_vehicle_make: lead.vehicleMake,
    p_vehicle_model: lead.vehicleModel,
    p_vehicle_year: lead.vehicleYear,
    p_vehicle_color: lead.vehicleColor,
    p_location_text: lead.locationText,
    p_preferred_date: lead.preferredDate,
    p_quote_price: lead.quotePrice,
    p_appointment_at: lead.appointmentAt,
    p_appointment_text: lead.appointmentText,
    p_payment_status: lead.paymentStatus,
    p_internal_note: lead.internalNote,
    p_raw_payload: lead.rawPayload,
  });

  if (error) {
    throw mapManualLeadRpcError(error);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.lead_id || !result?.lead_number) {
    throw new Error('Manual lead creation did not return a lead.');
  }

  return {
    leadId: result.lead_id,
    leadNumber: Number(result.lead_number),
    customerId: result.customer_id,
    createdByTeamMemberId: result.created_by_team_member_id,
    createdByName: result.created_by_name,
    updatedAt: result.updated_at,
    isDuplicate: Boolean(result.is_duplicate),
  };
}

export function formatManualLeadNotification({ actorName, lead }) {
  const pieces = [
    `${actorName} added a new lead: #${lead.leadNumber} ${lead.customerName}`,
    lead.serviceRequested,
    lead.phone,
  ].filter(Boolean);
  const text = pieces.join(' - ');

  return text.length <= 300 ? text : `${text.slice(0, 297)}...`;
}

async function getOtherActiveTeamMembers(teamMemberId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, normalized_phone')
    .eq('active', true)
    .neq('id', teamMemberId);

  if (error) {
    throw new Error(
      `Unable to load manual lead notification recipients: ${error.message}`,
    );
  }

  return data || [];
}

async function sendSmsToRecipients(recipients, body) {
  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_AUTH;
  const fromNumber = process.env.TWILIO_PHONE;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio outbound credentials are missing.');
  }

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

  return results.map((result, index) => ({
    recipientId: recipients[index]?.id,
    recipientName: recipients[index]?.name,
    recipientPhone: recipients[index]?.normalized_phone,
    status: result.status === 'fulfilled' ? 'sent' : 'failed',
    sid: result.status === 'fulfilled' ? result.value?.sid || null : null,
    error:
      result.status === 'rejected'
        ? result.reason?.message || String(result.reason)
        : null,
  }));
}

export async function sendManualLeadNotification({ actor, lead }) {
  const recipients = await getOtherActiveTeamMembers(actor.id);
  const body = formatManualLeadNotification({
    actorName: actor.name,
    lead,
  });

  if (!recipients.length) {
    return {
      status: 'skipped',
      body,
      recipients: [],
      message: 'No other active team member was available for SMS notification.',
    };
  }

  try {
    const deliveries = await sendSmsToRecipients(recipients, body);
    const failedCount = deliveries.filter(
      (delivery) => delivery.status === 'failed',
    ).length;
    const status =
      failedCount === 0
        ? 'sent'
        : failedCount === deliveries.length
          ? 'failed'
          : 'partial';

    return {
      status,
      body,
      recipients: deliveries,
      message:
        status === 'sent'
          ? `SMS notification sent to ${deliveries
              .map((delivery) => delivery.recipientName)
              .filter(Boolean)
              .join(', ')}.`
          : 'Manual lead was created, but one or more SMS notifications failed.',
    };
  } catch (error) {
    return {
      status: 'failed',
      body,
      recipients: recipients.map((recipient) => ({
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientPhone: recipient.normalized_phone,
        status: 'failed',
        sid: null,
        error: error.message,
      })),
      message: 'Manual lead was created, but the SMS notification failed.',
    };
  }
}

export async function recordManualLeadNotification({
  lead,
  actor,
  user,
  notification,
}) {
  const supabase = getSupabaseAdminClient();
  const recipientNames = (notification.recipients || [])
    .map((recipient) => recipient.recipientName)
    .filter(Boolean);
  const message =
    notification.status === 'sent'
      ? `SMS notification sent to ${recipientNames.join(', ')}`
      : notification.status === 'skipped'
        ? notification.message
        : notification.message;

  const { error: updateError } = await supabase.from('lead_updates').insert({
    lead_id: lead.leadId,
    update_type: 'notification',
    message,
    created_by_team_member_id: actor.id,
    raw_command: 'crm_dashboard:manual_lead_notification',
    metadata: {
      action: 'manual_lead_notification',
      status: notification.status,
      body: notification.body,
      recipients: notification.recipients || [],
    },
    action_source: 'crm_dashboard',
    actor_auth_user_id: user.id,
    actor_email: String(user.email || '').toLowerCase(),
  });

  if (updateError) {
    throw new Error(
      `Unable to record manual lead SMS notification: ${updateError.message}`,
    );
  }

  if (notification.status === 'sent' || notification.status === 'partial') {
    const { error: messageError } = await supabase.from('messages').insert({
      lead_id: lead.leadId,
      customer_id: lead.customerId,
      direction: 'outbound_team',
      body: notification.body,
    });

    if (messageError) {
      throw new Error(
        `Unable to record manual lead SMS message: ${messageError.message}`,
      );
    }
  }
}
