"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { UserRole } from "@reachinternational/types";
import { getRoleHomeRoute } from "@reachinternational/permissions";

/**
 * Module-level flag tracks whether the initial browser document load has been evaluated.
 * - On a genuine browser page reload (F5 / Cmd+R / Reload button), the entire JavaScript runtime
 *   is torn down and reinitialized, resetting this variable to `false`.
 * - On client-side navigation (Next.js SPA routing, sidebar/tab clicks, pagination, query updates),
 *   this variable remains `true`, guaranteeing that subsequent client navigations are NEVER
 *   falsely classified as a reload.
 */
let hasEvaluatedInitialNavigation = false;

function detectBrowserReload(): boolean {
  if (typeof window === "undefined" || !window.performance) return false;

  try {
    const navEntries = window.performance.getEntriesByType("navigation");
    if (navEntries.length > 0) {
      const navTiming = navEntries[0] as PerformanceNavigationTiming;
      return navTiming.type === "reload";
    }

    // Fallback for legacy browser environments
    const legacyNav = (
      window.performance as unknown as { navigation?: { type?: number } }
    )?.navigation;
    return legacyNav?.type === 1; // 1 === TYPE_RELOAD
  } catch {
    return false;
  }
}

export function BrowserLifecycleManager({
  userRole,
}: {
  userRole?: UserRole | string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    if (!hasEvaluatedInitialNavigation) {
      hasEvaluatedInitialNavigation = true;

      const isReload = detectBrowserReload();
      if (isReload) {
        const roleHome = getRoleHomeRoute(userRole);
        // Only redirect if not already on the role Home route, preventing redirect loops
        if (pathname !== roleHome) {
          router.replace(roleHome);
        }
      }
    }
  }, [pathname, router, userRole]);

  return null;
}
