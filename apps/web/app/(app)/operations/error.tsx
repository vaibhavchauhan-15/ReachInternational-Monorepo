"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function OperationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OperationsError]", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorState
        title="Unable to load operations telemetry"
        description="We couldn't retrieve shift logs and machine activity. Please try reloading."
        error={error}
        reset={reset}
      />
    </div>
  );
}
