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
  getAssignedInfo,
}: ShiftCardSelectorProps) {
  if (!shiftCodes || shiftCodes.length === 0) {
    return null;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Select Shift Schedule"
      className={cn(
        "flex items-stretch gap-1.5 sm:gap-2 w-full overflow-x-auto pb-1 scrollbar-none",
        className
      )}
    >
      {shiftCodes.map((sc) => {
        const scNorm = sc.code.replace(/^shift\s+/i, "").trim().toUpperCase();
        const selNorm = (selectedCode || "").replace(/^shift\s+/i, "").trim().toUpperCase();
        const isSelected = (selectedCode || "").toUpperCase() === sc.code.toUpperCase() || (selNorm !== "" && selNorm === scNorm);
        const normalHours = (sc.normal_minutes / 60).toFixed(0);
        const otHours = ((sc.scheduled_minutes - sc.normal_minutes) / 60).toFixed(0);
        const assignedInfo = getAssignedInfo ? getAssignedInfo(sc.code) : undefined;
        const compactRange = formatCompactShiftRange(sc.start_time, sc.end_time);

        return (
          <button
            key={sc.id || sc.code}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(sc)}
            className={cn(
              "relative flex flex-col justify-between rounded-xl border text-left cursor-pointer select-none",
              "transition-all duration-300 ease-out outline-none min-h-[52px]",
              isSelected
                ? "flex-[2.5] min-w-[135px] sm:min-w-[160px] bg-[var(--color-ink)] text-white border-[var(--color-ink)] shadow-xs py-2 px-3"
                : "flex-1 min-w-[62px] sm:min-w-[76px] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/40 hover:bg-[var(--color-hairline-soft-surface)] py-2 px-2.5",
              assignedInfo?.isAssigned && !isSelected && "border-amber-500/30 bg-amber-500/[0.03]"
            )}
            title={`${getShiftDisplayTitle(sc)}: ${compactRange}`}
          >
            {/* Header row: Shift Code + Night Moon Icon */}
            <div className="flex items-center justify-between gap-1 w-full">
              <div className="flex flex-col min-w-0">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span
                    className={cn(
                      "font-extrabold text-xs whitespace-nowrap leading-none",
                      isSelected ? "text-white" : "text-[var(--color-ink)]"
                    )}
                  >
                    {getShiftDisplayTitle(sc)}
                  </span>
                </div>
              </div>

              {/* Moon icon only shown when expanded (selected) */}
              {isSelected && sc.crosses_midnight && (
                <Moon
                  size={12}
                  className="h-3 w-3 shrink-0 text-white/90"
                  aria-label="Night Shift"
                />
              )}
            </div>

            {/* EXPANDED STATE ONLY: Visible when card is selected and grown */}
            {isSelected ? (
              <div className="mt-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-[9px] sm:text-[10px] font-mono font-medium text-white/90 whitespace-nowrap tracking-tight leading-tight">
                  {compactRange}
                </div>
                <div className="text-[8px] font-medium text-white/70 whitespace-nowrap leading-tight">
                  {normalHours}h norm{Number(otHours) > 0 ? ` + ${otHours}h OT` : ""}
                </div>
                {assignedInfo?.isAssigned && (
                  <span className="text-[9px] font-medium mt-0.5 truncate px-1 py-0.5 rounded bg-white/20 text-white">
                    {assignedInfo.label || "Covered"}
                  </span>
                )}
              </div>
            ) : assignedInfo?.isAssigned ? (
              /* REST STATE WITH ASSIGNMENT: Compact dot and short label */
              <div className="flex items-center gap-1 mt-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[9px] text-[var(--color-mute)] truncate">
                  {assignedInfo.label || "Covered"}
                </span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
