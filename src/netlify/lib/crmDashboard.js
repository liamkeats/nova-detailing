import { DateTime } from 'luxon';
import { getSupabaseAdminClient } from './supabase.js';

const CRM_TIME_ZONE = 'America/Halifax';

export const CRM_STATUS_GROUPS = [
  {
    id: 'new',
    label: 'New',
    statuses: ['new'],
  },
  {
    id: 'contacted',
    label: 'Contacted / Waiting',
    statuses: ['claimed', 'contacted', 'waiting'],
  },
  {
    id: 'quoted',
    label: 'Quoted',
    statuses: ['quoted'],
  },
  {
    id: 'booked',
    label: 'Booked',
    statuses: ['booked'],
  },
  {
    id: 'completed_unpaid',
    label: 'Completed - Unpaid',
    statuses: ['completed'],
    paymentStatuses: ['unpaid'],
  },
  {
    id: 'completed_paid',
    label: 'Completed - Paid',
    statuses: ['completed'],
    paymentStatuses: ['paid'],
  },
  {
    id: 'no_reply',
    label: 'No Reply',
    statuses: ['no_reply'],
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    statuses: ['cancelled'],
  },
];

function getRelatedRecord(value) {
  return Array.isArray(value) ? value[0] : value;
}

function truncate(value, maxLength = 180) {
  const text = String(value || '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

export function getCrmStatusGroup(status, paymentStatus = 'unpaid') {
  return (
    CRM_STATUS_GROUPS.find(
      (group) =>
        group.statuses.includes(status) &&
        (!group.paymentStatuses ||
          group.paymentStatuses.includes(paymentStatus)),
    )?.id ||
    'new'
  );
}

export function normalizeCrmLead(lead, activity = {}) {
  const customer = getRelatedRecord(lead.customers) || {};
  const vehicle = [
    lead.vehicle_year,
    lead.vehicle_make,
    lead.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ');
  const latestActivity =
    activity.latestNote ||
    lead.request_notes ||
    activity.originalMessage ||
    '';
  const paymentStatus = lead.payment_status || 'unpaid';

  return {
    id: lead.id,
    leadNumber: Number(lead.lead_number),
    status: lead.status,
    statusGroup: getCrmStatusGroup(lead.status, paymentStatus),
    source: lead.source,
    leadType: lead.lead_type,
    customer: {
      name: customer.name || 'Unknown customer',
      phone: customer.phone || '',
      email: customer.email || '',
    },
    service: lead.service_requested || '',
    vehicle,
    vehicleColor: lead.vehicle_color || '',
    quotePrice:
      lead.quote_price == null ? null : Number(lead.quote_price),
    paymentStatus,
    paidAt: lead.paid_at || null,
    appointmentText: lead.appointment_text || '',
    appointmentAt: lead.appointment_at || null,
    preferredDate: lead.preferred_date || null,
    requestNotes: lead.request_notes || '',
    latestActivity: truncate(latestActivity),
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    completedAt: lead.completed_at || null,
  };
}

export function getAppointmentBuckets(
  leads,
  nowValue = DateTime.now(),
) {
  const now = DateTime.isDateTime(nowValue)
    ? nowValue.setZone(CRM_TIME_ZONE)
    : DateTime.fromJSDate(nowValue, { zone: CRM_TIME_ZONE });
  const todayStart = now.startOf('day');
  const tomorrowStart = todayStart.plus({ days: 1 });
  const booked = leads
    .filter((lead) => lead.status === 'booked' && lead.appointmentAt)
    .map((lead) => ({
      lead,
      date: DateTime.fromISO(lead.appointmentAt, {
        zone: CRM_TIME_ZONE,
      }),
    }))
    .filter(({ date }) => date.isValid)
    .sort((left, right) => left.date.toMillis() - right.date.toMillis());

  return {
    today: booked
      .filter(
        ({ date }) => date >= todayStart && date < tomorrowStart,
      )
      .map(({ lead }) => lead),
    upcoming: booked
      .filter(({ date }) => date >= tomorrowStart)
      .slice(0, 12)
      .map(({ lead }) => lead),
  };
}

function indexLatestActivity(rows, predicate = () => true) {
  const result = new Map();

  (rows || []).forEach((row) => {
    if (!result.has(row.lead_id) && predicate(row)) {
      result.set(row.lead_id, row);
    }
  });

  return result;
}

export async function getCrmOverview() {
  const supabase = getSupabaseAdminClient();
  const [
    { data: rawLeads, error: leadError },
    { data: rawMessages, error: messageError },
    { data: rawUpdates, error: updateError },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select(
        [
          'id',
          'lead_number',
          'status',
          'source',
          'lead_type',
          'quote_price',
          'payment_status',
          'paid_at',
          'appointment_text',
          'appointment_at',
          'service_requested',
          'vehicle_make',
          'vehicle_model',
          'vehicle_year',
          'vehicle_color',
          'preferred_date',
          'request_notes',
          'created_at',
          'updated_at',
          'completed_at',
          'customers(name, phone, email)',
        ].join(','),
      )
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('messages')
      .select('lead_id, direction, body, created_at')
      .eq('direction', 'inbound_website')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('lead_updates')
      .select('lead_id, update_type, message, created_at')
      .eq('update_type', 'note')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  if (leadError) {
    throw new Error(`Unable to load CRM leads: ${leadError.message}`);
  }

  if (messageError) {
    throw new Error(`Unable to load CRM messages: ${messageError.message}`);
  }

  if (updateError) {
    throw new Error(`Unable to load CRM notes: ${updateError.message}`);
  }

  const originalMessages = indexLatestActivity(rawMessages);
  const latestNotes = indexLatestActivity(rawUpdates);
  const leads = (rawLeads || []).map((lead) =>
    normalizeCrmLead(lead, {
      originalMessage: originalMessages.get(lead.id)?.body,
      latestNote: latestNotes.get(lead.id)?.message,
    }),
  );
  const appointments = getAppointmentBuckets(leads);

  return {
    leads,
    appointments,
    statusGroups: CRM_STATUS_GROUPS,
    generatedAt: new Date().toISOString(),
  };
}

export async function getCrmLeadDetail(leadNumber) {
  const supabase = getSupabaseAdminClient();
  const { data: rawLead, error: leadError } = await supabase
    .from('leads')
    .select(
      [
        'id',
        'lead_number',
        'status',
        'source',
        'lead_type',
        'quote_price',
        'payment_status',
        'paid_at',
        'appointment_text',
        'appointment_at',
        'service_requested',
        'vehicle_make',
        'vehicle_model',
        'vehicle_year',
        'vehicle_color',
        'preferred_date',
        'request_notes',
        'created_at',
        'updated_at',
        'completed_at',
        'customers(name, phone, email, created_at, updated_at)',
      ].join(','),
    )
    .eq('lead_number', leadNumber)
    .maybeSingle();

  if (leadError) {
    throw new Error(`Unable to load CRM lead: ${leadError.message}`);
  }

  if (!rawLead) {
    return null;
  }

  const [
    { data: messages, error: messageError },
    { data: updates, error: updateError },
    { data: commandEvents, error: commandError },
    { data: intakeEvents, error: intakeError },
    { data: teamMembers, error: teamError },
  ] = await Promise.all([
    supabase
      .from('messages')
      .select('id, direction, body, created_at')
      .eq('lead_id', rawLead.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('lead_updates')
      .select(
        'id, update_type, message, metadata, created_by_team_member_id, created_at',
      )
      .eq('lead_id', rawLead.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('sms_command_events')
      .select(
        'id, body, parsed_command, status, response_text, error, team_member_id, created_at',
      )
      .eq('lead_id', rawLead.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('intake_events')
      .select(
        'id, provider, status, notification_status, notified_at, created_at, updated_at',
      )
      .eq('lead_id', rawLead.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('team_members')
      .select('id, name')
      .eq('active', true),
  ]);

  for (const [label, error] of [
    ['messages', messageError],
    ['history', updateError],
    ['commands', commandError],
    ['intake events', intakeError],
    ['team members', teamError],
  ]) {
    if (error) {
      throw new Error(`Unable to load CRM ${label}: ${error.message}`);
    }
  }

  const teamNames = new Map(
    (teamMembers || []).map((member) => [member.id, member.name]),
  );
  const lead = normalizeCrmLead(rawLead);

  return {
    ...lead,
    customer: {
      ...lead.customer,
      createdAt: getRelatedRecord(rawLead.customers)?.created_at || null,
      updatedAt: getRelatedRecord(rawLead.customers)?.updated_at || null,
    },
    originalRequest:
      (messages || []).find(
        (message) => message.direction === 'inbound_website',
      )?.body || '',
    messages: messages || [],
    history: (updates || []).map((update) => ({
      ...update,
      createdBy:
        teamNames.get(update.created_by_team_member_id) || 'System',
    })),
    commandEvents: (commandEvents || []).map((event) => ({
      ...event,
      teamMember: teamNames.get(event.team_member_id) || 'Unknown',
    })),
    intakeEvents: intakeEvents || [],
  };
}
