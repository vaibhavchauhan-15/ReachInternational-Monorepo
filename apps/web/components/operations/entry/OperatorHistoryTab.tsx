"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  FileSpreadsheet,
  Printer,
  Loader2,
  Calendar,
  Pencil,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { AnimatedX } from "@/components/ui/animated-icons";
import {
  useToast,
  Pagination,
  FilterToolbar,
  FilterDropdown,
  type FilterDropdownOption,
} from "@/components/ui";
import {
  formatDate,
  formatTo12Hour,
  formatExactTimestamp,
  formatCompactExactTimestamp,
  parseBreakdownDetails,
  addDaysToDateStr,
  getISTDateString,
} from "@reachinternational/utils";
import type { User, Machine, MachineHourLog } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import {
  getOperatorHistoryLogsAction,
  getOperationsExportLogsAction,
} from "@/app/actions/operators";
import {
  OperatorHistoryCardSkeletonList,
  OperationsLogTableSkeletonRows,
} from "../skeletons/OperationsSkeletons";

const PrintableOperatorLogsModal = dynamic(
  () => import("@/components/dashboard/PrintableOperatorLogsModal").then((mod) => mod.PrintableOperatorLogsModal),
  { ssr: false }
);

const OperationsEditLogModal = dynamic(
  () => import("@/components/operations/modals/OperationsEditLogModal").then((mod) => mod.OperationsEditLogModal),
  { ssr: false }
);

interface OperatorHistoryTabProps {
  user: User;
  assignedMachine?: Machine | null;
  initialLogs?: OperatorHourLog[];
}

