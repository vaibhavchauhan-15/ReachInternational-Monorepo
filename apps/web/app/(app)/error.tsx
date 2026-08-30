"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safe diagnostics to client console without leaking secrets to the DOM
    console.error("[AppError] Captured unhandled error boundary exception:", {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6 sm:p-8 text-center shadow-sm">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] mb-2">
          Unable to load section
        </h2>

        <p className="text-xs sm:text-sm text-[var(--color-ink-muted)] mb-6">
          A temporary issue occurred while loading this view. Your existing data remains safe.
        </p>

        {error.digest && (
          <div className="mb-6 px-3 py-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[11px] font-mono text-[var(--color-ink-muted)] inline-block">
            Ref: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[44px] justify-center"
          >
            Try again
          </Button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[44px]"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
