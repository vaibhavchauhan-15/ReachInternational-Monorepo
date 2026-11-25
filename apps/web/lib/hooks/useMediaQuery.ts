"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook via useSyncExternalStore.
 * Server snapshot is always `false` (mobile-first), so hydration matches;
 * React re-renders with the real value immediately after commit — no mismatch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false // ponytail: mobile-first server snapshot; desktop settles post-hydration
  );
}

export type ViewportMode = "mobile" | "desktop" | "unknown";

/**
 * Chooses which of two mutually exclusive responsive renderings should be mounted.
 *
 * Returns "unknown" for the server render AND the hydration pass, so the server and the
 * first client render agree (both renderings are present, CSS decides visibility).
 * Immediately after hydration React re-renders with the real value and the inactive
 * rendering leaves the tree — removing an entire duplicate row tree from the DOM with
 * no hydration mismatch and no layout shift (the removed tree was `display: none`).
 */
export function useActiveViewMode(desktopQuery = "(min-width: 1024px)"): ViewportMode {
  return useSyncExternalStore<ViewportMode>(
    (onChange) => {
      const mql = window.matchMedia(desktopQuery);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => (window.matchMedia(desktopQuery).matches ? "desktop" : "mobile"),
    () => "unknown"
  );
}
