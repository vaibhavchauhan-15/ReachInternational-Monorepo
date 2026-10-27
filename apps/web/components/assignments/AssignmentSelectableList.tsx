"use client";

import React, { useRef, useEffect } from "react";
import { Check, AlertCircle, Phone, Mail, Clock, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface AssignmentCandidateItem {
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  statusBadge?: {
    label: string;
    variant?: "default" | "success" | "warning" | "error" | "info" | "neutral" | "active" | "inactive" | "overdue";
  };
  details?: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
  avatarInitials?: string | null;
  isInherited?: boolean;
}

export interface AssignmentSelectableListProps {
  items: AssignmentCandidateItem[];
  selectedIds: string[];
  onSelect: (item: AssignmentCandidateItem) => void;
  isMultiSelect?: boolean;
  maxSelections?: number;
  emptyMessage?: string;
  className?: string;
  listMaxHeight?: string;
}

export function AssignmentSelectableList({
  items,
  selectedIds,
  onSelect,
  isMultiSelect = false,
  maxSelections,
  emptyMessage = "No candidates match the filter criteria.",
  className,
  listMaxHeight = "max-h-[360px]",
}: AssignmentSelectableListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(selectedIds);

  const handleKeyDown = (e: React.KeyboardEvent, item: AssignmentCandidateItem) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!item.disabled) {
        onSelect(item);
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-8 px-4 text-center rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 text-xs text-[var(--color-mute)] space-y-1">
        <p className="font-semibold text-[var(--color-ink)]">No items available</p>
        <p className="text-[11px]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role={isMultiSelect ? "listbox" : "radiogroup"}
      aria-multiselectable={isMultiSelect}
      className={cn(
        "divide-y divide-[var(--color-hairline)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-y-auto",
        listMaxHeight,
        className
      )}
    >
      {items.map((item) => {
        const isSelected = selectedSet.has(item.id);
        const isDisabled = Boolean(
          item.disabled ||
            (!isSelected && isMultiSelect && maxSelections && selectedIds.length >= maxSelections)
        );

        return (
          <div
            key={item.id}
            role={isMultiSelect ? "option" : "radio"}
            aria-selected={isSelected}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            onClick={() => {
              if (!isDisabled) onSelect(item);
            }}
            onKeyDown={(e) => handleKeyDown(e, item)}
            className={cn(
              "group relative flex items-center justify-between gap-3 p-3 transition-colors select-none",
              isDisabled
                ? "opacity-55 cursor-not-allowed bg-[var(--color-hairline-soft-surface)]/20"
                : "cursor-pointer hover:bg-[var(--color-hairline-soft-surface)]/70 active:bg-[var(--color-hairline-soft-surface)]",
              isSelected && !isDisabled && "bg-sky-50/70 dark:bg-sky-950/30"
            )}
          >
            {/* Left Selection Indicator + Avatar/Identity */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Radio or Checkbox visual marker */}
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center border transition-all",
                  isMultiSelect ? "rounded" : "rounded-full",
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-2xs"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas)] group-hover:border-[var(--color-mute)]"
                )}
              >
                {isSelected && (
                  <Check
                    className={cn(
                      "text-white stroke-[3]",
                      isMultiSelect ? "h-2.5 w-2.5" : "h-2 w-2"
                    )}
                  />
                )}
              </div>

              {/* Avatar Initial (Monochromatic) */}
              {item.avatarInitials && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-ink)] text-white dark:bg-white dark:text-[#171717] text-xs font-mono font-bold shadow-2xs">
                  {item.avatarInitials}
                </div>
              )}

              {/* Identity & Metadata Details */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-semibold truncate",
                      isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-ink)]"
                    )}
                  >
                    {item.title}
                  </span>

                  {item.subtitle && (
                    <span className="font-mono text-[10px] text-[var(--color-mute)] bg-[var(--color-hairline-soft-surface)] px-1.5 py-0.2 rounded border border-[var(--color-hairline)] shrink-0">
                      {item.subtitle}
                    </span>
                  )}

                  {item.isInherited && (
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold border bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 shrink-0">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      INHERITED
                    </span>
                  )}

                  {item.statusBadge && (
                    <Badge variant={item.statusBadge.variant || "neutral"}>
                      {item.statusBadge.label}
                    </Badge>
                  )}
                </div>

                {/* Second row: Contact / Location / Role info */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-mute)] font-mono">
                  {item.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" />
                      {item.phone}
                    </span>
                  )}
                  {item.email && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                      <Mail className="h-2.5 w-2.5 shrink-0" />
                      {item.email}
                    </span>
                  )}
                  {item.meta && <span>{item.meta}</span>}
                  {item.details && <span>{item.details}</span>}
                </div>
              </div>
            </div>

            {/* Right Status / Disabled Notice */}
            {isDisabled && item.disabledReason && (
              <div className="shrink-0 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{item.disabledReason}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
