import { OperationsLogsTabSkeleton } from "@/components/operations/skeletons/OperationsSkeletons";

export default function RunningLogsLoading() {
  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6 animate-pulse">
      <div className="hidden md:flex items-center justify-between gap-3">
        <div className="h-7 w-48 rounded bg-[var(--color-hairline)]" />
        <div className="h-9 w-32 rounded bg-[var(--color-hairline)]" />
      </div>
      <OperationsLogsTabSkeleton />
    </div>
  );
}
