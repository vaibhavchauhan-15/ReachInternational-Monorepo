export default function ProfileEditLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 animate-pulse select-none">
      {/* Back button skeleton */}
      <div className="h-4 w-28 bg-[var(--color-hairline)] rounded" />

      {/* Header card skeleton */}
      <div className="p-4 sm:p-5 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-full bg-[var(--color-hairline)] shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-36 bg-[var(--color-hairline)] rounded" />
            <div className="h-3 w-64 bg-[var(--color-hairline)] rounded" />
          </div>
        </div>
      </div>

      {/* Form sections skeleton */}
      <div className="p-4 sm:p-6 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-[var(--color-hairline)] bg-[var(--color-canvas)] rounded-xl p-4 space-y-3"
          >
            <div className="h-3.5 w-32 bg-[var(--color-hairline)] rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-10 bg-[var(--color-hairline)] rounded-lg" />
              <div className="h-10 bg-[var(--color-hairline)] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
