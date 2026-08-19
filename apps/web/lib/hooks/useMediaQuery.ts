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
