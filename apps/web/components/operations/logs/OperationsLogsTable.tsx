"use client";

import React from "react";
import { TooltipWrapper, Pagination } from "@/components/ui";
import { ShieldAlert, Check, ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import {
  formatDate,
  formatExactTimestamp,
  formatCompactExactTimestamp,
  formatCompactTiming,
  parseBreakdownDetails,
} from "@reachinternational/utils";
import { OperationsLogTableSkeletonRows } from "../skeletons/OperationsSkeletons";

export interface OperationsLogsTableProps {
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
  currentSort?: string;
  onSortChange?: (newSort: string) => void;
  onPageSizeChange?: (newSize: number) => void;
}

export interface OperationsLogRowProps {
  log: MachineHourLog;
  idx: number;
  currentPage: number;
  logsPageSize: number;
  logsViewMode: "machine" | "client" | "operator";
  onOpenConflictModal: (log: MachineHourLog) => void;
  onEditLog?: (log: MachineHourLog) => void;
  canEditLog?: (log: MachineHourLog) => boolean;
  onDeleteLog?: (log: MachineHourLog) => void;
  canDeleteLog?: (log: MachineHourLog) => boolean;
}

export const OperationsLogRow = React.memo(function OperationsLogRow({
  log,
  idx,
  currentPage,
  logsPageSize,
  logsViewMode,
  onOpenConflictModal,
  onEditLog,
  canEditLog,
  onDeleteLog,
  canDeleteLog,
}: OperationsLogRowProps) {
  const startMtr = log.start_meter ?? 0;
  const endMtr = log.end_meter ?? startMtr;
  const runningHours =
    log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
  const otHours = log.overtime_hours || 0;
  const isDecreased = endMtr < startMtr;
  const isUnusualHigh = runningHours > 18;

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
    (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() ||
    "—";

  const hasConflict = Boolean(log.conflict_flag);
  const isPendingConflict =
    hasConflict && (!log.conflict_status || log.conflict_status === "pending");
  const isResolvedConflict =
    hasConflict &&
    (log.conflict_status === "acknowledged" || log.conflict_status === "adjusted");

  const canEdit = Boolean(onEditLog) && (!canEditLog || canEditLog(log));
  const canDelete = Boolean(onDeleteLog) && (!canDeleteLog || canDeleteLog(log));

  return (
    <tr
      className={`${isPendingConflict ? "bg-amber-500/5 dark:bg-amber-500/10" : ""}`}
    >
      <td className="px-3 py-3 text-center font-bold text-xs text-[var(--color-mute)] font-mono">
        {(currentPage - 1) * logsPageSize + idx + 1}
      </td>
      <td className="px-4 py-3 font-mono whitespace-nowrap">
        <div className="font-semibold text-[var(--color-ink)] text-xs">
          {formatDate(log.log_date)}
        </div>
        {log.created_at ? (
          <div
            className="text-[10px] text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1 mt-0.5"
            title={`Exact log entry timestamp: ${formatExactTimestamp(
              log.created_at,
              true
            )}`}
          >
            <span>{formatCompactExactTimestamp(log.created_at)}</span>
          </div>
        ) : null}
        {isPendingConflict && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenConflictModal(log);
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer mt-1"
            title={
              log.conflict_reason ||
              "Overtime shift conflict detected. Click to review."
            }
          >
            <ShieldAlert
              size={10}
              className="shrink-0 text-amber-600 dark:text-amber-400"
            />
            <span>Shift Conflict</span>
          </button>
        )}
        {isResolvedConflict && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mt-1"
            title={`Conflict resolved: ${
              log.conflict_resolution_notes || log.conflict_status
            }`}
          >
            <Check
              size={10}
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <span>
              {log.conflict_status === "adjusted" ? "Adjusted" : "Acknowledged"}
            </span>
          </span>
        )}
      </td>
      {logsViewMode === "operator" ? (
        <>
          <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
            <span className="font-bold text-[var(--color-ink)]">
              {mObj?.model || "—"}
            </span>
          </td>
          <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
            <span className="font-bold text-[var(--color-ink)]">
              {mObj?.serial_number || mObj?.machine_code || "—"}
            </span>
          </td>
          <td className="px-4 py-3 font-semibold">
            <div className="font-bold text-[var(--color-ink)]">{clientName}</div>
            <div
              className="text-[10px] text-[var(--color-mute)] truncate max-w-[180px]"
              title={locationStr}
            >
              {clientCity}
            </div>
          </td>
          <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
            <div>{formatCompactTiming(log.start_time, log.end_time)}</div>
            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
              {(log as any).normal_working_hours ?? 8}h normal
            </div>
          </td>
          <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
            <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
          </td>
          <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
            <span className="text-amber-600 dark:text-amber-400">
              {otHours > 0 ? `${otHours}h` : "0h"}
            </span>
          </td>
          <td className="px-4 py-3 text-center whitespace-nowrap">
            {log.is_breakdown ? (
              <span className="inline-flex items-center justify-center font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                {breakdownInfo.timingRange ? (
                  <span className="flex flex-col text-center leading-tight">
                    <span className="font-bold">{breakdownInfo.timingRange}</span>
                    {breakdownInfo.duration && (
                      <span className="text-[10px] font-bold opacity-90">{breakdownInfo.duration}</span>
                    )}
                  </span>
                ) : (
                  <span>{breakdownInfo.displayText}</span>
                )}
              </span>
            ) : (
              <span className="font-bold text-[var(--color-ink)] font-mono text-xs">
                0
              </span>
            )}
          </td>
          <td className="px-4 py-3">
            <span
              className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block"
              title={cleanRemarks}
            >
              {cleanRemarks}
            </span>
          </td>
        </>
      ) : logsViewMode === "client" ? (
        <>
          <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
            <span className="font-bold text-[var(--color-ink)]">
              {mObj?.model || "—"}
            </span>
          </td>
          <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
            <span className="font-bold text-[var(--color-ink)]">
              {mObj?.serial_number || mObj?.machine_code || "—"}
            </span>
          </td>
          <td className="px-4 py-3 font-semibold whitespace-nowrap">
            <div className="font-bold text-[var(--color-ink)]">
              {opObj?.full_name || "Unassigned"}
            </div>
            {opObj?.phone && (
              <div className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">
                {opObj.phone}
              </div>
            )}
          </td>
          <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
            <div>{formatCompactTiming(log.start_time, log.end_time)}</div>
            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
              {(log as any).normal_working_hours ?? 8}h normal
            </div>
          </td>
          <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
            <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
          </td>
          <td className="px-4 py-3 text-center whitespace-nowrap">
            {log.is_breakdown ? (
              <span className="inline-flex items-center justify-center font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                {breakdownInfo.timingRange ? (
                  <span className="flex flex-col text-center leading-tight">
                    <span className="font-bold">{breakdownInfo.timingRange}</span>
                    {breakdownInfo.duration && (
                      <span className="text-[10px] font-bold opacity-90">{breakdownInfo.duration}</span>
                    )}
                  </span>
                ) : (
                  <span>{breakdownInfo.displayText}</span>
                )}
              </span>
            ) : (
              <span className="font-bold text-[var(--color-ink)] font-mono text-xs">
                0
              </span>
            )}
          </td>
          <td className="px-4 py-3">
            <span
              className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block"
              title={cleanRemarks}
            >
              {cleanRemarks}
            </span>
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-3">
            <div className="font-bold text-[var(--color-ink)]">
              {(log as any)?.client?.client_name ||
                (log as any)?.client?.company_name ||
                mObj?.customer_name ||
                "Unassigned Client"}
            </div>
            <div
              className="text-[10px] text-[var(--color-mute)] truncate max-w-[180px]"
              title={locationStr}
            >
              {clientCity}
            </div>
          </td>
          <td className="px-4 py-3 font-semibold whitespace-nowrap">
            <div className="font-bold text-[var(--color-ink)]">
              {opObj?.full_name || "Unassigned"}
            </div>
            {opObj?.phone && (
              <div className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">
                {opObj.phone}
              </div>
            )}
          </td>
          <td className="px-4 py-3 font-mono font-bold text-center text-[var(--color-ink)] whitespace-nowrap">
            {startMtr} → {endMtr}
            {isDecreased && (
              <span className="block text-[10px] text-rose-500 font-bold">
                Meter Decreased
              </span>
            )}
            {isUnusualHigh && (
              <span className="block text-[10px] text-amber-500 font-bold">
                High Operating Hours
              </span>
            )}
          </td>
          <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
            <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
          </td>
          <td className="px-4 py-3 text-center whitespace-nowrap">
            {log.is_breakdown ? (
              <span className="inline-flex items-center justify-center font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                {breakdownInfo.timingRange ? (
                  <span className="flex flex-col text-center leading-tight">
                    <span className="font-bold">{breakdownInfo.timingRange}</span>
                    {breakdownInfo.duration && (
                      <span className="text-[10px] font-bold opacity-90">{breakdownInfo.duration}</span>
                    )}
                  </span>
                ) : (
                  <span>{breakdownInfo.displayText}</span>
                )}
              </span>
            ) : (
              <span className="font-bold text-[var(--color-ink)] font-mono text-xs">
                0
              </span>
            )}
          </td>
          <td className="px-4 py-3">
            <span
              className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block"
              title={cleanRemarks}
            >
              {cleanRemarks}
            </span>
          </td>
        </>
      )}
      <td className="px-3 py-3 text-center">
        <div className="inline-flex items-center justify-center gap-1">
          {canEdit && (
            <TooltipWrapper content="Edit log entry">
              <button
                type="button"
                onClick={() => onEditLog?.(log)}
                className="p-1 rounded-md text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Edit log entry"
                aria-label="Edit log entry"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </TooltipWrapper>
          )}
          {canDelete && (
            <TooltipWrapper content="Delete log entry">
              <button
                type="button"
                onClick={() => onDeleteLog?.(log)}
                className="p-1 rounded-md text-[var(--color-mute)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors inline-flex items-center justify-center cursor-pointer"
                title="Delete log entry"
                aria-label="Delete log entry"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </TooltipWrapper>
          )}
        </div>
      </td>
    </tr>
  );
});

