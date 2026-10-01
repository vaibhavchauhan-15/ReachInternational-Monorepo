"use client";

import React, { useMemo, useState } from "react";
import { TooltipWrapper } from "@/components/ui";
import { ShieldAlert, ChevronUp, ChevronDown, MessageSquare, AlertTriangle, ChevronRight, Clock } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import {
  parseBreakdownDetails,
  formatTo12Hour,
  parseBreakdownString,
} from "@reachinternational/utils";
import { OperationsLogTableSkeletonRows } from "../skeletons/OperationsSkeletons";

export interface OperationsLogsTableProps {
  logs: MachineHourLog[];
  logsViewMode: "machine" | "client" | "operator";
  isPending: boolean;
  currentPage?: number;
  logsPageSize?: number;
  totalMatchingLogs?: number;
  onPageChange?: (newPage: number) => void;
  onOpenConflictModal?: (log: MachineHourLog) => void;
  currentSort?: string;
  onSortChange?: (newSort: string) => void;
  onPageSizeChange?: (newSize: number) => void;
  selectedMachineId?: string;
  clientMachines?: any[];
}

/**
 * Resolves standard shift order weight (1: Morning/S1, 2: Afternoon/S2, 3: Evening/S3, 4: Night/S4).
 */
export function getShiftOrderWeight(log: MachineHourLog): number {
  const code = (log.shift_code || "").trim().toUpperCase();
  if (code === "S1" || code === "A") return 1;
  if (code === "S2" || code === "B") return 2;
  if (code === "S3" || code === "C") return 3;
  if (code === "S4" || code === "D") return 4;

  const shift = (log.shift || "").toLowerCase();
  if (shift.includes("morning")) return 1;
  if (shift.includes("afternoon")) return 2;
  if (shift.includes("evening")) return 3;
  if (shift.includes("night")) return 4;

  const time = (log.start_time || "").trim();
  if (time >= "06:00" && time < "12:00") return 1;
  if (time >= "12:00" && time < "18:00") return 2;
  if (time >= "18:00") return 3;
  if (time >= "00:00" && time < "06:00") return 4;

  return 5;
}

/**
 * Robust resolver for human-readable shift code (e.g. S1, S2, S3, S4, A, B, C).
 */
export function resolveShiftCode(log: MachineHourLog): string {
  if (log.shift_code && log.shift_code.trim()) {
    const c = log.shift_code.trim().toUpperCase();
    return c.startsWith("SHIFT") ? c.replace(/^SHIFT\s*/i, "") : c;
  }
  if (log.shift && log.shift.trim()) {
    const s = log.shift.trim();
    if (/^(S\d|[A-D]|\d)$/i.test(s)) return s.toUpperCase();
    if (s.toLowerCase().startsWith("shift")) return s.replace(/^shift\s*/i, "").toUpperCase();
    const w = getShiftOrderWeight(log);
    return `S${w <= 4 ? w : 1}`;
  }
  const weight = getShiftOrderWeight(log);
  return `S${weight <= 4 ? weight : 1}`;
}

export function formatDayOfWeek(dateStr: string): string {
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    }
  } catch {}
  return "";
}

/**
 * Formats date into ultra-compact representation: e.g. "24-Sep (Thu)"
 */
export function formatCompactDay(dateStr: string): string {
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = parts[2] < 10 ? `0${parts[2]}` : `${parts[2]}`;
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const mon = monthNames[parts[1] - 1] || "";
      const dow = d.toLocaleDateString("en-US", { weekday: "short" });
      return `${day}-${mon} (${dow})`;
    }
  } catch {}
  return dateStr;
}

/**
 * Formats date into standard Excel DD-MMM-YY representation: e.g. "28-Sep-26"
 */
