import React from "react";

export function OperationsLogTableSkeletonRows({
  colSpan = 8,
  count = 5,
}: {
  colSpan?: number;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={`op-log-skel-${i}`} className="animate-pulse">
          <td className="px-3 py-3 text-center">
            <div className="h-4 w-6 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 rounded bg-[var(--color-hairline)] mb-1" />
            <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/70" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-28 rounded bg-[var(--color-hairline)] mb-1" />
            <div className="h-3 w-24 rounded bg-[var(--color-hairline)]/70" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-4 w-16 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3">
            <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]/70" />
          </td>
          {colSpan > 8 && (
            <td className="px-4 py-3 text-center">
              <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
            </td>
          )}
          {colSpan > 9 && (
            <td className="px-4 py-3 text-center">
              <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

export function MobileOperationsLogCardSkeletonList({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-3" aria-label="Loading logs...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`op-card-skel-${i}`}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
              <div className="h-4 w-32 rounded bg-[var(--color-hairline)]" />
              <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)] shrink-0" />
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]/70" />
              <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperatorDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading operator dashboard...">
      <div className="h-10 w-48 rounded-xl bg-[var(--color-hairline)]" />
      <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
        <div className="h-6 w-36 rounded bg-[var(--color-hairline)]" />
        <div className="h-4 w-64 rounded bg-[var(--color-hairline)]/70" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="h-12 rounded-xl bg-[var(--color-hairline)]" />
          <div className="h-12 rounded-xl bg-[var(--color-hairline)]" />
        </div>
      </div>
    </div>
  );
}

export function OperationsSubViewCardSkeleton() {
  return (
    <div
      className="p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs animate-pulse space-y-3"
      aria-label="Loading summary details..."
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-36 sm:w-48 rounded bg-[var(--color-hairline)]" />
          <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]/70" />
        </div>
        <div className="h-5 w-24 rounded bg-[var(--color-hairline)]/60" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`subview-kpi-skel-${i}`}
            className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1.5"
          >
            <div className="h-3 w-16 rounded bg-[var(--color-hairline)]/70" />
            <div className="h-5 w-14 rounded bg-[var(--color-hairline)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MachineAssignmentCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading roster assignments...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`mach-assign-skel-${i}`}
          className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="h-4.5 w-36 rounded bg-[var(--color-hairline)]" />
              <div className="h-3.5 w-48 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="h-6 w-20 rounded-full bg-[var(--color-hairline)] shrink-0" />
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="h-4 w-28 rounded bg-[var(--color-hairline)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="h-3 w-40 rounded bg-[var(--color-hairline)]/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
