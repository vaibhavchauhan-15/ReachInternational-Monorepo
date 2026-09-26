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
