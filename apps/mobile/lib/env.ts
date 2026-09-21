/**
 * ReachInternational Mobile — Centralized Environment Configuration
 * Authoritative single source of truth for runtime environment variables in Expo React Native.
 * Enforces reading directly from .env without hardcoding URLs or fallback secrets.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Returns the canonical Web Application URL from EXPO_PUBLIC_APP_URL or EXPO_PUBLIC_WEB_APP_URL.
 */
export function getAppUrl(): string {
  const envUrl =
    process.env.EXPO_PUBLIC_APP_URL ||
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  if (__DEV__) {
    // If running via Expo Go / dev client, infer host IP from debuggerHost
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost;

    if (debuggerHost) {
      const hostIp = debuggerHost.split(":")[0];
      if (hostIp) {
        return `http://${hostIp}:3000`;
      }
    }

    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000";
    }

    return "http://localhost:3000";
  }

  throw new Error(
    "[ENV] Critical configuration error: EXPO_PUBLIC_APP_URL is not defined in mobile .env or eas.json."
  );
}

/**
 * Alias for web app target URL.
 */
export function getWebAppUrl(): string {
  return getAppUrl();
}

/**
 * Returns the redirect URL for password reset emails.
 */
export function getResetPasswordRedirectUrl(): string {
  return `${getAppUrl()}/api/auth/callback?next=/reset-password`;
}

/**
 * Returns the Supabase project endpoint URL.
 */
export function getSupabaseUrl(): string {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !url.trim()) {
    throw new Error(
      "[ENV] Critical configuration error: EXPO_PUBLIC_SUPABASE_URL is not defined in mobile .env."
    );
  }

  return url.trim().replace(/\/$/, "");
}

/**
 * Returns the Supabase publishable anonymous key.
 */
export function getSupabaseAnonKey(): string {
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key || !key.trim()) {
    throw new Error(
      "[ENV] Critical configuration error: EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined in mobile .env."
    );
  }

  return key.trim();
}

/**
 * Typed environment object for mobile client.
 */
export const mobileEnv = {
  get appUrl(): string {
    return getAppUrl();
  },
  get resetPasswordRedirectUrl(): string {
    return getResetPasswordRedirectUrl();
  },
  get webAppUrl(): string {
    return getWebAppUrl();
  },
  get supabaseUrl(): string {
    return getSupabaseUrl();
  },
  get supabaseAnonKey(): string {
    return getSupabaseAnonKey();
  },
} as const;
