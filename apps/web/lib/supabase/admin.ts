import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseSecretKey } from "@/lib/env";

/**
 * Admin Supabase client using the service role key.
 * Bypasses Row Level Security — use ONLY on the server for
 * privileged operations (cron, queue workers, system tasks).
 * NEVER import this in client components.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}