"use client";

import React, { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X, RotateCcw, Check } from "lucide-react";
import type { FilterOptions } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentFilterPanelProps {
  filterOptions: FilterOptions;
  className?: string;
  totalResults?: number;
}

export function EquipmentFilterPanel({
  filterOptions,
  className,
  totalResults,
}: EquipmentFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Active query param readers
  const currentBrand = searchParams.get("brand") || "";
  const currentSubtype = searchParams.get("subtype") || "";
  const currentPower = searchParams.get("power") || "";
  const isRental = searchParams.get("rental") === "true";
  const isPurchase = searchParams.get("purchase") === "true";
  const currentQuery = searchParams.get("q") || "";

  // Count active filters
  const activeCount =
    (currentBrand ? 1 : 0) +
    (currentSubtype ? 1 : 0) +
    (currentPower ? 1 : 0) +
    (isRental ? 1 : 0) +
    (isPurchase ? 1 : 0) +
    (currentQuery ? 1 : 0);

  // Helper to update query string without losing page state or triggering full reload
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // Reset page on filter change
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const clearAllFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return (
    <div
      className={cn(
        "rounded-2xl p-5 sm:p-6 bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-xs",
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-[#0284c7]" />
          <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white uppercase font-mono">
            Filters
          </h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0284c7] text-white">
              {activeCount}
            </span>
          )}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips Strip */}
      {activeCount > 0 && (
        <div className="py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap gap-1.5">
          {currentQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700">
              Query: &quot;{currentQuery}&quot;
              <button
                type="button"
                onClick={() => setParam("q", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove search filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentBrand && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700">
              Brand: {currentBrand.toUpperCase()}
              <button
                type="button"
                onClick={() => setParam("brand", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove brand filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentSubtype && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700">
              {currentSubtype}
              <button
                type="button"
                onClick={() => setParam("subtype", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove subtype filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {currentPower && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700">
              Power: {currentPower}
              <button
                type="button"
                onClick={() => setParam("power", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove power filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {isRental && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Rental Available
              <button
                type="button"
                onClick={() => setParam("rental", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove rental filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {isPurchase && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
              Sale Available
              <button
                type="button"
                onClick={() => setParam("purchase", null)}
                className="hover:text-red-500 ml-0.5"
                aria-label="Remove purchase filter"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Offerings Group */}
      <div className="py-4 border-b border-neutral-200/80 dark:border-neutral-800">
        <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3 font-semibold">
          Offering Type
        </span>
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRental}
                onChange={(e) => setParam("rental", e.target.checked ? "true" : null)}
                className="size-4 rounded-sm text-[#0284c7] focus:ring-[#0284c7] border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <span>Equipment Rental</span>
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              ({filterOptions.rentalCount})
            </span>
          </label>

          <label className="flex items-center justify-between text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPurchase}
                onChange={(e) => setParam("purchase", e.target.checked ? "true" : null)}
                className="size-4 rounded-sm text-[#0284c7] focus:ring-[#0284c7] border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <span>Outright Purchase</span>
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              ({filterOptions.purchaseCount})
            </span>
          </label>
        </div>
      </div>

      {/* Brands Filter Group */}
      {filterOptions.brands.length > 0 && (
        <div className="py-4 border-b border-neutral-200/80 dark:border-neutral-800">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3 font-semibold">
            OEM Brand
          </span>
          <div className="space-y-2">
            {filterOptions.brands.map((b) => {
              const checked = currentBrand === b.value;
              return (
                <label
                  key={b.value}
                  className="flex items-center justify-between text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filter-brand"
                      checked={checked}
                      onChange={() => setParam("brand", checked ? null : b.value)}
                      onClick={() => {
                        if (checked) setParam("brand", null);
                      }}
                      className="size-4 text-[#0284c7] focus:ring-[#0284c7] border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <span>{b.label}</span>
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">({b.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtypes Filter Group */}
      {filterOptions.subtypes.length > 0 && (
        <div className="py-4 border-b border-neutral-200/80 dark:border-neutral-800">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3 font-semibold">
            Equipment Subtype
          </span>
          <div className="space-y-2">
            {filterOptions.subtypes.map((sub) => {
              const checked = currentSubtype === sub.value;
              return (
                <label
                  key={sub.value}
                  className="flex items-center justify-between text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filter-subtype"
                      checked={checked}
                      onChange={() => setParam("subtype", checked ? null : sub.value)}
                      onClick={() => {
                        if (checked) setParam("subtype", null);
                      }}
                      className="size-4 text-[#0284c7] focus:ring-[#0284c7] border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <span className="truncate max-w-[170px]">{sub.label}</span>
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">({sub.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Power Source Filter Group */}
      {filterOptions.powerSources.length > 0 && (
        <div className="py-4">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3 font-semibold">
            Power Source
          </span>
          <div className="space-y-2">
            {filterOptions.powerSources.map((p) => {
              const checked = currentPower === p.value;
              return (
                <label
                  key={p.value}
                  className="flex items-center justify-between text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="filter-power"
                      checked={checked}
                      onChange={() => setParam("power", checked ? null : p.value)}
                      onClick={() => {
                        if (checked) setParam("power", null);
                      }}
                      className="size-4 text-[#0284c7] focus:ring-[#0284c7] border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <span>{p.label}</span>
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">({p.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
