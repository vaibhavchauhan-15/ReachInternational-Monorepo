"use client";

import React, { useTransition, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PageHeader,
  Button,
  MonthSelect,
  Badge,
  Modal,
  useToast,
} from "@/components/ui";
import {
  AnimatedUserCheck,
  AnimatedUserX,
  AnimatedClock,
  AnimatedCalendar,
  AnimatedBriefcase,
  AnimatedZap,
  AnimatedPhone,
  AnimatedMapPin,
  AnimatedDownload,
  AnimatedChevronRight,
  AnimatedInfo,
  AnimatedTruck,
  AnimatedCreditCard,
  AnimatedLayers,
} from "@/components/ui/animated-icons";
import type { AttendanceDetailResult, AttendanceDay, AttendanceDayEntry } from "@/lib/data/attendance/attendance-detail";

interface AttendanceDetailClientProps {
  data: AttendanceDetailResult;
  currentMonth: string;
}

const STATUS_CHIP: Record<string, { label: string; name: string; color: string; cellBg: string; badgeVariant: "success" | "warning" | "error" | "neutral" }> = {
  PRESENT: {
    label: "P",
    name: "Present",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    cellBg: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/50",
    badgeVariant: "success",
  },
  HALF_DAY: {
    label: "HD",
    name: "Half Day",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    cellBg: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/25 hover:border-amber-500/50",
    badgeVariant: "warning",
  },
  ABSENT: {
    label: "A",
    name: "Absent",
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
    cellBg: "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/25 hover:border-rose-500/50",
    badgeVariant: "error",
  },
  WEEK_OFF: {
    label: "WO",
    name: "Week Off",
    color: "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)]",
    cellBg: "bg-[var(--color-canvas)]/50 border-[var(--color-hairline)] hover:border-[var(--color-hairline)]",
    badgeVariant: "neutral",
  },
  DISABLED: {
    label: "—",
    name: "Upcoming / In Progress",
    color: "bg-[var(--color-hairline-soft-surface)] text-[var(--color-faint)] border border-[var(--color-hairline)]",
    cellBg: "opacity-40 bg-[var(--color-canvas)]/30 border border-dashed border-[var(--color-hairline)] cursor-not-allowed select-none",
    badgeVariant: "neutral",
  },
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h 00m`;
}

function formatMinutesShort(mins: number): string {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeOnly(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const parts = timeStr.trim().split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return timeStr;
}

function formatTimeAMPM(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function getInitials(name: string): string {
  if (!name) return "EM";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type ViewMode = "calendar" | "table";

export function AttendanceDetailClient({ data, currentMonth }: AttendanceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState<AttendanceDay | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const { employee, days, weekdayRollup, summary } = data;

  // Format month title (e.g. "September 2026")
  const [yearStr, monthStr] = currentMonth.split("-");
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Current authoritative Indian date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  // Compute shift duration in hours
  const shiftDurationHours = useMemo(() => {
    const startMins = parseTimeToMinutes(employee.shift_start_time);
    const endMins = parseTimeToMinutes(employee.shift_end_time);
    if (startMins !== null && endMins !== null && endMins > startMins) {
      return (endMins - startMins) / 60;
    }
    return 8; // standard 8h fallback
  }, [employee.shift_start_time, employee.shift_end_time]);

  // Derive per-day punch details (punchIn, punchOut, machine, location)
  const enrichedDays = useMemo(() => {
    return days.map((d: AttendanceDay) => {
      const isFuture = d.date > todayStr;
      const isToday = d.date === todayStr;
      const isTodayNoLog = isToday && d.log_count === 0 && d.worked_minutes === 0;
      const isWeekOff = d.status === "WEEK_OFF";
      const isDisabled = (d.status === "DISABLED" || isFuture || isTodayNoLog) && !isWeekOff;

      let punchIn = d.punch_in || null;
      let punchOut = d.punch_out || null;
      let primaryMachine = "";
      let primaryLocation = "";

      if (d.entries && d.entries.length > 0) {
        if (!punchIn) {
          const starts = d.entries.map((e) => e.start_time).filter(Boolean) as string[];
          if (starts.length > 0) {
            starts.sort();
            punchIn = starts[0];
          }
        }
        if (!punchOut) {
          const ends = d.entries.map((e) => e.end_time).filter(Boolean) as string[];
          if (ends.length > 0) {
            ends.sort();
            punchOut = ends[ends.length - 1];
          }
        }
        const firstEntry = d.entries[0];
        primaryMachine = firstEntry.machine_code || firstEntry.machine_name || "";
        primaryLocation = firstEntry.location || "";
      }

      const effectiveStatus = isDisabled ? "DISABLED" : d.status;

      return {
        ...d,
        effectiveStatus,
        isDisabled,
        isToday,
        isFuture,
        punchIn,
        punchOut,
        lateMinutes: 0,
        earlyMinutes: 0,
        primaryMachine,
        primaryLocation,
      };
    });
  }, [days, todayStr]);

  // Aggregate monthly totals accurately
  const metrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let weekOff = 0;
    let totalWorkedMins = 0;
    let totalOtMins = 0;
    let totalBreakdownMins = 0;
    let scheduledWorkDays = 0;

    for (const d of enrichedDays) {
      if (d.status === "WEEK_OFF") {
        weekOff++;
      } else {
        scheduledWorkDays++;
        if (d.effectiveStatus === "PRESENT") {
          present++;
        } else if (d.effectiveStatus === "HALF_DAY") {
          halfDay++;
        } else if (d.effectiveStatus === "ABSENT") {
          absent++;
        }
      }

      if (!d.isDisabled) {
        totalWorkedMins += d.worked_minutes;
        totalOtMins += d.overtime_minutes;
        totalBreakdownMins += d.breakdown_minutes;
      }
    }

    // Payable Days formula: Present + (HalfDay * 0.5) + WeekOffs
    const payableDays = present + halfDay * 0.5 + weekOff;

    // Scheduled working hours for month = scheduledWorkDays * shiftDuration
    const scheduledHoursTotal = Math.round(scheduledWorkDays * shiftDurationHours);

    // Attendance rate %
    const totalAccountedDays = present + halfDay + absent;
    const attendanceRate = totalAccountedDays > 0 ? Math.round(((present + halfDay * 0.5) / totalAccountedDays) * 100) : 100;

    return {
      present,
      absent,
      halfDay,
      weekOff,
      payableDays,
      scheduledWorkDays,
      scheduledHoursTotal,
      attendanceRate,
      totalWorkedMins,
      totalOtMins,
      totalBreakdownMins,
    };
  }, [enrichedDays, shiftDurationHours]);

  // All days for the table/matrix (filter strip removed per feedback)
  const filteredDays = enrichedDays;

  const handleMonthChange = (newMonth: string) => {
    startTransition(() => {
      router.push(`/attendance/${employee.id}?month=${newMonth}`);
    });
  };

  // CSV export with comprehensive fields
  const handleExportCSV = useCallback(() => {
    const headers = [
      "Date",
      "Day",
      "Status",
      "Start Time",
      "End Time",
      "Hrs Worked",
      "Overtime Hours",
      "Breakdown Hours",
      "Primary Machine",
      "Location",
      "Log Count",
    ];

    const csvRows = enrichedDays.map((d) => {
      const displayStatus = d.effectiveStatus === "DISABLED"
        ? (d.isToday ? "IN_PROGRESS" : "UPCOMING")
        : d.status;

      return [
        d.date,
        DOW_LABELS[d.dow],
        displayStatus,
        formatTimeAMPM(d.punchIn),
        formatTimeAMPM(d.punchOut),
        (d.worked_minutes / 60).toFixed(2),
        (d.overtime_minutes / 60).toFixed(2),
        (d.breakdown_minutes / 60).toFixed(2),
        `"${d.primaryMachine.replace(/"/g, '""')}"`,
        `"${d.primaryLocation.replace(/"/g, '""')}"`,
        d.log_count,
      ];
    });

    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Attendance_Detail_${employee.full_name.replace(/\s+/g, "_")}_${currentMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported attendance sheet for ${employee.full_name}`);
  }, [enrichedDays, employee.full_name, currentMonth, toast]);

  // Browser print / PDF export
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Formatted employee ID
  const formattedEmpId = `EMP-${employee.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-28 sm:pb-24 md:pb-8 px-1 sm:px-0">
      {/* 1. Header Toolbar (Hidden when printing) */}
      <div className="print:hidden">
        <PageHeader
          title={employee.full_name}
          description={`Monthly attendance ledger and operational shift records for ${monthName}`}
          breadcrumbs={[
            { label: "Attendance", href: `/attendance?month=${currentMonth}` },
            { label: employee.full_name },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <MonthSelect
                value={currentMonth}
                onChange={handleMonthChange}
                disabled={isPending}
                showQuickNav
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                className="h-9 px-3 text-xs font-semibold gap-1.5"
                title="Print or Save as PDF"
              >
                <span>Print / PDF</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                icon={<AnimatedDownload size={14} className="text-[var(--color-mute)]" />}
                className="h-9 px-3 text-xs font-semibold gap-1.5"
                title="Export CSV"
              >
                <span>Export CSV</span>
              </Button>
            </div>
          }
        />
      </div>

      {/* Mobile Month & Export Bar (<md) */}
      <div className="flex md:hidden items-center justify-between gap-2 print:hidden">
        <MonthSelect
          value={currentMonth}
          onChange={handleMonthChange}
          disabled={isPending}
          showQuickNav
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          icon={<AnimatedDownload size={14} className="text-[var(--color-mute)]" />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 shrink-0"
        >
          <span>Export</span>
        </Button>
      </div>

      {/* 2. Employee Details Master Card (Elevated from the user's PDF) */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs transition-colors">
        {/* Top Title Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--color-hairline)]/80">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            {/* Avatar Badge */}
            <div className="w-12 h-12 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] flex items-center justify-center font-bold text-base font-mono shrink-0 shadow-2xs">
              {getInitials(employee.full_name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-[var(--color-ink)] tracking-tight truncate">
                  {employee.full_name}
                </h1>
                <Badge variant="neutral" className="text-[10px] uppercase font-mono font-semibold tracking-wider">
                  {employee.role}
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[var(--color-mute)] mt-0.5 font-mono truncate">
                {employee.email || "reachinternational.co.in"}
              </p>
            </div>
          </div>
        </div>

        {/* Structured 4-Column Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-3.5 text-xs">
          {/* Employee ID */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
              Employee ID
            </span>
            <span className="font-mono font-bold text-[var(--color-ink)] text-xs sm:text-sm">
              {formattedEmpId}
            </span>
          </div>

          {/* Phone Number */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
              Phone Number
            </span>
            {employee.phone ? (
              <a
                href={`tel:${employee.phone}`}
                className="inline-flex items-center gap-1.5 font-mono font-semibold text-[var(--color-ink)] hover:text-[#0070f3] transition-colors"
              >
                <AnimatedPhone size={13} className="text-[var(--color-mute)] shrink-0" />
                <span>{employee.phone}</span>
              </a>
            ) : (
              <span className="text-[var(--color-mute)] font-mono">—</span>
            )}
          </div>

          {/* Site Location */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
              Site Location
            </span>
            <div className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-ink)] truncate">
              <AnimatedMapPin size={13} className="text-[var(--color-mute)] shrink-0" />
              <span className="truncate">
                {employee.city ? `${employee.city}${employee.state ? `, ${employee.state}` : ""}` : "—"}
              </span>
            </div>
          </div>

          {/* Shift Schedule */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
              Shift Schedule
            </span>
            <div className="inline-flex items-center gap-1 font-mono font-medium text-[var(--color-ink)]">
              <AnimatedClock size={13} className="text-[var(--color-mute)] shrink-0" />
              <span>
                {employee.shift_start_time && employee.shift_end_time
                  ? `${formatTimeAMPM(employee.shift_start_time)} – ${formatTimeAMPM(employee.shift_end_time)}`
                  : "08:00 AM – 05:00 PM"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Executive Attendance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
        {[
          {
            label: "Payable Days",
            value: `${metrics.payableDays.toFixed(1)}`,
            caption: "Present + Week Offs",
            color: "text-emerald-700 dark:text-emerald-300",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            icon: AnimatedCreditCard,
          },
          {
            label: "Present",
            value: metrics.present,
            caption: "Full shifts",
            color: "text-emerald-700 dark:text-emerald-300",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            icon: AnimatedUserCheck,
          },
          {
            label: "Absent",
            value: metrics.absent,
            caption: "Missed days",
            color: metrics.absent > 0 ? "text-rose-700 dark:text-rose-300" : "text-[var(--color-mute)]",
            iconColor: metrics.absent > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--color-mute)]",
            icon: AnimatedUserX,
          },
          {
            label: "Half Day",
            value: metrics.halfDay,
            caption: "< 4h shifts",
            color: metrics.halfDay > 0 ? "text-amber-700 dark:text-amber-300" : "text-[var(--color-mute)]",
            iconColor: metrics.halfDay > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-mute)]",
            icon: AnimatedClock,
          },
          {
            label: "Week Off",
            value: metrics.weekOff,
            caption: "Scheduled rest",
            color: "text-[var(--color-mute)]",
            iconColor: "text-[var(--color-mute)]",
            icon: AnimatedCalendar,
          },
          {
            label: "Worked Hrs",
            value: formatMinutesShort(metrics.totalWorkedMins),
            caption: `Target: ${metrics.scheduledHoursTotal}h`,
            color: "text-sky-700 dark:text-sky-300",
            iconColor: "text-sky-600 dark:text-sky-400",
            icon: AnimatedBriefcase,
          },
          {
            label: "Overtime",
            value: formatMinutesShort(metrics.totalOtMins),
            caption: "Approved extra hrs",
            color: metrics.totalOtMins > 0 ? "text-amber-700 dark:text-amber-300" : "text-[var(--color-mute)]",
            iconColor: metrics.totalOtMins > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-mute)]",
            icon: AnimatedZap,
          },
        ].map((kpi) => {
          const IconComp = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              data-hover-parent
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-3.5 shadow-xs transition-colors hover:border-[var(--color-ink)]/25 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-[var(--color-hairline)]/60">
                <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider truncate">
                  {kpi.label}
                </span>
                <IconComp size={15} className={`w-3.5 h-3.5 shrink-0 ${kpi.iconColor}`} />
              </div>
              <div className={`mt-2 text-lg sm:text-xl font-extrabold tracking-tight font-mono ${kpi.color}`}>
                {kpi.value}
              </div>
              <p className="mt-1 text-[10px] sm:text-[11px] text-[var(--color-mute)] truncate">
                {kpi.caption}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* 4. Daily Attendance Records Section: Controls & View Switcher */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs space-y-4">
        {/* Section Header with View Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--color-hairline)]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
              Daily Attendance Ledger
            </h2>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Daily shift logs, punch timings, worked hours, and machine telemetry for {monthName}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap print:hidden">
            {/* View Mode Toggle (Calendar Matrix vs. Table Ledger) */}
            <div className="inline-flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "calendar"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <AnimatedCalendar size={13} className="w-3.5 h-3.5 shrink-0" />
                <span>Calendar Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <AnimatedLayers size={13} className="w-3.5 h-3.5 shrink-0" />
                <span>Ledger View</span>
              </button>
            </div>
          </div>
        </div>

        {/* VIEW 1: Detailed Table Ledger */}
        {viewMode === "table" && (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0 border border-[var(--color-hairline)] rounded-xl overflow-hidden hidden sm:block">
            <table className="w-full text-xs text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/80 text-[var(--color-mute)] uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-3.5">Date & Day</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Start Time</th>
                  <th className="py-3 px-3">End Time</th>
                  <th className="py-3 px-3 font-mono text-right">Worked Hrs</th>
                  <th className="py-3 px-3 font-mono text-right">Overtime</th>
                  <th className="py-3 px-3.5">Machine</th>
                  <th className="py-3 px-3.5">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {filteredDays.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[var(--color-mute)]">
                      No days matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredDays.map((d) => {
                    const dateNum = new Date(d.date).getDate();
                    const dowName = DOW_LABELS[d.dow];
                    const isSunday = d.dow === 0;
                    const chip = STATUS_CHIP[d.effectiveStatus] || STATUS_CHIP.DISABLED;
                    const isClickable = !d.isDisabled && (d.worked_minutes > 0 || d.log_count > 0 || d.effectiveStatus === "ABSENT");

                    return (
                      <tr
                        key={d.date}
                        role={isClickable ? "button" : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onClick={() => {
                          if (isClickable) setSelectedDay(d);
                        }}
                        onKeyDown={(e) => {
                          if (isClickable && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            setSelectedDay(d);
                          }
                        }}
                        className={`transition-colors ${
                          d.isToday ? "bg-sky-50/50 dark:bg-sky-950/20 font-medium" : ""
                        } ${
                          d.isDisabled
                            ? "opacity-50 bg-[var(--color-canvas)]/30"
                            : isClickable
                            ? "hover:bg-[var(--color-canvas)]/60 cursor-pointer"
                            : ""
                        }`}
                      >
                        {/* Date & Day */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-xs ${d.isToday ? "text-[#0070f3]" : "text-[var(--color-ink)]"}`}>
                              {monthDate.toLocaleDateString("en-US", { month: "short" })} {String(dateNum).padStart(2, "0")}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                isSunday
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
                              }`}
                            >
                              {dowName}
                            </span>
                            {d.isToday && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[var(--color-ink)] text-[var(--color-canvas)]">
                                Today
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Chip */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold ${chip.color}`}
                          >
                            {chip.name}
                          </span>
                        </td>

                        {/* Start Time */}
                        <td className="py-2.5 px-3 font-mono">
                          {d.punchIn ? (
                            <span className="text-[var(--color-ink)] font-semibold">
                              {formatTimeAMPM(d.punchIn)}
                            </span>
                          ) : (
                            <span className="text-[var(--color-mute)]">—</span>
                          )}
                        </td>

                        {/* End Time */}
                        <td className="py-2.5 px-3 font-mono">
                          {d.punchOut ? (
                            <span className="text-[var(--color-ink)] font-semibold">
                              {formatTimeAMPM(d.punchOut)}
                            </span>
                          ) : (
                            <span className="text-[var(--color-mute)]">—</span>
                          )}
                        </td>

                        {/* Worked Hours */}
                        <td className="py-2.5 px-3 font-mono text-right">
                          {d.worked_minutes > 0 ? (
                            <span className="font-bold text-[var(--color-ink)]">
                              {formatMinutes(d.worked_minutes)}
                            </span>
                          ) : d.status === "WEEK_OFF" ? (
                            <span className="text-[var(--color-mute)]">Off</span>
                          ) : d.isDisabled ? (
                            <span className="text-[var(--color-faint)]">—</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">0h</span>
                          )}
                        </td>

                        {/* Overtime */}
                        <td className="py-2.5 px-3 font-mono text-right">
                          {d.overtime_minutes > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              +{formatMinutes(d.overtime_minutes)}
                            </span>
                          ) : (
                            <span className="text-[var(--color-mute)]">—</span>
                          )}
                        </td>

                        {/* Machine */}
                        <td className="py-2.5 px-3.5">
                          {d.primaryMachine ? (
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[200px]">
                              <AnimatedTruck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                              <span className="font-mono font-semibold text-[var(--color-ink)] truncate">
                                {d.primaryMachine}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[var(--color-mute)]">—</span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="py-2.5 px-3.5">
                          {d.primaryLocation ? (
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[220px]">
                              <AnimatedMapPin size={13} className="text-[var(--color-mute)] shrink-0" />
                              <span className="text-[var(--color-ink)] truncate">
                                {d.primaryLocation}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[var(--color-mute)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Summary Footer (Totals for the Month) */}
              <tfoot>
                <tr className="border-t-2 border-[var(--color-hairline)] bg-[var(--color-canvas)]/90 font-bold text-xs">
                  <td className="py-3 px-3.5 text-[var(--color-ink)]">
                    Monthly Totals
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-600">
                    {metrics.present} Present
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-[var(--color-mute)] font-normal text-[11px]">
                    {metrics.payableDays.toFixed(1)} Payable Days
                  </td>
                  <td className="py-3 px-3 font-mono text-right text-[var(--color-ink)]">
                    {formatMinutes(metrics.totalWorkedMins)}
                  </td>
                  <td className="py-3 px-3 font-mono text-right text-amber-600">
                    +{formatMinutes(metrics.totalOtMins)}
                  </td>
                  <td colSpan={2} className="py-3 px-3.5 text-[var(--color-mute)] text-[11px] font-normal">
                    {metrics.attendanceRate}% Attendance Compliance
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile View (≤640px) Touch Cards for Ledger View */}
          <div className="block sm:hidden space-y-2.5 pt-2">
            {filteredDays.map((d) => {
              const chip = STATUS_CHIP[d.effectiveStatus] || STATUS_CHIP.DISABLED;
              const isClickable = !d.isDisabled && (d.worked_minutes > 0 || d.log_count > 0 || d.effectiveStatus === "ABSENT");
              const dateStr = new Date(d.date).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });

              return (
                <div
                  key={d.date}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => {
                    if (isClickable) setSelectedDay(d);
                  }}
                  className={`rounded-xl border p-3 shadow-xs transition-colors ${
                    d.isToday ? "ring-1 ring-[var(--color-ink)]" : ""
                  } ${
                    d.isDisabled
                      ? "opacity-45 bg-[var(--color-canvas)]/50 border-dashed border-[var(--color-hairline)]"
                      : isClickable
                      ? "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] active:scale-[0.99] cursor-pointer"
                      : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]/60">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[var(--color-ink)]">{dateStr}</span>
                      {d.isToday && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-[var(--color-ink)] text-[var(--color-canvas)]">
                          Today
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${chip.color}`}>
                      {chip.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[var(--color-mute)] uppercase block">Shift Timings</span>
                      <span className="text-[var(--color-ink)] font-semibold">
                        {d.punchIn ? formatTimeAMPM(d.punchIn) : "—"} → {d.punchOut ? formatTimeAMPM(d.punchOut) : "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[var(--color-mute)] uppercase block">Hours</span>
                      <span className="text-[var(--color-ink)] font-bold">
                        {d.worked_minutes > 0 ? formatMinutes(d.worked_minutes) : d.status === "WEEK_OFF" ? "Week Off" : "0h"}
                      </span>
                      {d.overtime_minutes > 0 && (
                        <span className="text-[10px] text-amber-600 font-bold block">
                          +{formatMinutes(d.overtime_minutes)} OT
                        </span>
                      )}
                    </div>
                  </div>

                  {(d.primaryMachine || d.primaryLocation) && (
                    <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-[var(--color-hairline)]/40 text-[11px] text-[var(--color-mute)]">
                      <div className="flex items-center gap-2 truncate">
                        {d.primaryMachine && (
                          <div className="flex items-center gap-1.5 truncate">
                            <AnimatedTruck size={13} className="text-sky-600 shrink-0" />
                            <span className="font-mono text-[var(--color-ink)] truncate">{d.primaryMachine}</span>
                          </div>
                        )}
                        {d.primaryLocation && (
                          <div className="flex items-center gap-1.5 truncate">
                            <AnimatedMapPin size={13} className="text-[var(--color-mute)] shrink-0" />
                            <span className="truncate">{d.primaryLocation}</span>
                          </div>
                        )}
                      </div>
                      {isClickable && (
                        <span className="inline-flex items-center text-[#0070f3] text-[11px] font-semibold shrink-0">
                          <span>Details</span>
                          <AnimatedChevronRight size={13} />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
        )}

        {/* VIEW 2: Calendar Matrix (Visual 7-Column Grid) */}
        {viewMode === "calendar" && (
          <div className="space-y-3">
            {/* Status Legend Strip */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap text-[11px] pb-2 border-b border-[var(--color-hairline)]/60">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                P (Present)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                HD (Half Day)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                A (Absent)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                WO (Week Off)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-ink)]/30 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink)]" />
                Today
              </span>
            </div>

            {/* 7-Column Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {DOW_LABELS.map((label, idx) => (
                <div
                  key={label}
                  className={`text-center text-[11px] font-semibold uppercase tracking-wider py-1.5 ${
                    idx === 0 ? "text-rose-500/70" : "text-[var(--color-mute)]"
                  }`}
                >
                  {label}
                </div>
              ))}

              {/* Leading empty cells */}
              {days.length > 0 &&
                Array.from({ length: days[0].dow }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[76px]" />
                ))}

              {/* Day Cells */}
              {enrichedDays.map((d) => {
                const chip = STATUS_CHIP[d.effectiveStatus] || STATUS_CHIP.DISABLED;
                const dateNum = new Date(d.date).getDate();
                const isClickable = !d.isDisabled && (d.worked_minutes > 0 || d.log_count > 0 || d.effectiveStatus === "ABSENT");

                return (
                  <div
                    key={d.date}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={() => {
                      if (isClickable) setSelectedDay(d);
                    }}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setSelectedDay(d);
                      }
                    }}
                    className={`rounded-xl border p-2 min-h-[76px] flex flex-col justify-between transition-all ${
                      d.isToday ? "ring-2 ring-[var(--color-ink)] shadow-xs" : ""
                    } ${
                      d.isDisabled
                        ? "opacity-40 bg-[var(--color-canvas)]/30 border border-dashed border-[var(--color-hairline)] cursor-not-allowed select-none"
                        : isClickable
                        ? `${chip.cellBg} cursor-pointer group shadow-2xs`
                        : `${chip.cellBg} cursor-default`
                    }`}
                  >
                    {/* Date Number + Today */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          d.isDisabled ? "text-[var(--color-faint)]" : d.isToday ? "text-[var(--color-ink)] font-bold" : "text-[var(--color-ink)]"
                        }`}
                      >
                        {dateNum}
                      </span>
                      {d.isToday && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[var(--color-ink)] text-[var(--color-canvas)]">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Status Chip */}
                    <div className="flex items-center justify-center my-0.5">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold ${chip.color}`}
                      >
                        {chip.label}
                      </span>
                    </div>

                    {/* Timings or Hours Footer */}
                    <div className="flex flex-col gap-0.5 text-[9px] font-mono w-full text-center">
                      {d.punchIn && d.punchOut ? (
                        <span className="text-[var(--color-mute)] truncate">
                          {formatTimeAMPM(d.punchIn)} → {formatTimeAMPM(d.punchOut)}
                        </span>
                      ) : null}
                      <div className="flex items-center justify-between w-full">
                        {d.worked_minutes > 0 ? (
                          <span className="font-semibold text-[var(--color-ink)]">
                            {formatMinutesShort(d.worked_minutes)}
                          </span>
                        ) : d.status === "WEEK_OFF" ? (
                          <span className="text-[var(--color-mute)] w-full text-center">Off</span>
                        ) : (
                          <span className="text-[var(--color-mute)] w-full text-center">0h</span>
                        )}
                        {d.overtime_minutes > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            +{formatMinutesShort(d.overtime_minutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Day-of-Week Summary Rollup Table */}
      {weekdayRollup && weekdayRollup.length > 0 && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs print:hidden">
          <div className="p-3.5 sm:p-4 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/40">
            <h2 className="text-sm font-bold text-[var(--color-ink)]">
              Day-of-Week Attendance Distribution
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Average working hours and past attendance distribution by day of week
            </p>
          </div>
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-xs text-left border-collapse min-w-[520px]">
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
                      {row.dow === 0 && (
                        <span className="ml-1.5 text-[10px] text-[var(--color-mute)] font-normal font-sans">
                          (Rest Day)
                        </span>
                      )}
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

      {/* 6. Day Shift Logs Inspection Modal */}
      {selectedDay && (
        <Modal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--color-ink)] text-sm sm:text-base">
                {new Date(selectedDay.date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          }
          description={`Shift logs, punch timestamps, and machinery telemetry for ${employee.full_name}`}
          size="lg"
        >
          <div className="space-y-4 pt-1">
            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 sm:p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] tracking-wider block">
                  Status
                </span>
                <span className="mt-1 inline-flex items-center justify-center font-bold text-xs">
                  {selectedDay.status}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 sm:p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] tracking-wider block">
                  Worked
                </span>
                <span className="mt-1 font-mono font-bold text-xs sm:text-sm text-[var(--color-ink)] block">
                  {formatMinutes(selectedDay.worked_minutes)}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 sm:p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] tracking-wider block">
                  Overtime
                </span>
                <span className="mt-1 font-mono font-bold text-xs sm:text-sm text-amber-600 block">
                  {formatMinutes(selectedDay.overtime_minutes)}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 sm:p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] tracking-wider block">
                  Logs Count
                </span>
                <span className="mt-1 font-mono font-bold text-xs sm:text-sm text-[var(--color-ink)] block">
                  {selectedDay.log_count}
                </span>
              </div>
            </div>

            {/* Shift Entries List */}
            {selectedDay.entries && selectedDay.entries.length > 0 ? (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider">
                  Machine Operation Entries ({selectedDay.entries.length})
                </h4>
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {selectedDay.entries.map((entry: AttendanceDayEntry, idx: number) => (
                    <div
                      key={entry.id || idx}
                      data-hover-parent
                      className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-ink)]/30 p-3 sm:p-3.5 space-y-2.5 text-xs transition-colors"
                    >
                      {/* Machine Title & Info */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <AnimatedTruck size={16} className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                            <span className="font-mono font-bold text-xs sm:text-sm text-[var(--color-ink)]">
                              {entry.machine_code || entry.machine_id.slice(0, 8)}
                            </span>
                            {entry.machine_name && entry.machine_name !== entry.machine_code && (
                              <span className="text-xs text-[var(--color-mute)] truncate hidden xs:inline">
                                • {entry.machine_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {entry.model && (
                            <Badge variant="neutral" className="text-[10px] font-mono">
                              {entry.model}
                            </Badge>
                          )}
                          {entry.serial_number && (
                            <Badge variant="neutral" className="text-[10px] font-mono hidden sm:inline-flex">
                              SN: {entry.serial_number}
                            </Badge>
                          )}
                          {entry.is_breakdown && (
                            <Badge variant="error" className="text-[10px]">
                              Breakdown
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Shift Telemetry Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-[var(--color-mute)]">
                        <div className="bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]/60">
                          <span className="text-[10px] uppercase block text-[var(--color-mute)]/70">Time</span>
                          <span className="text-[var(--color-ink)] font-medium">
                            {formatTimeAMPM(entry.start_time)} → {formatTimeAMPM(entry.end_time)}
                          </span>
                        </div>
                        <div className="bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]/60">
                          <span className="text-[10px] uppercase block text-[var(--color-mute)]/70">Meters</span>
                          <span className="text-[var(--color-ink)] font-medium">
                            {entry.start_meter} → {entry.end_meter}
                          </span>
                        </div>
                        <div className="bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]/60">
                          <span className="text-[10px] uppercase block text-[var(--color-mute)]/70">Running</span>
                          <span className="text-[var(--color-ink)] font-medium">
                            {entry.running_hours.toFixed(1)} hrs
                          </span>
                        </div>
                        <div className="bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]/60">
                          <span className="text-[10px] uppercase block text-[var(--color-mute)]/70">Normal / OT</span>
                          <span className="text-[var(--color-ink)] font-medium">
                            {entry.normal_working_hours.toFixed(1)}h / {entry.overtime_hours.toFixed(1)}h
                          </span>
                        </div>
                      </div>

                      {/* Location & Serial row */}
                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[var(--color-mute)] flex-wrap">
                        {entry.location ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AnimatedMapPin size={13} className="text-[var(--color-mute)] shrink-0" />
                            <span className="truncate">{entry.location}</span>
                          </div>
                        ) : (
                          <span />
                        )}
                        {entry.serial_number && (
                          <span className="text-[10px] font-mono sm:hidden">
                            SN: {entry.serial_number}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 text-center text-xs text-[var(--color-mute)]">
                <AnimatedInfo size={20} className="mx-auto mb-2 text-[var(--color-mute)]" />
                <p className="font-semibold text-[var(--color-ink)]">No Machine Operation Logs Recorded</p>
                <p className="mt-1 text-[var(--color-mute)]">
                  {selectedDay.status === "WEEK_OFF"
                    ? "Scheduled weekly off day. No shifts required."
                    : selectedDay.status === "ABSENT"
                    ? "No work log was submitted by the operator for this scheduled day."
                    : "No log entries found for this date."}
                </p>
              </div>
            )}
          </div>
        </Modal>
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
