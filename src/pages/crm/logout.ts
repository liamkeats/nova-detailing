import type { APIRoute } from 'astro';
import { createAstroSupabaseClient } from '../../lib/crmAuth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  try {
    const supabase = createAstroSupabaseClient(cookies, request);
    await supabase.auth.signOut();
  } catch (error) {
    console.error('CRM logout failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return redirect('/crm/login');
};
