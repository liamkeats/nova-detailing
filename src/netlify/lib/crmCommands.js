import { DateTime } from 'luxon';
import { getSupabaseAdminClient } from './supabase.js';

const CRM_TIME_ZONE = 'America/Halifax';
const MAX_STATUS_TEXT_LENGTH = 260;

function truncateStatusText(value) {
  const text = String(value || '').trim();

  if (text.length <= MAX_STATUS_TEXT_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_STATUS_TEXT_LENGTH - 3)}...`;
}

function formatPreferredDate(value) {
  if (!value) {
    return null;
  }

  const parsed = DateTime.fromISO(value, {
    zone: CRM_TIME_ZONE,
  });

  return parsed.isValid ? parsed.toFormat('ccc, LLL d, yyyy') : value;
}

function getRelatedCustomer(lead) {
  return Array.isArray(lead.customers) ? lead.customers[0] : lead.customers;
}

async function buildDetailedStatusResponse(supabase, leadId, leadNumber) {
  const [
    { data: lead, error: leadError },
    { data: firstMessage, error: messageError },
    { data: latestNote, error: noteError },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(
        [
          'status',
          'source',
          'quote_price',
          'appointment_text',
          'service_requested',
          'vehicle_make',
          'vehicle_model',
          'vehicle_year',
          'vehicle_color',
          'preferred_date',
          'request_notes',
          'customers(name, phone, email)',
        ].join(','),
      )
      .eq('id', leadId)
      .single(),
    supabase
      .from('messages')
      .select('body')
      .eq('lead_id', leadId)
      .eq('direction', 'inbound_website')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lead_updates')
      .select('message')
      .eq('lead_id', leadId)
      .eq('update_type', 'note')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (leadError) {
    throw new Error(`Unable to load lead status: ${leadError.message}`);
  }

  if (messageError) {
    throw new Error(`Unable to load original lead message: ${messageError.message}`);
  }

  if (noteError) {
    throw new Error(`Unable to load latest lead note: ${noteError.message}`);
  }

  const customer = getRelatedCustomer(lead) || {};
  const vehicle = [
    lead.vehicle_year,
    lead.vehicle_make,
    lead.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ');
  const originalRequest = lead.service_requested
    ? null
    : truncateStatusText(firstMessage?.body);

  return [
    `#${leadNumber} ${customer.name || 'Unknown'}`,
    `Status: ${String(lead.status || 'unknown').toUpperCase()}`,
    `Phone: ${customer.phone || 'Unknown'}`,
    customer.email ? `Email: ${customer.email}` : null,
    lead.service_requested ? `Service: ${lead.service_requested}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
    lead.vehicle_color ? `Color: ${lead.vehicle_color}` : null,
    lead.preferred_date
      ? `Preferred: ${formatPreferredDate(lead.preferred_date)}`
      : null,
    lead.quote_price == null ? null : `Quote: $${lead.quote_price}`,
    lead.appointment_text ? `Booking: ${lead.appointment_text}` : null,
    lead.request_notes
      ? `Request notes: ${truncateStatusText(lead.request_notes)}`
      : null,
    originalRequest ? `Request: ${originalRequest}` : null,
    latestNote?.message
      ? `Latest note: ${truncateStatusText(latestNote.message)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function findActiveTeamMember(normalizedPhone) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, normalized_phone')
    .eq('normalized_phone', normalizedPhone)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify team member: ${error.message}`);
  }

  return data;
}

export async function executeLeadCommand({
  accountSid,
  messageSid,
  fromPhone,
  toPhone,
  body,
  rawPayload,
  parsed,
}) {
  const supabase = getSupabaseAdminClient();
  const commandPayload = {
    ...rawPayload,
    ...(parsed.appointmentAt
      ? {
          _crmAppointmentAt: parsed.appointmentAt,
        }
      : {}),
  };
  const { data, error } = await supabase.rpc('execute_lead_sms_command', {
    p_twilio_message_sid: messageSid,
    p_twilio_account_sid: accountSid,
    p_from_phone: fromPhone,
    p_to_phone: toPhone,
    p_body: body,
    p_raw_payload: commandPayload,
    p_lead_number: parsed.leadNumber,
    p_command: parsed.command,
    p_argument: parsed.argument || null,
    p_amount: parsed.amount ?? null,
  });

  if (error) {
    throw new Error(`Unable to execute CRM command: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.response_text) {
    throw new Error('CRM command did not return a confirmation.');
  }

  let responseText = result.response_text;

  if (parsed.command === 'status' && result.lead_id) {
    try {
      responseText = await buildDetailedStatusResponse(
        supabase,
        result.lead_id,
        parsed.leadNumber,
      );

      const { error: responseUpdateError } = await supabase
        .from('sms_command_events')
        .update({
          response_text: responseText,
        })
        .eq('twilio_message_sid', messageSid);

      if (responseUpdateError) {
        console.error('Unable to store detailed status response', {
          messageSid,
          error: responseUpdateError.message,
        });
      }
    } catch (error) {
      console.error('Unable to format detailed lead status', {
        messageSid,
        leadId: result.lead_id,
        error: error.message,
      });
    }
  }

  return {
    leadId: result.lead_id,
    responseText,
    teamUpdateText: result.team_update_text,
    isDuplicate: Boolean(result.is_duplicate),
  };
}

export async function reserveCommandEvent({
  accountSid,
  messageSid,
  teamMemberId,
  fromPhone,
  toPhone,
  body,
  parsedCommand,
  rawPayload,
  status = 'processing',
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('sms_command_events').insert({
    twilio_message_sid: messageSid,
    twilio_account_sid: accountSid,
    team_member_id: teamMemberId || null,
    from_phone: fromPhone,
    to_phone: toPhone,
    body,
    parsed_command: parsedCommand,
    status,
    raw_payload: rawPayload,
  });

  if (!error) {
    return {
      reserved: true,
    };
  }

  if (error.code !== '23505') {
    throw new Error(`Unable to reserve SMS command: ${error.message}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from('sms_command_events')
    .select('response_text, status')
    .eq('twilio_message_sid', messageSid)
    .single();

  if (existingError) {
    throw new Error(`Unable to load duplicate SMS command: ${existingError.message}`);
  }

  return {
    reserved: false,
    responseText: existing.response_text || 'Command is already processing.',
    status: existing.status,
  };
}

export async function completeCommandEvent({
  messageSid,
  responseText,
  status = 'completed',
  error = null,
}) {
  const supabase = getSupabaseAdminClient();
  const { error: updateError } = await supabase
    .from('sms_command_events')
    .update({
      status,
      response_text: responseText,
      error,
    })
    .eq('twilio_message_sid', messageSid);

  if (updateError) {
    throw new Error(`Unable to complete SMS command: ${updateError.message}`);
  }
}

export async function getOpenLeads() {
  const supabase = getSupabaseAdminClient();
  const { data, error, count } = await supabase
    .from('leads')
    .select(
      [
        'lead_number',
        'status',
        'quote_price',
        'appointment_text',
        'service_requested',
        'vehicle_make',
        'vehicle_model',
        'vehicle_year',
        'customers(name)',
      ].join(','),
      { count: 'exact' },
    )
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Unable to load open leads: ${error.message}`);
  }

  return {
    leads: data || [],
    total: count || 0,
  };
}

export async function getOtherActiveTeamMembers(senderId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, normalized_phone')
    .eq('active', true)
    .neq('id', senderId);

  if (error) {
    throw new Error(`Unable to load team notification recipients: ${error.message}`);
  }

  return data || [];
}
