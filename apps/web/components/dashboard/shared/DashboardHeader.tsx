"use client";

import React, { useRef } from "react";
import type { DashboardRole } from "@reachinternational/types";
import { Calendar } from "lucide-react";

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

function formatDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

export function DashboardHeader({
  userName,
  subtitle,
  actions,
}: DashboardHeaderProps) {
  const calendarRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const greeting = getGreeting();
  const dateStr = formatDate();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--color-hairline)]">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          {greeting}, {userName}
        </h1>
        {subtitle ? (
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-0.5">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div
          onMouseEnter={() => calendarRef.current?.startAnimation?.()}
          onMouseLeave={() => calendarRef.current?.stopAnimation?.()}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-hairline)] text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-default"
        >
          <Calendar ref={calendarRef} size={14} className="w-3.5 h-3.5 text-[var(--color-mute)] shrink-0" />
          <span>{dateStr}</span>
        </div>
        {actions}
      </div>
    </div>
  );
}
