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

const ROLE_METADATA: Record<
  DashboardRole,
  { label: string; badge: string; defaultSubtitle: string }
> = {
  super_admin: {
    label: "Super Admin",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    defaultSubtitle: "System-wide telemetry, platform governance, and global fleet oversight.",
  },
  admin: {
    label: "Admin",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    defaultSubtitle: "Fleet operations, personnel management, and operational exception tracking.",
  },
  manager: {
    label: "Manager",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    defaultSubtitle: "Fleet allocation, utilization analytics, and shift productivity review.",
  },
  supervisor: {
    label: "Supervisor",
    badge: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20",
    defaultSubtitle: "Site-level equipment coordination and operator shift submissions.",
  },
  hr: {
    label: "HR",
    badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
    defaultSubtitle: "Personnel lifecycle, operator directory, and profile change requests.",
  },
  operator: {
    label: "Operator",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    defaultSubtitle: "Daily machinery operation, HMR meter logging, and shift execution.",
  },
};

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
  role = "operator",
  subtitle,
  actions,
}: DashboardHeaderProps) {
  const calendarRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const greeting = getGreeting();
  const dateStr = formatDate();
  const roleMeta = ROLE_METADATA[role] || ROLE_METADATA.operator;
  const activeSubtitle = subtitle ?? roleMeta.defaultSubtitle;

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-[var(--color-hairline)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] leading-tight">
            {greeting}, {userName}
          </h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border ${roleMeta.badge}`}
          >
            {roleMeta.label}
          </span>
        </div>
        {activeSubtitle ? (
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1 leading-normal line-clamp-2 sm:line-clamp-1">
            {activeSubtitle}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div
          onMouseEnter={() => calendarRef.current?.startAnimation?.()}
          onMouseLeave={() => calendarRef.current?.stopAnimation?.()}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]/20 transition-all cursor-default shadow-2xs"
        >
          <Calendar ref={calendarRef} size={14} className="w-3.5 h-3.5 text-[var(--color-mute)] shrink-0" />
          <span className="tabular-nums">{dateStr}</span>
        </div>
        {actions}
      </div>
    </div>
  );
}
