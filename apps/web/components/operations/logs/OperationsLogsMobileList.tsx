"use client";

import React from "react";
import { Button } from "@/components/ui";
import { ShieldAlert, Check, Trash2, Pencil, RotateCcw } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import {
  formatDate,
  formatExactTimestamp,
  formatCompactExactTimestamp,
  formatCompactTiming,
  parseConflictReason,
  parseBreakdownDetails,
} from "@reachinternational/utils";
import { MobileOperationsLogCardSkeletonList } from "../skeletons/OperationsSkeletons";

export interface OperationsLogsMobileListProps {
  logs: MachineHourLog[];
  logsViewMode: "machine" | "client" | "operator";
  isPending: boolean;
  currentPage: number;
  logsPageSize: number;
  totalMatchingLogs: number;
  onPageChange: (newPage: number) => void;
  onOpenConflictModal: (log: MachineHourLog) => void;
  onEditLog?: (log: MachineHourLog) => void;
  canEditLog?: (log: MachineHourLog) => boolean;
  onDeleteLog?: (log: MachineHourLog) => void;
  canDeleteLog?: (log: MachineHourLog) => boolean;
  onPageSizeChange?: (newSize: number) => void;
  // Mobile Lazy Loading Scroll Props
  mobileLogsList?: MachineHourLog[];
  isLoadingMoreMobile?: boolean;
  mobileHasMore?: boolean;
  loadMoreMobileError?: string | null;
  onMobileRetry?: () => void;
  mobileSentinelRef?: React.RefObject<HTMLDivElement | null>;
}

export interface OperationsLogMobileCardProps {
  log: MachineHourLog;
  logsViewMode: "machine" | "client" | "operator";
  onOpenConflictModal: (log: MachineHourLog) => void;
  onEditLog?: (log: MachineHourLog) => void;
  canEditLog?: (log: MachineHourLog) => boolean;
  onDeleteLog?: (log: MachineHourLog) => void;
  canDeleteLog?: (log: MachineHourLog) => boolean;
}

