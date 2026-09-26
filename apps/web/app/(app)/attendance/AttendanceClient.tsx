"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  AnimatedUsers,
  AnimatedUserCheck,
  AnimatedUserX,
  AnimatedClock,
  AnimatedCalendarCheck,
} from "@/components/ui/animated-icons";
import {
  PageHeader,
  Button,
  FilterToolbar,
  FilterDropdown,
  FilterChips,
  EmptyState,
  MonthSelect,
  useToast,
  highlightText,
  AttendanceTableSkeletonRows,
  AttendanceMobileCardSkeleton,
} from "@/components/ui";
import { AnimatedCounter } from "@/components/ui/Motion";
import { getAttendanceSummaryAction, getAttendanceExportAction } from "@/app/actions/attendance";
import type { AttendanceSummaryResult, AttendanceEmployee, AttendanceKpis } from "@/lib/data/attendance/attendance-summary";
import type { UserRole } from "@reachinternational/types";

interface AttendanceClientProps {
  initialData: AttendanceSummaryResult;
  currentMonth: string; // "2026-09"
  currentPage: number;
  userRole: UserRole;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AttendanceClient({
  initialData,
  currentMonth: initialMonth,
  currentPage: initialPage,
}: AttendanceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Active filter state hydrated from searchParams
  const [activeMonth, setActiveMonth] = useState<string>(
    searchParams.get("month") || initialMonth
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("search") || ""
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [overtimeFilter, setOvertimeFilter] = useState<string>(
    searchParams.get("overtime") || "all"
  );
  const [stateFilter, setStateFilter] = useState<string>(
    searchParams.get("state") || "all"
  );
  const [sortByFilter, setSortByFilter] = useState<string>(
    searchParams.get("sortBy") || "name_asc"
  );

  // Paginated data state
  const [displayedRows, setDisplayedRows] = useState<AttendanceEmployee[]>(
    initialData.rows || []
  );
  const [totalCount, setTotalCount] = useState<number>(initialData.total || 0);
  const [currentKpis, setCurrentKpis] = useState<AttendanceKpis>(
    initialData.kpis || {
      totalEmployees: 0,
      presentCount: 0,
      absentCount: 0,
      halfDayCount: 0,
      totalWorkedMinutes: 0,
      totalOtMinutes: 0,
    }
  );
  const [scheduledDaysCount, setScheduledDaysCount] = useState<number>(
    initialData.scheduledDays || 0
  );
  const [currentPageNum, setCurrentPageNum] = useState<number>(initialPage);

  // Loading states: NO full-screen blur. Skeletons only in list containers.
  const [isQueryLoading, setIsQueryLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(
    (initialData.rows?.length || 0) < (initialData.total || 0)
  );
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Synchronize state when server props update
  useEffect(() => {
    setDisplayedRows(initialData.rows || []);
    setTotalCount(initialData.total || 0);
    setCurrentKpis(initialData.kpis);
    setScheduledDaysCount(initialData.scheduledDays || 0);
    setHasMore((initialData.rows?.length || 0) < (initialData.total || 0));
    setCurrentPageNum(initialPage);
  }, [initialData, initialPage]);

  // Execute server query across the WHOLE database
  const executeQuery = useCallback(
    async (params: {
      month?: string;
      search?: string;
      status?: string;
      overtime?: string;
      state?: string;
      sortBy?: string;
    }) => {
      const targetMonth = params.month !== undefined ? params.month : activeMonth;
      const targetSearch = params.search !== undefined ? params.search : searchQuery;
      const targetStatus = params.status !== undefined ? params.status : statusFilter;
      const targetOvertime = params.overtime !== undefined ? params.overtime : overtimeFilter;
      const targetState = params.state !== undefined ? params.state : stateFilter;
      const targetSortBy = params.sortBy !== undefined ? params.sortBy : sortByFilter;

      setIsQueryLoading(true);
      setLoadMoreError(null);

      // Synchronize URL parameters seamlessly via replaceState (no page reload, no full blur)
      const urlParams = new URLSearchParams();
      if (targetMonth) urlParams.set("month", targetMonth);
      if (targetStatus && targetStatus !== "all") urlParams.set("status", targetStatus);
      if (targetOvertime && targetOvertime !== "all") urlParams.set("overtime", targetOvertime);
      if (targetState && targetState !== "all") urlParams.set("state", targetState);
      if (targetSortBy && targetSortBy !== "name_asc") urlParams.set("sortBy", targetSortBy);
      if (targetSearch.trim()) urlParams.set("search", targetSearch.trim());

      const qs = urlParams.toString();
      const nextUrl = `${pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", nextUrl);

      try {
        const [y, m] = targetMonth.split("-").map(Number);
        const res = await getAttendanceSummaryAction(y, m, {
          search: targetSearch.trim() || null,
          status: targetStatus !== "all" ? targetStatus : null,
          overtime: targetOvertime !== "all" ? targetOvertime : null,
          state: targetState !== "all" ? targetState : null,
          sortBy: targetSortBy !== "name_asc" ? targetSortBy : null,
          page: 1,
          pageSize: 25,
        });

        if (res) {
          setDisplayedRows(res.rows || []);
          setTotalCount(res.total || 0);
          setCurrentKpis(
            res.kpis || {
              totalEmployees: 0,
              presentCount: 0,
              absentCount: 0,
              halfDayCount: 0,
              totalWorkedMinutes: 0,
              totalOtMinutes: 0,
            }
          );
          setScheduledDaysCount(res.scheduledDays || 0);
          setCurrentPageNum(1);
          setHasMore((res.rows?.length || 0) < (res.total || 0));
        }
      } catch (err: any) {
        console.error("Failed to query attendance:", err);
        toast("error", err?.message || "Failed to load attendance records");
      } finally {
        setIsQueryLoading(false);
      }
    },
    [activeMonth, searchQuery, statusFilter, overtimeFilter, stateFilter, sortByFilter, pathname, toast]
  );

  // Debounced search input handler (300ms)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback(
    (newQuery: string) => {
      setSearchQuery(newQuery);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        executeQuery({ search: newQuery });
      }, 300);
    },
    [executeQuery]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    executeQuery({ search: searchQuery });
  };

  // Month navigation handler
  const handleMonthChange = useCallback(
    (newMonth: string) => {
      setActiveMonth(newMonth);
      executeQuery({ month: newMonth });
    },
    [executeQuery]
  );

  // Status filter change
  const handleStatusFilterChange = useCallback(
    (newStatus: string) => {
      setStatusFilter(newStatus);
      executeQuery({ status: newStatus });
    },
    [executeQuery]
  );

  // Overtime filter change
  const handleOvertimeFilterChange = useCallback(
    (newOvertime: string) => {
      setOvertimeFilter(newOvertime);
      executeQuery({ overtime: newOvertime });
    },
    [executeQuery]
  );

  // State filter change
  const handleStateFilterChange = useCallback(
    (newState: string) => {
      setStateFilter(newState);
      executeQuery({ state: newState });
    },
    [executeQuery]
  );

  // Sort filter change
  const handleSortByFilterChange = useCallback(
    (newSortBy: string) => {
      setSortByFilter(newSortBy);
      executeQuery({ sortBy: newSortBy });
    },
    [executeQuery]
  );

  // Reset all filters
  const resetFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearchQuery("");
    setStatusFilter("all");
    setOvertimeFilter("all");
    setStateFilter("all");
    setSortByFilter("name_asc");
    executeQuery({
      search: "",
      status: "all",
      overtime: "all",
      state: "all",
      sortBy: "name_asc",
    });
  };

  // Infinite Scroll Handler (Loads next 25-item chunk in the background)
  const isFetchingRef = useRef(false);
  const handleLoadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || isLoadingMore || isQueryLoading) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    const nextPage = currentPageNum + 1;
    try {
      const [y, m] = activeMonth.split("-").map(Number);
      const res = await getAttendanceSummaryAction(y, m, {
        search: searchQuery.trim() || null,
        status: statusFilter !== "all" ? statusFilter : null,
        overtime: overtimeFilter !== "all" ? overtimeFilter : null,
        state: stateFilter !== "all" ? stateFilter : null,
        sortBy: sortByFilter !== "name_asc" ? sortByFilter : null,
        page: nextPage,
        pageSize: 25,
      });

      if (res && res.rows) {
        setDisplayedRows((prev) => {
          const existingIds = new Set(prev.map((r) => r.employee_id));
          const fresh = res.rows.filter((r) => !existingIds.has(r.employee_id));
          const combined = [...prev, ...fresh];
          setHasMore(combined.length < res.total);
          return combined;
        });
        setCurrentPageNum(nextPage);
      }
    } catch (err: any) {
      console.error("Failed to load more attendance records:", err);
      setLoadMoreError("Failed to load more records. Click to retry.");
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [hasMore, isLoadingMore, isQueryLoading, currentPageNum, activeMonth, searchQuery, statusFilter, overtimeFilter, stateFilter, sortByFilter]);

  // Sentinel IntersectionObserver for smooth infinite scroll
  const desktopSentinelRef = useRef<HTMLTableRowElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktopSentinel = desktopSentinelRef.current;
    const mobileSentinel = mobileSentinelRef.current;
    if (!desktopSentinel && !mobileSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          handleLoadMore();
        }
      },
      { root: null, rootMargin: "300px", threshold: 0.1 }
    );

    if (desktopSentinel) observer.observe(desktopSentinel);
    if (mobileSentinel) observer.observe(mobileSentinel);

    return () => observer.disconnect();
  }, [handleLoadMore, displayedRows.length, hasMore]);

  // Browser Back / Forward popstate synchronization
  useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const urlMonth = currentParams.get("month") || initialMonth;
      const urlSearch = currentParams.get("search") || "";
      const urlStatus = currentParams.get("status") || "all";
      const urlOvertime = currentParams.get("overtime") || "all";
      const urlState = currentParams.get("state") || "all";
      const urlSortBy = currentParams.get("sortBy") || "name_asc";

      setActiveMonth(urlMonth);
      setSearchQuery(urlSearch);
      setStatusFilter(urlStatus);
      setOvertimeFilter(urlOvertime);
      setStateFilter(urlState);
      setSortByFilter(urlSortBy);

      executeQuery({
        month: urlMonth,
        search: urlSearch,
        status: urlStatus,
        overtime: urlOvertime,
        state: urlState,
        sortBy: urlSortBy,
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialMonth, executeQuery]);

  const activeFilterCount =
    (statusFilter !== "all" && statusFilter !== "" ? 1 : 0) +
    (overtimeFilter !== "all" && overtimeFilter !== "" ? 1 : 0) +
    (stateFilter !== "all" && stateFilter !== "" ? 1 : 0) +
    (sortByFilter !== "name_asc" && sortByFilter !== "" ? 1 : 0) +
    (searchQuery.trim() !== "" ? 1 : 0);

  // Filter options definitions
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Attendance" },
      { value: "present", label: "Present Only", dotColor: "bg-emerald-500" },
      { value: "absent", label: "Absent (0 Days)", dotColor: "bg-rose-500" },
      { value: "half_day", label: "Half Day", dotColor: "bg-amber-500" },
      { value: "has_absences", label: "Has Absences", dotColor: "bg-rose-400" },
      { value: "perfect", label: "Perfect (0 Absences)", dotColor: "bg-emerald-600" },
    ],
    []
  );

  const overtimeOptions = useMemo(
    () => [
      { value: "all", label: "All Overtime" },
      { value: "with_ot", label: "With Overtime (> 0h)", dotColor: "bg-amber-500" },
      { value: "no_ot", label: "No Overtime" },
    ],
    []
  );

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    displayedRows.forEach((r) => {
      if (r.state && r.state.trim()) set.add(r.state.trim());
    });
    ["Delhi", "Gujarat", "Karnataka", "Maharashtra"].forEach((s) => set.add(s));
    const sorted = Array.from(set).sort();
    return [
      { value: "all", label: "All States" },
      ...sorted.map((s) => ({ value: s, label: s })),
    ];
  }, [displayedRows]);

  const sortOptions = useMemo(
    () => [
      { value: "name_asc", label: "Name (A → Z)" },
      { value: "name_desc", label: "Name (Z → A)" },
      { value: "present_desc", label: "Most Present Days" },
      { value: "absent_desc", label: "Most Absent Days" },
      { value: "worked_desc", label: "Most Worked Hours" },
      { value: "ot_desc", label: "Most Overtime Hours" },
    ],
    []
  );

  // Active filter chips
  const filterChips = useMemo(() => {
    const chips = [];
    if (statusFilter && statusFilter !== "all") {
      const labelMap: Record<string, string> = {
        present: "Present",
        absent: "Absent",
        half_day: "Half Day",
        has_absences: "Has Absences",
        perfect: "Perfect",
      };
      chips.push({
        id: "status",
        label: "Attendance",
        valueLabel: labelMap[statusFilter] || statusFilter,
        onRemove: () => handleStatusFilterChange("all"),
      });
    }
    if (overtimeFilter && overtimeFilter !== "all") {
      const labelMap: Record<string, string> = {
        with_ot: "With Overtime",
        no_ot: "No Overtime",
      };
      chips.push({
        id: "overtime",
        label: "Overtime",
        valueLabel: labelMap[overtimeFilter] || overtimeFilter,
        onRemove: () => handleOvertimeFilterChange("all"),
      });
    }
    if (stateFilter && stateFilter !== "all") {
      chips.push({
        id: "state",
        label: "State",
        valueLabel: stateFilter,
        onRemove: () => handleStateFilterChange("all"),
      });
    }
    if (sortByFilter && sortByFilter !== "name_asc") {
      const labelMap: Record<string, string> = {
        name_desc: "Name (Z → A)",
        present_desc: "Most Present",
        absent_desc: "Most Absent",
        worked_desc: "Most Worked",
        ot_desc: "Most Overtime",
      };
      chips.push({
        id: "sortBy",
        label: "Sort",
        valueLabel: labelMap[sortByFilter] || sortByFilter,
        onRemove: () => handleSortByFilterChange("name_asc"),
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        id: "search",
        label: "Search",
        valueLabel: searchQuery.trim(),
        onRemove: () => {
          setSearchQuery("");
          executeQuery({ search: "" });
        },
      });
    }
    return chips;
  }, [
    statusFilter,
    overtimeFilter,
    stateFilter,
    sortByFilter,
    searchQuery,
    handleStatusFilterChange,
    handleOvertimeFilterChange,
    handleStateFilterChange,
    handleSortByFilterChange,
    executeQuery,
  ]);

  // Full-month unpaginated CSV export across whole dataset
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const [y, m] = activeMonth.split("-").map(Number);
      const exportData = await getAttendanceExportAction(y, m, {
        search: searchQuery.trim() || null,
        status: statusFilter !== "all" ? statusFilter : null,
        overtime: overtimeFilter !== "all" ? overtimeFilter : null,
        state: stateFilter !== "all" ? stateFilter : null,
        sortBy: sortByFilter !== "name_asc" ? sortByFilter : null,
      });

      const exportRows = exportData?.rows || displayedRows;
      const headers = [
        "Employee Name",
        "Phone",
        "Role",
        "City",
        "State",
        "Scheduled Days",
        "Present Days",
        "Absent Days",
        "Half Days",
        "Worked Hours",
        "OT Hours",
        "Status",
      ];
      const csvRows = exportRows.map((emp) => [
        `"${emp.full_name.replace(/"/g, '""')}"`,
        `"${emp.phone || ""}"`,
        emp.role,
        `"${emp.city || ""}"`,
        `"${emp.state || ""}"`,
        emp.scheduled_days,
        Math.min(emp.present_days, emp.scheduled_days),
        emp.absent_days,
        emp.half_days,
        (emp.worked_minutes / 60).toFixed(1),
        (emp.overtime_minutes / 60).toFixed(1),
        emp.status,
      ]);
      const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Attendance_${activeMonth}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast("success", `Exported ${exportRows.length} attendance records to CSV`);
    } catch (err: any) {
      console.error("Export CSV error:", err);
      toast("error", "Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, [activeMonth, searchQuery, statusFilter, overtimeFilter, stateFilter, sortByFilter, displayedRows, toast]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Canonical Desktop Page Header */}
      <PageHeader
        title="Attendance"
        breadcrumbs={[{ label: "Attendance" }]}
        actions={
          <div className="flex items-center gap-2">
            <MonthSelect
              value={activeMonth}
              onChange={handleMonthChange}
              disabled={isQueryLoading}
              showQuickNav
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              loading={isExporting}
              icon={<Download size={14} className="text-[var(--color-mute)]" />}
              className="h-9 px-3 text-xs font-semibold gap-1.5"
              title="Export Attendance CSV"
            >
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </Button>
          </div>
        }
      />

      {/* Mobile Action Row (PageHeader hidden on mobile < md) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <MonthSelect
          value={activeMonth}
          onChange={handleMonthChange}
          disabled={isQueryLoading}
          showQuickNav
          compact
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          loading={isExporting}
          icon={<Download size={14} className="text-[var(--color-mute)]" />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 shrink-0"
          title="Export CSV"
        >
          <span>{isExporting ? "..." : "Export"}</span>
        </Button>
      </div>

      {/* 2. Interactive KPI Cards Row (Click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Employees */}
        <motion.div
          data-hover-parent
          role="button"
          tabIndex={0}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange("all")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatusFilterChange("all");
            }
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "all" || !statusFilter
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">
              Total Staff
            </span>
            <AnimatedUsers size={16} className="w-4 h-4 shrink-0 text-[var(--color-ink)]" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)]">
            <AnimatedCounter value={currentKpis.totalEmployees} />
          </div>
        </motion.div>

        {/* Present */}
        <motion.div
          data-hover-parent
          role="button"
          tabIndex={0}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "present" ? "all" : "present")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatusFilterChange(statusFilter === "present" ? "all" : "present");
            }
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "present"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Present
            </span>
            <AnimatedUserCheck size={16} className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
            <AnimatedCounter value={currentKpis.presentCount} />
          </div>
        </motion.div>

        {/* Absent */}
        <motion.div
          data-hover-parent
          role="button"
          tabIndex={0}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "absent" ? "all" : "absent")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatusFilterChange(statusFilter === "absent" ? "all" : "absent");
            }
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "absent"
              ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">
              Absent
            </span>
            <AnimatedUserX size={16} className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300">
            <AnimatedCounter value={currentKpis.absentCount} />
          </div>
        </motion.div>

        {/* Half Day */}
        <motion.div
          data-hover-parent
          role="button"
          tabIndex={0}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "half_day" ? "all" : "half_day")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatusFilterChange(statusFilter === "half_day" ? "all" : "half_day");
            }
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "half_day"
              ? "bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/20 dark:bg-amber-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
              Half Day
            </span>
            <AnimatedClock size={16} className="w-4 h-4 shrink-0 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300">
            <AnimatedCounter value={currentKpis.halfDayCount} />
          </div>
        </motion.div>
      </div>

      {/* 3. Scheduled Working Days Info Banner */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-3.5 shadow-xs text-xs sm:text-sm text-[var(--color-body)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-[var(--color-ink)]">
            Scheduled Working Days: {scheduledDaysCount}
          </span>
          <span className="text-[var(--color-mute)]"> (weekdays excluding Sundays)</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-mute)]">
          <span>Worked: <strong className="text-[var(--color-ink)]">{formatMinutes(currentKpis.totalWorkedMinutes)}</strong></span>
          <span>•</span>
          <span>Overtime: <strong className="text-amber-600 dark:text-amber-400">{formatMinutes(currentKpis.totalOtMinutes)}</strong></span>
        </div>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="space-y-2">
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSubmitSearch={handleSearchSubmit}
          placeholder="Search by employee name, phone, or location..."
          activeFilterCount={activeFilterCount}
          onResetFilters={resetFilters}
          actions={
            <div className="text-xs text-[var(--color-mute)] px-2 whitespace-nowrap hidden sm:block">
              {totalCount} employee{totalCount !== 1 ? "s" : ""}
            </div>
          }
        >
          {/* Expandable Filter Controls Drawer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            <FilterDropdown
              label="Attendance"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              options={statusOptions}
            />
            <FilterDropdown
              label="Overtime"
              value={overtimeFilter}
              onChange={handleOvertimeFilterChange}
              options={overtimeOptions}
            />
            <FilterDropdown
              label="Location"
              value={stateFilter}
              onChange={handleStateFilterChange}
              options={stateOptions}
            />
            <FilterDropdown
              label="Sort By"
              value={sortByFilter}
              onChange={handleSortByFilterChange}
              options={sortOptions}
            />
          </div>
        </FilterToolbar>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <FilterChips chips={filterChips} onClearAll={resetFilters} />
        )}
      </div>

      {/* 5. Desktop High-Density Table (Hidden on mobile < md) */}
      <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 text-[var(--color-mute)] uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-3.5">Employee</th>
                <th className="py-3 px-3.5">Location</th>
                <th className="py-3 px-3.5 text-center">Scheduled</th>
                <th className="py-3 px-3.5 text-center">Present</th>
                <th className="py-3 px-3.5 text-center">Absent</th>
                <th className="py-3 px-3.5 text-center">Half Day</th>
                <th className="py-3 px-3.5 text-right">Worked</th>
                <th className="py-3 px-3.5 text-right">OT Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {isQueryLoading ? (
                <AttendanceTableSkeletonRows count={8} />
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={<AnimatedCalendarCheck size={28} />}
                      title="No attendance records found"
                      description={
                        searchQuery || statusFilter !== "all" || overtimeFilter !== "all" || stateFilter !== "all"
                          ? "No records match your active search and filter criteria."
                          : "No attendance recorded for this month."
                      }
                      action={
                        activeFilterCount > 0 ? (
                          <Button variant="secondary" size="sm" onClick={resetFilters}>
                            Clear Filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                <>
                  {displayedRows.map((emp) => (
                    <tr
                      key={emp.employee_id}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(`/attendance/${emp.employee_id}?month=${activeMonth}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/attendance/${emp.employee_id}?month=${activeMonth}`);
                        }
                      }}
                      aria-label={`View attendance detail for ${emp.full_name}`}
                      className="hover:bg-[var(--color-canvas)]/60 cursor-pointer transition-colors group focus:outline-none focus:bg-[var(--color-canvas)]/80"
                    >
                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/attendance/${emp.employee_id}?month=${activeMonth}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-[var(--color-ink)] group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors inline-block"
                        >
                          <span className="group-hover:underline">{highlightText(emp.full_name, searchQuery)}</span>
                        </Link>
                        <div className="text-[11px] text-[var(--color-mute)] font-mono">
                          {emp.phone ? highlightText(emp.phone, searchQuery) : "No phone"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-[var(--color-body)]">
                        {emp.city || emp.state ? (
                          <span>
                            {emp.city ? <span>{highlightText(emp.city, searchQuery)}, </span> : null}
                            {emp.state ? <span>{highlightText(emp.state, searchQuery)}</span> : null}
                          </span>
                        ) : (
                          <span className="italic text-[var(--color-mute)]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-center font-mono font-medium text-[var(--color-body)]">
                        {emp.scheduled_days}
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={
                            emp.present_days > 0
                              ? "font-mono font-bold text-emerald-600 dark:text-emerald-400"
                              : "font-mono text-[var(--color-mute)]"
                          }
                        >
                          {Math.min(emp.present_days, emp.scheduled_days)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={
                            emp.absent_days > 0
                              ? "font-mono font-bold text-rose-600 dark:text-rose-400"
                              : "font-mono text-[var(--color-mute)]"
                          }
                        >
                          {emp.absent_days}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={
                            emp.half_days > 0
                              ? "font-mono font-bold text-amber-600 dark:text-amber-400"
                              : "font-mono text-[var(--color-mute)]"
                          }
                        >
                          {emp.half_days}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-mono font-medium text-[var(--color-ink)]">
                        {formatMinutes(emp.worked_minutes)}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-mono font-medium">
                        <span
                          className={
                            emp.overtime_minutes > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[var(--color-mute)]"
                          }
                        >
                          {formatMinutes(emp.overtime_minutes)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Infinite Scroll Desktop Sentinel */}
                  {hasMore && (
                    <tr ref={desktopSentinelRef} className="border-t border-[var(--color-hairline)]/40">
                      <td colSpan={8} className="p-0">
                        {isLoadingMore && (
                          <div className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-2 text-xs text-[var(--color-mute)] font-medium">
                              <div className="w-3.5 h-3.5 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
                              <span>Loading more attendance records...</span>
                            </div>
                          </div>
                        )}
                        {loadMoreError && (
                          <div className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={handleLoadMore}
                              className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                            >
                              <RotateCcw size={12} />
                              <span>{loadMoreError}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* End of list indicator */}
        {!isQueryLoading && !hasMore && displayedRows.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 text-xs text-[var(--color-mute)] flex items-center justify-center gap-3 select-none">
            <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
            <span className="font-medium">All {totalCount} attendance records loaded</span>
            <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
          </div>
        )}
      </div>

      {/* 6. Mobile Touch Cards View (≤640px) */}
      <div className="block md:hidden space-y-3">
        {isQueryLoading ? (
          <AttendanceMobileCardSkeleton count={4} />
        ) : displayedRows.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6">
            <EmptyState
              icon={<AnimatedCalendarCheck size={28} />}
              title="No attendance records found"
              description="No records match your active search or filter."
              action={
                activeFilterCount > 0 ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {displayedRows.map((emp) => (
              <Link
                key={emp.employee_id}
                href={`/attendance/${emp.employee_id}?month=${activeMonth}`}
                className="block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs space-y-3 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-[var(--color-ink)] truncate flex items-center gap-1">
                      <span>{highlightText(emp.full_name, searchQuery)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-mute)] shrink-0" />
                    </div>
                    <p className="text-xs text-[var(--color-mute)] font-mono truncate">
                      {emp.phone ? highlightText(emp.phone, searchQuery) : "No phone"} •{" "}
                      {emp.city || emp.state
                        ? `${emp.city ? `${emp.city}, ` : ""}${emp.state || ""}`
                        : "No location"}
                    </p>
                  </div>
                </div>

                {/* Attendance metrics well */}
                <div className="grid grid-cols-3 gap-2 text-xs bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-hairline)]">
                  <div className="text-center">
                    <span className="block text-[10px] text-[var(--color-mute)] uppercase font-semibold">
                      Present
                    </span>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                      {Math.min(emp.present_days, emp.scheduled_days)}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-[var(--color-mute)] uppercase font-semibold">
                      Absent
                    </span>
                    <span className="font-bold text-sm text-rose-600 dark:text-rose-400 font-mono">
                      {emp.absent_days}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-[var(--color-mute)] uppercase font-semibold">
                      Half Day
                    </span>
                    <span className="font-bold text-sm text-amber-600 dark:text-amber-400 font-mono">
                      {emp.half_days}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--color-mute)] font-mono pt-1">
                  <span>
                    Worked:{" "}
                    <strong className="text-[var(--color-ink)]">
                      {formatMinutes(emp.worked_minutes)}
                    </strong>
                  </span>
                  <span>
                    OT:{" "}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {formatMinutes(emp.overtime_minutes)}
                    </strong>
                  </span>
                </div>
              </Link>
            ))}

            {/* Infinite Scroll Mobile Sentinel */}
            {hasMore && (
              <div ref={mobileSentinelRef} className="py-2">
                {isLoadingMore && <AttendanceMobileCardSkeleton count={2} />}
                {loadMoreError && (
                  <div className="text-center py-2">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>{loadMoreError}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isQueryLoading && !hasMore && displayedRows.length > 0 && (
              <div className="py-4 text-center text-xs text-[var(--color-mute)] flex items-center justify-center gap-3 select-none">
                <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                <span className="font-medium">All {totalCount} attendance records loaded</span>
                <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
