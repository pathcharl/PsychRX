import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "";

declare global {
  // Reuse singletons across HMR reloads in development.
  // eslint-disable-next-line no-var
  var __psychrxSupabase: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __psychrxSupabaseAdmin: SupabaseClient | undefined;
}

/**
 * Browser/client Supabase singleton (anon key).
 * Respects Row Level Security. Safe to import in client components.
 */
export const supabase: SupabaseClient =
  globalThis.__psychrxSupabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__psychrxSupabase = supabase;
}

/**
 * Server-only Supabase singleton (service-role key).
 * Bypasses Row Level Security — NEVER import this in client components.
 * The service key is not exposed to the browser (no NEXT_PUBLIC_ prefix),
 * so this client is non-functional client-side by design.
 */
export const supabaseAdmin: SupabaseClient =
  globalThis.__psychrxSupabaseAdmin ??
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__psychrxSupabaseAdmin = supabaseAdmin;
}

export default supabase;
