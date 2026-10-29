"use client";

import React from "react";
import type { DashboardRole } from "@reachinternational/types";

interface DashboardHeaderProps {
  userName: string;
  role?: DashboardRole;
  subtitle?: string;
  actions?: React.ReactNode;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  userName,
  subtitle,
  actions,
}: DashboardHeaderProps) {
  const greeting = getGreeting();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 sm:pb-3.5 border-b border-[var(--color-hairline)]">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] leading-tight truncate sm:whitespace-normal">
          {greeting}, {userName}
        </h1>
        {subtitle ? (
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1 leading-normal line-clamp-2 sm:line-clamp-1">
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
