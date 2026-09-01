import { Skeleton } from "@/components/ui";

export default function MachineEditLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 px-3 sm:px-6 py-4 sm:py-6 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
