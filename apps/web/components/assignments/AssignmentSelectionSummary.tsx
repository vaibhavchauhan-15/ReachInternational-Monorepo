"use client";

import React from "react";
import { Users, Trash2, Clock, AlertCircle, Shield, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface SelectedAssignmentSummaryItem {
  id: string; // unique item key or assignment ID
  title: string; // Operator name or Machine code
  subtitle?: string | null;
  shiftCode: string;
  shiftName?: string | null;
  shiftTiming?: string | null;
  avatarInitials?: string | null;
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
  emptyTitle?: string;
  emptyDescription?: string;
  conflictMessage?: string | null;
  disabled?: boolean;
  className?: string;
}

export function AssignmentSelectionSummary({
  items,
  onRemoveItem,
  maxCapacity = 3,
  capacityLabel = "24h Shift Coverage Roster",
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
          {items.map((item) => (
            <div
              key={`${item.id}-${item.shiftCode}`}
              className={cn(
                "flex items-center justify-between gap-3 p-3 transition-colors",
                item.conflict && "bg-rose-50/60 dark:bg-rose-950/30"
              )}
            >
              {/* Left Identity + Shift info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {item.avatarInitials && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-ink)] text-white dark:bg-white dark:text-[#171717] text-xs font-mono font-bold shadow-2xs">
                    {item.avatarInitials}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-[var(--color-ink)] truncate">
                      {item.title}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                      Shift {item.shiftCode}
                    </span>
                    {item.shiftName && (
                      <span className="text-[11px] font-medium text-[var(--color-ink)] truncate max-w-[140px] shrink-0">
                        • {item.shiftName}
                      </span>
                    )}
                    {item.shiftTiming && (
                      <span className="font-mono text-[10px] text-[var(--color-mute)] shrink-0">
                        ({item.shiftTiming})
                      </span>
                    )}
                  </div>

                  {item.subtitle && (
                    <div className="text-[11px] text-[var(--color-mute)] font-mono truncate">
                      {item.subtitle}
                      {item.phone && ` • ${item.phone}`}
                    </div>
                  )}

                  {item.conflict && (
                    <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
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
                title={`Remove ${item.title} from Shift ${item.shiftCode}`}
                aria-label={`Remove ${item.title} from Shift ${item.shiftCode}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
