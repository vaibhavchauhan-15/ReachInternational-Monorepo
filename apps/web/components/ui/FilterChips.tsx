"use client";

import React from "react";
import { AnimatedX, AnimatedRotateCcw } from "./animated-icons";

export interface FilterChipItem {
  id: string;
  label: string;
  valueLabel: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: FilterChipItem[];
  onClearAll?: () => void;
  className?: string;
}

export function FilterChips({ chips, onClearAll, className = "" }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 pt-1 ${className}`}>
      <span className="text-[11px] font-semibold text-[var(--color-mute)] mr-0.5">
        Active Filters:
      </span>

      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-medium animate-in fade-in zoom-in-95 duration-150"
        >
          <span className="text-sky-900 dark:text-sky-200 font-semibold">{chip.label}:</span>
          <span className="truncate max-w-[140px]">{chip.valueLabel}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:bg-sky-500/20 rounded p-0.5 transition-colors cursor-pointer"
            aria-label={`Remove ${chip.label} filter`}
          >
            <AnimatedX size={11} />
          </button>
        </span>
      ))}

      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-[var(--color-mute)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
        >
          <AnimatedRotateCcw size={11} />
          <span>Clear All</span>
        </button>
      )}
    </div>
  );
}
