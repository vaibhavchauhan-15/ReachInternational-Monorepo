import React from "react";

export default function UserDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] animate-pulse flex-col gap-4 pb-16 sm:gap-5 md:pb-8">
      {/* 1. Breadcrumb */}
      <div className="hidden items-center justify-between py-1 sm:flex">
        <div className="h-4 w-28 rounded-md bg-[var(--color-hairline)]" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-3 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-16 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-3 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-4 w-32 rounded-md bg-[var(--color-hairline)]" />
        </div>
      </div>

      {/* 2. Hero card */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-2xs sm:p-5 xl:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--color-hairline)] sm:h-14 sm:w-14" />
            <div className="space-y-2">
              <div className="h-2.5 w-24 rounded-md bg-[var(--color-hairline)]" />
              <div className="h-6 w-44 rounded-md bg-[var(--color-hairline)] sm:w-56" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 rounded-md bg-[var(--color-hairline)]" />
                <div className="h-5 w-20 rounded-full bg-[var(--color-hairline)]" />
                <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]" />
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-9 w-24 rounded-lg bg-[var(--color-hairline)]" />
            <div className="h-9 w-28 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-9 w-9 rounded-md bg-[var(--color-hairline)]" />
          </div>
        </div>
      </div>

      {/* 3. Profile details groups */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs">
        <div className="border-b border-[var(--color-hairline)] px-4 py-2.5 sm:px-5">
          <div className="h-2.5 w-28 rounded-md bg-[var(--color-hairline)]" />
        </div>
        <div className="grid grid-cols-1 gap-px bg-[var(--color-hairline)] sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3 bg-[var(--color-canvas-elevated)] p-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[var(--color-hairline)]" />
                <div className="h-2.5 w-20 rounded-md bg-[var(--color-hairline)]" />
              </div>
              <div className="h-4 w-32 rounded-md bg-[var(--color-hairline)]" />
              <div className="h-4 w-24 rounded-md bg-[var(--color-hairline)]" />
              <div className="h-4 w-28 rounded-md bg-[var(--color-hairline)]" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Snapshot strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline)] shadow-2xs lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-20 rounded-md bg-[var(--color-hairline)]" />
              <div className="h-6 w-6 rounded-md bg-[var(--color-hairline)]" />
            </div>
            <div className="h-5 w-12 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-2.5 w-24 rounded-md bg-[var(--color-hairline)]" />
          </div>
        ))}
      </div>

      {/* 5. Tab strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-hairline)] pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-[var(--color-hairline)] sm:w-28" />
        ))}
      </div>

      {/* 6. Panel */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-hairline)] px-4 py-3 sm:px-5">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-hairline)]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-40 rounded-md bg-[var(--color-hairline)]" />
            <div className="h-2.5 w-28 rounded-md bg-[var(--color-hairline)]" />
          </div>
        </div>
        <div className="space-y-2.5 p-3.5 sm:p-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full rounded-lg bg-[var(--color-hairline)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
