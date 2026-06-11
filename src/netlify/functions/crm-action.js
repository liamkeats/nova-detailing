import {
  authorizeCrmRequest,
  crmJsonResponse,
} from '../lib/crmAuth.js';
import {
  CrmActionError,
  executeCrmAction,
  getCrmTeamMember,
  isSameOriginCrmRequest,
  validateCrmActionPayload,
} from '../lib/crmActions.js';
import { getCrmLeadDetail } from '../lib/crmDashboard.js';

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
    console.error('CRM action authentication failed', {
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
        error: 'CRM actions require JSON.',
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
    const action = validateCrmActionPayload(payload);
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

    const result = await executeCrmAction(auth.user, action);
    const lead =
      action.action === 'archive'
        ? null
        : await getCrmLeadDetail(action.leadNumber);

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
      error instanceof CrmActionError ? error.statusCode : 500;

    console.error('CRM action failed', {
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
            ? 'Unable to update the CRM lead.'
            : error.message,
      },
      auth,
    );
  }
}
