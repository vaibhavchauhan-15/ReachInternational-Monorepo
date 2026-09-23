"use client";

import React, { useState, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  ExternalLink,
  ChevronRight,
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
  Badge,
  FilterToolbar,
  FilterDropdown,
  FilterChips,
  EmptyState,
  MonthSelect,
  Pagination,
  useToast,
} from "@/components/ui";
import { AnimatedCounter } from "@/components/ui/Motion";
import type { AttendanceSummaryResult } from "@/lib/data/attendance/attendance-summary";
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
  currentMonth,
  currentPage,
}: AttendanceClientProps) {
  const { rows = [], total = 0, kpis, scheduledDays = 0, pageSize = 25 } = initialData;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const currentSearchParam = searchParams.get("search") || "";
  const currentStatusParam = searchParams.get("status") || "all";

  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
  const [searchQuery, setSearchQuery] = useState(currentSearchParam);
  const [statusFilter, setStatusFilter] = useState(currentStatusParam);

  if (prevSearchParams !== searchParams) {
    setPrevSearchParams(searchParams);
    setSearchQuery(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "all");
  }

  // Navigate with updated query parameters
  const updateParams = useCallback(
    (overrides: { month?: string; page?: number; status?: string; search?: string }) => {
      startTransition(() => {
        const params = new URLSearchParams();
        const nextMonth = overrides.month !== undefined ? overrides.month : currentMonth;
        const nextPage = overrides.page !== undefined ? overrides.page : 1;
        const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter;
        const nextSearch = overrides.search !== undefined ? overrides.search : searchQuery;

        params.set("month", nextMonth);
        if (nextPage > 1) params.set("page", String(nextPage));
        if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
        if (nextSearch.trim()) params.set("search", nextSearch.trim());

        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [currentMonth, statusFilter, searchQuery, pathname, router]
  );

  // Month navigation
  const handleMonthChange = useCallback((newMonth: string) => {
    updateParams({ month: newMonth, page: 1 });
  }, [updateParams]);

  // Pagination change
  const handlePageChange = useCallback((newPage: number) => {
    updateParams({ page: newPage });
  }, [updateParams]);

  // Status filter change
  const handleStatusFilterChange = useCallback((newStatus: string) => {
    setStatusFilter(newStatus);
    updateParams({ status: newStatus, page: 1 });
  }, [updateParams]);

  // Search input change with submit on enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchQuery, page: 1 });
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    updateParams({ search: "", status: "all", page: 1 });
  };

  const activeFilterCount =
    (statusFilter !== "all" && statusFilter !== "" ? 1 : 0) +
    (searchQuery.trim() !== "" ? 1 : 0);

  // Active filter chips
  const filterChips = useMemo(() => {
    const chips = [];
    if (statusFilter && statusFilter !== "all") {
      const labelMap: Record<string, string> = {
        present: "Present",
        absent: "Absent",
        half_day: "Half Day",
      };
      chips.push({
        id: "status",
        label: "Status",
        valueLabel: labelMap[statusFilter] || statusFilter,
        onRemove: () => handleStatusFilterChange("all"),
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        id: "search",
        label: "Search",
        valueLabel: searchQuery.trim(),
        onRemove: () => {
          setSearchQuery("");
          updateParams({ search: "", page: 1 });
        },
      });
    }
    return chips;
  }, [statusFilter, searchQuery, handleStatusFilterChange, updateParams]);

  // CSV export
  const handleExportCSV = useCallback(() => {
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
    const csvRows = (rows || []).map((emp) => [
      `"${emp.full_name.replace(/"/g, '""')}"`,
      `"${emp.phone || ""}"`,
      emp.role,
      `"${emp.city || ""}"`,
      `"${emp.state || ""}"`,
      emp.scheduled_days,
      emp.present_days,
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
      `Attendance_${currentMonth}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${rows.length} attendance records to CSV`);
  }, [rows, currentMonth, toast]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Canonical Desktop Page Header */}
      <PageHeader
        title="Attendance"
        description="Monthly operator attendance tracking derived from machine operation logs"
        breadcrumbs={[{ label: "Attendance" }]}
        actions={
          <div className="flex items-center gap-2">
            <MonthSelect
              value={currentMonth}
              onChange={handleMonthChange}
              disabled={isPending}
              showQuickNav
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download size={14} className="text-[var(--color-mute)]" />}
              className="h-9 px-3 text-xs font-semibold gap-1.5"
              title="Export Attendance CSV"
            >
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Mobile Action Row (PageHeader hidden on mobile < md) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <MonthSelect
          value={currentMonth}
          onChange={handleMonthChange}
          disabled={isPending}
          showQuickNav
          compact
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          icon={<Download size={14} className="text-[var(--color-mute)]" />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 shrink-0"
          title="Export CSV"
        >
          <span>Export</span>
        </Button>
      </div>

      {/* 2. Interactive KPI Cards Row (Click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Employees */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange("all")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "all" || !statusFilter
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">
              Total Staff
            </span>
            <AnimatedUsers size={16} className="text-[var(--color-ink)]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)]">
            <AnimatedCounter value={kpis.totalEmployees} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            Active operators this month
          </p>
        </motion.div>

        {/* Present */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "present" ? "all" : "present")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "present"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Present
            </span>
            <AnimatedUserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
            <AnimatedCounter value={kpis.presentCount} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            Full daily work log completed
          </p>
        </motion.div>

        {/* Absent */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "absent" ? "all" : "absent")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "absent"
              ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Absent
            </span>
            <AnimatedUserX size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-300">
            <AnimatedCounter value={kpis.absentCount} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            No machine logs submitted
          </p>
        </motion.div>

        {/* Half Day */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusFilterChange(statusFilter === "half_day" ? "all" : "half_day")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            statusFilter === "half_day"
              ? "bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/20 dark:bg-amber-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Half Day
            </span>
            <AnimatedClock size={16} className="text-amber-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300">
            <AnimatedCounter value={kpis.halfDayCount} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            Under 4 hours operation
          </p>
        </motion.div>
      </div>

      {/* 3. Scheduled Working Days Info Banner */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-3.5 shadow-xs text-xs sm:text-sm text-[var(--color-body)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-[var(--color-ink)]">
            Scheduled Working Days: {scheduledDays}
          </span>
          <span className="text-[var(--color-mute)]"> (weekdays excluding Sundays)</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-mute)]">
          <span>Worked: <strong className="text-[var(--color-ink)]">{formatMinutes(kpis.totalWorkedMinutes)}</strong></span>
          <span>•</span>
          <span>Overtime: <strong className="text-amber-600 dark:text-amber-400">{formatMinutes(kpis.totalOtMinutes)}</strong></span>
        </div>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="space-y-2">
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            if (!val) updateParams({ search: "", page: 1 });
          }}
          onSubmitSearch={handleSearchSubmit}
          placeholder="Search by employee name or phone..."
          activeFilterCount={activeFilterCount}
          onResetFilters={resetFilters}
          actions={
            <div className="text-xs text-[var(--color-mute)] px-2 whitespace-nowrap hidden sm:block">
              {total} employee{total !== 1 ? "s" : ""}
            </div>
          }
        >
          {/* Expandable Filter Controls Drawer */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              options={[
                { value: "all", label: "All Status" },
                { value: "present", label: "Present", dotColor: "bg-emerald-500" },
                { value: "absent", label: "Absent", dotColor: "bg-rose-500" },
                { value: "half_day", label: "Half Day", dotColor: "bg-amber-500" },
              ]}
            />
          </div>
        </FilterToolbar>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <FilterChips chips={filterChips} onClearAll={resetFilters} />
        )}
      </div>

      {/* 5. Desktop High-Density Table */}
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
                <th className="py-3 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8">
                    <EmptyState
                      icon={<AnimatedCalendarCheck size={28} />}
                      title="No attendance records found"
                      description={
                        searchQuery || statusFilter !== "all"
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
                rows.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    className="hover:bg-[var(--color-canvas)]/40 transition-colors"
                  >
                    <td className="py-2.5 px-3.5">
                      <Link
                        href={`/attendance/${emp.employee_id}?month=${currentMonth}`}
                        className="font-semibold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1 group"
                      >
                        <span className="group-hover:underline">{emp.full_name}</span>
                        <ExternalLink className="w-3 h-3 text-[var(--color-mute)] group-hover:text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <div className="text-[11px] text-[var(--color-mute)] font-mono">
                        {emp.phone || "No phone"}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 text-[var(--color-body)]">
                      {emp.city || emp.state ? (
                        <span>
                          {emp.city ? `${emp.city}, ` : ""}
                          {emp.state || ""}
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
                        {emp.present_days}
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

                    <td className="py-2.5 px-3.5 text-center">
                      {emp.status === "PRESENT" && (
                        <Badge variant="success" dot className="whitespace-nowrap">
                          Present
                        </Badge>
                      )}
                      {emp.status === "ABSENT" && (
                        <Badge variant="error" dot className="whitespace-nowrap">
                          Absent
                        </Badge>
                      )}
                      {emp.status === "HALF_DAY" && (
                        <Badge variant="warning" dot className="whitespace-nowrap">
                          Half Day
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Canonical Pagination Bar */}
        {total > 0 && (
          <div className="px-4 py-3 border-t border-[var(--color-hairline)]">
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* 6. Mobile Touch Cards View (≤640px) */}
      <div className="block md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6">
            <EmptyState
              icon={<AnimatedCalendarCheck size={28} />}
              title="No attendance records found"
              description="No records match your active search or filter."
            />
          </div>
        ) : (
          rows.map((emp) => (
            <Link
              key={emp.employee_id}
              href={`/attendance/${emp.employee_id}?month=${currentMonth}`}
              className="block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs space-y-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[var(--color-ink)] truncate flex items-center gap-1">
                    <span>{emp.full_name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--color-mute)] shrink-0" />
                  </p>
                  <p className="text-xs text-[var(--color-mute)] font-mono truncate">
                    {emp.phone || "No phone"} • {emp.city || emp.state || "No location"}
                  </p>
                </div>

                <div className="shrink-0">
                  {emp.status === "PRESENT" && (
                    <Badge variant="success" dot>
                      Present
                    </Badge>
                  )}
                  {emp.status === "ABSENT" && (
                    <Badge variant="error" dot>
                      Absent
                    </Badge>
                  )}
                  {emp.status === "HALF_DAY" && (
                    <Badge variant="warning" dot>
                      Half Day
                    </Badge>
                  )}
                </div>
              </div>

              {/* Attendance metrics well */}
              <div className="grid grid-cols-3 gap-2 text-xs bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-hairline)]">
                <div className="text-center">
                  <span className="block text-[10px] text-[var(--color-mute)] uppercase font-semibold">
                    Present
                  </span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                    {emp.present_days}
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
          ))
        )}

        {/* Mobile Pagination */}
        {total > pageSize && (
          <div className="pt-2">
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-[var(--color-canvas)]/50 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
