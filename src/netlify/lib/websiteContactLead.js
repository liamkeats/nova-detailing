import { getSupabaseAdminClient } from './supabase.js';

export async function createWebsiteContactLead({
  submissionId,
  name,
  phone,
  normalizedPhone,
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
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('create_website_contact_lead', {
    p_submission_id: submissionId,
    p_name: name,
    p_phone: phone,
    p_normalized_phone: normalizedPhone,
    p_email: email,
    p_service_requested: service,
    p_vehicle_make: vehicleMake || null,
    p_vehicle_model: vehicleModel || null,
    p_vehicle_year: vehicleYear || null,
    p_vehicle_color: vehicleColor || null,
    p_preferred_date: preferredDate,
    p_notes: notes || null,
    p_message: message,
    p_raw_payload: rawPayload,
  });

  if (error) {
    throw new Error(`Unable to save detailed website lead: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.lead_id || !result?.lead_number) {
    throw new Error('Supabase did not return the saved detailed website lead.');
  }

  return {
    customerId: result.customer_id,
    leadId: result.lead_id,
    leadNumber: Number(result.lead_number),
    isDuplicate: Boolean(result.is_duplicate),
    notificationStatus: result.notification_status,
  };
}

export async function markWebsiteContactNotification({
  submissionId,
  status,
  sentCount,
  failedCount,
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('intake_events')
    .update({
      notification_status: status,
      notification_result: {
        sent_count: sentCount,
        failed_count: failedCount,
      },
      notified_at: sentCount > 0 ? new Date().toISOString() : null,
    })
    .eq('submission_id', submissionId);

  if (error) {
    throw new Error(`Unable to update detailed lead notification: ${error.message}`);
  }
}
