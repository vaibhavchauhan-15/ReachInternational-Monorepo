/**
 * ReachInternational Mobile — Centralized Environment Configuration
 * Authoritative single source of truth for runtime environment variables in Expo React Native.
 * Enforces reading directly from EXPO_PUBLIC_* without hardcoding URLs or fallback secrets.
 *
 * NOTE ON MOBILE SECURITY:
 * All variables accessible in the mobile client bundle (prefixed with EXPO_PUBLIC_)
 * are embedded into the client application binary (APK/AAB/IPA) and are readable by users.
 * NO privileged server secrets (service-role keys, private API secrets) must EVER be
 * included in mobile configuration.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

export type AppEnvironment = "development" | "preview" | "production";
export type ShellMode = "native" | "webview";

/**
 * Returns the active runtime environment (development, preview, production).
 */
export function getAppEnv(): AppEnvironment {
  const env: string | undefined = process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV;
  if (env === "production") return "production";
  if (env === "preview" || env === "staging") return "preview";
  return "development";
}

/**
 * Returns the mobile shell mode: 'native' (default) or 'webview'.
 */
export function getShellMode(): ShellMode {
  return process.env.EXPO_PUBLIC_SHELL_MODE === "webview" ? "webview" : "native";
}

/**
 * Returns the deep-link URL scheme (default: reachinternational).
 */
export function getDeepLinkScheme(): string {
  return process.env.EXPO_PUBLIC_SCHEME?.trim() || "reachinternational";
}

/**
 * Returns the Sentry DSN if configured.
 */
export function getSentryDsn(): string | undefined {
  return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

/**
 * Returns whether Agentation visual feedback toolbar is enabled.
 */
export function isAgentationEnabled(): boolean {
  if (Platform.OS !== "web") return false;
  if (process.env.EXPO_PUBLIC_ENABLE_AGENTATION === "false") return false;
  const isDev = __DEV__ || process.env.NODE_ENV === "development";
  const isExplicit = process.env.EXPO_PUBLIC_ENABLE_AGENTATION === "true";
  return isDev || isExplicit;
}

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
      "[ENV] Critical configuration error: EXPO_PUBLIC_SUPABASE_URL is not defined in mobile .env or build profile."
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
      "[ENV] Critical configuration error: EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined in mobile .env or build profile."
    );
  }

  return key.trim();
}

/**
 * Typed environment object for mobile client.
 */
export const mobileEnv = {
  get appEnv(): AppEnvironment {
    return getAppEnv();
  },
  get isProduction(): boolean {
    return getAppEnv() === "production";
  },
  get isDevelopment(): boolean {
    return getAppEnv() === "development";
  },
  get shellMode(): ShellMode {
    return getShellMode();
  },
  get scheme(): string {
    return getDeepLinkScheme();
  },
  get sentryDsn(): string | undefined {
    return getSentryDsn();
  },
  get isAgentationEnabled(): boolean {
    return isAgentationEnabled();
  },
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
