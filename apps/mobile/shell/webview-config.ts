/**
 * ReachInternational Mobile — WebView Shell Configuration
 * Authoritative URL resolution, origin whitelisting, and user-agent definition.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

// App Version
export const SHELL_VERSION = "1.0.0";
export const SHELL_USER_AGENT_SUFFIX = `ReachInternationalApp/${SHELL_VERSION} (${Platform.OS}; MobileShell)`;

/**
 * Resolves the target Web App URL:
 * 1. Explicit EXPO_PUBLIC_WEB_APP_URL environment variable
 * 2. In development on Android emulator: http://10.0.2.2:3000
 * 3. In development on iOS simulator / Expo Go: http://<LAN_IP>:3000
 * 4. Production fallback: https://www.reachinternational.co.in
 */
export function getWebAppUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  if (__DEV__) {
    // If running via Expo Go / dev client, infer host IP from debuggerHost
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
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

  return "https://www.reachinternational.co.in";
}

/**
 * Whitelist of trusted origins that are permitted to load directly within the WebView.
 * Any navigation request targeting outside this whitelist is diverted to the native system browser.
 */
export const TRUSTED_DOMAINS: string[] = [
  "reachinternational.co.in",
  "www.reachinternational.co.in",
  "localhost",
  "10.0.2.2",
  "127.0.0.1",
  "supabase.co",
];

/**
 * Checks whether a given URL is permitted inside the WebView.
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Allow internal app schemes / about
    if (parsed.protocol === "about:" || parsed.protocol === "blob:") {
      return true;
    }

    // Must be http or https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check trusted domains or local network IP addresses
    return (
      TRUSTED_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      ) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)
    );
  } catch {
    return false;
  }
}
