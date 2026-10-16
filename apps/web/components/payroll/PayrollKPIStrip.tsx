"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  AnimatedCreditCard,
  AnimatedBriefcase,
  AnimatedClock,
  AnimatedCalendar,
} from "@/components/ui/animated-icons";

export interface PayrollKPIStats {
  totalGross: number;
  totalNet: number;
  totalPaid: number;
  totalBalance: number;
  totalAttendedDays: number;
  totalOtDays: number;
}

export interface PayrollKPIStripProps {
  kpis: PayrollKPIStats;
  isPending?: boolean;
}

export function PayrollKPIStrip({ kpis, isPending }: PayrollKPIStripProps) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 transition-opacity ${
        isPending ? "opacity-75 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Total Gross Payroll */}
      <motion.div
        data-hover-parent
        whileTap={{ scale: 0.98 }}
        className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-[var(--color-ink)]/30 active:scale-[0.98]"
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">
            Total Gross Payroll
          </span>
          <AnimatedCreditCard size={16} className="w-4 h-4 shrink-0 text-sky-500" />
        </div>
        <div className="mt-2 text-base sm:text-xl lg:text-2xl font-extrabold text-[var(--color-ink)] font-mono tabular-nums truncate">
          ₹{kpis.totalGross.toLocaleString("en-IN")}
        </div>
      </motion.div>

      {/* Total Net Payable */}
      <motion.div
        data-hover-parent
        whileTap={{ scale: 0.98 }}
        className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-emerald-500/40 active:scale-[0.98]"
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
            Net Payable
          </span>
          <AnimatedBriefcase size={16} className="w-4 h-4 shrink-0 text-emerald-500" />
        </div>
        <div className="mt-2 text-base sm:text-xl lg:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums truncate">
          ₹{kpis.totalNet.toLocaleString("en-IN")}
        </div>
      </motion.div>

      {/* Disbursed vs Unpaid Balance */}
      <motion.div
        data-hover-parent
        whileTap={{ scale: 0.98 }}
        className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-amber-500/40 active:scale-[0.98]"
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
            Disbursed vs Unpaid
          </span>
          <AnimatedClock size={16} className="w-4 h-4 shrink-0 text-amber-500" />
        </div>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 text-base sm:text-xl lg:text-2xl font-extrabold text-[var(--color-ink)] font-mono tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">
            ₹{kpis.totalPaid.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] sm:text-xs font-normal text-[var(--color-mute)] truncate">
            / bal ₹{kpis.totalBalance.toLocaleString("en-IN")}
          </span>
        </div>
      </motion.div>

      {/* Total Working & Attended Days */}
      <motion.div
        data-hover-parent
        whileTap={{ scale: 0.98 }}
        className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-indigo-500/40 active:scale-[0.98]"
      >
        <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 truncate">
            Days &amp; Leave Summary
          </span>
          <AnimatedCalendar size={16} className="w-4 h-4 shrink-0 text-indigo-500" />
        </div>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 text-base sm:text-xl lg:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
          <span>{kpis.totalAttendedDays} d</span>
          <span className="text-[10px] sm:text-xs font-normal text-[var(--color-mute)] truncate">
            / OT {kpis.totalOtDays} d
          </span>
        </div>
      </motion.div>
    </div>
  );
}
