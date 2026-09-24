/**
 * ReachInternational Web — Centralized Environment Configuration
 * Authoritative single source of truth for runtime environment variables.
 * Enforces reading directly from .env without hardcoding URLs or secret keys.
 */

/**
 * Returns the canonical Application URL from NEXT_PUBLIC_APP_URL.
 * Strips any trailing slashes for consistent URL concatenation.
 */
export function getAppUrl(): string {
  // In development, prioritize localhost or active window origin
  if (process.env.NODE_ENV === "development") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin.replace(/\/$/, "");
    }
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl && envUrl.includes("localhost")) {
      return envUrl.trim().replace(/\/$/, "");
    }
    return "http://localhost:3000";
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  // Client-side execution fallback to active window origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  // Strict enforcement: never silently return a hardcoded production domain
  throw new Error(
    "[ENV] Critical configuration error: NEXT_PUBLIC_APP_URL is not defined in environment variables. " +
    "Please set NEXT_PUBLIC_APP_URL in your .env or deployment settings."
  );
}

/**
 * Returns the canonical redirect URL for password reset emails.
 * Routes through the server-side /api/auth/callback endpoint for PKCE code exchange.
 * Accepts an optional origin parameter so requests from localhost generate localhost
 * redirect links, while production requests generate production redirect links.
 */
export function getResetPasswordRedirectUrl(customOrigin?: string): string {
  if (customOrigin && customOrigin.trim().length > 0) {
    return `${customOrigin.trim().replace(/\/$/, "")}/api/auth/callback?next=/reset-password`;
  }

  // Client-side execution: always use the user's active browser origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/api/auth/callback?next=/reset-password`;
  }

  const base = getAppUrl();
  return `${base}/api/auth/callback?next=/reset-password`;
}

/**
 * Returns the Supabase project endpoint URL.
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.trim()) {
    throw new Error(
      "[ENV] Critical configuration error: NEXT_PUBLIC_SUPABASE_URL is not defined in .env."
    );
  }
  return url.trim().replace(/\/$/, "");
}

/**
 * Returns the Supabase publishable anonymous key.
 */
export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "[ENV] Critical configuration error: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not defined in .env."
    );
  }
  return key.trim();
}

/**
 * Returns the Supabase service role / secret key (Server runtime only).
 */
export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "[ENV] Critical configuration error: SUPABASE_SECRET_KEY is not defined on server runtime."
    );
  }
  return key.trim();
}

/**
 * Returns Google Analytics Measurement ID if configured in .env.
 */
export function getGaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return id && id.trim().length > 0 ? id.trim() : undefined;
}

/**
 * Returns Upstash Redis configuration if configured in .env.
 */
export function getUpstashRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.trim(),
    token: token.trim(),
  };
}

/**
 * Typed environment object for direct property access.
 */
export const env = {
  get appUrl(): string {
    return getAppUrl();
  },
  get resetPasswordRedirectUrl(): string {
    return getResetPasswordRedirectUrl();
  },
  get supabaseUrl(): string {
    return getSupabaseUrl();
  },
  get supabasePublishableKey(): string {
    return getSupabasePublishableKey();
  },
  get supabaseSecretKey(): string {
    return getSupabaseSecretKey();
  },
  get gaMeasurementId(): string | undefined {
    return getGaMeasurementId();
  },
  get upstash() {
    return getUpstashRedisConfig();
  },
} as const;



