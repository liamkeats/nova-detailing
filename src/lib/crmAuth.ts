import {
  createServerClient,
  type CookieMethodsServer,
} from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { parse } from 'cookie';

function getSupabaseUrl() {
  return (
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  );
}

function getSupabasePublishableKey() {
  return (
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  );
}

export function getAllowedCrmEmails() {
  const configured =
    import.meta.env.CRM_ALLOWED_EMAILS || process.env.CRM_ALLOWED_EMAILS || '';

  return configured
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedCrmEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAllowedCrmEmails().includes(email.trim().toLowerCase());
}

export function createAstroSupabaseClient(
  cookies: AstroCookies,
  request: Request
) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('CRM authentication environment variables are missing.');
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      const requestCookies = parse(request.headers.get('cookie') || '');
      return Object.entries(requestCookies)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([name, value]) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookies.set(name, value, {
          ...options,
          path: options.path || '/',
          secure: import.meta.env.PROD,
        });
      });
    },
  };

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: cookieMethods,
  });
}
