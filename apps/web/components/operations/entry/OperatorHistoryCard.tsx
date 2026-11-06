"use client";

import React, { useMemo } from "react";
import { Pencil, Lock } from "lucide-react";
import {
  formatDate,
  formatExactTimestamp,
  parseBreakdownDetails,
  addDaysToDateStr,
  getISTDateString,
} from "@reachinternational/utils";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";

export interface OperatorHistoryCardProps {
  log: OperatorHourLog;
  onEditLog?: (log: OperatorHourLog) => void;
  className?: string;
}

export function isLogWithin7Days(logDate?: string | null): boolean {
  if (!logDate) return false;
  try {
    const rawDateStr = logDate.split("T")[0].trim();
    const todayStr = getISTDateString();
    const sevenDaysAgoStr = addDaysToDateStr(todayStr, -7);
    return rawDateStr >= sevenDaysAgoStr && rawDateStr <= todayStr;
  } catch {
    return false;
  }
}

export const OperatorHistoryCard = React.memo<OperatorHistoryCardProps>(
  function OperatorHistoryCard({ log, onEditLog, className = "" }) {
    const startM = Number(log.start_meter) || 0;
    const endM = Number(log.end_meter) || startM;
    const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

    const rawShift = (log.shift_code || log.shift || "").trim();
    const shiftName = !rawShift
      ? "Shift A"
      : /^shift/i.test(rawShift)
      ? rawShift.replace(/^shift\s*/i, "Shift ")
      : `Shift ${rawShift}`;

    // Machine Model + Serial Number
    const machineIdCode = log.machine?.machine_id || "";
    const model = log.machine?.model || "";
    const serial = log.machine?.serial_number || "";
    const primaryTitle = machineIdCode || model || "Equipment";
    const secondaryIdentifier = serial || (model && model !== primaryTitle ? model : "");

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
    const breakdownText =
      breakdownInfo?.displayText || log.breakdown_duration || "Breakdown";
    const breakdownNote = (log.remarks || "").trim();

    // Exact log timestamp date and time
    const timestampStr = log.created_at
      ? formatExactTimestamp(log.created_at, false)
      : formatDate(log.log_date);

    const canEdit = isLogWithin7Days(log.log_date);

    return (
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1.5 shadow-2xs ${className}`}
      >
        {/* Row 1: Top Header — Exact timestamp date & time (left) + Operating Hours badge & Edit/Lock Action (right) */}
        <div className="flex items-center justify-between pb-1 text-xs font-mono">
          <span className="text-[var(--color-mute)] font-medium">
            {timestampStr}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shrink-0">
              +{rt.toFixed(1)} hrs
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEditLog?.(log)}
                className="p-1 rounded-full text-[var(--color-mute)] hover:text-[var(--color-link)] active:scale-95 transition-colors cursor-pointer"
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

        {/* Row 2: Machine + Serial Number */}
        <div className="text-sm font-bold text-[var(--color-ink)] truncate" title={primaryTitle}>
          {primaryTitle}
          {secondaryIdentifier && (
            <span className="font-mono text-xs font-normal text-[var(--color-mute)] ml-1">
              ({secondaryIdentifier})
            </span>
          )}
        </div>

        {/* Row 3: Client : Client name (bold) + city name in parentheses (muted) */}
        <div className="text-xs flex items-baseline gap-1 min-w-0">
          <span className="text-xs text-[var(--color-mute)] shrink-0">Client :</span>
          <span className="font-bold text-[var(--color-ink)] truncate">{clientName}</span>
          {clientCity && (
            <span className="text-xs text-[var(--color-mute)] shrink-0 font-normal">
              ({clientCity})
            </span>
          )}
        </div>

        {/* Row 4: HMR: Start -> End */}
        <div className="text-xs font-mono text-[var(--color-mute)] flex items-center">
          <span>HMR: </span>
          <span className="text-[var(--color-ink)] font-medium ml-1">{startM.toFixed(1)}</span>
          <span className="mx-1.5 text-[var(--color-mute)]">&rarr;</span>
          <strong className="text-[var(--color-ink)] font-bold">{endM.toFixed(1)}</strong>
        </div>

        {/* Row 5: Shift Date & Shift Badge */}
        <div className="text-xs font-mono text-[var(--color-mute)] flex items-center gap-2 flex-wrap">
          <span>Shift Date : </span>
          <strong className="text-[var(--color-ink)] font-bold">{formatDate(log.log_date)}</strong>
          <span className="text-[11px] font-bold text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full">
            {shiftName}
          </span>
          {log.overtime_hours ? (
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
              +{log.overtime_hours}h OT
            </span>
          ) : null}
        </div>

        {/* Row 6: Divider Line */}
        <div className="pt-1.5 border-t border-[var(--color-hairline)]" />

        {/* Row 7: Breakdown: 0 (Normal) or Breakdown: [Reason] */}
        <div>
          {log.is_breakdown ? (
            <div className="text-xs font-mono text-rose-600 dark:text-rose-400 flex items-center gap-1 truncate">
              <span className="font-bold shrink-0">Breakdown: </span>
              <span
                className="truncate font-medium"
                title={breakdownText}
              >
                {breakdownText}
              </span>
            </div>
          ) : (
            <div className="text-xs font-mono text-[var(--color-mute)] flex items-center gap-1">
              <span className="font-normal shrink-0">Breakdown: </span>
              <span>0 (Normal)</span>
            </div>
          )}
          {breakdownNote && log.is_breakdown && (
            <div className="text-[11px] font-mono text-[var(--color-mute)] mt-0.5 truncate">
              Note: {breakdownNote}
            </div>
          )}
        </div>
      </div>
    );
  }
);
