/**
 * ReachInternational Mobile — WebView Shell Configuration
 * Authoritative URL resolution, origin whitelisting, and user-agent definition.
 * Eliminates hardcoded URLs in favor of dynamic environment loading.
 */

import { Platform } from "react-native";
import { getAppUrl, getSupabaseUrl } from "../lib/env";

// App Version
export const SHELL_VERSION = "1.0.0";
export const SHELL_USER_AGENT_SUFFIX = `ReachInternationalApp/${SHELL_VERSION} (${Platform.OS}; MobileShell)`;

/**
 * Resolves the target Web App URL using the centralized environment module.
 */
export function getWebAppUrl(): string {
  return getAppUrl();
}

/**
 * Safely extracts hostname from a full URL string.
 */
function getHostname(urlStr: string): string | null {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Dynamically resolves whitelist of trusted domains from environment configuration.
 */
export function getTrustedDomains(): string[] {
  const domains = [
    "reachinternational.co.in",
    "www.reachinternational.co.in",
    "localhost",
    "10.0.2.2",
    "127.0.0.1",
  ];

  try {
    const supabaseHost = getHostname(getSupabaseUrl());
    if (supabaseHost && !domains.includes(supabaseHost)) {
      domains.push(supabaseHost);
    }
  } catch {
    // env not initialized in isolated test
  }

  try {
    const appHost = getHostname(getAppUrl());
    if (appHost && !domains.includes(appHost)) {
      domains.push(appHost);
    }
  } catch {
    // env not initialized in isolated test
  }

  return domains;
}

export const TRUSTED_DOMAINS: string[] = [
  "reachinternational.co.in",
  "www.reachinternational.co.in",
  "localhost",
  "10.0.2.2",
  "127.0.0.1",
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
    const trusted = getTrustedDomains();

    // Check trusted domains or local network IP addresses
    return (
      trusted.some(
        (domain) =>
          hostname === domain ||
          (!domain.includes(".supabase.co") && hostname.endsWith(`.${domain}`))
      ) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)
    );
  } catch {
    return false;
  }
}
