import React from "react";

export function ClientTableSkeletonRows({
  canManageClients,
  count = 5,
}: {
  canManageClients: boolean;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={`client-skel-${i}`} className="animate-pulse">
          <td className="py-3 px-4">
            <div className="h-4 w-16 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="py-3 px-4">
            <div className="h-4 w-36 rounded bg-[var(--color-hairline)] mb-1" />
            <div className="h-3 w-24 rounded bg-[var(--color-hairline)]/70" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3.5 w-28 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3.5 w-32 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="py-3 px-4">
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]" />
          </td>
          {canManageClients && (
            <td className="py-3 px-4 text-right">
              <div className="flex items-center justify-end gap-1">
                <div className="h-7 w-7 rounded bg-[var(--color-hairline)]" />
                <div className="h-7 w-7 rounded bg-[var(--color-hairline)]" />
              </div>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

export function MobileClientCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-[var(--color-hairline)] border-l-[3px] border-l-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs flex flex-col justify-between gap-3 animate-pulse"
      aria-hidden="true"
    >
      {/* Header Row: Company Name + Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="h-4 w-36 rounded bg-[var(--color-hairline)]" />
            <div className="h-4 w-16 rounded bg-[var(--color-hairline)]/70" />
          </div>
          <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/50" />
        </div>
        <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)] shrink-0" />
      </div>

      {/* Inset Specs Well */}
      <div className="rounded-lg bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] p-2.5">
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
          <div className="space-y-1">
            <div className="h-2.5 w-16 rounded bg-[var(--color-hairline)]/60" />
            <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-12 rounded bg-[var(--color-hairline)]/60" />
            <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-16 rounded bg-[var(--color-hairline)]/60" />
            <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-14 rounded bg-[var(--color-hairline)]/60" />
            <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]" />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-[var(--color-hairline)]" />
          <div className="h-8 w-16 rounded-md bg-[var(--color-hairline)]" />
        </div>
        <div className="h-8 w-24 rounded-md bg-[var(--color-hairline)]" />
      </div>
    </div>
  );
}

export function MobileClientCardSkeletonList({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  const content = Array.from({ length: count }).map((_, i) => (
    <MobileClientCardSkeleton key={`client-card-skel-${i}`} />
  ));

  if (className) {
    return (
      <div className={className} aria-label="Loading client directory...">
        {content}
      </div>
    );
  }

  return <>{content}</>;
}
