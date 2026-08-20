"use client";

import React, { useEffect, useState } from "react";
import { Agentation } from "agentation";

export function AgentationWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Render in development mode (or if explicitly enabled)
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_ENABLE_AGENTATION !== "true") {
    return null;
  }

  return <Agentation />;
}
