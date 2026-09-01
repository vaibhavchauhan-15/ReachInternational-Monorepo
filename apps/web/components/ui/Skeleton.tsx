import React from "react";
import { Card } from "./Card";

export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] ${className}`}
      {...props}
    />
  );
}

export function SkeletonHeader({
  hasEyebrow = true,
  hasSubtitle = true,
  hasAction = false,
}: {
  hasEyebrow?: boolean;
  hasSubtitle?: boolean;
  hasAction?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        {hasEyebrow && <Skeleton className="h-3.5 w-24" />}
        <Skeleton className="h-8 w-48 sm:w-64" />
        {hasSubtitle && <Skeleton className="h-4 w-72 sm:w-96" />}
      </div>
      {hasAction && <Skeleton className="h-10 w-32 rounded-[var(--radius-md)]" />}
    </div>
  );
}

export function SkeletonKPI({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} padding="md" className="flex flex-col justify-between gap-3 h-full w-full">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)]" />
          </div>
          <Skeleton className="h-8 w-20 mt-1" />
        </Card>
      ))}
    </>
  );
}

export function SkeletonTable({
  columns = 5,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full border-collapse min-w-[600px]">
        <div className="flex border-b border-[var(--color-hairline)] py-3 px-4 gap-4 items-center">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-4 ${i === 0 ? "w-32" : "flex-1"}`}
            />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex border-b border-[var(--color-hairline)] py-4 px-4 gap-4 items-center last:border-0"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-1.5">
                <Skeleton
                  className={`h-4 ${
                    colIndex === 0
                      ? "w-3/4 font-semibold"
                      : colIndex === columns - 1
                      ? "w-1/2 ml-auto"
                      : "w-2/3"
                  }`}
                />
                {colIndex === 0 && <Skeleton className="h-3 w-1/2" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChartCard() {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <div className="mt-6 flex items-end gap-3 h-48 pt-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-[var(--radius-sm)]"
            style={{ height: `${20 + ((i * 17) % 70)}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading dashboard...">
      <SkeletonHeader hasEyebrow hasSubtitle />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonKPI count={8} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>

      {/* Due Machine Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} padding="md" className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between items-center py-1">
                  <div className="flex flex-col gap-1 w-3/4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity Card */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
        <SkeletonTable columns={3} rows={5} />
      </Card>
    </div>
  );
}

export function MachinesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading machine directory...">
      <SkeletonHeader hasEyebrow hasSubtitle hasAction />

      <Card padding="md" className="flex flex-col gap-4">
        {/* Search and Filters bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
        </div>

        {/* Machine Table */}
        <SkeletonTable columns={6} rows={8} />

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-8 w-20 rounded-[var(--radius-sm)]" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MachineDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full" aria-label="Loading machine details...">
      {/* Back button */}
      <Skeleton className="h-4 w-28" />

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Skeleton className="h-11 w-11 sm:h-13 sm:w-13 rounded-xl shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 sm:h-8 w-44 sm:w-60 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-xl self-end sm:self-center shrink-0" />
        </div>
      </div>

      {/* Segmented Toggle Bar */}
      <div className="grid grid-cols-2 sm:inline-flex sm:w-auto p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-[var(--color-hairline)] gap-1">
        <Skeleton className="h-9 w-full sm:w-44 rounded-lg" />
        <Skeleton className="h-9 w-full sm:w-52 rounded-lg" />
      </div>

      {/* Basic Info Card Skeleton */}
      <Card padding="md" className="sm:p-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>

      {/* Client Details Card Skeleton */}
      <Card padding="md" className="sm:p-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-4 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 mt-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="mt-3.5 p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading notifications...">
      <SkeletonHeader hasEyebrow hasSubtitle />

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonKPI count={4} />
      </div>

      <Card padding="md" className="flex flex-col gap-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
        </div>

        {/* Notifications Table */}
        <SkeletonTable columns={5} rows={8} />

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-8 w-20 rounded-[var(--radius-sm)]" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ServicesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading services schedule...">
      <SkeletonHeader hasEyebrow hasSubtitle />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SkeletonKPI count={5} />
      </div>

      {/* Assigned Machines Table Card */}
      <Card padding="md">
        <div className="flex flex-col gap-1 mb-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-44" />
        </div>
        <SkeletonTable columns={6} rows={6} />
      </Card>

      {/* Service History Table Card */}
      <Card padding="md">
        <div className="flex flex-col gap-1 mb-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
        <SkeletonTable columns={5} rows={5} />
      </Card>
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading users directory...">
      <SkeletonHeader hasEyebrow hasSubtitle hasAction />

      {/* Tab Navigation Placeholder */}
      <div className="flex gap-4 border-b border-[var(--color-hairline)] pb-3">
        <Skeleton className="h-8 w-28 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-8 w-36 rounded-[var(--radius-sm)]" />
      </div>

      {/* Users Table Card */}
      <Card padding="md">
        <SkeletonTable columns={5} rows={8} />
      </Card>
    </div>
  );
}

export function OperationsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading operations hub...">
      <SkeletonHeader hasEyebrow hasSubtitle hasAction />

      {/* Tab Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--color-hairline)]">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-md)] shrink-0" />
        <Skeleton className="h-9 w-28 rounded-[var(--radius-md)] shrink-0" />
        <Skeleton className="h-9 w-32 rounded-[var(--radius-md)] shrink-0" />
        <Skeleton className="h-9 w-24 rounded-[var(--radius-md)] shrink-0" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonKPI count={4} />
      </div>

      {/* Operations Table / Feed Card */}
      <Card padding="md" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-72 rounded-[var(--radius-md)]" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-[var(--radius-md)]" />
            <Skeleton className="h-10 w-28 rounded-[var(--radius-md)]" />
          </div>
        </div>
        <SkeletonTable columns={6} rows={8} />
      </Card>
    </div>
  );
}

export function ClientsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading clients directory...">
      <SkeletonHeader hasEyebrow hasSubtitle hasAction />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonKPI count={4} />
      </div>

      {/* Clients Table Card */}
      <Card padding="md" className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-72 rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-32 rounded-[var(--radius-md)]" />
        </div>
        <SkeletonTable columns={5} rows={8} />
      </Card>
    </div>
  );
}

