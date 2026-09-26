import "server-only";

/**
 * ReachInternational Web — Server-Only Environment Configuration
 * Protected by `import "server-only"`.
 * Any accidental client-side import fails at build time.
 */

export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key?.trim()) throw new Error("[ENV] SUPABASE_SECRET_KEY is not configured.");
  return key.trim();
}

export function getUpstashRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url?.trim() || !token?.trim()) return null;
  return { url: url.trim(), token: token.trim() };
}
