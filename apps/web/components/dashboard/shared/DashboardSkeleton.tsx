import React from "react";
import { Skeleton, SkeletonKPI } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export function DashboardShellSkeleton({
  kpiCount = 4,
}: {
  kpiCount?: number;
}) {
  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--color-hairline)]">
        <div>
          <Skeleton className="h-7 w-48 sm:w-64 rounded-md" />
        </div>
        <Skeleton className="hidden sm:block h-8 w-44 rounded-md" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SkeletonKPI count={kpiCount} />
      </div>

      {/* Main Section / Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 p-5 space-y-4">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </Card>
        <Card className="p-5 space-y-4">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </Card>
      </div>
    </div>
  );
}
