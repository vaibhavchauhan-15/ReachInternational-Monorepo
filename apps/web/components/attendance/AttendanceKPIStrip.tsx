"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  AnimatedUsers,
  AnimatedUserCheck,
  AnimatedUserX,
  AnimatedClock,
} from "@/components/ui/animated-icons";
import { AnimatedCounter } from "@/components/ui/Motion";
import type { AttendanceKpis } from "@/lib/data/attendance/attendance-summary";

export interface AttendanceKPIStripProps {
  kpis: AttendanceKpis;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export function AttendanceKPIStrip({
  kpis,
  statusFilter,
  onStatusFilterChange,
}: AttendanceKPIStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
      {/* Total Employees */}
      <motion.div
        data-hover-parent
        role="button"
        tabIndex={0}
        whileTap={{ scale: 0.98 }}
        onClick={() => onStatusFilterChange("all")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStatusFilterChange("all");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          statusFilter === "all" || !statusFilter
            ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
        }`}
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">
            Total Staff
          </span>
          <AnimatedUsers size={16} className="w-4 h-4 shrink-0 text-[var(--color-ink)]" />
        </div>
        <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)]">
          <AnimatedCounter value={kpis.totalEmployees} />
        </div>
      </motion.div>

      {/* Present */}
      <motion.div
        data-hover-parent
        role="button"
        tabIndex={0}
        whileTap={{ scale: 0.98 }}
        onClick={() => onStatusFilterChange(statusFilter === "present" ? "all" : "present")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStatusFilterChange(statusFilter === "present" ? "all" : "present");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          statusFilter === "present"
            ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
        }`}
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
            Present
          </span>
          <AnimatedUserCheck size={16} className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="mt-2 text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
          <AnimatedCounter value={kpis.presentCount} />
        </div>
      </motion.div>

      {/* Absent */}
      <motion.div
        data-hover-parent
        role="button"
        tabIndex={0}
        whileTap={{ scale: 0.98 }}
        onClick={() => onStatusFilterChange(statusFilter === "absent" ? "all" : "absent")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStatusFilterChange(statusFilter === "absent" ? "all" : "absent");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          statusFilter === "absent"
            ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
        }`}
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">
            Absent
          </span>
          <AnimatedUserX size={16} className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="mt-2 text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300">
          <AnimatedCounter value={kpis.absentCount} />
        </div>
      </motion.div>

      {/* Half Day */}
      <motion.div
        data-hover-parent
        role="button"
        tabIndex={0}
        whileTap={{ scale: 0.98 }}
        onClick={() => onStatusFilterChange(statusFilter === "half_day" ? "all" : "half_day")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStatusFilterChange(statusFilter === "half_day" ? "all" : "half_day");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          statusFilter === "half_day"
            ? "bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/20 dark:bg-amber-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-amber-500/40"
        }`}
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
            Half Day
          </span>
          <AnimatedClock size={16} className="w-4 h-4 shrink-0 text-amber-500" />
        </div>
        <div className="mt-2 text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300">
          <AnimatedCounter value={kpis.halfDayCount} />
        </div>
      </motion.div>
    </div>
  );
}
