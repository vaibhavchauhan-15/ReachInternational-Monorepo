/**
 * ReachInternational Mobile â€” Centralized Environment Configuration
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
/**
 * Returns the Agentation MCP / sync server endpoint URL.
 * Defaults to http://localhost:4747.
 */
export function getAgentationEndpoint(): string {
  return process.env.EXPO_PUBLIC_AGENTATION_ENDPOINT?.trim() || "http://localhost:4747";
}

export function isAgentationEnabled(): boolean {
  if (Platform.OS !== "web") return false;
  if (process.env.EXPO_PUBLIC_ENABLE_AGENTATION === "false") return false;
  const isDev = __DEV__ || process.env.NODE_ENV === "development";
  const isExplicit = process.env.EXPO_PUBLIC_ENABLE_AGENTATION === "true";
  return isDev || isExplicit;
}

/**
 * Returns the canonical Web Application URL from EXPO_PUBLIC_APP_URL or EXPO_PUBLIC_WEB_APP_URL.
 *
 * Dev-device safety rule:
 * When running on a real device or Expo Go, `localhost` in the env file resolves to the
 * device itself — not the developer's machine. We detect this and fall back to the Expo
 * Metro bundler's LAN host IP (from Constants.expoConfig.hostUri) so API calls reach the
 * Next.js dev server on the host machine over the local network automatically.
 */
export function getAppUrl(): string {
  const envUrl = (
    process.env.EXPO_PUBLIC_APP_URL ||
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).trim().replace(/\/$/, "");

  if (__DEV__) {
    // If the env URL is localhost/127.0.0.1 (meaningless on a physical device),
    // override with the LAN IP that Expo Metro exposes via Constants.
    const isLocalhostUrl =
      !envUrl ||
      envUrl.includes("localhost") ||
      envUrl.includes("127.0.0.1");

    if (isLocalhostUrl) {
      // Expo Go / Dev Client: Metro bundler exposes the host IP here
      const debuggerHost: string | undefined =
        Constants.expoConfig?.hostUri ||
        (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ||
        (Constants as any).manifest?.debuggerHost;

      if (debuggerHost) {
        // debuggerHost is "192.168.x.x:8081" — take the IP, use port 3000
        const hostIp = debuggerHost.split(":")[0];
        if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
          return `http://${hostIp}:3000`;
        }
      }

      // Android emulator: 10.0.2.2 is the special alias for the host loopback
      if (Platform.OS === "android") {
        return "http://10.0.2.2:3000";
      }

      // iOS simulator: host loopback is reachable via localhost
      return "http://localhost:3000";
    }

    // env URL is a real non-localhost address (LAN IP or tunnel) — use it directly
    return envUrl;
  }

  // Production / preview: env URL must be explicitly configured
  if (envUrl) {
    return envUrl;
  }

  throw new Error(
    "[ENV] Critical: EXPO_PUBLIC_APP_URL is not set. Add it to apps/mobile/.env or eas.json build profile."
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
  get agentationEndpoint(): string {
    return getAgentationEndpoint();
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
