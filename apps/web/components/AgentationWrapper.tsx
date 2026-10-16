"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Agentation } from "agentation";
import { isAgentationEnabled } from "@/lib/env/client";

const emptySubscribe = () => () => {};

export function AgentationWrapper() {
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const pathname = usePathname();

  useEffect(() => {
    // Sanity check: if previous stored toolbar position in localStorage is out-of-bounds
    // (for instance, when switching from desktop 1536px to mobile 360px viewport),
    // clear the invalid coordinate so the toolbar resets to the visible default location.
    try {
      const savedPosition = localStorage.getItem("feedback-toolbar-position");
      if (savedPosition) {
        const pos = JSON.parse(savedPosition);
        if (
          typeof pos?.x === "number" &&
          typeof pos?.y === "number" &&
          (pos.x > window.innerWidth - 44 ||
            pos.y > window.innerHeight - 44 ||
            pos.x < 0 ||
            pos.y < 0)
        ) {
          localStorage.removeItem("feedback-toolbar-position");
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [pathname]);

  if (!isMounted) return null;

  // Render in development mode (or if explicitly enabled via NEXT_PUBLIC_ENABLE_AGENTATION)
  if (!isAgentationEnabled()) {
    return null;
  }

  return <Agentation key={pathname} className="reach-agentation-toolbar" />;
}

