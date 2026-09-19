"use client";

import { useEffect } from "react";
import { DashboardErrorState } from "@/components/dashboard/shared";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return <DashboardErrorState error={error} reset={reset} />;
}
