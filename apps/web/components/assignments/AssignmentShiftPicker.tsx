"use client";

import React from "react";
import { Clock, AlertCircle } from "lucide-react";
import type { ClientShiftCode } from "@reachinternational/types";
import { formatTo12Hour } from "@reachinternational/utils";
import { cn } from "@/lib/utils";

export interface AssignmentShiftPickerProps {
  shifts: ClientShiftCode[];
  selectedCode: string;
  onSelectShift: (code: string) => void;
  disabledCodes?: string[];
  conflictNotice?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function AssignmentShiftPicker({
  shifts,
  selectedCode,
  onSelectShift,
  disabledCodes = [],
  conflictNotice = {},
  disabled = false,
  className,
  label = "Select Shift Schedule",
}: AssignmentShiftPickerProps) {
  const disabledSet = new Set(disabledCodes);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink)]">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            {label}
          </span>
          <span className="text-[10px] text-[var(--color-mute)] font-mono">
            {shifts.length} configured shifts
          </span>
        </div>
      )}

      {/* Shift Option Buttons — Responsive Grid: 1 column on mobile, 3 columns on tablet/desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
        {shifts.map((shift) => {
          const isSelected = selectedCode.trim().toUpperCase() === shift.code.trim().toUpperCase();
          const isDisabled = disabled || disabledSet.has(shift.code);
          const conflict = conflictNotice[shift.code];

          const displayStart = formatTo12Hour(shift.start_time) || shift.start_time;
          const displayEnd = formatTo12Hour(shift.end_time) || shift.end_time;
          const timeRange = displayStart && displayEnd ? `${displayStart} – ${displayEnd}` : "";

          // Client's shift name: keep only client's shift name, with zero duplicate names
          const shiftName =
            shift.name && shift.name.trim()
              ? shift.name.trim()
              : shift.code?.trim()
              ? shift.code.toLowerCase().startsWith("shift")
                ? shift.code.trim()
                : `Shift ${shift.code.trim()}`
              : "Shift";

          return (
            <button
              key={shift.code}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectShift(shift.code)}
              className={cn(
                "relative flex items-center justify-between sm:flex-col sm:items-start sm:justify-center rounded-xl border text-left select-none",
                "transition-all duration-200 ease-out outline-none min-h-[48px] sm:min-h-[52px] px-3 sm:px-3.5 py-2 sm:py-2.5 min-w-0 cursor-pointer touch-manipulation",
                "active:scale-[0.99]",
                isDisabled
                  ? "opacity-50 cursor-not-allowed bg-[var(--color-hairline-soft-surface)]/20 border-[var(--color-hairline)]"
                  : isSelected
                  ? "border-[var(--color-primary)] bg-sky-50 dark:bg-sky-950/40 text-[var(--color-ink)] ring-1 ring-[var(--color-primary)] shadow-xs"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]/50",
                conflict && "border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20"
              )}
              title={`${shiftName}${timeRange ? `: ${timeRange}` : ""}`}
            >
              {/* Mobile View (< sm): Left Identity, Right Timings + Indicator */}
              <div className="flex sm:hidden items-center justify-between w-full min-w-0 gap-2">
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    "text-xs truncate block",
                    isSelected ? "font-bold text-[var(--color-ink)]" : "font-semibold text-[var(--color-ink)]"
                  )}>
                    {shiftName}
                  </span>
                  {conflict && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                      <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{conflict}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {timeRange && (
                    <span className="text-[11px] font-mono text-[var(--color-mute)] whitespace-nowrap">
                      {timeRange}
                    </span>
                  )}
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                        : "border-[var(--color-hairline)] bg-[var(--color-canvas)]"
                    )}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </div>
              </div>

              {/* Tablet & Desktop View (sm+): Top Name & Dot, Bottom Timings */}
              <div className="hidden sm:flex flex-col justify-center items-start leading-tight min-w-0 w-full select-none">
                <div className="flex items-center justify-between gap-1 w-full min-w-0">
                  <span className={cn(
                    "text-xs truncate",
                    isSelected ? "font-bold text-[var(--color-ink)]" : "font-semibold text-[var(--color-ink)]"
                  )}>
                    {shiftName}
                  </span>
                  {isSelected ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] shrink-0 animate-pulse" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-hairline)] shrink-0" />
                  )}
                </div>
                {timeRange && (
                  <div className="text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)] mt-1 truncate w-full">
                    {timeRange}
                  </div>
                )}
                {conflict && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                    <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{conflict}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
