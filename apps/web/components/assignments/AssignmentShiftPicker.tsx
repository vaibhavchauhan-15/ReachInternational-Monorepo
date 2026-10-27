"use client";

import React from "react";
import { Clock, Sun, Moon, AlertCircle } from "lucide-react";
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {shifts.map((shift) => {
          const isSelected = selectedCode.trim().toUpperCase() === shift.code.trim().toUpperCase();
          const isDisabled = disabled || disabledSet.has(shift.code);
          const conflict = conflictNotice[shift.code];

          const isNight =
            shift.code.toLowerCase().includes("night") ||
            shift.code === "S3" ||
            (shift.start_time && parseInt(shift.start_time.split(":")[0], 10) >= 20);

          const displayStart = formatTo12Hour(shift.start_time) || shift.start_time;
          const displayEnd = formatTo12Hour(shift.end_time) || shift.end_time;

          return (
            <button
              key={shift.code}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectShift(shift.code)}
              className={cn(
                "relative flex flex-col p-2.5 rounded-xl border text-left transition-all min-h-[52px] select-none",
                isDisabled
                  ? "opacity-50 cursor-not-allowed bg-[var(--color-hairline-soft-surface)]/20 border-[var(--color-hairline)]"
                  : isSelected
                  ? "border-[var(--color-primary)] bg-sky-50 dark:bg-sky-950/40 text-[var(--color-ink)] shadow-2xs ring-1 ring-[var(--color-primary)]"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]/50",
                conflict && "border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20"
              )}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {isNight ? (
                    <Moon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span>Shift {shift.code}</span>
                </div>
                {isSelected && (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                )}
              </div>

              {shift.name && shift.name.trim().toLowerCase() !== `shift ${shift.code}`.toLowerCase() && (
                <div className="text-[11px] font-semibold text-[var(--color-ink)] mt-0.5 truncate">
                  {shift.name}
                </div>
              )}

              <div className="text-[11px] font-mono text-[var(--color-mute)] mt-1">
                {displayStart} – {displayEnd}
              </div>

              {conflict && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{conflict}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
