export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="p-4 sm:p-5 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[var(--color-hairline)] shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-[var(--color-hairline)]" />
            <div className="h-3 w-48 rounded bg-[var(--color-hairline)]" />
            <div className="h-4 w-20 rounded-full bg-[var(--color-hairline)]" />
          </div>
          <div className="h-9 w-24 rounded-xl bg-[var(--color-hairline)] hidden sm:block" />
        </div>
      </div>

      {/* Sections Skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
          <div className="divide-y divide-[var(--color-hairline)]">
            <div className="py-2.5 flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-[var(--color-hairline)]" />
              <div className="h-3 w-32 rounded bg-[var(--color-hairline)]" />
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-[var(--color-hairline)]" />
              <div className="h-3 w-40 rounded bg-[var(--color-hairline)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
