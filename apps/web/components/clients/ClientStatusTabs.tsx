"use client";

import React, { memo } from "react";
import { RotateCcw, MapPin } from "lucide-react";

interface ClientStatusTabsProps {
  statusFilter: "all" | "active" | "inactive";
  cityFilter?: string;
  districtFilter?: string;
  stateFilter?: string;
  availableCities?: string[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  hasActiveFilters?: boolean;
  onStatusChange: (status: "all" | "active" | "inactive") => void;
  onCityChange?: (city: string) => void;
  onDistrictChange?: (district: string) => void;
  onStateChange?: (state: string) => void;
  onResetFilters?: () => void;
}

export const ClientStatusTabs = memo(function ClientStatusTabs({
  statusFilter,
  cityFilter = "all",
  districtFilter = "all",
  stateFilter = "all",
  availableCities = [],
  totalCount,
  activeCount,
  inactiveCount,
  hasActiveFilters = false,
  onStatusChange,
  onCityChange,
  onResetFilters,
}: ClientStatusTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Lightweight Site Location Selector (Native select, 0 heavy maps/geo libraries) */}
      {availableCities.length > 0 && onCityChange && (
        <div className="relative flex items-center">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--color-mute)] pointer-events-none" />
          <select
            value={cityFilter}
            onChange={(e) => onCityChange(e.target.value)}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-7 pr-3 py-1.5 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <option value="all">All Locations ({availableCities.length})</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
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
      {hasActiveFilters && onResetFilters && (
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
  );
});
