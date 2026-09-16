"use client";

import React, { memo, useState, useEffect } from "react";
import { Search, Loader2, X, RotateCcw } from "lucide-react";

interface ClientsToolbarProps {
  initialSearch: string;
  statusFilter: "all" | "active" | "inactive";
  cityFilter?: string;
  availableCities?: string[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  isPending: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: "all" | "active" | "inactive") => void;
  onCityChange?: (city: string) => void;
  onResetFilters: () => void;
}

export const ClientsToolbar = memo(function ClientsToolbar({
  initialSearch,
  statusFilter,
  cityFilter = "all",
  availableCities = [],
  totalCount,
  activeCount,
  inactiveCount,
  isPending,
  onSearchChange,
  onStatusChange,
  onCityChange,
  onResetFilters,
}: ClientsToolbarProps) {
  // Local state isolates keystrokes from parent re-renders
  const [localSearch, setLocalSearch] = useState(initialSearch);

  // Synchronize when initialSearch prop changes externally (e.g. browser back button or reset)
  useEffect(() => {
    setLocalSearch(initialSearch);
  }, [initialSearch]);

  // 300ms Debounce dispatch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== initialSearch) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, initialSearch, onSearchChange]);

  const hasActiveFilters = localSearch.trim().length > 0 || statusFilter !== "all" || (cityFilter && cityFilter !== "all");

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-xs">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-mute)] pointer-events-none" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search by company, code, GSTIN, PAN, contact, city..."
          className="w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-9 py-2 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:bg-[var(--color-canvas-elevated)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPending ? (
            <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
          ) : localSearch.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setLocalSearch("");
                onSearchChange("");
              }}
              className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter Controls Strip */}
      <div className="flex flex-wrap items-center gap-2">
        {/* City Filter (if available) */}
        {availableCities.length > 0 && onCityChange && (
          <select
            value={cityFilter}
            onChange={(e) => onCityChange(e.target.value)}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2.5 py-1.5 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="all">All Cities ({availableCities.length})</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] p-1">
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("inactive")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Inactive ({inactiveCount})
          </button>
        </div>

        {/* Reset Filters Action */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
});
