"use client";

import React from "react";

export interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/**
 * ReachInternational Web — Canonical KPIGrid Component
 * 3-tier viewport layout for KPI metrics:
 * Mobile: 1-2 columns, Tablet: 2-3 columns, Desktop: 4+ columns
 */
export function KPIGrid({
  children,
  columns = 4,
  className = "",
}: KPIGridProps) {
  const colClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[columns];

  return (
    <div className={`grid gap-3 sm:gap-4 ${colClasses} ${className}`}>
      {children}
    </div>
  );
}
