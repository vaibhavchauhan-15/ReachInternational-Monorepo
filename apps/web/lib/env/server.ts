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

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim() || undefined;
}

export function getInternalAuthSecret(): string | undefined {
  return process.env.INTERNAL_AUTH_SECRET?.trim() || undefined;
}

/**
 * Typed server-only environment configuration object
 */
export const serverEnv = {
  get supabaseSecretKey(): string {
    return getSupabaseSecretKey();
  },
  get upstashRedis(): { url: string; token: string } | null {
    return getUpstashRedisConfig();
  },
  get cronSecret(): string | undefined {
    return getCronSecret();
  },
  get internalAuthSecret(): string | undefined {
    return getInternalAuthSecret();
  },
} as const;