export const OperationsLogMobileCard = React.memo(function OperationsLogMobileCard({
  log,
  logsViewMode,
  onOpenConflictModal,
  onEditLog,
  canEditLog,
  onDeleteLog,
  canDeleteLog,
}: OperationsLogMobileCardProps) {
  const startMtr = log.start_meter ?? 0;
  const endMtr = log.end_meter ?? startMtr;
  const runningHours =
    log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
  const otHours = log.overtime_hours || 0;
  const mObj = log.machine as any;
  const opObj = log.operator as any;
  const clientName =
    (log as any)?.client?.client_name ||
    (log as any)?.client?.company_name ||
    mObj?.customer_name ||
    "Unassigned Client";
  const rawClientCity =
    (log as any)?.client?.city?.trim() ||
    mObj?.city?.trim() ||
    (log.location ? log.location.split(",")[0]?.trim() : "");
  const clientCity = rawClientCity || "—";
  const locationStr =
    log.location ||
    ((log as any)?.client?.city
      ? [
          (log as any).client.city,
          (log as any).client.district,
          (log as any).client.state,
        ]
          .filter(Boolean)
          .join(", ")
      : clientCity !== "—"
      ? clientCity
      : "—");

  const breakdownInfo = parseBreakdownDetails(log);
  const cleanRemarks =
    (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";

  const hasConflict = Boolean(log.conflict_flag);
  const isPendingConflict =
    hasConflict && (!log.conflict_status || log.conflict_status === "pending");
  const isResolvedConflict =
    hasConflict &&
    (log.conflict_status === "acknowledged" || log.conflict_status === "adjusted");
  const cardConflict = hasConflict
    ? parseConflictReason(log.conflict_reason, {
        machineCode:
          mObj?.machine_code || mObj?.machine_id || mObj?.model || "Equipment",
        machineModel: mObj?.model,
        operatorName: opObj?.full_name || "Operator",
        startTime: log.start_time,
        endTime: log.end_time,
        runningHours: runningHours,
        overtimeHours: otHours,
        logDate: log.log_date,
      })
    : null;

  const canEdit = Boolean(onEditLog) && (!canEditLog || canEditLog(log));
  const canDelete = Boolean(onDeleteLog) && (!canDeleteLog || canDeleteLog(log));

  return (
    <div
      key={log.id}
      className={`p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-2xs ${
        isPendingConflict
          ? "border-l-4 border-l-amber-500"
          : isResolvedConflict
          ? "border-l-4 border-l-emerald-500"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold">
              {formatDate(log.log_date)}
            </span>
          </div>
          <h4 className="font-extrabold text-sm text-[var(--color-ink)] mt-0.5 truncate">
            {mObj?.model
              ? `${mObj.model}${mObj?.serial_number ? ` (${mObj.serial_number})` : mObj?.machine_code ? ` (${mObj.machine_code})` : ""}`
              : mObj?.machine_code || "—"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isPendingConflict && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <ShieldAlert size={11} className="text-amber-600 dark:text-amber-400" />
              Shift Conflict
            </span>
          )}
          {isResolvedConflict && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
              {log.conflict_status === "adjusted" ? "Adjusted" : "Acknowledged"}
            </span>
          )}
        </div>
      </div>

      {logsViewMode === "operator" ? (
        <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                Client / Site:
              </span>
              <span className="font-bold text-[var(--color-ink)] block truncate" title={locationStr}>
                {clientName}
              </span>
              <span className="text-[10px] text-[var(--color-mute)] block truncate" title={locationStr}>
                {clientCity}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                Shift Timings:
              </span>
              <span className="font-bold font-mono text-[var(--color-ink)]">
                {formatCompactTiming(log.start_time, log.end_time)}
              </span>
              <span className="text-[10px] text-[var(--color-mute)] block font-mono">
                {startMtr} → {endMtr}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
            <div>
              <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                Operating Hrs (OP):
              </span>
              <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                {runningHours} hrs
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                Overtime (OT):
              </span>
              <span className="font-extrabold font-mono text-amber-600 dark:text-amber-400">
                {otHours} hrs
              </span>
            </div>
          </div>
          {(log.is_breakdown || cleanRemarks !== "—") && (
            <div className="pt-1 border-t border-[var(--color-hairline)] space-y-1">
              {log.is_breakdown ? (
                <div className="font-extrabold text-rose-600 dark:text-rose-400 text-[11px] font-mono">
                  Breakdown: {breakdownInfo.duration || breakdownInfo.timingRange || breakdownInfo.displayText}
                </div>
              ) : null}
              {cleanRemarks !== "—" && (
              <div className="text-[11px] text-[var(--color-mute)] italic">
                Remarks: {cleanRemarks}
              </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {logsViewMode === "client" ? null : (
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--color-hairline)]">
            <div>
              <span className="text-[10px] text-[var(--color-mute)] block">
                Client / Site:
              </span>
              <span className="font-bold text-[var(--color-ink)]">
                {clientName}
              </span>
              <span className="text-[10px] text-[var(--color-mute)] block truncate" title={locationStr}>
                {clientCity}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--color-mute)] block">
                Operator:
              </span>
              <span className="font-bold text-[var(--color-ink)]">
                {opObj?.full_name || "Unassigned"}
              </span>
            </div>
          </div>
          )}

          {logsViewMode === "client" ? (
            <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                    Operator:
                  </span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {opObj?.full_name || "Unassigned"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                    Shift Timings:
                  </span>
                  <span className="font-bold font-mono text-[var(--color-ink)]">
                    {formatCompactTiming(log.start_time, log.end_time)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                    Work Time (WT):
                  </span>
                  <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                    {runningHours} hrs
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                    Breakdown:
                  </span>
                  {log.is_breakdown ? (
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 inline-flex items-center text-[11px] font-mono">
                      {breakdownInfo.timingRange ? (
                        <span className="flex flex-col text-right leading-tight">
                          <span>{breakdownInfo.timingRange}</span>
                          {breakdownInfo.duration && (
                            <span className="text-[9.5px] opacity-90">{breakdownInfo.duration}</span>
                          )}
                        </span>
                      ) : (
                        <span>{breakdownInfo.displayText}</span>
                      )}
                    </span>
                  ) : (
                    <span className="font-bold text-[var(--color-ink)] font-mono text-[11px]">
                      0
                    </span>
                  )}
                </div>
              </div>
              {cleanRemarks !== "—" && (
                <div className="pt-1 border-t border-[var(--color-hairline)] text-[11px] text-[var(--color-mute)] italic">
                  Remarks: {cleanRemarks}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                  Meter Reading:
                </span>
                <span className="font-bold font-mono text-[var(--color-ink)]">
                  {startMtr} → {endMtr} hrs
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">
                  Run Hours:
                </span>
                <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                  {runningHours} hrs
                </span>
              </div>
            </div>
            {(log.is_breakdown || otHours > 0 || cleanRemarks !== "—") && (
              <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  {log.is_breakdown ? (
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 text-[11px] font-mono">
                      Breakdown: {breakdownInfo.duration || breakdownInfo.timingRange || breakdownInfo.displayText}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--color-mute)] font-semibold">Breakdown: 0</span>
                  )}
                  {otHours > 0 && (
                    <span className="font-extrabold font-mono text-amber-600 dark:text-amber-400 text-[11px]">
                      OT: {otHours}h
                    </span>
                  )}
                </div>
                {cleanRemarks !== "—" && (
                  <div className="pt-1 border-t border-[var(--color-hairline)] text-[11px] text-[var(--color-mute)] italic">
                    Remarks: {cleanRemarks}
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </>
      )}

      {/* Inline Overtime Shift Conflict Detailed Warning Box */}
      {hasConflict && cardConflict && (
        <div
          className={`p-3 rounded-xl border space-y-2 text-xs ${
            isPendingConflict
              ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30"
              : "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert
                size={14}
                className={
                  isPendingConflict
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }
              />
              <span
                className={`font-bold ${
                  isPendingConflict
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {isPendingConflict
                  ? cardConflict.title
                  : `Overtime Conflict Resolved (${log.conflict_status || "approved"})`}
              </span>
            </div>
            {isPendingConflict && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenConflictModal(log)}
                className="text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 py-1 h-7"
              >
                Resolve Conflict
              </Button>
            )}
          </div>

          {/* Clean summary row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {Number(log.overtime_hours || 0) > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                +{log.overtime_hours}h Overtime
              </span>
            ) : null}
            <span
              className={`text-[11px] font-medium ${
                isPendingConflict
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {isPendingConflict
                ? cardConflict.conflictingEntity
                  ? `Collides with active shift on ${cardConflict.conflictingEntity}`
                  : "Overtime overlaps with subsequent shift"
                : "Approved by supervisor"}
            </span>
          </div>

          {log.conflict_resolution_notes && (
            <div className="text-[10px] text-[var(--color-mute)] italic pt-1 border-t border-[var(--color-hairline)]">
              Resolution Note: {log.conflict_resolution_notes}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between">
        {log.created_at ? (
          <span
            className="text-[9.5px] font-mono text-[var(--color-mute)] font-medium"
            title={`Exact log entry timestamp: ${formatExactTimestamp(log.created_at, true)}`}
          >
            {formatCompactExactTimestamp(log.created_at)}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={() => onEditLog?.(log)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-xs font-bold text-[var(--color-mute)] hover:text-sky-600 active:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors cursor-pointer"
              aria-label="Edit log entry"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteLog?.(log)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-xs font-bold text-[var(--color-mute)] hover:text-red-600 active:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
              aria-label="Delete log entry"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export const OperationsLogsMobileList = React.memo(function OperationsLogsMobileList({
  logs,
  logsViewMode,
  isPending,
  currentPage = 1,
  logsPageSize = 10,
  totalMatchingLogs,
  onPageChange,
  onOpenConflictModal,
  onEditLog,
  canEditLog,
  onDeleteLog,
  canDeleteLog,
  onPageSizeChange,
  mobileLogsList,
  isLoadingMoreMobile = false,
  mobileHasMore = false,
  loadMoreMobileError,
  onMobileRetry,
  mobileSentinelRef,
}: OperationsLogsMobileListProps) {
  const displayLogs = mobileLogsList && mobileLogsList.length > 0 ? mobileLogsList : logs;

  return (
    <div className="block sm:hidden space-y-3">
      {isPending && displayLogs.length === 0 ? (
        <MobileOperationsLogCardSkeletonList count={4} />
      ) : displayLogs.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--color-mute)] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
          No daily running hour logs found matching active filters.
        </div>
      ) : (
        displayLogs.map((log) => (
          <OperationsLogMobileCard
            key={log.id}
            log={log}
            logsViewMode={logsViewMode}
            onOpenConflictModal={onOpenConflictModal}
            onEditLog={onEditLog}
            canEditLog={canEditLog}
            onDeleteLog={onDeleteLog}
            canDeleteLog={canDeleteLog}
          />
        ))
      )}

      {/* Sentinel element for infinite scroll chunk loading */}
      <div ref={mobileSentinelRef} className="h-1 w-full pointer-events-none" aria-hidden="true" />

      {/* Skeleton cards while loading next chunk */}
      {isLoadingMoreMobile && (
        <MobileOperationsLogCardSkeletonList count={2} />
      )}

      {/* Retry prompt if next chunk fails */}
      {loadMoreMobileError && (
        <div className="p-3 my-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="text-[var(--color-error)] font-medium">{loadMoreMobileError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onMobileRetry}
            className="h-7 px-3 text-xs font-semibold rounded-md border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* End-of-List Indicator on Mobile */}
      {!mobileHasMore && displayLogs.length > 0 && !isPending && (
        <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
          <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
          <span className="font-medium text-[var(--color-mute)]">All daily running hour logs have been displayed</span>
          <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
        </div>
      )}
    </div>
  );
});
