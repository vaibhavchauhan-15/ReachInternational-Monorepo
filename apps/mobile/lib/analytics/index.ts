/**
 * ReachInternational Mobile — Analytics Abstraction Layer
 * Supports Google Analytics (gtag.js) on Web and safe isomorphic dispatch on Native.
 */

import { Platform } from 'react-native';

export const GA_MEASUREMENT_ID = 'G-DC126P3SM9';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Safe invocation of gtag on Web platform
 */
function sendWebGtag(...args: unknown[]): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  } else if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(args);
  }
}

export interface MobilePageViewParams {
  url?: string;
  title?: string;
}

export function trackPageView({ url, title }: MobilePageViewParams = {}): void {
  if (Platform.OS === 'web') {
    sendWebGtag('event', 'page_view', {
      page_path: url,
      page_title: title,
      send_to: GA_MEASUREMENT_ID,
    });
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (Platform.OS === 'web') {
    sendWebGtag('event', eventName, {
      ...params,
      send_to: GA_MEASUREMENT_ID,
    });
  }
}

export function trackLogin(method = 'credentials', role?: string): void {
  trackEvent('login', {
    method,
    user_role: role || 'unknown',
  });
}

export function trackSignUp(method = 'credentials'): void {
  trackEvent('sign_up', {
    method,
  });
}

export function trackLogout(): void {
  trackEvent('logout', {
    timestamp: new Date().toISOString(),
  });
}

export function trackSearch(query: string, searchCategory = 'mobile'): void {
  if (!query || query.trim().length === 0) return;
  trackEvent('search', {
    search_term: query.trim(),
    search_category: searchCategory,
  });
}

export function trackCtaClick(buttonName: string, location?: string): void {
  trackEvent('cta_click', {
    cta_name: buttonName,
    location: location || 'mobile',
  });
}

export function trackOperationAction(
  action: string,
  metadata?: Record<string, unknown>
): void {
  trackEvent('operations_action', {
    action_name: action,
    ...metadata,
  });
}
