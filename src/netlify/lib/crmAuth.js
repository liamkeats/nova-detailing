import { createServerClient } from '@supabase/ssr';
import { parse, serialize } from 'cookie';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

function getAllowedEmails() {
  return String(process.env.CRM_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email) {
  return Boolean(email) && getAllowedEmails().includes(email.toLowerCase());
}

function getAuthEnvironment() {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('CRM authentication environment variables are missing.');
  }

  return {
    supabaseUrl,
    supabaseKey,
  };
}

function getCookieHeader(event) {
  const entry = Object.entries(event.headers || {}).find(
    ([name]) => name.toLowerCase() === 'cookie',
  );

  return entry?.[1] || '';
}

export async function authorizeCrmRequest(event) {
  const { supabaseUrl, supabaseKey } = getAuthEnvironment();
  const requestCookies = parse(getCookieHeader(event));
  const responseCookies = [];
  let responseHeaders = { ...NO_STORE_HEADERS };
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Object.entries(requestCookies)
          .filter(([, value]) => value !== undefined)
          .map(([name, value]) => ({
            name,
            value,
          }));
      },
      setAll(cookiesToSet, headers) {
        responseHeaders = {
          ...responseHeaders,
          ...headers,
        };
        cookiesToSet.forEach(({ name, value, options }) => {
          responseCookies.push(
            serialize(name, value, {
              ...options,
              path: options.path || '/',
              secure: process.env.NODE_ENV === 'production',
            }),
          );
        });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user || !isAllowedEmail(user.email)) {
    return {
      authorized: false,
      user: null,
      headers: responseHeaders,
      cookies: responseCookies,
    };
  }

  return {
    authorized: true,
    user: {
      id: user.id,
      email: user.email,
    },
    headers: responseHeaders,
    cookies: responseCookies,
  };
}

export function crmJsonResponse(statusCode, body, auth = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...NO_STORE_HEADERS,
    ...(auth?.headers || {}),
  };

  return {
    statusCode,
    headers,
    ...(auth?.cookies?.length
      ? {
          multiValueHeaders: {
            'Set-Cookie': auth.cookies,
          },
        }
      : {}),
    body: JSON.stringify(body),
  };
}
