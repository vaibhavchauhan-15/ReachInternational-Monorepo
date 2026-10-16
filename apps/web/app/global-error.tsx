"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0a] text-[#171717] dark:text-[#ededed] p-4 font-sans antialiased">
        <div className="flex max-w-md flex-col items-center justify-center rounded-xl border border-[#ebebeb] dark:border-[#262626] bg-white dark:bg-[#171717] p-8 text-center shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight">
            Application Error
          </h1>

          <p className="mt-2 text-sm text-[#737373] dark:text-[#a3a3a3]">
            A critical system error occurred. The application encountered an unexpected state and could not recover.
          </p>

          {error.digest && (
            <p className="mt-2 font-mono text-xs text-[#a3a3a3] dark:text-[#525252]">
              Error Digest: {error.digest}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-md bg-[#0284c7] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0369a1] focus:outline-none focus:ring-2 focus:ring-[#0284c7] focus:ring-offset-2 transition"
            >
              Reload Application
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-[#ebebeb] dark:border-[#262626] bg-[#fafafa] dark:bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-[#171717] dark:text-[#fafafa] hover:bg-[#f5f5f5] dark:hover:bg-[#1f1f1f] transition"
            >
              Return Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
