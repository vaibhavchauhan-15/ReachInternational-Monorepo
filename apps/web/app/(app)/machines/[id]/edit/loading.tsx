import { Skeleton } from "@/components/ui";

export default function MachineEditLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-5 px-3 sm:px-6 py-3 sm:py-6 pb-24 sm:pb-8 animate-pulse">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Skeleton className="h-4 w-36 sm:w-48 rounded" />
        <Skeleton className="h-8 w-8 sm:w-28 rounded-lg" />
      </div>
      <Skeleton className="h-20 sm:h-24 w-full rounded-2xl" />
      <Skeleton className="h-56 sm:h-64 w-full rounded-2xl" />
      <Skeleton className="h-56 sm:h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 sm:h-56 w-full rounded-2xl" />
      <Skeleton className="h-14 sm:h-16 w-full rounded-2xl" />
    </div>
  );
}
