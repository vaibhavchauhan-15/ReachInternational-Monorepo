"use client";

import React from "react";
import { UserCheck, Clock, AlertCircle } from "lucide-react";

export interface TodayShiftSummary {
  total: number;
  entered: number;
  pending: number;
  unassigned: number;
}

export interface TodayShiftMonitorKPIStripProps {
  summary: TodayShiftSummary;
}

export function TodayShiftMonitorKPIStrip({
  summary,
}: TodayShiftMonitorKPIStripProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4">
        <div className="text-xs text-muted-foreground font-medium">Total Roster</div>
        <div className="text-2xl font-bold text-[var(--color-ink)] mt-1">{summary.total}</div>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4">
        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
          <UserCheck size={12} /> Entered
        </div>
        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{summary.entered}</div>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:p-4">
        <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
          <Clock size={12} /> Pending
        </div>
        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{summary.pending}</div>
      </div>
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 sm:p-4">
        <div className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
          <AlertCircle size={12} /> Unassigned
        </div>
        <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{summary.unassigned}</div>
      </div>
    </div>
  );
}
