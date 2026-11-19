import "server-only";

/**
 * ReachInternational Web — Server-Only Environment Configuration
 * Protected by `import "server-only"`.
 * Any accidental client-side import fails at build time.
 */

export function hasSupabaseSecretKey(): boolean {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key?.trim());
}

export function tryGetSupabaseSecretKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key?.trim() || null;
}

export function getSupabaseSecretKey(): string {
  const key = tryGetSupabaseSecretKey();
  if (!key) throw new Error("[ENV] SUPABASE_SECRET_KEY is not configured.");
  return key;
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

export function getUploadSessionSecret(): string {
  const secret = process.env.UPLOAD_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret?.trim()) throw new Error("[ENV] UPLOAD_SESSION_SECRET or SUPABASE_SECRET_KEY is not configured.");
  return secret.trim();
}

/**
 * Typed server-only environment configuration object
 */
export const serverEnv = {
  get hasSupabaseSecretKey(): boolean {
    return hasSupabaseSecretKey();
  },
  get trySupabaseSecretKey(): string | null {
    return tryGetSupabaseSecretKey();
  },
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
  get uploadSessionSecret(): string {
    return getUploadSessionSecret();
  },
} as const;
