"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ErrorState
        title="We encountered an unexpected error"
        description="Something interrupted your request. You can try refreshing the page or navigating back."
        error={error}
        reset={reset}
        showHomeLink
        className="max-w-lg"
      />
    </div>
  );
}
