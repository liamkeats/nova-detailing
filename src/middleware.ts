import { defineMiddleware } from 'astro:middleware';
import {
  createAstroSupabaseClient,
  isAllowedCrmEmail,
} from './lib/crmAuth';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/');

  if (!isCrmRoute) {
    return next();
  }

  let user = null;

  try {
    const supabase = createAstroSupabaseClient(
      context.cookies,
      context.request
    );
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user && isAllowedCrmEmail(data.user.email)) {
      user = data.user;
      context.locals.crmUser = {
        id: user.id,
        email: user.email || '',
      };
    }
  } catch (error) {
    console.error('CRM route authentication failed', {
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (pathname === '/crm/login') {
    if (user) {
      return context.redirect('/crm');
    }

    const response = await next();
    Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => {
      response.headers.set(name, value);
    });
    return response;
  }

  if (!user) {
    return context.redirect('/crm/login');
  }

  const response = await next();
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => {
    response.headers.set(name, value);
  });
  return response;
});
