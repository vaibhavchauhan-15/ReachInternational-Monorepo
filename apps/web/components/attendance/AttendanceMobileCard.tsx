"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { highlightText } from "@/components/ui";
import type { AttendanceEmployee } from "@/lib/data/attendance/attendance-summary";

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getInitials(name: string): string {
  if (!name) return "OP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export interface AttendanceMobileCardProps {
  emp: AttendanceEmployee;
  activeMonth: string;
  searchQuery: string;
}

export function AttendanceMobileCard({
  emp,
  activeMonth,
  searchQuery,
}: AttendanceMobileCardProps) {
  const initials = getInitials(emp.full_name);

  return (
    <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-xs space-y-3.5 hover:border-[var(--color-ink)]/20 transition-all">
      {/* Operator Header: Avatar, Name, Role badge, and Location */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-[var(--color-hairline)] flex items-center justify-center text-xs font-bold text-[var(--color-ink)] shrink-0 select-none">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/attendance/${emp.employee_id}?month=${activeMonth}`}
              className="font-semibold text-sm text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate"
            >
              {highlightText(emp.full_name, searchQuery)}
            </Link>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-[var(--color-mute)] border border-[var(--color-hairline)] shrink-0">
              {emp.role || "Operator"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[var(--color-mute)] font-mono">
            {emp.phone && (
              <span className="flex items-center gap-1">
                <Phone size={11} className="shrink-0" />
                {highlightText(emp.phone, searchQuery)}
              </span>
            )}
            {(emp.city || emp.state) && (
              <span className="flex items-center gap-1">
                <MapPin size={11} className="shrink-0" />
                {emp.city ? <span>{highlightText(emp.city, searchQuery)}, </span> : null}
                {emp.state ? <span>{highlightText(emp.state, searchQuery)}</span> : null}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4-Stat Metric Box: Scheduled, Present, Absent, Half Day */}
      <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-center">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
            Sched
          </span>
          <span className="font-mono font-bold text-sm text-[var(--color-ink)]">
            {emp.scheduled_days}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Present
          </span>
          <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
            {Math.min(emp.present_days, emp.scheduled_days)}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Absent
          </span>
          <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
            {emp.absent_days}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Half Day
          </span>
          <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
            {emp.half_days}
          </span>
        </div>
      </div>

      {/* Hours and Navigation Footer */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center gap-2 font-mono text-[var(--color-mute)]">
          <span>
            Worked:{" "}
            <strong className="text-[var(--color-ink)]">
              {formatMinutes(emp.worked_minutes)}
            </strong>
          </span>
          {emp.overtime_minutes > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              +{formatMinutes(emp.overtime_minutes)} OT
            </span>
          )}
        </div>
        <Link
          href={`/attendance/${emp.employee_id}?month=${activeMonth}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline min-h-[44px] px-2 -mr-2"
        >
          <span>Ledger</span>
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
