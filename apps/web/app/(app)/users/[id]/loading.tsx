import React from "react";

export default function UserDetailLoading() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full animate-pulse">
      {/* 1. Breadcrumb Skeleton */}
      <div className="flex items-center justify-between py-1">
        <div className="h-4 w-28 rounded-md bg-[var(--color-hairline)]" />
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-4 w-12 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-3 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-16 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-3 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-32 rounded-md bg-[var(--color-hairline)]" />
        </div>
      </div>

      {/* 2. Master Hero Card Skeleton */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-[var(--color-hairline)] shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 rounded-md bg-[var(--color-hairline)]" />
                <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]" />
                <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]" />
              </div>
              <div className="h-7 w-48 sm:w-64 rounded-md bg-[var(--color-hairline)]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-9 w-20 rounded-md bg-[var(--color-hairline)]" />
          </div>
        </div>
      </div>

      {/* 3. 4-Card Metadata Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 space-y-3 shadow-2xs"
          >
            <div className="h-4 w-32 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-5 w-40 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-4 w-28 rounded-md bg-[var(--color-hairline)]" />
          </div>
        ))}
      </div>

      {/* 4. 4-Card KPI Metrics Strip Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 space-y-2 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded-md bg-[var(--color-hairline)]" />
              <div className="h-4 w-4 rounded-md bg-[var(--color-hairline)]" />
            </div>
            <div className="h-7 w-20 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-3 w-28 rounded-md bg-[var(--color-hairline)]" />
          </div>
        ))}
      </div>

      {/* 5. Tab Strip Skeleton */}
      <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-2 overflow-x-auto">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 w-28 rounded-full bg-[var(--color-hairline)] shrink-0" />
        ))}
      </div>

      {/* 6. Content Table / Cards Skeleton */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="h-5 w-48 rounded-md bg-[var(--color-hairline)]" />
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-[var(--color-hairline)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
