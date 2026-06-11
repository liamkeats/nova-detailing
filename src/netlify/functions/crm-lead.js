import {
  authorizeCrmRequest,
  crmJsonResponse,
} from '../lib/crmAuth.js';
import { getCrmLeadDetail } from '../lib/crmDashboard.js';

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return crmJsonResponse(405, {
      success: false,
      error: 'Method not allowed.',
    });
  }

  let auth;

  try {
    auth = await authorizeCrmRequest(event);
  } catch (error) {
    console.error('CRM lead authentication failed', {
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

  const leadNumber = Number(event.queryStringParameters?.leadNumber);

  if (!Number.isSafeInteger(leadNumber) || leadNumber < 1) {
    return crmJsonResponse(
      400,
      {
        success: false,
        error: 'A valid lead number is required.',
      },
      auth,
    );
  }

  try {
    const includeArchived =
      event.queryStringParameters?.includeArchived === 'true';
    const lead = await getCrmLeadDetail(leadNumber, {
      includeArchived,
    });

    if (!lead) {
      return crmJsonResponse(
        404,
        {
          success: false,
          error: 'Lead not found.',
        },
        auth,
      );
    }

    return crmJsonResponse(
      200,
      {
        success: true,
        lead,
      },
      auth,
    );
  } catch (error) {
    console.error('CRM lead detail failed', {
      userId: auth.user.id,
      leadNumber,
      error: error.message,
    });
    return crmJsonResponse(
      500,
      {
        success: false,
        error: 'Unable to load the lead.',
      },
      auth,
    );
  }
}
