"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ClientsError]", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorState
        title="Unable to load clients directory"
        description="We couldn't retrieve the client list. Please check your connection and try again."
        error={error}
        reset={reset}
      />
    </div>
  );
}