export function formatExcelDate(dateStr: string): string {
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const day = parts[2] < 10 ? `0${parts[2]}` : `${parts[2]}`;
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const mon = monthNames[parts[1] - 1] || "";
      const yearStr = String(parts[0]).slice(-2);
      return `${day}-${mon}-${yearStr}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Formats hours into unit string: e.g. 7 -> "7h", 24 -> "24h", 0 -> "0h", 7.5 -> "7.5h"
 */
export function formatHoursWithUnit(val: number): string {
  if (val == null || isNaN(val)) return "0h";
  const rounded = Math.abs(val - Math.round(val)) < 0.05 ? Math.round(val) : Math.round(val * 10) / 10;
  return `${rounded}h`;
}

/**
 * Calculates working hours for an individual shift log.
 */
export function calculateShiftWorkingHours(log: MachineHourLog): number {
  if (log.normal_working_hours != null && Number(log.normal_working_hours) > 0) {
    const normal = Number(log.normal_working_hours);
    const ot = Number(log.overtime_hours || 0);
    return normal + ot;
  }
  if (log.start_time && log.end_time) {
    const sParts = log.start_time.split(":").map(Number);
    const eParts = log.end_time.split(":").map(Number);
    if (!isNaN(sParts[0]) && !isNaN(eParts[0])) {
      const sMin = sParts[0] * 60 + (sParts[1] || 0);
      let eMin = eParts[0] * 60 + (eParts[1] || 0);
      if (eMin <= sMin) {
        if (eParts[0] === 23 && (eParts[1] || 0) === 59) {
          eMin = 1440;
        } else {
          eMin += 1440;
        }
      }
      return (eMin - sMin) / 60;
    }
  }
  if (log.shift_scheduled_minutes != null && Number(log.shift_scheduled_minutes) > 0) {
    return Number(log.shift_scheduled_minutes) / 60;
  }
  // Standard shift working hours fallback (operator work time includes normal work + lunch = 8.0h)
  return 8.0;
}

/**
 * Calculates breakdown hours for an individual shift log.
 */
export function calculateShiftBreakdownHours(log: MachineHourLog): number {
  if (!log.is_breakdown) return 0;
  if (log.breakdown_hours != null && Number(log.breakdown_hours) > 0) {
    return Number(log.breakdown_hours);
  }
  const breakdownInfo = parseBreakdownDetails(log);
  if (breakdownInfo.durationRaw) {
    const matchH = breakdownInfo.durationRaw.match(/(\d+(?:\.\d+)?)\s*h/i);
    const matchM = breakdownInfo.durationRaw.match(/(\d+)\s*m/i);
    const h = matchH ? parseFloat(matchH[1]) : 0;
    const m = matchM ? parseInt(matchM[1], 10) : 0;
    if (h > 0 || m > 0) {
      return h + m / 60;
    }
  }
  return 0;
}

/**
 * Extracts formatted start time, end time, timing range, and duration from a log.
 */
export function extractBreakdownTiming(log: MachineHourLog): {
  startTime: string | null;
  endTime: string | null;
  timeRange: string | null;
  duration: string | null;
} {
  let start = log.breakdown_start_time ? formatTo12Hour(log.breakdown_start_time) : null;
  let end = log.breakdown_end_time ? formatTo12Hour(log.breakdown_end_time) : null;

  if (!start || !end) {
    const parsedDuration = parseBreakdownString(log.breakdown_duration);
    if (parsedDuration?.startTime && parsedDuration?.endTime) {
      start = start || parsedDuration.startTime;
      end = end || parsedDuration.endTime;
    }
  }

  if (!start || !end) {
    const parsedRemarks = parseBreakdownString(log.remarks);
    if (parsedRemarks?.startTime && parsedRemarks?.endTime) {
      start = start || parsedRemarks.startTime;
      end = end || parsedRemarks.endTime;
    }
  }

  if (!start || !end) {
    const bkdDetails = parseBreakdownDetails(log);
    if (bkdDetails.timingRange) {
      const parts = bkdDetails.timingRange.split(/[-–—]/);
      if (parts.length === 2) {
        start = start || formatTo12Hour(parts[0]);
        end = end || formatTo12Hour(parts[1]);
      }
    }
  }

  const timeRange = start && end ? `${start} – ${end}` : (start || end || null);

  const bkdMin = log.breakdown_minutes ?? Math.round((log.breakdown_hours || 0) * 60);
  const duration =
    bkdMin > 0
      ? bkdMin % 60 === 0
        ? `${Math.floor(bkdMin / 60)}h`
        : `${Math.floor(bkdMin / 60)}h ${bkdMin % 60}m`
      : log.breakdown_duration || null;

  return { startTime: start, endTime: end, timeRange, duration };
}

export interface DailyLogGroup {
  date: string;
  formattedDate: string;
  logs: MachineHourLog[];
  totalDayHmrRun: number;
  startMeter: number;
  endMeter: number;
  totalRunningHours: number;
  totalWorkingHours: number;
  totalBreakdownHours: number;
  /** Total maintenance minutes for this daily group (subset of breakdown covered by client allowance). */
  totalMaintenanceMinutes: number;
  totalOtHours: number;
  breakdownCount: number;
  uniqueMachinesCount: number;
  clientName: string;
  clientCity: string;
  locationStr: string;
  machineModel?: string;
  machineSerial?: string;
  shiftsDisplay: string;
  operatorsDisplay: string;
  operatorNames: string[];
  remarksDisplay: string;
}

/**
 * Groups raw shift logs by log_date into daily groups with consolidated shift entries.
 */
export function groupLogsByDate(logs: MachineHourLog[], logsViewMode: string = "client"): DailyLogGroup[] {
  const map = new Map<string, MachineHourLog[]>();

  for (const log of logs) {
    const d = log.log_date ? log.log_date.split("T")[0] : "Unknown Date";
    const existing = map.get(d);
    if (existing) {
      existing.push(log);
    } else {
      map.set(d, [log]);
    }
  }

  const groups: DailyLogGroup[] = [];

  for (const [date, dayLogs] of map.entries()) {
    // Sort shifts inside the day group:
    // In client view: group by machine model/code first, then by shift chronological sequence
    const sortedShifts = [...dayLogs].sort((a, b) => {
      if (logsViewMode === "client") {
        const mA = ((a.machine as any)?.model || (a.machine as any)?.machine_id || "").toLowerCase();
        const mB = ((b.machine as any)?.model || (b.machine as any)?.machine_id || "").toLowerCase();
        if (mA !== mB) return mA.localeCompare(mB);
        const sA = ((a.machine as any)?.serial_number || "").toLowerCase();
        const sB = ((b.machine as any)?.serial_number || "").toLowerCase();
        if (sA !== sB) return sA.localeCompare(sB);
      }
      const orderA = getShiftOrderWeight(a);
      const orderB = getShiftOrderWeight(b);
      if (orderA !== orderB) return orderA - orderB;
      const tA = a.start_time || "";
      const tB = b.start_time || "";
      return tA.localeCompare(tB);
    });

    let minStartMeter = Infinity;
    let maxEndMeter = -Infinity;
    let sumRunningHours = 0;
    let sumWorkHours = 0;
    let sumBreakdownHours = 0;
    let sumMaintenanceMinutes = 0;
    let sumOtHours = 0;
    let breakdownCount = 0;
    const machinesSet = new Set<string>();

    for (const s of sortedShifts) {
      const sMtr = s.start_meter ?? 0;
      const eMtr = s.end_meter ?? sMtr;
      const rHrs = s.running_hours ?? Math.max(0, Math.round((eMtr - sMtr) * 10) / 10);
      sumRunningHours += Number(rHrs || 0);
      sumWorkHours += calculateShiftWorkingHours(s);
      sumBreakdownHours += calculateShiftBreakdownHours(s);
      sumMaintenanceMinutes += Number(s.maintenance_minutes || 0);
      sumOtHours += Number(s.overtime_hours || 0);
      if (sMtr < minStartMeter) minStartMeter = sMtr;
      if (eMtr > maxEndMeter) maxEndMeter = eMtr;
      if (s.is_breakdown) breakdownCount++;
      const mId = s.machine_id || (s.machine as any)?.id || (s.machine as any)?.machine_id;
      if (mId) machinesSet.add(mId);
    }

    if (minStartMeter === Infinity) minStartMeter = 0;
    if (maxEndMeter === -Infinity) maxEndMeter = minStartMeter;

    const firstLog = sortedShifts[0];
    const mObj = firstLog?.machine as any;
    const clientName =
      (firstLog as any)?.client?.client_name ||
      (firstLog as any)?.client?.company_name ||
      mObj?.customer_name ||
      "Unassigned Client";
    const rawClientCity =
      (firstLog as any)?.client?.city?.trim() ||
      mObj?.city?.trim() ||
      (firstLog?.location ? firstLog.location.split(",")[0]?.trim() : "");
    const clientCity = rawClientCity || "—";
    const locationStr =
      firstLog?.location ||
      ((firstLog as any)?.client?.city
        ? [
            (firstLog as any).client.city,
            (firstLog as any).client.district,
            (firstLog as any).client.state,
          ]
            .filter(Boolean)
            .join(", ")
        : clientCity !== "—"
        ? clientCity
        : "—");

    // Format shifts list e.g. S1/S2/S3
    const shiftsDisplay = sortedShifts
      .map((s) => {
        const c = resolveShiftCode(s);
        return c.toUpperCase().startsWith("S") || isNaN(Number(c)) ? c : `S${c}`;
      })
      .join("/");

    // Format operator names cleanly (deduplicating identical operators across shifts on the same day)
    const operatorNamesList: string[] = [];
    for (const s of sortedShifts) {
      const op =
        (s.operator as any)?.full_name ||
        (s as any).operator_name ||
        (s as any).operator?.name ||
        "Unassigned";
      if (op && !operatorNamesList.includes(op)) {
        operatorNamesList.push(op);
      }
    }
    const operatorsDisplay = operatorNamesList.length > 0 ? operatorNamesList.join(", ") : "Unassigned";

    // Format consolidated remarks
    const remarksList = sortedShifts
      .map((s) => (s.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim())
      .filter((r) => r.length > 0 && r !== "—");
    const remarksDisplay = Array.from(new Set(remarksList)).join("; ");

    const totalWorkingHours =
      Math.abs(sumWorkHours - Math.round(sumWorkHours)) < 0.05
        ? Math.round(sumWorkHours)
        : Math.round(sumWorkHours * 10) / 10;

    const totalBreakdownHours =
      Math.abs(sumBreakdownHours - Math.round(sumBreakdownHours)) < 0.05
        ? Math.round(sumBreakdownHours)
        : Math.round(sumBreakdownHours * 10) / 10;

    groups.push({
      date,
      formattedDate: formatExcelDate(date),
      logs: sortedShifts,
      totalDayHmrRun: Math.max(0, Math.round((maxEndMeter - minStartMeter) * 10) / 10),
      startMeter: minStartMeter,
      endMeter: maxEndMeter,
      totalRunningHours: Math.max(0, Math.round(sumRunningHours * 10) / 10),
      totalWorkingHours,
      totalBreakdownHours,
      totalMaintenanceMinutes: sumMaintenanceMinutes,
      totalOtHours: Math.max(0, Math.round(sumOtHours * 10) / 10),
      breakdownCount,
      uniqueMachinesCount: machinesSet.size,
      clientName,
      clientCity,
      locationStr,
      machineModel: mObj?.model,
      machineSerial: mObj?.serial_number || mObj?.machine_code,
      shiftsDisplay,
      operatorsDisplay,
      operatorNames: operatorNamesList,
      remarksDisplay,
    });
  }

  return groups;
}

export interface OperationsDailyLogRowProps {
  group: DailyLogGroup;
  dayIndex: number;
  logsViewMode: "machine" | "client" | "operator";
  showMachineColumn?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onOpenConflictModal?: (log: MachineHourLog) => void;
}

/**
 * 1-line ultra-compact daily summary row matching the requested table format:
 * Date | Client | Shift | Operator | Day RT | Total Working Hours | Breakdown | Remark
 */
export const OperationsDailyLogRow = React.memo(function OperationsDailyLogRow({
  group,
  logsViewMode,
  showMachineColumn = true,
  onOpenConflictModal,
}: OperationsDailyLogRowProps) {
  const isClientView = logsViewMode === "client";
  const [isRowExpanded, setIsRowExpanded] = useState(false);

  // Check if any shift on this date has a pending conflict
  const conflictLog = group.logs.find(
    (l) => Boolean(l.conflict_flag) && (!l.conflict_status || l.conflict_status === "pending")
  );

  return (
    <>
      <tr
        onClick={() => setIsRowExpanded((prev) => !prev)}
        className={`group transition-colors border-b border-[var(--color-hairline)] cursor-pointer select-none ${
          isRowExpanded
            ? "bg-[var(--color-canvas)]"
            : conflictLog
            ? "bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10"
            : "hover:bg-[var(--color-canvas)]/70"
        }`}
      >
        {/* Date (e.g. 28-Sep-26) */}
        <td className="px-3 py-2 font-mono font-bold text-xs text-[var(--color-ink)] whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              size={12}
              className={`text-[var(--color-mute)] transition-transform duration-200 shrink-0 ${
                isRowExpanded ? "rotate-90 text-sky-600 dark:text-sky-400" : ""
              }`}
            />
            <span>{group.formattedDate}</span>
            {group.remarksDisplay && (
              <TooltipWrapper content="Click to view remarks">
                <span className="inline-flex text-sky-600 dark:text-sky-400 p-0.5">
                  <MessageSquare size={11} className="shrink-0" />
                </span>
              </TooltipWrapper>
            )}
            {conflictLog && onOpenConflictModal && (
              <TooltipWrapper content="Conflict detected in shift log. Click to review.">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConflictModal(conflictLog);
                  }}
                  className="cursor-pointer text-amber-600 dark:text-amber-400 p-0.5"
                  title="Conflict detected"
                >
                  <ShieldAlert size={12} className="shrink-0" />
                </button>
              </TooltipWrapper>
            )}
          </div>
        </td>

        {/* Client / Machine */}
        {showMachineColumn && (
          isClientView ? (
            <td className="px-3 py-2 font-mono whitespace-nowrap text-xs">
              <div
                className="flex items-center gap-1.5 max-w-[200px]"
                title={group.machineSerial ? `${group.machineModel} (SN: ${group.machineSerial})` : group.machineModel}
              >
                <span className="font-bold text-[var(--color-ink)] truncate">
                  {group.machineModel || "—"}
                </span>
                {group.machineSerial && (
                  <span className="text-[10px] text-[var(--color-mute)] font-mono font-medium shrink-0">
                    ({group.machineSerial})
                  </span>
                )}
              </div>
            </td>
          ) : (
            <td className="px-3 py-2 font-semibold whitespace-nowrap text-xs">
              <div className="flex items-center gap-1.5 max-w-[220px]" title={group.locationStr || group.clientName}>
                <span className="font-bold text-[var(--color-ink)] truncate">
                  {group.clientName}
                </span>
              </div>
            </td>
          )
        )}

        {/* Shift (e.g. S1/S2/S3) */}
        <td className="px-3 py-2 font-mono whitespace-nowrap text-xs font-bold text-sky-700 dark:text-sky-300">
          <div className="flex items-center gap-1">
            {group.shiftsDisplay}
          </div>
        </td>

        {/* Operator Name */}
        <td className="px-3 py-2 text-xs font-semibold text-[var(--color-ink)] whitespace-normal min-w-[150px]">
          <div className="flex flex-wrap items-center gap-1.5" title={group.operatorsDisplay}>
            {group.operatorNames && group.operatorNames.length > 0 ? (
              group.operatorNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs font-semibold text-[var(--color-ink)]"
                >
                  {name}
                </span>
              ))
            ) : (
              <span>{group.operatorsDisplay}</span>
            )}
          </div>
        </td>

        {/* M/C RT (e.g. 7h) */}
        <td className="px-3 py-2 font-mono font-bold text-center text-xs text-sky-600 dark:text-sky-400 whitespace-nowrap">
          {formatHoursWithUnit(group.totalRunningHours)}
        </td>

        {/* WH (Work Hours) */}
        <td className="px-3 py-2 font-mono font-bold text-center text-xs text-[var(--color-ink)] whitespace-nowrap">
          {formatHoursWithUnit(group.totalWorkingHours)}
        </td>

        {/* B/D / Maintenance — single column, smart label based on client allowance */}
        <td className="px-3 py-2 font-mono font-bold text-center text-xs whitespace-nowrap">
          {(() => {
            const totalBdMin = Math.round(group.totalBreakdownHours * 60);
            const maintMin = group.totalMaintenanceMinutes;
            const netBdMin = Math.max(0, totalBdMin - maintMin);
            const formatMin = (m: number) => {
              const h = Math.floor(m / 60);
              const rem = m % 60;
              return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
            };
            if (totalBdMin === 0) return <span className="text-[var(--color-mute)]">0h</span>;
            // Fully covered by maintenance allowance -> show MT prefix (print-friendly)
            if (maintMin >= totalBdMin && maintMin > 0) {
              return (
                <TooltipWrapper content={`Maintenance: ${formatMin(maintMin)} (covered by client allowance)`}>
                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    MT {formatMin(maintMin)}
                  </span>
                </TooltipWrapper>
              );
            }
            // Partially covered — show MT portion + net B/D portion
            if (maintMin > 0 && netBdMin > 0) {
              return (
                <div className="flex flex-col items-center gap-0.5">
                  <TooltipWrapper content={`Maintenance: ${formatMin(maintMin)} (covered by client allowance)`}>
                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      MT {formatMin(maintMin)}
                    </span>
                  </TooltipWrapper>
                  <TooltipWrapper content={`Net Breakdown (exceeds allowance): ${formatMin(netBdMin)}`}>
                    <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                      {formatMin(netBdMin)}
                    </span>
                  </TooltipWrapper>
                </div>
              );
            }
            // No allowance — pure breakdown -> red badge with hours (under B/D column)
            return (
              <TooltipWrapper content={`Breakdown: ${formatMin(totalBdMin)}`}>
                <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                  {formatMin(totalBdMin)}
                </span>
              </TooltipWrapper>
            );
          })()}
        </td>
      </tr>

      {/* Expandable Remark Row */}
      {isRowExpanded && (
        <tr className="bg-[var(--color-canvas)]/90 border-b border-[var(--color-hairline)]">
          <td
            colSpan={showMachineColumn ? 7 : 6}
            className="px-4 py-3 text-xs text-[var(--color-ink)] space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <MessageSquare size={14} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[10.5px] uppercase tracking-wider text-[var(--color-mute)]">
                    Shift Remarks ({group.formattedDate}):
                  </span>
                  <span className="text-[10.5px] text-[var(--color-mute)] font-mono">
                    Shifts: {group.shiftsDisplay} • Operators: {group.operatorsDisplay}
                  </span>
                </div>
                <p className="font-sans text-xs text-[var(--color-ink)] whitespace-pre-wrap leading-relaxed">
                  {group.remarksDisplay || "No special remarks logged for this day."}
                </p>
              </div>
            </div>
            {group.totalBreakdownHours > 0 && (() => {
              const totalBdMin = Math.round(group.totalBreakdownHours * 60);
              const maintMin = group.totalMaintenanceMinutes;
              const netBdMin = Math.max(0, totalBdMin - maintMin);
              const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };

              // Identify individual stoppage shift logs
              const stoppageLogs = group.logs.filter(
                (l) => Boolean(l.is_breakdown) || Number(l.breakdown_minutes || 0) > 0 || Number(l.breakdown_hours || 0) > 0
              );

              return (
                <div className="flex flex-col gap-2 pl-6 pt-1 border-t border-[var(--color-hairline)]/60">
                  {/* Summary row */}
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-[var(--color-mute)]">
                      <AlertTriangle size={13} className="shrink-0 text-amber-500" />
                      <span>Total stoppage: <strong className="text-[var(--color-ink)] font-mono">{fmtMin(totalBdMin)}</strong></span>
                    </div>
                    {maintMin > 0 && (
                      <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-mono">MT</span>
                        <span>Maintenance (allowance): <strong className="font-mono">{fmtMin(maintMin)}</strong></span>
                      </div>
                    )}
                    {netBdMin > 0 && (
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                        <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 text-[9px] font-mono">B/D</span>
                        <span>Net Breakdown (B/D): <strong className="font-mono">{fmtMin(netBdMin)}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Detailed Per-Incident Stoppage Timestamps */}
                  {stoppageLogs.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-mute)]">
                        Stoppage Timestamps & Classification:
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {stoppageLogs.map((bLog, bIdx) => {
                          const logMaint = Number(bLog.maintenance_minutes || 0);
                          const logBdMin =
                            Number(bLog.breakdown_minutes || 0) ||
                            Math.round(Number(bLog.breakdown_hours || 0) * 60) ||
                            totalBdMin;
                          const logNetBd = Math.max(0, logBdMin - logMaint);
                          const isFullyMaint = logMaint >= logBdMin && logMaint > 0;
                          const isPartial = logMaint > 0 && logNetBd > 0;

                          const timing = extractBreakdownTiming(bLog);
                          const shiftCode = resolveShiftCode(bLog);
                          const op =
                            (bLog.operator as any)?.full_name ||
                            (bLog as any).operator_name ||
                            "Operator";

                          const note = (bLog.remarks || "")
                            .replace(/\[Breakdown Duration:[^\]]+\]/gi, "")
                            .replace(/\[Breakdown:[^\]]+\]/gi, "")
                            .trim();

                          return (
                            <div
                              key={bLog.id || bIdx}
                              className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs flex-wrap sm:flex-nowrap"
                            >
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <Clock size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
                                <span className="font-semibold text-[var(--color-ink)]">
                                  Shift {shiftCode} ({op})
                                </span>
                                {timing.timeRange ? (
                                  <span className="font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded text-[11px] border border-sky-200/50 dark:border-sky-800/40">
                                    {timing.timeRange}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[var(--color-mute)] text-[11px]">
                                    (Time unrecorded)
                                  </span>
                                )}
                                <span className="font-mono text-[var(--color-mute)] text-[11px]">
                                  Duration: {fmtMin(logBdMin)}
                                </span>
                                {note && note !== "—" && (
                                  <span className="text-[var(--color-mute)] italic truncate max-w-[280px]">
                                    • {note}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isFullyMaint ? (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                                    MT {fmtMin(logMaint)} (Maintenance)
                                  </span>
                                ) : isPartial ? (
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                      MT {fmtMin(logMaint)}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                      {fmtMin(logNetBd)} (B/D)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 dark:text-rose-400">
                                    {fmtMin(logBdMin)} (Breakdown)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </td>
        </tr>
      )}
    </>
  );
});

// Backwards compatibility alias for any existing imports
export const OperationsDailyLogBox = OperationsDailyLogRow as any;

export const OperationsLogsTable = React.memo(function OperationsLogsTable({
  logs,
  logsViewMode,
  isPending,
  onOpenConflictModal,
  currentSort = "date-desc",
  onSortChange,
  selectedMachineId,
  clientMachines,
}: OperationsLogsTableProps) {
  const isClientView = logsViewMode === "client";

  // Group shift logs by machine when in client view
  const machineWiseGroups = useMemo(() => {
    if (!isClientView) return [];

    const logsByMachineId = new Map<string, MachineHourLog[]>();
    for (const log of logs) {
      const mId = log.machine_id || (log.machine as any)?.id || "unassigned";
      const existing = logsByMachineId.get(mId);
      if (existing) {
        existing.push(log);
      } else {
        logsByMachineId.set(mId, [log]);
      }
    }

    // Determine target machine IDs
    const targetMachineIds: string[] = [];
    if (selectedMachineId && selectedMachineId !== "all") {
      targetMachineIds.push(selectedMachineId);
    } else {
      // If all machines selected: preserve order of clientMachines, then append any remaining from logs
      if (clientMachines && clientMachines.length > 0) {
        for (const m of clientMachines) {
          if (m?.id && logsByMachineId.has(m.id)) {
            targetMachineIds.push(m.id);
          }
        }
      }
      for (const mId of logsByMachineId.keys()) {
        if (!targetMachineIds.includes(mId)) {
          targetMachineIds.push(mId);
        }
      }
    }

    return targetMachineIds
      .map((mId) => {
        const machLogs = logsByMachineId.get(mId) || [];
        const machineObj =
          clientMachines?.find((m) => m.id === mId) ||
          machLogs[0]?.machine || { id: mId, model: "Equipment" };

        const dailyGroups = groupLogsByDate(machLogs, "client");
        const sumDayRT = dailyGroups.reduce((acc, g) => acc + g.totalRunningHours, 0);
        const sumWorkingHours = dailyGroups.reduce((acc, g) => acc + g.totalWorkingHours, 0);
        const sumBreakdownHours = dailyGroups.reduce((acc, g) => acc + g.totalBreakdownHours, 0);

        return {
          machineId: mId,
          machineObj,
          logs: machLogs,
          dailyGroups,
          sumDayRT,
          sumWorkingHours,
          sumBreakdownHours,
        };
      })
      .filter((g) => g.logs.length > 0);
  }, [isClientView, logs, selectedMachineId, clientMachines]);

  // Standard flat grouping for machine / operator views
  const groupedLogs = useMemo(() => {
    if (isClientView) return [];
    return groupLogsByDate(logs, logsViewMode);
  }, [isClientView, logs, logsViewMode]);

  const sumDayRT = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalRunningHours, 0);
  }, [groupedLogs]);

  const sumWorkingHours = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalWorkingHours, 0);
  }, [groupedLogs]);

  const sumBreakdownHours = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalBreakdownHours, 0);
  }, [groupedLogs]);

  const standardTotalColumns = 7;
  const clientMachineTotalColumns = 6;

  return (
    <div
      className={`hidden sm:block space-y-4 transition-opacity duration-200 ${
        isPending ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────────
          CLIENT TAB VIEW: MACHINE-WISE GROUPS WITH MACHINE DETAILS AT TOP
          AND SEPARATE SUMMARY PER MACHINE
         ───────────────────────────────────────────────────────────────── */}
      {isClientView ? (
        machineWiseGroups.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-10 text-center text-xs text-[var(--color-mute)] shadow-2xs">
            {isPending
              ? "Loading daily shift logs..."
              : "No daily running hour shifts found for this client matching the active filter selection."}
          </div>
        ) : (
          machineWiseGroups.map((mGroup) => (
            <div
              key={mGroup.machineId}
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-2xs"
            >
              {/* Machine Details Header at Top */}
              <div className="px-3.5 py-2.5 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm text-[var(--color-ink)]">
                      {mGroup.machineObj.model || "Equipment"}
                    </span>
                    {(mGroup.machineObj.serial_number || mGroup.machineObj.machine_code) && (
                      <span className="font-mono text-[11px] font-semibold text-[var(--color-mute)]">
                        (SN: {mGroup.machineObj.serial_number || mGroup.machineObj.machine_code})
                      </span>
                    )}
                  </div>

                  {(mGroup.machineObj.machine_id || mGroup.machineObj.machine_code) && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] font-mono text-[10px] font-bold text-[var(--color-ink)] shadow-2xs">
                      {mGroup.machineObj.machine_id || mGroup.machineObj.machine_code}
                    </span>
                  )}
                </div>

                {/* Quick Summary KPIs for this Machine */}
                <div className="flex items-center gap-2.5 text-xs font-mono">
                  <span className="text-[var(--color-mute)]">
                    <span className="font-sans text-[10px] uppercase font-bold text-[var(--color-mute)]">Days: </span>
                    <strong className="text-[var(--color-ink)] font-mono font-bold">{mGroup.dailyGroups.length}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-[var(--color-mute)]">
                    <span className="font-sans text-[10px] uppercase font-bold text-[var(--color-mute)]">M/C RT: </span>
                    <strong className="text-sky-600 dark:text-sky-400 font-mono font-bold">
                      {formatHoursWithUnit(mGroup.sumDayRT)}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="text-[var(--color-mute)]">
                    <span className="font-sans text-[10px] uppercase font-bold text-[var(--color-mute)]">WH: </span>
                    <strong className="text-[var(--color-ink)] font-mono font-bold">
                      {formatHoursWithUnit(mGroup.sumWorkingHours)}
                    </strong>
                  </span>
                  {mGroup.sumBreakdownHours > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-[var(--color-mute)]">
                        <span className="font-sans text-[10px] uppercase font-bold text-[var(--color-mute)]">B/D: </span>
                        <strong className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                          {formatHoursWithUnit(mGroup.sumBreakdownHours)}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Shift Logs Table for this Machine */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase text-[9.5px] font-extrabold border-b border-[var(--color-hairline)] select-none">
                    <tr>
                      <th className="px-3 py-2 font-mono whitespace-nowrap text-left">
                        {onSortChange ? (
                          <button
                            type="button"
                            onClick={() => onSortChange(currentSort === "date-desc" ? "date-asc" : "date-desc")}
                            className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-ink)] transition-colors cursor-pointer select-none"
                            title="Click to toggle date sort order"
                          >
                            <span>Date</span>
                            {currentSort === "date-asc" ? (
                              <ChevronUp size={12} className="text-sky-500 shrink-0" />
                            ) : (
                              <ChevronDown size={12} className="text-sky-500 shrink-0" />
                            )}
                          </button>
                        ) : (
                          <span>Date</span>
                        )}
                      </th>
                      <th className="px-3 py-2 whitespace-nowrap text-left">
                        <TooltipWrapper content="Logged Shifts for this Day (e.g. S1/S2/S3)">
                          <span>Shift</span>
                        </TooltipWrapper>
                      </th>
                      <th className="px-3 py-2 whitespace-nowrap text-left">
                        <TooltipWrapper content="Assigned Operators for each Shift">
                          <span>OPERATOR NAME</span>
                        </TooltipWrapper>
                      </th>
                      <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                        <TooltipWrapper content="Machine Running Time (Meter / Operating Hours)">
                          <span>M/C RT</span>
                        </TooltipWrapper>
                      </th>
                      <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                        <TooltipWrapper content="Work Hours">
                          <span>WH</span>
                        </TooltipWrapper>
                      </th>
                      <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                        <TooltipWrapper content="Breakdown Hours">
                          <span>B/D</span>
                        </TooltipWrapper>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                    {mGroup.dailyGroups.map((group, dayIdx) => (
                      <OperationsDailyLogRow
                        key={group.date}
                        group={group}
                        dayIndex={dayIdx}
                        logsViewMode={logsViewMode}
                        showMachineColumn={false}
                        onOpenConflictModal={onOpenConflictModal}
                      />
                    ))}
                  </tbody>
                  {/* Separate summary footer for this machine */}
                  <tfoot className="border-t-2 border-[var(--color-hairline)] bg-[var(--color-canvas)] select-none">
                    <tr>
                      <td colSpan={clientMachineTotalColumns} className="px-3 pt-2 pb-0.5 text-xs font-extrabold text-[var(--color-ink)]">
                        Total
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--color-hairline)] font-mono text-xs font-bold text-[var(--color-ink)]">
                      <td className="px-3 pb-2 pt-0.5 text-left font-bold text-[var(--color-ink)] whitespace-nowrap">
                        {mGroup.dailyGroups.length} {mGroup.dailyGroups.length === 1 ? "day" : "days"}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="px-3 pb-2 pt-0.5 text-center text-sky-600 dark:text-sky-400 whitespace-nowrap font-bold">
                        {formatHoursWithUnit(mGroup.sumDayRT)}
                      </td>
                      <td className="px-3 pb-2 pt-0.5 text-center whitespace-nowrap font-bold">
                        {formatHoursWithUnit(mGroup.sumWorkingHours)}
                      </td>
                      <td className="px-3 pb-2 pt-0.5 text-center whitespace-nowrap font-bold">
                        {formatHoursWithUnit(mGroup.sumBreakdownHours)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))
        )
      ) : (
        /* ─────────────────────────────────────────────────────────────────
            MACHINE & OPERATOR TAB VIEW: UNTOUCHED STANDARD SINGLE TABLE
           ───────────────────────────────────────────────────────────────── */
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase text-[9.5px] font-extrabold border-b border-[var(--color-hairline)] select-none">
                <tr>
                  <th className="px-3 py-2 font-mono whitespace-nowrap text-left">
                    {onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(currentSort === "date-desc" ? "date-asc" : "date-desc")}
                        className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-ink)] transition-colors cursor-pointer select-none"
                        title="Click to toggle date sort order"
                      >
                        <span>Date</span>
                        {currentSort === "date-asc" ? (
                          <ChevronUp size={12} className="text-sky-500 shrink-0" />
                        ) : (
                          <ChevronDown size={12} className="text-sky-500 shrink-0" />
                        )}
                      </button>
                    ) : (
                      <span>Date</span>
                    )}
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap text-left">
                    <TooltipWrapper content="Client / Customer Company Name">
                      <span>Client</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap text-left">
                    <TooltipWrapper content="Logged Shifts for this Day (e.g. S1/S2/S3)">
                      <span>Shift</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap text-left">
                    <TooltipWrapper content="Assigned Operators for each Shift">
                      <span>OPERATOR NAME</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Machine Running Time (Meter / Operating Hours)">
                      <span>M/C RT</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Work Hours">
                      <span>WH</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-3 py-2 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Breakdown Hours">
                      <span>B/D</span>
                    </TooltipWrapper>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {isPending && groupedLogs.length === 0 ? (
                  <OperationsLogTableSkeletonRows colSpan={standardTotalColumns} count={4} />
                ) : groupedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={standardTotalColumns} className="p-10 text-center text-xs text-[var(--color-mute)]">
                      No daily running hour shifts found matching the active filter selection.
                    </td>
                  </tr>
                ) : (
                  groupedLogs.map((group, dayIdx) => (
                    <OperationsDailyLogRow
                      key={group.date}
                      group={group}
                      dayIndex={dayIdx}
                      logsViewMode={logsViewMode}
                      showMachineColumn={true}
                      onOpenConflictModal={onOpenConflictModal}
                    />
                  ))
                )}
              </tbody>
              {groupedLogs.length > 0 && (
                <tfoot className="border-t-2 border-[var(--color-hairline)] bg-[var(--color-canvas)] select-none">
                  <tr>
                    <td colSpan={standardTotalColumns} className="px-3 pt-2 pb-0.5 text-xs font-extrabold text-[var(--color-ink)]">
                      Total
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--color-hairline)] font-mono text-xs font-bold text-[var(--color-ink)]">
                    <td className="px-3 pb-2 pt-0.5 text-left font-bold text-[var(--color-ink)] whitespace-nowrap">
                      {groupedLogs.length} {groupedLogs.length === 1 ? "day" : "days"}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="px-3 pb-2 pt-0.5 text-center text-sky-600 dark:text-sky-400 whitespace-nowrap font-bold">
                      {formatHoursWithUnit(sumDayRT)}
                    </td>
                    <td className="px-3 pb-2 pt-0.5 text-center whitespace-nowrap font-bold">
                      {formatHoursWithUnit(sumWorkingHours)}
                    </td>
                    <td className="px-3 pb-2 pt-0.5 text-center whitespace-nowrap font-bold">
                      {formatHoursWithUnit(sumBreakdownHours)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
});
