"use client";

import React from "react";
import { Users, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedAssignmentSummaryItem {
  id: string; // unique item key or assignment ID
  title: string; // Operator name or Machine code
  subtitle?: string | null;
  employeeId?: string | null;
  shiftCode: string;
  shiftName?: string | null;
  shiftTiming?: string | null;
  avatarInitials?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  notes?: string | null;
  isInherited?: boolean;
  conflict?: string | null;
}

export interface AssignmentSelectionSummaryProps {
  items: SelectedAssignmentSummaryItem[];
  onRemoveItem: (id: string, shiftCode?: string) => void;
  maxCapacity?: number;
  capacityLabel?: string;
  showCapacityBadge?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  conflictMessage?: string | null;
  disabled?: boolean;
  className?: string;
}

export function formatShiftBadge(shiftCode: string, shiftName?: string | null): string {
  if (shiftName) {
    const cleaned = shiftName.replace(/\s*\([^)]*\)/g, "").trim();
    if (cleaned.toLowerCase().startsWith("shift")) {
      return cleaned;
    }
  }
  const code = (shiftCode || "").trim();
  if (!code) return "Shift";
  if (code.toLowerCase().startsWith("shift")) {
    return code;
  }
  return `Shift ${code}`;
}

export function AssignmentSelectionSummary({
  items,
  onRemoveItem,
  maxCapacity = 3,
  capacityLabel = "24h Shift Coverage Roster",
  showCapacityBadge = false,
  emptyTitle = "No Active Roster Assignments",
  emptyDescription = "Select a candidate from the list above and assign them to a shift schedule.",
  conflictMessage,
  disabled = false,
  className,
}: AssignmentSelectionSummaryProps) {
  const currentCount = items.length;
  const isFull = currentCount >= maxCapacity;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with Capacity Badge & Progress Indicator */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--color-ink)]">{capacityLabel}</span>
          {showCapacityBadge && (
            <span
              className={cn(
                "font-mono text-[10px] px-2 py-0.5 rounded-full font-bold border",
                isFull
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  : "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
              )}
            >
              {currentCount} / {maxCapacity} shifts
            </span>
          )}
        </div>

        {/* Mini progress dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: maxCapacity }).map((_, idx) => (
            <span
              key={idx}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                idx < currentCount
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-hairline)]"
              )}
            />
          ))}
        </div>
      </div>

      {/* Global Conflict Warning */}
      {conflictMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{conflictMessage}</span>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30 space-y-1">
          <Users className="h-6 w-6 mx-auto text-[var(--color-mute)] mb-1" />
          <p className="text-xs font-semibold text-[var(--color-ink)]">{emptyTitle}</p>
          <p className="text-[11px] text-[var(--color-mute)]">{emptyDescription}</p>
        </div>
      ) : (
        /* List of Assigned Roster Cards */
        <div className="divide-y divide-[var(--color-hairline)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden text-xs">
          {items.map((item) => {
            const shiftBadgeText = formatShiftBadge(item.shiftCode, item.shiftName);
            const empId = item.employeeId || item.subtitle;
            const initials = item.avatarInitials || (item.title ? item.title.slice(0, 2).toUpperCase() : "OP");

            return (
              <div
                key={`${item.id}-${item.shiftCode}`}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 transition-colors hover:bg-[var(--color-hairline-soft-surface)]/30",
                  item.conflict && "bg-rose-50/60 dark:bg-rose-950/30"
                )}
              >
                {/* Left Identity + Shift info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Current Avatar */}
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={item.title}
                      className="h-8 w-8 shrink-0 rounded-lg object-cover border border-[var(--color-hairline)] select-none"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-ink)] text-white dark:bg-white dark:text-[#171717] text-xs font-mono font-bold shadow-2xs select-none">
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Operator Name & Assign Shift Name Chip/Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[var(--color-ink)] truncate max-w-[200px] sm:max-w-none">
                        {item.title}
                      </span>
                      <span className="inline-flex items-center font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                        {shiftBadgeText}
                      </span>
                    </div>

                    {/* Emp ID Only */}
                    {empId && (
                      <div className="text-[11px] text-[var(--color-mute)] font-mono truncate">
                        {empId}
                      </div>
                    )}

                    {item.conflict && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                        <span>{item.conflict}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action: Remove Button */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemoveItem(item.id, item.shiftCode)}
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  title={`Remove ${item.title} from ${shiftBadgeText}`}
                  aria-label={`Remove ${item.title} from ${shiftBadgeText}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
