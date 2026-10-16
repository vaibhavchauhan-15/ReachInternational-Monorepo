"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { AnimatedCalendarCheck } from "@/components/ui/animated-icons";
import {
  Button,
  EmptyState,
  highlightText,
  AttendanceTableSkeletonRows,
} from "@/components/ui";
import type { AttendanceEmployee } from "@/lib/data/attendance/attendance-summary";

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export interface AttendanceDesktopTableProps {
  displayedRows: AttendanceEmployee[];
  isQueryLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  totalCount: number;
  activeMonth: string;
  searchQuery: string;
  statusFilter: string;
  overtimeFilter: string;
  stateFilter: string;
  activeFilterCount: number;
  onResetFilters: () => void;
  onLoadMore: () => void;
  desktopSentinelRef: React.RefObject<HTMLTableRowElement | null>;
}

export function AttendanceDesktopTable({
  displayedRows,
  isQueryLoading,
  hasMore,
  isLoadingMore,
  loadMoreError,
  totalCount,
  activeMonth,
  searchQuery,
  statusFilter,
  overtimeFilter,
  stateFilter,
  activeFilterCount,
  onResetFilters,
  onLoadMore,
  desktopSentinelRef,
}: AttendanceDesktopTableProps) {
  const router = useRouter();

  return (
    <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
      <div className="overflow-x-auto max-h-[700px]">
        <table className="w-full text-left text-xs border-collapse font-sans whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] text-[var(--color-mute)] font-semibold text-[11px] uppercase tracking-wider">
            <tr>
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
                      searchQuery ||
                      statusFilter !== "all" ||
                      overtimeFilter !== "all" ||
                      stateFilter !== "all"
                        ? "No records match your active search and filter criteria."
                        : "No attendance recorded for this month."
                    }
                    action={
                      activeFilterCount > 0 ? (
                        <Button variant="secondary" size="sm" onClick={onResetFilters}>
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
                    onClick={() =>
                      router.push(`/attendance/${emp.employee_id}?month=${activeMonth}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(
                          `/attendance/${emp.employee_id}?month=${activeMonth}`
                        );
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
                        <span className="group-hover:underline">
                          {highlightText(emp.full_name, searchQuery)}
                        </span>
                      </Link>
                      <div className="text-[11px] text-[var(--color-mute)] font-mono">
                        {emp.phone
                          ? highlightText(emp.phone, searchQuery)
                          : "No phone"}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5 text-[var(--color-body)]">
                      {emp.city || emp.state ? (
                        <span>
                          {emp.city ? (
                            <span>{highlightText(emp.city, searchQuery)}, </span>
                          ) : null}
                          {emp.state ? (
                            <span>{highlightText(emp.state, searchQuery)}</span>
                          ) : null}
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
                  <tr
                    ref={desktopSentinelRef}
                    className="border-t border-[var(--color-hairline)]/40"
                  >
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
                            onClick={onLoadMore}
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
          <span className="font-medium">
            All {totalCount} attendance records loaded
          </span>
          <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
        </div>
      )}
    </div>
  );
}
