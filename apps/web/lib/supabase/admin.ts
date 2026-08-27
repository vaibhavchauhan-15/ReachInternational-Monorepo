import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the service role key.
 * Bypasses Row Level Security — use ONLY on the server for
 * privileged operations (cron, queue workers, system tasks).
 * NEVER import this in client components.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL on server runtime.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}