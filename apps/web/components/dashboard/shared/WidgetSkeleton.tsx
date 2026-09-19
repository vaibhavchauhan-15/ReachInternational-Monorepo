import React from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface WidgetSkeletonProps {
  title?: string;
  height?: string;
  className?: string;
}

export function WidgetSkeleton({
  title,
  height = "h-48",
  className = "",
}: WidgetSkeletonProps) {
  return (
    <Card className={`p-4 sm:p-5 border-[var(--color-hairline)] bg-[var(--color-surface)] ${className}`}>
      <div className="flex items-center justify-between mb-4">
        {title ? (
          <span className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider">
            {title}
          </span>
        ) : (
          <Skeleton className="h-4 w-28 rounded" />
        )}
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className={`w-full rounded-lg bg-[var(--color-canvas)] animate-pulse ${height}`} />
    </Card>
  );
}