export function OperatorHistoryTab({
  user,
  assignedMachine,
  initialLogs = [],
}: OperatorHistoryTabProps) {
  const { toast } = useToast();
  const [logsList, setLogsList] = useState<OperatorHourLog[]>(initialLogs);
  const [loading, setLoading] = useState<boolean>(initialLogs.length === 0);

  // Fetch on mount if initialLogs was empty (lazy loaded pattern)
  useEffect(() => {
    if (initialLogs.length === 0) {
      let isMounted = true;
      getOperatorHistoryLogsAction(100)
        .then((res) => {
          if (isMounted) {
            if (res.success && res.logs) {
              setLogsList(res.logs as OperatorHourLog[]);
            }
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (isMounted) {
            console.error("Failed to load history logs:", err);
            setLoading(false);
          }
        });
      return () => {
        isMounted = false;
      };
    }
  }, [initialLogs.length]);

// Preset options for FilterDropdown components
const DATE_FILTER_OPTIONS: FilterDropdownOption[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Past 7 Days" },
  { value: "month", label: "This Month" },
];

const CONDITION_FILTER_OPTIONS: FilterDropdownOption[] = [
  { value: "all", label: "All Logs" },
  { value: "normal", label: "Normal (No Faults)", dotColor: "bg-emerald-500" },
  { value: "breakdown", label: "Breakdown Logged", dotColor: "bg-rose-500" },
];

const SORT_OPTIONS: FilterDropdownOption[] = [
  { value: "date_desc", label: "Date: Newest First" },
  { value: "date_asc", label: "Date: Oldest First" },
  { value: "hours_desc", label: "Operating Hours: High to Low" },
  { value: "hours_asc", label: "Operating Hours: Low to High" },
  { value: "meter_desc", label: "End Meter: High to Low" },
  { value: "meter_asc", label: "End Meter: Low to High" },
];

/**
 * Intelligent date search matcher that checks dates in any format
 * (e.g. 19 Sep, Sep 19, 19-09-2026, 19/09/2026, 2026-09-19, 19.09, September, 19, etc.)
 */
function matchesDateSearch(log: OperatorHourLog, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (!log.log_date) return false;

  const rawDateStr = log.log_date.split("T")[0].trim();
  const [yearStr, monthStr, dayStr] = rawDateStr.split("-");
  if (!yearStr || !monthStr || !dayStr) {
    return rawDateStr.toLowerCase().includes(q);
  }

  const dayNum = parseInt(dayStr, 10);
  const monthNum = parseInt(monthStr, 10);

  const MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const MONTH_SHORT = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  const fullMonth = MONTH_NAMES[monthNum - 1] || "";
  const shortMonth = MONTH_SHORT[monthNum - 1] || "";

  if (q === "today") {
    return rawDateStr === getISTDateString();
  }
  if (q === "yesterday") {
    return rawDateStr === addDaysToDateStr(getISTDateString(), -1);
  }

  const candidates: string[] = [
    rawDateStr,
    `${dayStr}-${monthStr}-${yearStr}`,
    `${dayStr}/${monthStr}/${yearStr}`,
    `${dayStr}.${monthStr}.${yearStr}`,
    `${dayStr} ${monthStr} ${yearStr}`,
    `${dayNum}/${monthNum}/${yearStr}`,
    `${dayNum}-${monthNum}-${yearStr}`,
    `${dayStr}-${monthStr}`,
    `${dayStr}/${monthStr}`,
    `${dayNum}/${monthNum}`,
    `${dayNum}-${monthNum}`,
    `${monthStr}-${dayStr}`,
    `${monthStr}/${dayStr}`,
    `${dayStr} ${shortMonth} ${yearStr}`,
    `${dayStr} ${fullMonth} ${yearStr}`,
    `${dayStr} ${shortMonth}`,
    `${shortMonth} ${dayStr}`,
    `${dayStr}-${shortMonth}`,
    `${shortMonth}-${dayStr}`,
    `${fullMonth} ${dayStr}`,
    `${dayStr} ${fullMonth}`,
    `${shortMonth} ${yearStr}`,
    `${fullMonth} ${yearStr}`,
    shortMonth,
    fullMonth,
    yearStr,
    dayStr,
    String(dayNum),
    formatDate(log.log_date).toLowerCase(),
  ];

  if (log.created_at) {
    candidates.push(formatCompactExactTimestamp(log.created_at).toLowerCase());
  }

  const normalizedQ = q.replace(/[\.\/]/g, "-").replace(/\s+/g, " ");
  const normalizedSpace = q.replace(/[\.\-\/]/g, " ").replace(/\s+/g, " ");

  if (candidates.some((c) => c.includes(q) || c.includes(normalizedQ) || c.includes(normalizedSpace))) {
    return true;
  }

  const tokens = q.split(/[\s\-\.\/]+/).filter(Boolean);
  if (tokens.length > 1) {
    const allMatch = tokens.every((token) =>
      candidates.some((c) => c.includes(token))
    );
    if (allMatch) return true;
  }

  // Graceful fallback for machine code/model if user enters it
  const mCode = log.machine?.machine_id?.toLowerCase() || "";
  const mModel = log.machine?.model?.toLowerCase() || "";
  const mSerial = log.machine?.serial_number?.toLowerCase() || "";
  return mCode.includes(q) || mModel.includes(q) || mSerial.includes(q);
}

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [mobileCount, setMobileCount] = useState<number>(10);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim() !== "") count++;
    if (dateFilter !== "all") count++;
    if (conditionFilter !== "all") count++;
    if (sortBy !== "date_desc") count++;
    return count;
  }, [search, dateFilter, conditionFilter, sortBy]);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setDateFilter("all");
    setConditionFilter("all");
    setSortBy("date_desc");
    setPage(1);
    setMobileCount(10);
  }, []);

  // Export States
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Edit State (operators can edit within 7 days, delete is permanently blocked)
  const [editingLog, setEditingLog] = useState<OperatorHourLog | null>(null);

  // Filter computation
  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      // 1. Date Range Filter
      if (dateFilter !== "all" && log.log_date) {
        const todayStr = getISTDateString();
        const rawDate = log.log_date.split("T")[0];
        if (dateFilter === "today") {
          if (rawDate !== todayStr) return false;
        } else if (dateFilter === "yesterday") {
          const yestStr = addDaysToDateStr(todayStr, -1);
          if (rawDate !== yestStr) return false;
        } else if (dateFilter === "week") {
          const logD = new Date(rawDate).getTime();
          const nowD = new Date(todayStr).getTime();
          const diffDays = Math.floor((nowD - logD) / (1000 * 60 * 60 * 24));
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (dateFilter === "month") {
          const parts = rawDate.split("-").map(Number);
          const todayParts = todayStr.split("-").map(Number);
          if (parts[0] !== todayParts[0] || parts[1] !== todayParts[1]) {
            return false;
          }
        }
      }

      // 2. Condition / Breakdown Filter
      if (conditionFilter !== "all") {
        if (conditionFilter === "breakdown" && !log.is_breakdown) return false;
        if (conditionFilter === "normal" && log.is_breakdown) return false;
      }

      // 3. Date Search matching in any format
      return matchesDateSearch(log, search);
    });
  }, [logsList, dateFilter, conditionFilter, search]);

  // Sort computation
  const sortedLogs = useMemo(() => {
    const result = [...filteredLogs];
    result.sort((a, b) => {
      if (sortBy === "date_asc") {
        const tA = new Date(a.log_date || 0).getTime();
        const tB = new Date(b.log_date || 0).getTime();
        return tA - tB;
      }
      if (sortBy === "hours_desc") {
        const hA = a.running_hours ?? 0;
        const hB = b.running_hours ?? 0;
        return hB - hA;
      }
      if (sortBy === "hours_asc") {
        const hA = a.running_hours ?? 0;
        const hB = b.running_hours ?? 0;
        return hA - hB;
      }
      if (sortBy === "meter_desc") {
        const mA = Number(a.end_meter) || 0;
        const mB = Number(b.end_meter) || 0;
        return mB - mA;
      }
      if (sortBy === "meter_asc") {
        const mA = Number(a.end_meter) || 0;
        const mB = Number(b.end_meter) || 0;
        return mA - mB;
      }
      // Default: date_desc (newest first)
      const tA = new Date(a.log_date || 0).getTime();
      const tB = new Date(b.log_date || 0).getTime();
      if (tB !== tA) return tB - tA;
      const cA = new Date(a.created_at || 0).getTime();
      const cB = new Date(b.created_at || 0).getTime();
      return cB - cA;
    });
    return result;
  }, [filteredLogs, sortBy]);

  const paginatedLogs = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedLogs.slice(from, from + pageSize);
  }, [sortedLogs, page, pageSize]);

  // Mobile Chunk-by-Chunk Infinite Scroll
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  const mobileDisplayedLogs = useMemo(() => {
    return sortedLogs.slice(0, mobileCount);
  }, [sortedLogs, mobileCount]);

  const hasMoreMobile = mobileCount < sortedLogs.length;

  const handleLoadMoreMobile = useCallback(() => {
    setMobileCount((prev) => {
      if (prev >= sortedLogs.length) return prev;
      return Math.min(prev + 10, sortedLogs.length);
    });
  }, [sortedLogs.length]);

  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMoreMobile();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobile]);

  // Excel Export
  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    try {
      setIsExportingExcel(true);
      const { exportOperatorLogsToExcel } = await import("@/lib/utils/operator-logs-export");

      let exportMonth = "all";
      let exportStart: string | undefined;
      let exportEnd: string | undefined;

      if (dateFilter === "today") {
        exportMonth = "custom";
        exportStart = getISTDateString();
        exportEnd = getISTDateString();
      } else if (dateFilter === "week") {
        exportMonth = "custom";
        exportStart = addDaysToDateStr(getISTDateString(), -7);
        exportEnd = getISTDateString();
      } else if (dateFilter === "month") {
        exportMonth = "current";
      }

      const res = await getOperationsExportLogsAction({
        viewMode: "operator",
        entityId: user.id,
        operatorId: user.id,
        month: exportMonth,
        customStartDate: exportStart,
        customEndDate: exportEnd,
        search,
      });

      if (!res.success || !res.logs || res.logs.length === 0) {
        toast("error", "Export Failed", res.error || "No logs found for the selected filters.");
        return;
      }

      exportOperatorLogsToExcel(
        res.logs as OperatorHourLog[],
        user,
        assignedMachine,
        exportMonth,
        exportStart,
        exportEnd
      );

      toast("success", "Export Successful", `Exported ${res.logs.length} machine logs to Excel.`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast("error", "Export Error", errMsg || "Failed to export logs.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Helper: check if a log is within the allowed 7-day edit window
  const isLogWithin7Days = useCallback((logDate?: string | null) => {
    if (!logDate) return false;
    const logDateStr = logDate.split("T")[0];
    const parts = logDateStr.split("-").map(Number);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
    }
    return false;
  }, []);

  const handleLogUpdated = useCallback((updatedLog: MachineHourLog) => {
    setLogsList((prev) =>
      prev.map((l) =>
        l.id === updatedLog.id
          ? ({
              ...l,
              ...updatedLog,
              machine: updatedLog.machine || l.machine,
              client: updatedLog.client || l.client,
            } as OperatorHourLog)
          : l
      )
    );
    setEditingLog(null);
  }, []);

  return (
    <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Export CTAs */}
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 border-b border-[var(--color-hairline)] pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
            Historical Machine Logs
          </h2>
          <p className="text-[11px] text-[var(--color-mute)]">
            Showing {filteredLogs.length} total logged shifts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Export to Excel (.xlsx)"
          >
            {isExportingExcel ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Print or export to PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar from Machine & User directories */}
      <FilterToolbar
        searchQuery={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
          setMobileCount(10);
        }}
        placeholder="Search date (e.g. 19 Sep, 2026-09-19)..."
        inputClassName="placeholder:text-[11px] sm:placeholder:text-xs"
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        defaultOpen={activeFilterCount > 0}
      >
        <div className="flex flex-col gap-3 w-full">
          {/* Responsive Custom Dropdown Filter Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 w-full">
            {/* 1. Date Range Preset Filter */}
            <div className="w-full min-w-0">
              <FilterDropdown
                label="Date"
                value={dateFilter}
                onChange={(val) => {
                  setDateFilter(val);
                  setPage(1);
                  setMobileCount(10);
                }}
                options={DATE_FILTER_OPTIONS}
                className="w-full"
              />
            </div>

            {/* 2. Condition Filter */}
            <div className="w-full min-w-0">
              <FilterDropdown
                label="Status"
                value={conditionFilter}
                onChange={(val) => {
                  setConditionFilter(val);
                  setPage(1);
                  setMobileCount(10);
                }}
                options={CONDITION_FILTER_OPTIONS}
                className="w-full"
              />
            </div>

            {/* 3. Sort By Filter */}
            <div className="w-full min-w-0">
              <FilterDropdown
                label="Sort"
                value={sortBy}
                onChange={(val) => {
                  setSortBy(val);
                  setPage(1);
                  setMobileCount(10);
                }}
                options={SORT_OPTIONS}
                className="w-full"
                align="right"
              />
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[var(--color-hairline)] text-xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] mr-1 shrink-0">
                Active ({activeFilterCount}):
              </span>
              {search.trim() !== "" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Date: &quot;{search}&quot;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                      setMobileCount(10);
                    }}
                    className="hover:text-[var(--color-link)] transition-colors ml-0.5 cursor-pointer"
                    aria-label="Clear date search"
                  >
                    <AnimatedX size={12} />
                  </button>
                </span>
              )}
              {dateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Date: {DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("all");
                      setPage(1);
                      setMobileCount(10);
                    }}
                    className="hover:text-[var(--color-link)] transition-colors ml-0.5 cursor-pointer"
                    aria-label="Clear date filter"
                  >
                    <AnimatedX size={12} />
                  </button>
                </span>
              )}
              {conditionFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Status: {CONDITION_FILTER_OPTIONS.find((o) => o.value === conditionFilter)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConditionFilter("all");
                      setPage(1);
                      setMobileCount(10);
                    }}
                    className="hover:text-[var(--color-link)] transition-colors ml-0.5 cursor-pointer"
                    aria-label="Clear condition filter"
                  >
                    <AnimatedX size={12} />
                  </button>
                </span>
              )}
              {sortBy !== "date_desc" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy("date_desc");
                      setPage(1);
                      setMobileCount(10);
                    }}
                    className="hover:text-[var(--color-link)] transition-colors ml-0.5 cursor-pointer"
                    aria-label="Reset sort"
                  >
                    <AnimatedX size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </FilterToolbar>

      {loading ? (
        <>
          {/* Mobile Skeleton Loading Cards */}
          <div className="block sm:hidden">
            <OperatorHistoryCardSkeletonList count={4} />
          </div>

          {/* Desktop Skeleton Loading Table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-[var(--color-hairline)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] font-mono text-[10px] tracking-wider uppercase">
                  <th className="px-3 py-2.5">Date &amp; Time</th>
                  <th className="px-3 py-2.5">Machine</th>
                  <th className="px-3 py-2.5">Client / Site</th>
                  <th className="px-3 py-2.5 text-right">Start</th>
                  <th className="px-3 py-2.5 text-right">End</th>
                  <th className="px-3 py-2.5 text-right">RT (h)</th>
                  <th className="px-3 py-2.5">Breakdown</th>
                  <th className="px-3 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                <OperationsLogTableSkeletonRows count={5} colSpan={8} />
              </tbody>
            </table>
          </div>
        </>
      ) : sortedLogs.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-[var(--color-hairline)] p-6">
          <Calendar className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold text-[var(--color-ink)]">No Shift Logs Found</p>
          <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
            {search ? "No logs match your search criteria." : "No logs have been submitted for this period."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table (>=640px) */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-[var(--color-hairline)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] font-mono text-[10px] tracking-wider uppercase">
                  <th className="px-3 py-2.5">Date &amp; Time</th>
                  <th className="px-3 py-2.5">Machine</th>
                  <th className="px-3 py-2.5">Client / Site</th>
                  <th className="px-3 py-2.5 text-right">Start</th>
                  <th className="px-3 py-2.5 text-right">End</th>
                  <th className="px-3 py-2.5 text-right">RT (h)</th>
                  <th className="px-3 py-2.5">Breakdown</th>
                  <th className="px-3 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium">
                {paginatedLogs.map((log) => {
                  const startM = Number(log.start_meter) || 0;
                  const endM = Number(log.end_meter) || startM;
                  const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

                  const sTime = formatTo12Hour(log.start_time);
                  const eTime = formatTo12Hour(log.end_time);
                  const shiftTimingStr = sTime && eTime ? `${sTime} – ${eTime}` : sTime || eTime || "—";

                  const model = log.machine?.model || "";
                  const serial = log.machine?.serial_number || "";

                  return (
                    <tr key={log.id} className="hover:bg-[var(--color-canvas)]/50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-bold text-[var(--color-ink)]">{formatDate(log.log_date)}</div>
                        <div className="text-[10px] text-[var(--color-mute)]">
                          {shiftTimingStr}
                        </div>
                        {log.created_at && (
                          <div className="text-[9.5px] text-[var(--color-mute)] opacity-80" title={`Logged at: ${log.created_at}`}>
                            Entry: {formatCompactExactTimestamp(log.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-[var(--color-ink)]">
                          {model || log.machine?.machine_id || "—"}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--color-mute)]">
                          {serial ? `S/N: ${serial}` : log.machine?.machine_id ? `ID: ${log.machine.machine_id}` : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px] truncate" title={log.location || log.client?.company_name || ""}>
                        <div className="font-semibold text-[var(--color-ink)] truncate">
                          {log.client?.company_name || "Base Yard"}
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] truncate">
                          {log.location || log.client?.company_name || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{startM.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{endM.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{rt.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5">
                        {log.is_breakdown ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-mono">
                            <AlertTriangle size={11} />
                            {log.breakdown_duration || "Yes"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-mute)] font-mono">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isLogWithin7Days(log.log_date) ? (
                          <button
                            type="button"
                            onClick={() => setEditingLog(log)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 inline-flex items-center gap-1 transition-colors"
                            title="Edit log within 7 days"
                          >
                            <Pencil size={11} />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-mute)] opacity-60"
                            title="Locked after 7 days"
                          >
                            <Lock size={11} />
                            <span>Locked</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Desktop Pagination */}
            {sortedLogs.length > pageSize && (
              <div className="p-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={sortedLogs.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>

          {/* Mobile Touch Cards View (<=640px) */}
          <div className="block sm:hidden space-y-2.5">
            {mobileDisplayedLogs.map((log) => {
              const startM = Number(log.start_meter) || 0;
              const endM = Number(log.end_meter) || startM;
              const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

              // 12-hour format with AM/PM and no seconds
              const sTime = formatTo12Hour(log.start_time);
              const eTime = formatTo12Hour(log.end_time);
              const shiftTimingStr = sTime && eTime ? `${sTime} – ${eTime}` : sTime || eTime || "";

              // Machine Model + Serial Number
              const model = log.machine?.model || "";
              const serial = log.machine?.serial_number || "";
              const machineTitle = model && serial
                ? `${model} (${serial})`
                : model || (serial ? `S/N: ${serial}` : log.machine?.machine_id || "Equipment");

              // Client Name & City
              const clientName =
                log.client?.company_name ||
                log.client?.client_name ||
                (log.location ? log.location.split(",")[0]?.trim() : "") ||
                "Base Yard";
              const rawCity =
                log.client?.city?.trim() ||
                (log.location && log.location.includes(",")
                  ? log.location.split(",")[1]?.trim()
                  : "");
              const clientCity = rawCity && rawCity.toLowerCase() !== clientName.toLowerCase() ? rawCity : "";

              // Breakdown details parsing
              const breakdownInfo = parseBreakdownDetails(log);

              // Exact log timestamp date and time
              const timestampStr = log.created_at
                ? formatExactTimestamp(log.created_at, false)
                : formatDate(log.log_date);

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 shadow-2xs"
                >
                  {/* Row 1: Top Header — Exact timestamp date & time with small text + Operating Hours badge */}
                  <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-1.5 text-[10px] font-mono">
                    <span className="text-[var(--color-mute)] font-medium">
                      {timestampStr}
                    </span>
                    <span className="font-mono text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                      +{rt.toFixed(1)} hrs
                    </span>
                  </div>

                  {/* Row 2: Machine + Serial Number */}
                  <div className="text-xs font-bold text-[var(--color-ink)] truncate" title={machineTitle}>
                    {model || "Equipment"}
                    {serial ? (
                      <span className="font-mono text-[11px] font-normal text-[var(--color-mute)] ml-1">
                        ({serial})
                      </span>
                    ) : log.machine?.machine_id ? (
                      <span className="font-mono text-[11px] font-normal text-[var(--color-mute)] ml-1">
                        ({log.machine.machine_id})
                      </span>
                    ) : null}
                  </div>

                  {/* Row 3: Client : Client name only + city name with small text */}
                  <div className="text-xs flex items-baseline gap-1 min-w-0">
                    <span className="text-[11px] text-[var(--color-mute)] shrink-0">Client :</span>
                    <span className="font-semibold text-[var(--color-ink)] truncate">{clientName}</span>
                    {clientCity ? (
                      <span className="text-[10px] text-[var(--color-mute)] shrink-0 font-normal">
                        ({clientCity})
                      </span>
                    ) : null}
                  </div>

                  {/* Row 4: HMR: 77255->772260 */}
                  <div className="text-[11px] font-mono text-[var(--color-mute)]">
                    <span>HMR: </span>
                    <span className="text-[var(--color-ink)]">{startM.toFixed(1)}</span>
                    <span className="mx-1 text-[var(--color-mute)]">&rarr;</span>
                    <strong className="text-[var(--color-ink)] font-bold">{endM.toFixed(1)}</strong>
                  </div>

                  {/* Shift Date above shift time with bold */}
                  <div className="text-[11px] font-mono text-[var(--color-mute)] flex items-center gap-1.5">
                    <span>Shift Date : </span>
                    <strong className="text-[var(--color-ink)] font-bold">{formatDate(log.log_date)}</strong>
                  </div>

                  {/* Row 5: Shift Time : 06:00 AM-03:00 PM */}
                  <div className="text-[11px] font-mono text-[var(--color-mute)] flex items-center gap-1.5 flex-wrap">
                    <span>Shift Time : </span>
                    <span className="text-[var(--color-ink)] font-medium">
                      {shiftTimingStr || "—"}
                    </span>
                    {log.overtime_hours ? (
                      <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                        +{log.overtime_hours}h OT
                      </span>
                    ) : null}
                  </div>

                  {/* Row 6: Breakdown (small text) & Edit Icon at the end (only icon, outer layout removed) */}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]/70 gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      {log.is_breakdown ? (
                        <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
                          <span className="font-semibold shrink-0">Breakdown: </span>
                          <span
                            className="truncate"
                            title={breakdownInfo.displayText || log.breakdown_duration || "Yes"}
                          >
                            {breakdownInfo.displayText || log.breakdown_duration || "Yes"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-[var(--color-mute)] flex items-center gap-1">
                          <span className="font-semibold shrink-0">Breakdown: </span>
                          <span>0</span>
                        </div>
                      )}
                    </div>

                    {/* Edit icon only at the end (Feedbacks 1 & 2) */}
                    <div className="shrink-0 flex items-center">
                      {isLogWithin7Days(log.log_date) ? (
                        <button
                          type="button"
                          onClick={() => setEditingLog(log)}
                          className="p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-link)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 transition-colors cursor-pointer"
                          title="Edit log within 7 days"
                          aria-label="Edit machine log"
                        >
                          <Pencil size={14} />
                        </button>
                      ) : (
                        <span
                          className="p-1 text-[var(--color-mute)] opacity-50 inline-flex items-center"
                          title="Locked after 7 days"
                        >
                          <Lock size={13} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMoreMobile && (
              <div ref={mobileSentinelRef} className="pt-1">
                <OperatorHistoryCardSkeletonList count={2} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Printable Modal (Loaded dynamically on-demand) */}
      {showPrintModal && (
        <PrintableOperatorLogsModal
          open={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          user={user}
          assignedMachine={assignedMachine || null}
          logs={logsList}
        />
      )}

      {/* Edit Log Modal (Operators can edit own logs within 7 days, delete disabled) */}
      {editingLog && (
        <OperationsEditLogModal
          log={editingLog as unknown as MachineHourLog}
          isOpen={Boolean(editingLog)}
          onClose={() => setEditingLog(null)}
          onSuccess={handleLogUpdated}
          canDelete={false}
        />
      )}
    </div>
  );
}
