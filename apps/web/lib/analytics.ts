/**
 * ReachInternational — Google Analytics (gtag.js) Utility & Event Tracker
 * Measurement ID: G-DC126P3SM9 (Configurable via NEXT_PUBLIC_GA_MEASUREMENT_ID)
 *
 * Implements:
 * - Google Analytics 4 (GA4) event standards
 * - Google Consent Mode v2 support
 * - SSR safety and graceful degradation
 * - High-level helpers for enterprise operations, navigation, and auth
 */

import { track as vercelTrack } from "@vercel/analytics";
import { getGaMeasurementId } from "@/lib/env/client";

export const GA_MEASUREMENT_ID = getGaMeasurementId() || "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Internal safe execution of gtag commands with dataLayer fallback
 */
export function gtagSafe(...args: unknown[]): void {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    window.gtag(...args);
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(args);
  }
}

/**
 * Standard Page View parameters
 */
export interface PageViewParams {
  url?: string;
  title?: string;
  location?: string;
}

/**
 * Track an SPA page view
 */
export function trackPageView({ url, title, location }: PageViewParams = {}): void {
  if (typeof window === "undefined") return;

  const pagePath =
    url || `${window.location.pathname}${window.location.search}`;
  const pageTitle = title || document.title;
  const pageLocation = location || window.location.href;

  gtagSafe("event", "page_view", {
    page_title: pageTitle,
    page_location: pageLocation,
    page_path: pagePath,
    send_to: GA_MEASUREMENT_ID,
  });
}

/**
 * Generic event tracker with standard parameters
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  gtagSafe("event", eventName, {
    ...params,
    send_to: GA_MEASUREMENT_ID,
  });

  try {
    if (typeof window !== "undefined") {
      vercelTrack(
        eventName,
        params as Record<string, string | number | boolean | null | undefined>
      );
    }
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Google Consent Mode v2 update helper
 */
export function updateConsent(granted: boolean): void {
  const status = granted ? "granted" : "denied";
  gtagSafe("consent", "update", {
    analytics_storage: status,
    ad_storage: status,
    ad_user_data: status,
    ad_personalization: status,
  });
}

/**
 * Set current user ID for authenticated user tracking
 * Redacts any PII; pass Supabase UUID only.
 */
export function setAnalyticsUserId(userId: string | null): void {
  if (!userId) {
    gtagSafe("config", GA_MEASUREMENT_ID, {
      user_id: undefined,
    });
    return;
  }
  gtagSafe("config", GA_MEASUREMENT_ID, {
    user_id: userId,
  });
}

/**
 * Set custom user properties (e.g. role, tenant)
 */
export function setUserProperties(
  properties: Record<string, string | number | boolean>
): void {
  gtagSafe("set", "user_properties", properties);
}

/**
 * Track user authentication: Login
 */
export function trackLogin(method = "credentials", role?: string): void {
  trackEvent("login", {
    method,
    user_role: role || "unknown",
  });
}

/**
 * Track user authentication: Sign Up
 */
export function trackSignUp(method = "credentials"): void {
  trackEvent("sign_up", {
    method,
  });
}

/**
 * Track user logout
 */
export function trackLogout(): void {
  trackEvent("logout", {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track search queries across Command Palette or tables
 */
export function trackSearch(query: string, searchCategory = "global"): void {
  if (!query || query.trim().length === 0) return;
  trackEvent("search", {
    search_term: query.trim(),
    search_category: searchCategory,
  });
}

/**
 * Track CTA / Button clicks (e.g., "Get Started", "Contact Sales", "Export Report")
 */
export function trackCtaClick(buttonName: string, location?: string): void {
  trackEvent("cta_click", {
    cta_name: buttonName,
    location: location || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
  });
}

/**
 * Track file downloads (.pdf, .xlsx, .csv)
 */
export function trackFileDownload(
  fileName: string,
  fileExtension?: string,
  category = "documents"
): void {
  trackEvent("file_download", {
    file_name: fileName,
    file_extension: fileExtension || fileName.split(".").pop() || "unknown",
    category,
  });
}

/**
 * Track report exports (Excel, CSV, PDF)
 */
export function trackReportExport(
  reportName: string,
  format: "csv" | "xlsx" | "pdf",
  filters?: Record<string, unknown>
): void {
  trackEvent("report_export", {
    report_name: reportName,
    export_format: format,
    ...filters,
  });
}

/**
 * Track operational fleet and shift events (HMR, Machine allocation, Maintenance)
 */
export function trackOperationAction(
  action: string,
  metadata?: Record<string, unknown>
): void {
  trackEvent("operations_action", {
    action_name: action,
    ...metadata,
  });
}

/**
 * Track external outbound link clicks
 */
export function trackOutboundLink(url: string, label?: string): void {
  trackEvent("outbound_click", {
    destination_url: url,
    link_label: label || url,
  });
}

/**
 * Track UI theme changes (dark, light, system)
 */
export function trackThemeChange(theme: string): void {
  trackEvent("theme_change", {
    theme_preference: theme,
  });
}

/**
 * Track application errors and exceptions
 */
export function trackException(description: string, fatal = false): void {
  trackEvent("exception", {
    description,
    fatal,
  });
}
