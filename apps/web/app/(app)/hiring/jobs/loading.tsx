export default function JobsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-6 w-52 bg-[var(--color-hairline-soft-surface)] rounded-md" />
          <div className="h-3 w-80 bg-[var(--color-hairline-soft-surface)] rounded-md" />
        </div>
        <div className="h-9 w-48 bg-[var(--color-hairline-soft-surface)] rounded-xl" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[var(--color-hairline-soft-surface)] rounded-2xl border border-[var(--color-hairline)]" />
        ))}
      </div>

      <div className="h-64 bg-[var(--color-hairline-soft-surface)] rounded-2xl border border-[var(--color-hairline)]" />
    </div>
  );
}
