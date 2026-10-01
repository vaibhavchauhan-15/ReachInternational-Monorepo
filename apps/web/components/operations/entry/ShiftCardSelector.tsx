"use client";

import React from "react";
import { Moon } from "lucide-react";
import type { ClientShiftCode } from "@reachinternational/types";
import { cn } from "@/lib/utils";

export interface ShiftCardSelectorProps {
  shiftCodes: ClientShiftCode[];
  selectedCode?: string;
  onSelect: (sc: ClientShiftCode) => void;
  className?: string;
  getAssignedInfo?: (code: string) => { isAssigned: boolean; label?: string } | undefined;
  todayLoggedShiftCodes?: string[];
  todayLogs?: Array<{
    shift_code: string;
    start_meter: number;
    end_meter: number;
    running_hours: number;
  }>;
}

/**
 * Strips leading zero from hours and removes space before AM/PM.
 * e.g. "06:00 AM" -> "6:00AM", "02:00 PM" -> "2:00PM"
 */
export function formatCompactTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  // Remove leading zero on hour, then remove space before AM/PM
  return timeStr.trim().replace(/^0(\d:)/, "$1").replace(/\s+(AM|PM)$/i, "$1");
}

/**
 * Formats start–end times as a tight single-string range.
 * Example: "6:00AM-2:00PM"
 */
export function formatCompactShiftRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "";
  const s = formatCompactTime(start);
  const e = formatCompactTime(end);
  if (s && e) return `${s}-${e}`;
  return s || e || "";
}

import { getShiftDisplayTitle, getShiftSubtitle } from "@reachinternational/utils";
export { getShiftDisplayTitle, getShiftSubtitle };


export function ShiftCardSelector({
  shiftCodes,
  selectedCode,
  onSelect,
  className,
  todayLoggedShiftCodes = [],
}: ShiftCardSelectorProps) {
  if (!shiftCodes || shiftCodes.length === 0) {
    return null;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Select Shift Schedule"
      className={cn(
        "flex items-stretch gap-1.5 sm:gap-2 w-full",
        className
      )}
    >
      {shiftCodes.map((sc) => {
        const scNorm = sc.code.replace(/^shift\s+/i, "").trim().toUpperCase();
        const selNorm = (selectedCode || "").replace(/^shift\s+/i, "").trim().toUpperCase();
        const isSelected =
          (selectedCode || "").toUpperCase() === sc.code.toUpperCase() ||
          (selNorm !== "" && selNorm === scNorm);
        const compactRange = formatCompactShiftRange(sc.start_time, sc.end_time);
        const isLoggedToday = todayLoggedShiftCodes.some(
          (c) =>
            c.toUpperCase() === sc.code.toUpperCase() ||
            c.replace(/^shift\s+/i, "").trim().toUpperCase() === scNorm
        );

        return (
          <button
            key={sc.id || sc.code}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(sc)}
            className={cn(
              "relative flex flex-col justify-center rounded-xl border text-left cursor-pointer select-none",
              "transition-all duration-200 ease-out outline-none min-h-[44px] h-[44px] px-2 sm:px-3 py-1.5 min-w-0",
              // Grow & shrink behavior: selected card grows (flex-[1.5] on mobile, flex-[1.3] on desktop), unselected shrink (flex-1), fitting 360px seamlessly
              isSelected
                ? "flex-[1.5] sm:flex-[1.3] shadow-xs"
                : "flex-1 hover:bg-[var(--color-hairline-soft-surface)]",
              // Color styling:
              // - Submitted shift -> Green (emerald)
              // - Other selected shift -> Blue (sky)
              // - Other unselected shift -> Canvas elevated
              isLoggedToday
                ? isSelected
                  ? "bg-emerald-600 dark:bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500 ring-1 ring-emerald-500/40"
                  : "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 dark:border-emerald-500/50 hover:bg-emerald-500/20"
                : isSelected
                ? "bg-sky-600 dark:bg-sky-500 text-white border-sky-600 dark:border-sky-500 ring-1 ring-sky-500/30"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-sky-500/40"
            )}
            title={`${getShiftDisplayTitle(sc)}${compactRange ? `: ${compactRange}` : ""}${isLoggedToday ? " (Logged Today)" : ""}`}
          >
            {isSelected ? (
              /* EXPANDED (SELECTED) STATE: Exactly TWO lines (Name and Shift Time) */
              <div className="flex flex-col justify-center items-start leading-tight min-w-0 w-full select-none">
                <div className="flex items-center gap-1 min-w-0 w-full">
                  <span className="font-extrabold text-[11px] sm:text-xs text-white leading-tight truncate">
                    {isLoggedToday ? `✓ ${getShiftDisplayTitle(sc)}` : getShiftDisplayTitle(sc)}
                  </span>
                  {sc.crosses_midnight && (
                    <Moon
                      size={10}
                      className="h-2.5 w-2.5 shrink-0 text-white/80"
                      aria-label="Night Shift"
                    />
                  )}
                </div>
                {compactRange ? (
                  <span className="text-[8.5px] sm:text-[10px] font-mono font-medium text-white/95 leading-tight mt-0.5 whitespace-nowrap truncate tracking-tighter sm:tracking-tight">
                    {compactRange}
                  </span>
                ) : null}
              </div>
            ) : (
              /* CLOSED (UNSELECTED) STATE: Exactly ONE line (Only Name) */
              <div className="flex flex-col justify-center items-center sm:items-start leading-tight min-w-0 w-full select-none">
                <span
                  className={cn(
                    "font-bold text-[11px] sm:text-xs leading-tight truncate",
                    isLoggedToday ? "text-emerald-800 dark:text-emerald-300" : "text-[var(--color-ink)]"
                  )}
                >
                  {isLoggedToday ? `✓ ${getShiftDisplayTitle(sc)}` : getShiftDisplayTitle(sc)}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
