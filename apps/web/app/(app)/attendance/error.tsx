"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function AttendanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AttendanceError]", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorState
        title="Unable to load attendance records"
        description="We couldn't retrieve monthly attendance logs. Please verify your connection and try again."
        error={error}
        reset={reset}
      />
    </div>
  );
}
