"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | { message?: string; digest?: string } | string | null;
  reset?: () => void;
  onRetry?: () => void;
  action?: React.ReactNode;
  showHomeLink?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this view. Please try again or return to the dashboard.",
  error,
  reset,
  onRetry,
  action,
  showHomeLink = false,
  className = "",
}: ErrorStateProps) {
  const retryHandler = onRetry || reset;
  const errorMessage =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
      ? error.message
      : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex min-h-[320px] w-full flex-col items-center justify-center rounded-xl border border-[var(--color-hairline,#ebebeb)] dark:border-[#262626] bg-[var(--color-surface,#ffffff)] dark:bg-[#171717] p-8 text-center shadow-sm ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-[var(--color-ink,#171717)] dark:text-[#fafafa]">
        {title}
      </h3>

      <p className="mt-1.5 max-w-md text-sm text-[var(--color-mute,#737373)] dark:text-[#a3a3a3]">
        {errorMessage || description}
      </p>

      {(retryHandler || action || showHomeLink) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {retryHandler && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => retryHandler()}
              className="inline-flex items-center gap-2 border-[var(--color-hairline,#ebebeb)] dark:border-[#262626]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Try Again</span>
            </Button>
          )}

          {action}

          {showHomeLink && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-hairline,#ebebeb)] dark:border-[#262626] bg-[var(--color-canvas,#fafafa)] dark:bg-[#0a0a0a] px-3 py-1.5 text-xs font-medium text-[var(--color-ink,#171717)] dark:text-[#fafafa] transition hover:bg-[var(--color-hairline-soft-surface,#f5f5f5)]"
            >
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
