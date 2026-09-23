"use client";

import React, { useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  PageHeader,
  Button,
  MonthSelect,
  useToast,
} from "@/components/ui";
import type { AttendanceDetailResult, AttendanceDay } from "@/lib/data/attendance/attendance-detail";

interface AttendanceDetailClientProps {
  data: AttendanceDetailResult;
  currentMonth: string;
}

const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  PRESENT: {
    label: "P",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  },
  ABSENT: {
    label: "A",
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  },
  HALF_DAY: {
    label: "HD",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  },
  WEEK_OFF: {
    label: "WO",
    color: "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)]",
  },
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AttendanceDetailClient({ data, currentMonth }: AttendanceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const { employee, days, weekdayRollup, summary } = data;

  const handleMonthChange = (newMonth: string) => {
    startTransition(() => {
      router.push(`/attendance/${employee.id}?month=${newMonth}`);
    });
  };

  // CSV export for individual employee
  const handleExportCSV = useCallback(() => {
    const headers = ["Date", "Day", "Status", "Worked Hours", "OT Hours", "Breakdown Hours", "Log Count"];
    const csvRows = days.map((d: AttendanceDay) => [
      d.date,
      DOW_LABELS[d.dow],
      d.status,
      (d.worked_minutes / 60).toFixed(1),
      (d.overtime_minutes / 60).toFixed(1),
      (d.breakdown_minutes / 60).toFixed(1),
      d.log_count,
    ]);
    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Attendance_${employee.full_name.replace(/\s+/g, "_")}_${currentMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported attendance sheet for ${employee.full_name}`);
  }, [days, employee.full_name, currentMonth, toast]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Canonical Desktop Page Header */}
      <PageHeader
        title={employee.full_name}
        description={`${employee.role} • ${employee.phone || "No phone"}${
          employee.city ? ` • ${employee.city}` : ""
        }${
          employee.shift_start_time && employee.shift_end_time
            ? ` • Shift: ${employee.shift_start_time}–${employee.shift_end_time}`
            : ""
        }`}
        breadcrumbs={[
          { label: "Attendance", href: `/attendance?month=${currentMonth}` },
          { label: employee.full_name },
        ]}
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
              title="Export CSV"
            >
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Mobile Back & Controls Row (PageHeader hidden on mobile < md) */}
      <div className="flex md:hidden flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/attendance?month=${currentMonth}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] min-h-[44px] px-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Attendance</span>
          </Link>
          <div className="flex items-center gap-2">
            <MonthSelect
              value={currentMonth}
              onChange={handleMonthChange}
              disabled={isPending}
              showQuickNav
              compact
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download size={14} className="text-[var(--color-mute)]" />}
              className="h-11 px-3 text-xs font-semibold"
              title="Export CSV"
            >
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* Mobile employee subtitle badge */}
        <div className="text-xs text-[var(--color-mute)] font-mono px-1">
          {employee.role} • {employee.phone || "No phone"}
          {employee.city ? ` • ${employee.city}` : ""}
        </div>
      </div>

      {/* 2. Summary KPI Strip (7 Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {[
          {
            label: "Present",
            value: summary.presentDays,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Absent",
            value: summary.absentDays,
            color: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Half Day",
            value: summary.halfDays,
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Week Off",
            value: summary.weekOffs,
            color: "text-[var(--color-mute)]",
          },
          {
            label: "Worked",
            value: formatMinutes(summary.totalWorkedMinutes),
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "OT Hours",
            value: formatMinutes(summary.totalOtMinutes),
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Breakdown",
            value: formatMinutes(summary.totalBreakdownMinutes),
            color: "text-rose-600 dark:text-rose-400",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-3.5 shadow-xs text-center"
          >
            <span className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider block">
              {kpi.label}
            </span>
            <div className={`mt-1 text-lg sm:text-xl font-extrabold tracking-tight font-mono ${kpi.color}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Calendar Grid — Desktop (≥640px) */}
      <div className="hidden sm:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-[var(--color-ink)] mb-3.5">
          Daily Attendance Matrix
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {/* Day-of-week headers */}
          {DOW_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-semibold text-[var(--color-mute)] uppercase pb-1.5"
            >
              {label}
            </div>
          ))}

          {/* Leading empty cells for calendar alignment */}
          {days.length > 0 &&
            Array.from({ length: days[0].dow }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[64px]" />
            ))}

          {/* Day cells */}
          {days.map((day: AttendanceDay) => {
            const chip = STATUS_CHIP[day.status] || STATUS_CHIP.ABSENT;
            const dateNum = new Date(day.date).getDate();

            return (
              <div
                key={day.date}
                className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2 min-h-[64px] flex flex-col items-center justify-center gap-1 text-center transition-colors hover:border-[var(--color-ink)]/30"
              >
                <span className="text-[10px] font-mono text-[var(--color-mute)]">{dateNum}</span>
                <span
                  className={`inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-bold ${chip.color}`}
                >
                  {chip.label}
                </span>
                {day.worked_minutes > 0 ? (
                  <span className="text-[10px] font-mono text-[var(--color-ink)]">
                    {formatMinutes(day.worked_minutes)}
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--color-mute)] font-mono">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Calendar List — Mobile (≤640px) */}
      <div className="block sm:hidden space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-ink)] px-1">
          Daily Attendance
        </h2>
        {days.map((day: AttendanceDay) => {
          const chip = STATUS_CHIP[day.status] || STATUS_CHIP.ABSENT;
          const dateStr = new Date(day.date).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });

          return (
            <div
              key={day.date}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 min-h-[44px] shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-[10px] font-bold ${chip.color}`}
                >
                  {chip.label}
                </span>
                <span className="text-xs font-semibold text-[var(--color-ink)]">{dateStr}</span>
              </div>
              <div className="text-right text-xs text-[var(--color-mute)] font-mono">
                {day.worked_minutes > 0 && (
                  <span className="mr-2 text-[var(--color-ink)]">{formatMinutes(day.worked_minutes)}</span>
                )}
                {day.overtime_minutes > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    +{formatMinutes(day.overtime_minutes)} OT
                  </span>
                )}
                {day.log_count > 0 && (
                  <span className="ml-2 text-[var(--color-mute)]">
                    {day.log_count} log{day.log_count > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Day-of-Week Rollup Table */}
      {weekdayRollup && weekdayRollup.length > 0 && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/40">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">
              Day-of-Week Summary
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Average working hours and attendance distribution by day of week
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 text-[var(--color-mute)] uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-2.5 px-3.5">Day</th>
                  <th className="py-2.5 px-3.5 text-center">Total</th>
                  <th className="py-2.5 px-3.5 text-center">Present</th>
                  <th className="py-2.5 px-3.5 text-center">Absent</th>
                  <th className="py-2.5 px-3.5 text-center">Half Day</th>
                  <th className="py-2.5 px-3.5 text-right">Avg Worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {weekdayRollup.map((row) => (
                  <tr
                    key={row.dow}
                    className={`hover:bg-[var(--color-canvas)]/40 transition-colors ${
                      row.dow === 0 ? "bg-gray-50/50 dark:bg-gray-900/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-semibold text-[var(--color-ink)]">
                      {DOW_LABELS[row.dow]}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono text-[var(--color-body)]">
                      {row.total_days}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {row.present_days}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {row.absent_days}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {row.half_days}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-medium text-[var(--color-ink)]">
                      {formatMinutes(row.avg_worked_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-[var(--color-canvas)]/50 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
