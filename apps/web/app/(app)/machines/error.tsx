"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function MachinesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MachinesError]", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorState
        title="Unable to load machine fleet"
        description="We couldn't retrieve the fleet directory. Please check your connection and try again."
        error={error}
        reset={reset}
      />
    </div>
  );
}
