/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    crmUser?: {
      id: string;
      email: string;
    };
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
  readonly CRM_ALLOWED_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
