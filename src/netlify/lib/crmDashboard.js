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
    archivedAt: lead.archived_at || null,
    archivedByTeamMemberId:
      lead.archived_by_team_member_id || null,
  };
}

function getTimeZoneDateKey(value) {
  const date =
    value && typeof value.toJSDate === 'function'
      ? value.toJSDate()
      : value instanceof Date
        ? value
        : new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CRM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getNextDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return getTimeZoneDateKey(
    new Date(Date.UTC(year, month - 1, day + 1, 12)),
  );
}

export function getAppointmentBuckets(leads, nowValue = new Date()) {
  const todayKey = getTimeZoneDateKey(nowValue);
  const tomorrowKey = getNextDateKey(todayKey);
  const booked = leads
    .filter(
      (lead) =>
        !lead.archivedAt &&
        lead.status === 'booked' &&
        lead.appointmentAt,
    )
    .map((lead) => ({
      lead,
      date: new Date(lead.appointmentAt),
      dateKey: getTimeZoneDateKey(lead.appointmentAt),
    }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  return {
    today: booked
      .filter(({ dateKey }) => dateKey === todayKey)
      .map(({ lead }) => lead),
    upcoming: booked
      .filter(({ dateKey }) => dateKey >= tomorrowKey)
      .slice(0, 12)
      .map(({ lead }) => lead),
  };
}

export function normalizeCrmLeadSummary(lead) {
  const customer = getRelatedRecord(lead.customers) || {};
  const paymentStatus = lead.payment_status || 'unpaid';

  return {
    leadNumber: Number(lead.lead_number),
    status: lead.status,
    statusGroup: getCrmStatusGroup(lead.status, paymentStatus),
    source: lead.source,
    customer: {
      name: customer.name || 'Unknown customer',
      phone: customer.phone || '',
    },
    service: lead.service_requested || '',
    vehicle: [
      lead.vehicle_year,
      lead.vehicle_make,
      lead.vehicle_model,
    ]
      .filter(Boolean)
      .join(' '),
    quotePrice:
      lead.quote_price == null ? null : Number(lead.quote_price),
    paymentStatus,
    appointmentText: lead.appointment_text || '',
    appointmentAt: lead.appointment_at || null,
    createdAt: lead.created_at,
    archivedAt: lead.archived_at || null,
  };
}

export async function getCrmOverview({ includeArchived = false } = {}) {
  const supabase = getSupabaseAdminClient();
  let leadQuery = supabase
    .from('leads')
    .select(
      [
        'lead_number',
        'status',
        'source',
        'quote_price',
        'payment_status',
        'appointment_text',
        'appointment_at',
        'service_requested',
        'vehicle_make',
        'vehicle_model',
        'vehicle_year',
        'created_at',
        'archived_at',
        'customers(name, phone)',
      ].join(','),
    );

  if (!includeArchived) {
    leadQuery = leadQuery.is('archived_at', null);
  }

  leadQuery = leadQuery
    .order('updated_at', { ascending: false })
    .limit(500);

  const { data: rawLeads, error: leadError } = await leadQuery;

  if (leadError) {
    throw new Error(`Unable to load CRM leads: ${leadError.message}`);
  }

  const leads = (rawLeads || []).map(normalizeCrmLeadSummary);
  const appointments = getAppointmentBuckets(leads);

  return {
    leads,
    appointments,
    statusGroups: CRM_STATUS_GROUPS,
    generatedAt: new Date().toISOString(),
  };
}

export async function getCrmLeadDetail(
  leadNumber,
  { includeArchived = false } = {},
) {
  const supabase = getSupabaseAdminClient();
  let leadQuery = supabase
    .from('leads')
    .select(
      [
        'id',
        'lead_number',
        'status',
        'source',
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
        'archived_at',
        'archived_by_team_member_id',
        'customers(name, phone, email)',
      ].join(','),
    )
    .eq('lead_number', leadNumber);

  if (!includeArchived) {
    leadQuery = leadQuery.is('archived_at', null);
  }

  const { data: rawLead, error: leadError } =
    await leadQuery.maybeSingle();

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
        'id, update_type, message, created_by_team_member_id, created_at',
      )
      .eq('lead_id', rawLead.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('sms_command_events')
      .select(
        'id, body, status, response_text, error, team_member_id, created_at',
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
    archivedBy:
      teamNames.get(rawLead.archived_by_team_member_id) || '',
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
  };
}
