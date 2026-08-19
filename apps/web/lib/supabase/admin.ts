import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the service role key.
 * Bypasses Row Level Security — use ONLY on the server for
 * privileged operations (cron, queue workers, system tasks).
 * NEVER import this in client components.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}