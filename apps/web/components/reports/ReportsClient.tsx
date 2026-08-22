"use client";

import { useState } from "react";
import {
  AnimatedBarChart3,
  AnimatedDownload,
  AnimatedSlidersHorizontal,
  AnimatedWrench,
  AnimatedPackage,
  AnimatedShoppingBag,
  AnimatedGauge,
  AnimatedBuilding2,
} from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";

interface ReportsClientProps {
  user: User;
}

export function ReportsClient({ user }: ReportsClientProps) {
  const [activeCategory, setActiveCategory] = useState<"operations" | "service" | "inventory" | "sales_purchase" | "management">("operations");

  const categories = [
    { id: "operations", label: "Operations", icon: AnimatedGauge },
    { id: "service", label: "Service", icon: AnimatedWrench },
    { id: "inventory", label: "Inventory", icon: AnimatedPackage },
    { id: "sales_purchase", label: "Sales & Purchase", icon: AnimatedShoppingBag },
    { id: "management", label: "Management", icon: AnimatedBuilding2 },
  ];

  return (
    <div className="w-full space-y-6 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-2">
            <AnimatedBarChart3 size={14} />
            Analytics & Executive Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
            Categorized operational insights, service breakdown analysis, stock valuation, and management KPIs
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <AnimatedDownload size={16} />
          <span>Export Summary Report</span>
        </button>
      </div>

      {/* CATEGORY TABS (Item 18 Requirement!) */}
      <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-3 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
              }`}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY REPORT CARDS & FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCategory === "operations" && (
          <>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Machine Utilization Report</h3>
              <p className="text-xs text-[var(--color-mute)]">Track active operating hours vs idle days per machine</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Running Hours Logbook</h3>
              <p className="text-xs text-[var(--color-mute)]">Operator meter logs aggregated by branch and model</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Machine Downtime Analysis</h3>
              <p className="text-xs text-[var(--color-mute)]">Breakdown frequency and resolution MTTR metrics</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
          </>
        )}

        {activeCategory === "service" && (
          <>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Breakdown Analysis</h3>
              <p className="text-xs text-[var(--color-mute)]">Root cause classification for breakdown complaints</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Engineer Performance</h3>
              <p className="text-xs text-[var(--color-mute)]">Service completion speed, FSR compliance, and client ratings</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
          </>
        )}

        {activeCategory === "inventory" && (
          <>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Stock Valuation</h3>
              <p className="text-xs text-[var(--color-mute)]">Current inventory asset value across all branch stores</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Low Stock Consumption</h3>
              <p className="text-xs text-[var(--color-mute)]">Parts under minimum threshold and reorder suggestions</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
          </>
        )}

        {activeCategory === "sales_purchase" && (
          <>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Purchase Analysis</h3>
              <p className="text-xs text-[var(--color-mute)]">PO volume and vendor expenditure breakdown</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
          </>
        )}

        {activeCategory === "management" && (
          <>
            <div className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--color-ink)]">Executive Financial Summary</h3>
              <p className="text-xs text-[var(--color-mute)]">Company-wide operational KPIs and maintenance costs</p>
              <button className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Generate Report →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