export const OperationsLogsTable = React.memo(function OperationsLogsTable({
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
  currentSort = "date-desc",
  onSortChange,
  onPageSizeChange,
}: OperationsLogsTableProps) {
  const colSpan = (logsViewMode === "operator" ? 10 : logsViewMode === "client" ? 9 : 8) + 1;

  return (
    <div
      className={`hidden sm:block rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm transition-opacity duration-200 ${
        isPending ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs min-w-[850px]">
          <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
            <tr>
              <th className="px-3 py-3 w-[45px] text-center font-mono">
                <TooltipWrapper content="Serial Number">
                  <span>S.N</span>
                </TooltipWrapper>
              </th>
              <th
                className={`px-4 py-3 whitespace-nowrap font-mono select-none ${
                  onSortChange ? "cursor-pointer hover:text-[var(--color-ink)]" : ""
                }`}
                onClick={() => {
                  if (onSortChange) {
                    onSortChange(currentSort === "date-desc" ? "date-asc" : "date-desc");
                  }
                }}
              >
                <TooltipWrapper content="Click to sort by log date">
                  <span className="inline-flex items-center gap-1">
                    <span>Date</span>
                    {currentSort === "date-asc" ? (
                      <ChevronUp className="w-3 h-3 text-sky-500" />
                    ) : currentSort === "date-desc" ? (
                      <ChevronDown className="w-3 h-3 text-sky-500" />
                    ) : null}
                  </span>
                </TooltipWrapper>
              </th>
              {logsViewMode === "operator" ? (
                <>
                  <th className="px-4 py-3 whitespace-nowrap font-mono">
                    <TooltipWrapper content="Machine Model">
                      <span>Model</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap font-mono">
                    <TooltipWrapper content="Machine Serial Number / Code">
                      <span>Serial Number</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Client Name & Site Location">
                      <span>Client & Location</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Shift Start Time & End Time">
                      <span>Timings</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Total Machine Running Time (Calculated by HMR: End Meter - Start Meter)">
                      <span>RT(h)</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Overtime Hours">
                      <span>OT(h)</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">
                    <TooltipWrapper content="Breakdown Duration & Status">
                      <span>Breakdown</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Log Remarks & Breakdown Notes">
                      <span>Remarks</span>
                    </TooltipWrapper>
                  </th>
                </>
              ) : logsViewMode === "client" ? (
                <>
                  <th className="px-4 py-3 whitespace-nowrap font-mono">
                    <TooltipWrapper content="Machine Model">
                      <span>Model</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap font-mono">
                    <TooltipWrapper content="Machine Serial Number">
                      <span>Serial Number</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Assigned Operator Name & Mobile">
                      <span>Operator</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Shift Start Time & End Time">
                      <span>Timings</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                    <TooltipWrapper content="Total Machine Running Time (Calculated by HMR: End Meter - Start Meter)">
                      <span>RT(h)</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">
                    <TooltipWrapper content="Breakdown Duration & Status">
                      <span>Breakdown</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Log Remarks & Notes">
                      <span>Remarks</span>
                    </TooltipWrapper>
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Client Name & Site Location">
                      <span>Client & Location</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Assigned Operator Name & Mobile">
                      <span>Operator</span>
                    </TooltipWrapper>
                  </th>
                  <th
                    className={`px-4 py-3 font-mono text-center whitespace-nowrap select-none ${
                      onSortChange ? "cursor-pointer hover:text-[var(--color-ink)]" : ""
                    }`}
                    onClick={() => {
                      if (onSortChange) {
                        onSortChange(currentSort === "meter-desc" ? "meter-asc" : "meter-desc");
                      }
                    }}
                  >
                    <TooltipWrapper content="Click to sort by hour meter reading">
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>HMR</span>
                        {currentSort === "meter-asc" ? (
                          <ChevronUp className="w-3 h-3 text-sky-500" />
                        ) : currentSort === "meter-desc" ? (
                          <ChevronDown className="w-3 h-3 text-sky-500" />
                        ) : null}
                      </span>
                    </TooltipWrapper>
                  </th>
                  <th
                    className={`px-4 py-3 font-mono text-center whitespace-nowrap select-none ${
                      onSortChange ? "cursor-pointer hover:text-[var(--color-ink)]" : ""
                    }`}
                    onClick={() => {
                      if (onSortChange) {
                        onSortChange(currentSort === "hours-desc" ? "hours-asc" : "hours-desc");
                      }
                    }}
                  >
                    <TooltipWrapper content="Total Machine Running Time (Calculated by HMR: End Meter - Start Meter). Click to sort.">
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>RT(h)</span>
                        {currentSort === "hours-asc" ? (
                          <ChevronUp className="w-3 h-3 text-sky-500" />
                        ) : currentSort === "hours-desc" ? (
                          <ChevronDown className="w-3 h-3 text-sky-500" />
                        ) : null}
                      </span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">
                    <TooltipWrapper content="Breakdown Duration & Status">
                      <span>Breakdown</span>
                    </TooltipWrapper>
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    <TooltipWrapper content="Log Remarks & Notes">
                      <span>Remarks</span>
                    </TooltipWrapper>
                  </th>
                </>
              )}
              <th className="px-3 py-3 w-[68px] text-center font-mono">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
            {isPending ? (
              <OperationsLogTableSkeletonRows colSpan={colSpan} count={5} />
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--color-mute)]">
                  No daily running hour logs found matching the active filter selection.
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <OperationsLogRow
                  key={log.id}
                  log={log}
                  idx={idx}
                  currentPage={currentPage}
                  logsPageSize={logsPageSize}
                  logsViewMode={logsViewMode}
                  onOpenConflictModal={onOpenConflictModal}
                  onEditLog={onEditLog}
                  canEditLog={canEditLog}
                  onDeleteLog={onDeleteLog}
                  canDeleteLog={canDeleteLog}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalMatchingLogs > 0 && (
        <div
          className={`px-4 py-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] transition-opacity duration-150 ${
            isPending ? "opacity-50 pointer-events-none" : ""
          }`}
          aria-busy={isPending}
        >
          <Pagination
            page={currentPage}
            pageSize={logsPageSize}
            total={totalMatchingLogs}
            onPageChange={onPageChange}
            pageSizeOptions={[10, 20, 25, 50]}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
});
