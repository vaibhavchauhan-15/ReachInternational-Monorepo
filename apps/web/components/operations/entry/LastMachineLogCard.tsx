"use client";

import React from "react";
import { formatDate, formatTo12Hour } from "@reachinternational/utils";
import type { OperatorLastLogSummary } from "@reachinternational/types";
import { UserCheck } from "lucide-react";

interface LastMachineLogCardProps {
  lastLog?: OperatorLastLogSummary | null;
  machineId?: string;
}

export function LastMachineLogCard({ lastLog }: LastMachineLogCardProps) {
  if (!lastLog) {
    return (
      <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between text-[11px] sm:text-xs text-emerald-800/70 dark:text-emerald-300/70">
        <span>No previous shift log recorded for this machine yet.</span>
        <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded border border-emerald-500/25">
          First Entry
        </span>
      </div>
    );
  }

  const endFormatted = formatTo12Hour(lastLog.end_time) || "—";
  const dateFormatted = formatDate(lastLog.log_date) || "—";
  const submittedUserName = lastLog.entered_by_name || lastLog.operator_name || "Operator";
  const isAssisted = Boolean(lastLog.entry_source && lastLog.entry_source !== "operator");

  return (
    <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/25 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-emerald-800 dark:text-emerald-300 font-mono pb-2 border-b border-emerald-500/20">
        <span>Last Shift</span>
        {isAssisted && (
          <span className="inline-flex items-center gap-1 font-mono text-[8px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-800 dark:text-sky-200 border border-sky-500/30 normal-case">
            <UserCheck size={9} />
            Assisted Entry
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 divide-y sm:divide-y-0 divide-emerald-500/20">
        {/* 1. Last Recorded Date */}
        <div className="flex sm:flex-col items-center sm:items-start justify-between pt-1 sm:pt-0">
          <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium">Last Recorded Date</span>
          <span className="font-mono text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 sm:mt-0.5">
            {dateFormatted}
          </span>
        </div>

        {/* 2. Shift End Time */}
        <div className="flex sm:flex-col items-center sm:items-start justify-between pt-2 sm:pt-0">
          <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium">Shift End Time</span>
          <span className="font-mono text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 sm:mt-0.5">
            {endFormatted}
          </span>
        </div>

        {/* 3. Last Entry By */}
        <div className="flex sm:flex-col items-center sm:items-start justify-between pt-2 sm:pt-0">
          <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium">Last Entry By</span>
          <span className="font-mono text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 truncate sm:mt-0.5">
            {submittedUserName}
          </span>
        </div>
      </div>
    </div>
  );
}
