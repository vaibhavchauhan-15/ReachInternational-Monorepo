"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { CustomTimePicker } from "@/components/ui";

interface BreakdownSectionProps {
  isBreakdown: boolean;
  onToggleBreakdown: (val: boolean) => void;
  breakdownStartTime: string;
  breakdownEndTime: string;
  onBreakdownStartTimeChange: (val: string) => void;
  onBreakdownEndTimeChange: (val: string) => void;
  breakdownDurationText?: string;
  breakdownReason: string;
  onBreakdownReasonChange: (val: string) => void;
}

export function BreakdownSection({
  isBreakdown,
  onToggleBreakdown,
  breakdownStartTime,
  breakdownEndTime,
  onBreakdownStartTimeChange,
  onBreakdownEndTimeChange,
  breakdownDurationText,
  breakdownReason,
  onBreakdownReasonChange,
}: BreakdownSectionProps) {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
        isBreakdown
          ? "border-rose-500/30 bg-rose-500/5"
          : "border-[var(--color-hairline)] bg-[var(--color-canvas)]/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
              isBreakdown
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)]"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-ink)]">
              Machine Breakdown
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleBreakdown(!isBreakdown)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isBreakdown
              ? "bg-rose-600 text-white shadow-xs hover:bg-rose-700"
              : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-[var(--color-hairline)]"
          }`}
        >
          {isBreakdown ? "Remove" : "+ Add"}
        </button>
      </div>

      {isBreakdown && (
        <div className="mt-3 pt-3 border-t border-rose-500/20 space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <CustomTimePicker
                label={
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Breakdown Start
                  </span>
                }
                hideIcon={true}
                value={breakdownStartTime}
                onChange={onBreakdownStartTimeChange}
                required={isBreakdown}
              />
            </div>

            <div>
              <CustomTimePicker
                label={
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Breakdown End
                  </span>
                }
                hideIcon={true}
                value={breakdownEndTime}
                onChange={onBreakdownEndTimeChange}
                required={isBreakdown}
              />
            </div>
          </div>

          {breakdownDurationText && (
            <div className="px-2.5 py-1.5 sm:py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] sm:text-xs font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-1.5 leading-tight">
              <span className="shrink-0">Duration Window:</span>
              <span className="text-right truncate sm:overflow-visible">{breakdownDurationText}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)] mb-1.5 block">
              Breakdown Reason &amp; Action Taken
            </label>
            <textarea
              rows={2}
              value={breakdownReason}
              onChange={(e) => onBreakdownReasonChange(e.target.value)}
              placeholder="e.g. Hydraulic pipe leakage replaced by field engineer..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
