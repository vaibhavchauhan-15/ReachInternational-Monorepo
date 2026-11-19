import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "../env/client.ts";
import { getSupabaseSecretKey, hasSupabaseSecretKey } from "../env/server.ts";

/**
 * Admin Supabase client using the service role key.
 * Bypasses Row Level Security — use ONLY on the server for
 * privileged operations (cron, queue workers, system tasks).
 * NEVER import this in client components.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Safe accessor for admin client. Returns null if SUPABASE_SECRET_KEY is missing.
 */
export function tryCreateSupabaseAdminClient(): SupabaseClient | null {
  if (!hasSupabaseSecretKey()) return null;
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}