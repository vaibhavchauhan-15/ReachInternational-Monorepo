"use client";

import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { GroupedSpecifications } from "@/lib/queries/equipment";
import { cn } from "@/lib/utils";

export interface EquipmentSpecificationsProps {
  groupedSpecifications: GroupedSpecifications[];
  keySpecifications: Array<{ name: string; value: string; unit: string | null }>;
  className?: string;
}

export function EquipmentSpecifications({
  groupedSpecifications,
  keySpecifications,
  className,
}: EquipmentSpecificationsProps) {
  // Filter out any empty groups
  const validGroups = groupedSpecifications.filter(
    (g) => g.specs && g.specs.length > 0 && g.specs.some((s) => s.value && s.value.trim() !== "")
  );

  const [activeTab, setActiveTab] = useState(validGroups[0]?.groupName || "");

  if (validGroups.length === 0 && keySpecifications.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-8", className)}>
      {/* 1. Key Specifications Grid */}
      {keySpecifications.length > 0 && (
        <section aria-labelledby="key-specs-heading">
          <h3
            id="key-specs-heading"
            className="text-xs font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-4 font-semibold"
          >
            Key Machine Metrics
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {keySpecifications.map((spec, i) => (
              <div
                key={i}
                className="p-4 rounded-xl sm:rounded-2xl bg-neutral-50 dark:bg-[#141414] border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between"
              >
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  {spec.name}
                </span>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Structured Category-Specific Technical Specifications */}
      {validGroups.length > 0 && (
        <section aria-labelledby="full-specs-heading">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800 mb-6">
            <div>
              <h3
                id="full-specs-heading"
                className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
              >
                Technical Specifications
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Verified manufacturer data and operational parameters
              </p>
            </div>

            {/* Desktop Tabs Filter */}
            <div className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
              {validGroups.map((group) => {
                const isActive = activeTab === group.groupName;
                return (
                  <button
                    key={group.groupName}
                    type="button"
                    onClick={() => setActiveTab(group.groupName)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      isActive
                        ? "bg-white dark:bg-[#1e1e1e] text-neutral-950 dark:text-white shadow-2xs"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    )}
                  >
                    {group.groupName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop View: Active Tab Table */}
          <div className="hidden md:block">
            {validGroups
              .filter((g) => g.groupName === activeTab || (!activeTab && true))
              .map((group) => (
                <div
                  key={group.groupName}
                  className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121212] shadow-2xs"
                >
                  <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white font-mono uppercase">
                      {group.groupName} Data
                    </span>
                    <span className="text-xs font-mono text-neutral-400">
                      {group.specs.length} Verified Entries
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse">
                    <tbody>
                      {group.specs.map((s, idx) => (
                        <tr
                          key={s.code || idx}
                          className={cn(
                            "border-b border-neutral-100 dark:border-neutral-850/60 last:border-b-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40 transition-colors",
                            idx % 2 === 0 ? "bg-transparent" : "bg-neutral-50/40 dark:bg-neutral-900/20"
                          )}
                        >
                          <th
                            scope="row"
                            className="py-3.5 px-6 text-sm font-medium text-neutral-700 dark:text-neutral-300 w-1/2"
                          >
                            {s.name}
                          </th>
                          <td className="py-3.5 px-6 text-sm font-semibold text-neutral-900 dark:text-white w-1/2 font-mono">
                            {s.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>

          {/* Mobile & Tablet View: Stacked Accordion Sections */}
          <div className="md:hidden space-y-4">
            {validGroups.map((group) => (
              <details
                key={group.groupName}
                open
                className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-white dark:bg-[#121212] shadow-2xs group"
              >
                <summary className="px-4 py-3.5 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between cursor-pointer select-none font-bold text-sm text-neutral-900 dark:text-white">
                  <span>{group.groupName}</span>
                  <ChevronDown className="size-4 text-neutral-400 group-open:rotate-180 transition-transform" />
                </summary>

                <div className="p-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                  {group.specs.map((s, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                        {s.name}
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-white font-mono text-right">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
