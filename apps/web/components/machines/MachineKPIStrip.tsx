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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
      {/* Total Card */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("all")}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          currentStatus === "all"
            ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
        }`}
      >
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
          {userRole === "operator" ? "Assigned Fleet" : "Total Fleet"}
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] mt-1">
          <AnimatedCounter value={stats.totalCount} />
        </div>
      </motion.div>

      {/* Available Card */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("available")}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          currentStatus === "available"
            ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
        }`}
      >
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Available
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
          <AnimatedCounter value={stats.availableCount} />
        </div>
      </motion.div>

      {/* Rented Card */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectStatus("rented")}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          currentStatus === "rented"
            ? "bg-sky-50/40 border-sky-500 shadow-xs ring-1 ring-sky-500/20 dark:bg-sky-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-sky-500/40"
        }`}
      >
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
          On Rent
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1">
          <AnimatedCounter value={stats.rentedCount} />
        </div>
      </motion.div>

      {/* Breakdown Card */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={onToggleBreakdown}
        className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
          healthStatusFilter === "breakdown"
            ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
        }`}
      >
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          Breakdown Events
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
          <AnimatedCounter value={stats.breakdownCount} />
        </div>
      </motion.div>
    </div>
  );
};
