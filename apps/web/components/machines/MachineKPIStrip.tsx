"use client";

import React from "react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/Motion";
import type { UserRole } from "@/lib/types/database";

export interface MachineStatsSummary {
  totalCount: number;
  availableCount: number;
  rentedCount: number;
  breakdownCount: number;
  maintenanceCount?: number;
  spareCount?: number;
}

export interface MachineKPIStripProps {
  stats: MachineStatsSummary;
  currentStatus: string;
  healthStatusFilter: string;
  userRole?: UserRole;
  onSelectStatus: (status: string) => void;
  onToggleBreakdown: () => void;
}

export const MachineKPIStrip: React.FC<MachineKPIStripProps> = ({
  stats,
  currentStatus,
  healthStatusFilter,
  userRole,
  onSelectStatus,
  onToggleBreakdown,
}) => {
  return (
    <div
      role="region"
      aria-label="Fleet Key Performance Indicators"
      className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full"
    >
      {/* Total Fleet Card */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={currentStatus === "all" && healthStatusFilter === "all"}
        aria-label={`Total fleet: ${stats.totalCount} machines`}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("all")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus("all");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] ${
          currentStatus === "all" && healthStatusFilter === "all"
            ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30 hover:shadow-xs active:bg-[var(--color-hairline-soft-surface)]"
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] truncate">
          {userRole === "operator" ? "Assigned Fleet" : "Total Fleet"}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-[var(--color-ink)] mt-1">
          <AnimatedCounter value={stats.totalCount} />
        </div>
      </motion.div>

      {/* Available Fleet Card */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={currentStatus === "available"}
        aria-label={`Available machines: ${stats.availableCount}`}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("available")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus("available");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] ${
          currentStatus === "available"
            ? "bg-emerald-50/60 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40 hover:shadow-xs active:bg-[var(--color-hairline-soft-surface)]"
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
          Available
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-emerald-700 dark:text-emerald-300 mt-1">
          <AnimatedCounter value={stats.availableCount} />
        </div>
      </motion.div>

      {/* On Rent Fleet Card */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={currentStatus === "rented"}
        aria-label={`On rent machines: ${stats.rentedCount}`}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("rented")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectStatus("rented");
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] ${
          currentStatus === "rented"
            ? "bg-sky-50/60 border-sky-500 shadow-xs ring-1 ring-sky-500/20 dark:bg-sky-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-sky-500/40 hover:shadow-xs active:bg-[var(--color-hairline-soft-surface)]"
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 truncate">
          On Rent
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-sky-700 dark:text-sky-300 mt-1">
          <AnimatedCounter value={stats.rentedCount} />
        </div>
      </motion.div>

      {/* Breakdown Events Card */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={healthStatusFilter === "breakdown"}
        aria-label={`Breakdown events: ${stats.breakdownCount}`}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleBreakdown}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleBreakdown();
          }
        }}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] ${
          healthStatusFilter === "breakdown"
            ? "bg-rose-50/60 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40 hover:shadow-xs active:bg-[var(--color-hairline-soft-surface)]"
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">
          Breakdown Events
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-rose-700 dark:text-rose-300 mt-1">
          <AnimatedCounter value={stats.breakdownCount} />
        </div>
      </motion.div>
    </div>
  );
};
