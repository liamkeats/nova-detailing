import { DateTime } from 'luxon';
import { getSupabaseAdminClient } from './supabase.js';

const CRM_TIME_ZONE = 'America/Halifax';
const CRM_ACTIONS = new Set([
  'note',
  'status',
  'quote',
  'book',
  'no_reply',
  'paid',
  'unpaid',
  'done',
  'cancel',
  'archive',
  'restore',
]);
const CRM_STATUSES = new Set([
  'new',
  'contacted',
  'waiting',
  'quoted',
  'booked',
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CrmActionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CrmActionError';
    this.statusCode = statusCode;
  }
}

function requireText(value, message, maxLength) {
  const text = String(value || '').trim();

  if (!text) {
    throw new CrmActionError(message);
  }

  if (text.length > maxLength) {
    throw new CrmActionError(
      `${message.replace(/\.$/, '')} and must be ${maxLength.toLocaleString(
        'en-CA',
      )} characters or fewer.`,
    );
  }

  return text;
}

export function validateCrmActionPayload(
  payload,
  nowValue = DateTime.now().setZone(CRM_TIME_ZONE),
) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CrmActionError('A valid CRM action is required.');
  }

  const leadNumber = Number(payload.leadNumber);
  const action = String(payload.action || '').trim().toLowerCase();
  const requestId = String(payload.requestId || '').trim();
  const expectedUpdatedAtText = String(payload.expectedUpdatedAt || '').trim();
  const expectedUpdatedAt = DateTime.fromISO(expectedUpdatedAtText, {
    setZone: true,
  });

  if (!Number.isSafeInteger(leadNumber) || leadNumber < 1) {
    throw new CrmActionError('A valid lead number is required.');
  }

  if (!CRM_ACTIONS.has(action)) {
    throw new CrmActionError('Select a supported CRM action.');
  }

  if (!UUID_PATTERN.test(requestId)) {
    throw new CrmActionError('A valid action request ID is required.');
  }

  if (!expectedUpdatedAt.isValid) {
    throw new CrmActionError('Refresh the lead before saving this action.');
  }

  const result = {
    leadNumber,
    action,
    requestId,
    // Keep Supabase's microsecond precision for the optimistic-lock check.
    expectedUpdatedAt: expectedUpdatedAtText,
    note: null,
    amount: null,
    status: null,
    appointmentAt: null,
    appointmentText: null,
  };

  if (action === 'note') {
    result.note = requireText(payload.note, 'Note text is required.', 2000);
  }

  if (action === 'status') {
    const status = String(payload.status || '').trim().toLowerCase();

    if (!CRM_STATUSES.has(status)) {
      throw new CrmActionError('Select an allowed lead status.');
    }

    result.status = status;
  }

  if (action === 'quote') {
    const amountText = String(payload.amount ?? '').trim();

    if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amountText)) {
      throw new CrmActionError(
        'Enter a quote between $0.01 and $999,999.99.',
      );
    }

    const amount = Number(amountText);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
      throw new CrmActionError(
        'Enter a quote between $0.01 and $999,999.99.',
      );
    }

    result.amount = amount;
  }

  if (action === 'book') {
    const appointmentLocal = requireText(
      payload.appointmentLocal,
      'Choose an appointment date and time.',
      32,
    );
    const appointment = DateTime.fromFormat(
      appointmentLocal,
      "yyyy-MM-dd'T'HH:mm",
      { zone: CRM_TIME_ZONE },
    );
    const now = DateTime.isDateTime(nowValue)
      ? nowValue.setZone(CRM_TIME_ZONE)
      : DateTime.fromJSDate(nowValue, { zone: CRM_TIME_ZONE });

    if (!appointment.isValid || appointment <= now) {
      throw new CrmActionError(
        'Choose a future appointment date and time.',
      );
    }

    result.appointmentAt = appointment.toUTC().toISO();
    result.appointmentText = appointment.toFormat(
      "ccc, LLL d, yyyy 'at' h:mm a",
    );
  }

  return result;
}

export function isSameOriginCrmRequest(event) {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );
  const origin = headers.origin;
  const host = headers['x-forwarded-host'] || headers.host;
  const protocol = headers['x-forwarded-proto'] || 'https';

  if (!origin || !host) {
    return false;
  }

  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

export async function getCrmTeamMember(user) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, auth_user_id, auth_email')
    .eq('auth_user_id', user.id)
    .eq('auth_email', String(user.email || '').toLowerCase())
    .eq('active', true)
    .maybeSingle();

  if (error) {
    if (error.code === '42703') {
      throw new CrmActionError(
        'Stage 4 V1.1 database migration has not been applied.',
        503,
      );
    }

    throw new Error(`Unable to verify CRM team member: ${error.message}`);
  }

  return data;
}

function mapRpcError(error) {
  const message = String(error?.message || '');
  const mappings = [
    ['crm_forbidden:', 403],
    ['crm_not_found:', 404],
    ['crm_conflict:', 409],
    ['crm_invalid:', 400],
  ];
  const match = mappings.find(([prefix]) => message.includes(prefix));

  if (match) {
    const [prefix, statusCode] = match;
    return new CrmActionError(
      message.slice(message.indexOf(prefix) + prefix.length).trim(),
      statusCode,
    );
  }

  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new CrmActionError(
      'Stage 4 V1.1 database migration has not been applied.',
      503,
    );
  }

  return new Error(`Unable to update CRM lead: ${message || 'Unknown error'}`);
}

export async function executeCrmAction(user, action) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    'apply_crm_dashboard_lead_action',
    {
      p_auth_user_id: user.id,
      p_auth_email: user.email,
      p_lead_number: action.leadNumber,
      p_action: action.action,
      p_request_id: action.requestId,
      p_expected_updated_at: action.expectedUpdatedAt,
      p_note: action.note,
      p_amount: action.amount,
      p_status: action.status,
      p_appointment_at: action.appointmentAt,
      p_appointment_text: action.appointmentText,
    },
  );

  if (error) {
    throw mapRpcError(error);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.lead_id) {
    throw new Error('CRM action did not return an updated lead.');
  }

  return {
    leadId: result.lead_id,
    leadNumber: Number(result.lead_number),
    action: result.action,
    responseText: result.response_text,
    updatedAt: result.updated_at,
    isDuplicate: Boolean(result.is_duplicate),
  };
}
