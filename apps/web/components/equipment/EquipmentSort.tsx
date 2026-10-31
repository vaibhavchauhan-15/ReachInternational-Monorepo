"use client";

import React, { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EquipmentSortProps {
  className?: string;
}

const SORT_OPTIONS = [
  { label: "Featured", value: "featured" },
  { label: "Model Name (A-Z)", value: "name_asc" },
  { label: "Model Name (Z-A)", value: "name_desc" },
  { label: "Working Height (Low to High)", value: "height_asc" },
  { label: "Working Height (High to Low)", value: "height_desc" },
];

export function EquipmentSort({ className }: EquipmentSortProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "featured";

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const params = new URLSearchParams(searchParams.toString());
      if (val === "featured") {
        params.delete("sort");
      } else {
        params.set("sort", val);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor="equipment-sort-select"
        className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hidden sm:inline-flex items-center gap-1 font-medium"
      >
        <ArrowUpDown className="size-3 text-[#0284c7]" />
        <span>Sort:</span>
      </label>

      <div className="relative">
        <select
          id="equipment-sort-select"
          value={currentSort}
          onChange={handleSortChange}
          className="appearance-none text-xs sm:text-sm font-semibold bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 rounded-xl pl-3 pr-8 py-2 text-neutral-900 dark:text-neutral-100 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#0284c7] cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
