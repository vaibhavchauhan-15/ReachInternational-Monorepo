/**
 * ReachInternational Web — Client-Safe Environment Configuration
 * Safe for use in ANY component, browser or server.
 * Contains only public variables and browser origin resolvers.
 */

export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url?.trim()) {
    throw new Error("[ENV] NEXT_PUBLIC_APP_URL is not configured.");
  }
  return url.trim().replace(/\/$/, "");
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url?.trim()) throw new Error("[ENV] NEXT_PUBLIC_SUPABASE_URL is not configured.");
  return url.trim().replace(/\/$/, "");
}

export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key?.trim()) throw new Error("[ENV] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.");
  return key.trim();
}

export function getGaMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || undefined;
}

export function hasSupabaseUrl(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
}

export function hasSupabaseConfig(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim())
  );
}

export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "2026.08.27.01";
}

export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function isAgentationEnabled(): boolean {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_AGENTATION !== "true") {
    return false;
  }
  return process.env.NEXT_PUBLIC_ENABLE_AGENTATION === "true" || process.env.NODE_ENV === "development";
}

/**
 * Returns the canonical redirect URL for password reset emails.
 * Routes through the server-side /api/auth/callback endpoint for PKCE code exchange.
 * Uses request-aware origin or active browser origin, falling back to getAppUrl().
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
 * Typed client environment access object
 */
export const clientEnv = {
  get appUrl(): string {
    return getAppUrl();
  },
  get supabaseUrl(): string {
    return getSupabaseUrl();
  },
  get supabasePublishableKey(): string {
    return getSupabasePublishableKey();
  },
  get hasSupabaseUrl(): boolean {
    return hasSupabaseUrl();
  },
  get hasSupabaseConfig(): boolean {
    return hasSupabaseConfig();
  },
  get gaMeasurementId(): string | undefined {
    return getGaMeasurementId();
  },
  get appVersion(): string {
    return getAppVersion();
  },
  get sentryDsn(): string | undefined {
    return getSentryDsn();
  },
  get isAgentationEnabled(): boolean {
    return isAgentationEnabled();
  },
  get resetPasswordRedirectUrl(): string {
    return getResetPasswordRedirectUrl();
  },
} as const;
