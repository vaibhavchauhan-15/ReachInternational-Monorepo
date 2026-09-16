/**
 * ReachInternational Feature Flags Engine
 * Provides environment-variable-backed kill-switches and route-specific opt-out controls.
 */

export interface FeatureFlags {
  enablePullToRefresh: boolean;
  pullToRefreshDisabledRoutes: string[];
}

export const FEATURES: FeatureFlags = {
  // Global kill-switch controllable via environment variable (default: true)
  enablePullToRefresh:
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_ENABLE_PULL_TO_REFRESH !== "false",

  // Route-specific opt-outs (e.g. routes with drag-and-drop, full-screen editors, or canvas interactions)
  pullToRefreshDisabledRoutes: [
    "/settings/appearance",
  ],
};

/**
 * Checks if Pull-to-Refresh gesture is enabled globally and for a specific route pathname.
 */
export function isPullToRefreshEnabledForRoute(pathname?: string | null): boolean {
  if (!FEATURES.enablePullToRefresh) return false;
  if (!pathname) return true;

  return !FEATURES.pullToRefreshDisabledRoutes.some((disabledRoute) =>
    pathname === disabledRoute || pathname.startsWith(`${disabledRoute}/`)
  );
}
