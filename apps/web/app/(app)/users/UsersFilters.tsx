"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import {
  AnimatedSlidersHorizontal,
  AnimatedFileText,
  AnimatedChevronDown,
} from "@/components/ui/animated-icons";
import { FilterToolbar } from "@/components/ui";
import {
  FilterOption,
  STATUS_OPTIONS,
  KYC_OPTIONS,
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
} from "./users-helpers";

interface CustomFilterSelectorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  align?: "left" | "right";
  className?: string;
}

export function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
}: CustomFilterSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open]);

  const selectedOpt = options.find((o) => o.id === value) || options[0];

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${open ? "z-40" : "z-10"} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`w-full h-11 sm:h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-xs select-none ${
          open || value !== "all"
            ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/15 text-[var(--color-ink)]"
            : "bg-[var(--color-canvas)] border-[var(--color-hairline)] text-[var(--color-ink)] hover:border-[var(--color-ink)]/40"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {selectedOpt?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selectedOpt.dotColor}`} />
          )}
          <span className="text-[10px] font-mono text-[var(--color-mute)] uppercase shrink-0">
            {label}:
          </span>
          <span className="truncate font-semibold text-xs text-[var(--color-ink)]">
            {selectedOpt?.label}
          </span>
        </div>
        <AnimatedChevronDown
          size={13}
          className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--color-ink)]" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            aria-label={ariaLabel}
            className={`absolute top-full mt-1.5 z-50 min-w-full max-h-60 overflow-y-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl pointer-events-auto ${
              align === "right"
                ? "right-0 left-auto sm:left-0 sm:right-auto sm:min-w-[200px]"
                : "left-0 right-auto sm:left-0 sm:min-w-[220px]"
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full min-h-[44px] sm:min-h-[36px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)] font-semibold shadow-xs"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isSelected ? "bg-white" : opt.dotColor
                        }`}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface UsersFiltersProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onSubmitSearch: (e?: React.FormEvent) => void;
  isQueryLoading: boolean;
  activeFilterCount: number;
  onResetFilters: () => void;
  viewMode: "auto" | "cards" | "table";
  onViewModeChange: (mode: "auto" | "cards" | "table") => void;
  roleFilter: string;
  onRoleFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  stateFilter: string;
  onStateFilterChange: (val: string) => void;
  kycFilter: string;
  onKycFilterChange: (val: string) => void;
  dateRangeFilter: string;
  onDateRangeFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  roleOptions: FilterOption[];
  stateOptions: FilterOption[];
}

export function UsersFilters({
  searchTerm,
  onSearchChange,
  onSubmitSearch,
  isQueryLoading,
  activeFilterCount,
  onResetFilters,
  viewMode,
  onViewModeChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  stateFilter,
  onStateFilterChange,
  kycFilter,
  onKycFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  sortBy,
  onSortByChange,
  roleOptions,
  stateOptions,
}: UsersFiltersProps) {
  return (
    <FilterToolbar
      searchQuery={searchTerm}
      onSearchChange={onSearchChange}
      onSubmitSearch={onSubmitSearch}
      isLoading={isQueryLoading}
      placeholder="Search by name, phone, or email..."
      activeFilterCount={activeFilterCount}
      onResetFilters={onResetFilters}
      defaultOpen={false}
      actions={
        <div className="hidden sm:flex items-center bg-[var(--color-hairline-soft-surface)] p-0.5 rounded-lg border border-[var(--color-hairline)] text-xs h-9 shrink-0">
          <button
            type="button"
            onClick={() => onViewModeChange("auto")}
            className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
              viewMode === "auto"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
            }`}
            title="Auto responsive view"
          >
            Auto View
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("cards")}
            className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
              viewMode === "cards"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
            }`}
            title="Cards view"
          >
            <AnimatedSlidersHorizontal size={13} />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
              viewMode === "table"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
            }`}
            title="Table view"
          >
            <AnimatedFileText size={13} />
            <span>Table</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        {/* Responsive Custom Dropdown Filter Selectors */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full">
          {/* 1. Role Selector */}
          <div className="w-full sm:w-56 min-w-0">
            <CustomFilterSelector
              label="Role"
              value={roleFilter}
              onChange={onRoleFilterChange}
              options={roleOptions}
              ariaLabel="Filter by role"
              align="left"
            />
          </div>

          {/* 2. Status Selector */}
          <div className="w-full sm:w-40 min-w-0">
            <CustomFilterSelector
              label="Status"
              value={statusFilter}
              onChange={onStatusFilterChange}
              options={STATUS_OPTIONS}
              ariaLabel="Filter by status"
              align="right"
            />
          </div>

          {/* 3. State Selector */}
          <div className="w-full sm:w-48 min-w-0">
            <CustomFilterSelector
              label="State"
              value={stateFilter}
              onChange={onStateFilterChange}
              options={stateOptions}
              ariaLabel="Filter by state"
              align="left"
            />
          </div>

          {/* 4. KYC / Verification Selector */}
          <div className="w-full sm:w-48 min-w-0">
            <CustomFilterSelector
              label="KYC"
              value={kycFilter}
              onChange={onKycFilterChange}
              options={KYC_OPTIONS}
              ariaLabel="Filter by KYC verification status"
              align="right"
            />
          </div>

          {/* 5. Joined Date Range Selector */}
          <div className="w-full sm:w-44 min-w-0">
            <CustomFilterSelector
              label="Joined"
              value={dateRangeFilter}
              onChange={onDateRangeFilterChange}
              options={DATE_RANGE_OPTIONS}
              ariaLabel="Filter by registration date"
              align="left"
            />
          </div>

          {/* 6. Sort By Selector */}
          <div className="w-full sm:w-44 min-w-0">
            <CustomFilterSelector
              label="Sort"
              value={sortBy}
              onChange={onSortByChange}
              options={SORT_OPTIONS}
              ariaLabel="Sort users directory"
              align="right"
            />
          </div>
        </div>

        {/* Active Filter Chips Strip */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-[var(--color-hairline)] text-xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] mr-1 shrink-0">
              Active ({activeFilterCount}):
            </span>
            {searchTerm.trim() !== "" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>Search: &quot;{searchTerm}&quot;</span>
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear search keyword"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {roleFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>Role: {roleOptions.find((o) => o.id === roleFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => onRoleFilterChange("all")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear role filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>Status: {STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => onStatusFilterChange("all")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear status filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {stateFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>State: {stateOptions.find((o) => o.id === stateFilter)?.label || stateFilter}</span>
                <button
                  type="button"
                  onClick={() => onStateFilterChange("all")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear state filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {kycFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>KYC: {KYC_OPTIONS.find((o) => o.id === kycFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => onKycFilterChange("all")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear KYC filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {dateRangeFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>Joined: {DATE_RANGE_OPTIONS.find((o) => o.id === dateRangeFilter)?.label}</span>
                <button
                  type="button"
                  onClick={() => onDateRangeFilterChange("all")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Clear date range filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {sortBy !== "newest" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                <span>Sort: {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}</span>
                <button
                  type="button"
                  onClick={() => onSortByChange("newest")}
                  className="hover:text-[var(--color-link)] transition-colors ml-0.5"
                  aria-label="Reset sort order to default"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-[var(--color-link)] hover:underline cursor-pointer transition-all ml-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset all</span>
            </button>
          </div>
        )}
      </div>
    </FilterToolbar>
  );
}
