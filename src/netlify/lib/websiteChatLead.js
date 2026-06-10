import { getSupabaseAdminClient } from './supabase.js';

export async function createWebsiteChatLead({
  submissionId,
  name,
  phone,
  normalizedPhone,
  message,
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('create_website_chat_lead', {
    p_submission_id: submissionId,
    p_name: name,
    p_phone: phone,
    p_normalized_phone: normalizedPhone,
    p_message: message,
  });

  if (error) {
    throw new Error(`Unable to save website chat lead: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.lead_id || !result?.lead_number) {
    throw new Error('Supabase did not return the saved website chat lead.');
  }

  return {
    customerId: result.customer_id,
    leadId: result.lead_id,
    leadNumber: Number(result.lead_number),
    isDuplicate: Boolean(result.is_duplicate),
    notificationStatus: result.notification_status,
  };
}

export async function markWebsiteChatNotification({
  submissionId,
  status,
  sentCount,
  failedCount,
}) {
  const supabase = getSupabaseAdminClient();
  const update = {
    notification_status: status,
    notification_result: {
      sent_count: sentCount,
      failed_count: failedCount,
    },
    notified_at: sentCount > 0 ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('intake_events')
    .update(update)
    .eq('submission_id', submissionId);

  if (error) {
    throw new Error(`Unable to update notification status: ${error.message}`);
  }
}
