"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function UsersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[UsersError]", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorState
        title="Unable to load team members"
        description="We couldn't retrieve the user directory. Please check your connection and try again."
        error={error}
        reset={reset}
      />
    </div>
  );
}
