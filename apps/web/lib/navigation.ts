/**
 * Deterministic In-App Navigation Utilities.
 *
 * Prevents raw `window.history.back()` from exiting the application,
 * cycling through query parameter history, or breaking when pages
 * are opened directly, shared via URL, or refreshed.
 */

const SESSION_KEY = "reach_app_nav_history";
const MAX_HISTORY = 25;

export interface NavHistoryEntry {
  pathname: string;
  search: string;
}

/**
 * Resolves the logical parent route for any given pathname in ReachInternational.
 */
export function resolveParentRoute(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";

  // Machine routes
  if (path.startsWith("/machines/")) {
    if (path.endsWith("/edit")) {
      return path.replace(/\/edit$/, "");
    }
    return "/machines";
  }

  // Client routes
  if (path.startsWith("/clients/")) {
    return "/clients";
  }

  // Audit routes
  if (path.startsWith("/audit/")) {
    return "/audit";
  }

  // User routes
  if (path.startsWith("/users/")) {
    return "/users";
  }

  // Dashboard logs
  if (path.startsWith("/dashboard/")) {
    return "/dashboard";
  }

  // Settings sub-routes
  if (path.startsWith("/settings/")) {
    return "/settings";
  }

  // Generic nested route fallback: /a/b -> /a
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 1) {
    return `/${segments[0]}`;
  }

  // Top-level routes fallback to /dashboard
  return "/dashboard";
}

/**
 * Records the current route in the session-based navigation history stack.
 * Ensures duplicate or consecutive search-param changes do not create redundant stack frames.
 */
export function recordAppNavigation(pathname: string, searchParamsString: string = ""): void {
  if (typeof window === "undefined") return;

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    let history: NavHistoryEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];

    const last = history[history.length - 1];

    // If still on the same pathname, update search parameters on the current entry
    if (last && last.pathname === pathname) {
      if (last.search !== searchParamsString) {
        last.search = searchParamsString;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
      }
      return;
    }

    // If navigating back to the immediately preceding entry, pop the forward entry
    if (history.length >= 2 && history[history.length - 2]?.pathname === pathname) {
      history.pop();
      if (history.length > 0) {
        history[history.length - 1].search = searchParamsString;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
      return;
    }

    // Push new page entry
    history.push({ pathname, search: searchParamsString });
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
  } catch {
    // Non-fatal fallback if sessionStorage is inaccessible
  }
}

/**
 * Pops and returns the preceding in-app route.
 * If no previous route exists in the session (e.g. direct load, refresh, or external entry),
 * resolves and returns the logical parent route.
 */
export function popPreviousAppRoute(currentPathname: string): string {
  if (typeof window === "undefined") {
    return resolveParentRoute(currentPathname);
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    let history: NavHistoryEntry[] = raw ? JSON.parse(raw) : [];

    if (Array.isArray(history) && history.length > 0) {
      // Remove any trailing entries matching the current pathname
      while (history.length > 0 && history[history.length - 1].pathname === currentPathname) {
        history.pop();
      }

      // Retrieve previous entry
      const previous = history.pop();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));

      if (previous && previous.pathname && previous.pathname !== currentPathname) {
        return previous.search ? `${previous.pathname}?${previous.search}` : previous.pathname;
      }
    }
  } catch {
    // Non-fatal, proceed to referrer / parent fallback
  }

  // Check same-origin referrer if available
  try {
    if (document.referrer) {
      const refUrl = new URL(document.referrer);
      if (refUrl.origin === window.location.origin && refUrl.pathname !== currentPathname) {
        return refUrl.pathname + refUrl.search;
      }
    }
  } catch {
    // Fall back to logical parent
  }

  return resolveParentRoute(currentPathname);
}
