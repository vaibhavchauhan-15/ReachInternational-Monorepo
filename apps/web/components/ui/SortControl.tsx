"use client";

import React from "react";
import { FilterDropdown, FilterDropdownOption } from "./FilterDropdown";
import { AnimatedArrowUpDown, AnimatedArrowUp, AnimatedArrowDown } from "./animated-icons";

export interface SortControlProps {
  options: FilterDropdownOption[];
  sortField: string;
  onSortFieldChange: (field: string) => void;
  direction?: "asc" | "desc";
  onDirectionChange?: (dir: "asc" | "desc") => void;
  className?: string;
}

export function SortControl({
  options,
  sortField,
  onSortFieldChange,
  direction,
  onDirectionChange,
  className = "",
}: SortControlProps) {
  const toggleDirection = () => {
    if (onDirectionChange) {
      onDirectionChange(direction === "asc" ? "desc" : "asc");
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <FilterDropdown
        label="Sort By"
        options={options}
        value={sortField}
        onChange={onSortFieldChange}
      />

      {direction && onDirectionChange && (
        <button
          type="button"
          onClick={toggleDirection}
          className="h-[38px] sm:h-9 px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] flex items-center justify-center transition-all cursor-pointer shadow-2xs text-xs font-semibold"
          title={`Sorted ${direction === "asc" ? "Ascending (click to toggle)" : "Descending (click to toggle)"}`}
          aria-label={`Toggle sort direction, currently ${direction}`}
        >
          {direction === "asc" ? (
            <AnimatedArrowUp size={14} className="text-sky-600 dark:text-sky-400" />
          ) : (
            <AnimatedArrowDown size={14} className="text-sky-600 dark:text-sky-400" />
          )}
        </button>
      )}
    </div>
  );
}
