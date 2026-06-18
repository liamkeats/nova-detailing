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
  executeManualLeadEdit,
  validateManualLeadEditPayload,
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
    console.error('Manual CRM lead edit authentication failed', {
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
        error: 'Manual CRM lead edits require JSON.',
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
    const edit = validateManualLeadEditPayload(payload);
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

    const result = await executeManualLeadEdit(auth.user, edit);
    const lead = await getCrmLeadDetail(edit.leadNumber);

    return crmJsonResponse(
      200,
      {
        success: true,
        result,
        lead,
      },
      auth,
    );
  } catch (error) {
    const statusCode =
      error instanceof CrmManualLeadError ? error.statusCode : 500;

    console.error('Manual CRM lead edit failed', {
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
            ? 'Unable to edit the manual CRM lead.'
            : error.message,
      },
      auth,
    );
  }
}
