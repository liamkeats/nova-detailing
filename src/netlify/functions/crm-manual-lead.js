import {
  authorizeCrmRequest,
  crmJsonResponse,
} from '../lib/crmAuth.js';
import {
  getCrmTeamMember,
  isSameOriginCrmRequest,
} from '../lib/crmActions.js';
import { getCrmLeadDetail } from '../lib/crmDashboard.js';
import {
  CrmManualLeadError,
  executeManualLeadCreate,
  recordManualLeadNotification,
  sendManualLeadNotification,
  validateManualLeadPayload,
} from '../lib/crmManualLead.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return crmJsonResponse(405, {
      success: false,
      error: 'Method not allowed.',
    });
  }

  let auth;

  try {
    auth = await authorizeCrmRequest(event);
  } catch (error) {
    console.error('Manual CRM lead authentication failed', {
      error: error.message,
    });
    return crmJsonResponse(500, {
      success: false,
      error: 'CRM authentication is not configured.',
    });
  }

  if (!auth.authorized) {
    return crmJsonResponse(
      401,
      {
        success: false,
        error: 'Authentication required.',
      },
      auth,
    );
  }

  if (!isSameOriginCrmRequest(event)) {
    return crmJsonResponse(
      403,
      {
        success: false,
        error: 'This CRM request was not accepted.',
      },
      auth,
    );
  }

  const contentType = String(
    event.headers?.['content-type'] ||
      event.headers?.['Content-Type'] ||
      '',
  ).toLowerCase();

  if (!contentType.startsWith('application/json')) {
    return crmJsonResponse(
      415,
      {
        success: false,
        error: 'Manual CRM leads require JSON.',
      },
      auth,
    );
  }

  let payload;

  try {
    payload = JSON.parse(event.body || '');
  } catch {
    return crmJsonResponse(
      400,
      {
        success: false,
        error: 'A valid JSON request is required.',
      },
      auth,
    );
  }

  try {
    const manualLead = validateManualLeadPayload(payload);
    const teamMember = await getCrmTeamMember(auth.user);

    if (!teamMember) {
      return crmJsonResponse(
        403,
        {
          success: false,
          error: 'Your CRM account is not mapped to an active team member.',
        },
        auth,
      );
    }

    const result = await executeManualLeadCreate(auth.user, manualLead);
    let notification = {
      status: 'skipped',
      message: result.isDuplicate
        ? 'Duplicate create request; SMS notification was not sent again.'
        : 'SMS notification was not attempted.',
      recipients: [],
    };

    if (!result.isDuplicate) {
      notification = await sendManualLeadNotification({
        actor: teamMember,
        lead: {
          ...manualLead,
          leadNumber: result.leadNumber,
        },
      });

      try {
        await recordManualLeadNotification({
          lead: result,
          actor: teamMember,
          user: auth.user,
          notification,
        });
      } catch (error) {
        console.error('Unable to record manual lead notification', {
          leadNumber: result.leadNumber,
          error: error.message,
        });
        notification = {
          ...notification,
          logError: error.message,
        };
      }
    }

    const lead = await getCrmLeadDetail(result.leadNumber);

    return crmJsonResponse(
      200,
      {
        success: true,
        result: {
          ...result,
          responseText: `Lead #${result.leadNumber} created.`,
        },
        notification,
        lead,
      },
      auth,
    );
  } catch (error) {
    const statusCode =
      error instanceof CrmManualLeadError ? error.statusCode : 500;

    console.error('Manual CRM lead creation failed', {
      userId: auth.user.id,
      userEmail: auth.user.email,
      statusCode,
      error: error.message,
    });

    return crmJsonResponse(
      statusCode,
      {
        success: false,
        error:
          statusCode === 500
            ? 'Unable to create the manual CRM lead.'
            : error.message,
      },
      auth,
    );
  }
}
