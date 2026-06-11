import {
  authorizeCrmRequest,
  crmJsonResponse,
} from '../lib/crmAuth.js';
import { getCrmOverview } from '../lib/crmDashboard.js';

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
    console.error('CRM overview authentication failed', {
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

  try {
    const overview = await getCrmOverview();

    return crmJsonResponse(
      200,
      {
        success: true,
        user: auth.user,
        ...overview,
      },
      auth,
    );
  } catch (error) {
    console.error('CRM overview failed', {
      userId: auth.user.id,
      error: error.message,
    });
    return crmJsonResponse(
      500,
      {
        success: false,
        error: 'Unable to load the CRM dashboard.',
      },
      auth,
    );
  }
}
