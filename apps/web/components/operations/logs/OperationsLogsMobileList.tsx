"use client";

import React, { useMemo, useState } from "react";
import { Button, Badge } from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import { ShieldAlert, RotateCcw, Calendar, MessageSquare, Clock, AlertTriangle } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import { MobileOperationsLogCardSkeletonList } from "../skeletons/OperationsSkeletons";
import {
  groupLogsByDate,
  resolveShiftCode,
  formatHoursWithUnit,
  extractBreakdownTiming,
  type DailyLogGroup,
} from "./OperationsLogsTable";

export interface OperationsLogsMobileListProps {
  logs: MachineHourLog[];
  logsViewMode: "machine" | "client" | "operator";
  isPending: boolean;
  currentPage?: number;
  logsPageSize?: number;
  totalMatchingLogs?: number;
  onPageChange?: (newPage: number) => void;
  onOpenConflictModal?: (log: MachineHourLog) => void;
  onPageSizeChange?: (newSize: number) => void;
  selectedMachineId?: string;
  clientMachines?: any[];
  searchTerm?: string;
  // Mobile Lazy Loading Scroll Props
  mobileLogsList?: MachineHourLog[];
  isLoadingMoreMobile?: boolean;
  mobileHasMore?: boolean;
  loadMoreMobileError?: string | null;
  onMobileRetry?: () => void;
  mobileSentinelRef?: React.RefObject<HTMLDivElement | null>;
  onEditLog?: (log: MachineHourLog) => void;
  canEditLog?: ((log: MachineHourLog) => boolean) | boolean;
  onDeleteLog?: (log: MachineHourLog) => void;
  canDeleteLog?: ((log: MachineHourLog) => boolean) | boolean;
}

export interface OperationsDailyLogMobileCardProps {
  group: DailyLogGroup;
  dayIndex?: number;
  logsViewMode: "machine" | "client" | "operator";
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onOpenConflictModal?: (log: MachineHourLog) => void;
  searchTerm?: string;
}

export const OperationsDailyLogMobileCard = React.memo(function OperationsDailyLogMobileCard({
  group,
  logsViewMode,
  onOpenConflictModal,
  searchTerm,
}: OperationsDailyLogMobileCardProps) {
  const isClientView = logsViewMode === "client";
  const [isRemarksOpen, setIsRemarksOpen] = useState(false);

  // Check if any shift on this date has a pending conflict
  const conflictLog = group.logs.find(
    (l) => Boolean(l.conflict_flag) && (!l.conflict_status || l.conflict_status === "pending")
  );

  return (
    <div
      className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-2xs transition-colors p-3 space-y-2 relative ${
        conflictLog ? "border-amber-500/30 bg-amber-500/5" : ""
      }`}
    >
      {/* Header: Date, Client & Conflict */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-hairline)] pb-2">
        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-[var(--color-ink)]">
          <Calendar size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{group.formattedDate}</span>
          {group.remarksDisplay && (
            <button
              type="button"
              onClick={() => setIsRemarksOpen((prev) => !prev)}
              className="p-0.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 cursor-pointer"
              title="Toggle remarks"
            >
              <MessageSquare size={13} className="shrink-0" />
            </button>
          )}
          {conflictLog && onOpenConflictModal && (
            <button
              type="button"
              onClick={() => onOpenConflictModal(conflictLog)}
              className="p-1 text-amber-600 hover:text-amber-700 active:scale-95 cursor-pointer"
              title="Conflict detected in shift"
            >
              <ShieldAlert size={14} className="shrink-0" />
            </button>
          )}
        </div>

        <div className="text-right truncate max-w-[170px]">
          <span className="font-bold text-sm text-[var(--color-ink)] block truncate">
            <Highlight text={isClientView && group.machineModel ? group.machineModel : group.clientName} query={searchTerm} />
          </span>
        </div>
      </div>

      {/* Row 1: Shift & Operator */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-xs text-[var(--color-mute)] font-sans">Shift:</span>
            <span className="font-bold text-sky-700 dark:text-sky-300 text-xs">
              {group.shiftsDisplay}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap max-w-full">
            <span className="text-xs text-[var(--color-mute)]">Operator:</span>
            <span className="font-semibold text-[var(--color-ink)] text-xs" title={group.operatorsDisplay}>
              <Highlight text={group.operatorsDisplay} query={searchTerm} />
            </span>
          </div>
        </div>

        {/* Row 2: Metrics Strip (M/C RT, WH, B/D / Maintenance) */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-[var(--color-hairline)] font-mono text-center">
          <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <span className="text-[10px] sm:text-xs text-[var(--color-mute)] block font-sans font-bold">M/C RT</span>
            <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">
              {formatHoursWithUnit(group.totalRunningHours)}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            <span className="text-[10px] sm:text-xs text-[var(--color-mute)] block font-sans font-bold">WH</span>
            <span className="font-bold text-[var(--color-ink)] text-sm">
              {formatHoursWithUnit(group.totalWorkingHours)}
            </span>
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
            {(() => {
              const totalBdMin = Math.round(group.totalBreakdownHours * 60);
              const maintMin = group.totalMaintenanceMinutes;
              const netBdMin = Math.max(0, totalBdMin - maintMin);
              const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
              if (totalBdMin === 0) {
                return (
                  <>
                    <span className="text-[10px] sm:text-xs text-[var(--color-mute)] block font-sans font-bold">B/D</span>
                    <span className="font-bold text-[var(--color-mute)] text-sm">0h</span>
                  </>
                );
              }
              if (maintMin >= totalBdMin && maintMin > 0) {
                return (
                  <>
                    <span className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 block font-sans font-bold">MT</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">MT {fmtMin(maintMin)}</span>
                  </>
                );
              }
              if (maintMin > 0 && netBdMin > 0) {
                return (
                  <>
                    <span className="text-[10px] sm:text-xs text-[var(--color-mute)] block font-sans font-bold">B/D</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-xs block">MT {fmtMin(maintMin)}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-xs">{fmtMin(netBdMin)}</span>
                  </>
                );
              }
              return (
                <>
                  <span className="text-[10px] sm:text-xs text-rose-600 dark:text-rose-400 block font-sans font-bold">B/D</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{fmtMin(totalBdMin)}</span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Row 3: Remarks & Stoppage Timestamps (click to toggle / expanded) */}
        {(group.remarksDisplay || group.totalBreakdownHours > 0) && (
          <div className="pt-1 border-t border-[var(--color-hairline)]">
            <button
              type="button"
              onClick={() => setIsRemarksOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-medium cursor-pointer"
            >
              <MessageSquare size={12} className="shrink-0" />
              <span>
                {isRemarksOpen
                  ? "Hide Details"
                  : group.totalBreakdownHours > 0
                  ? "View Remarks & Stoppage"
                  : "View Remark"}
              </span>
            </button>
            {isRemarksOpen && (
              <div className="mt-1.5 space-y-2">
                {group.remarksDisplay && (
                  <p className="p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs text-[var(--color-ink)] whitespace-pre-wrap leading-relaxed italic">
                    <Highlight text={group.remarksDisplay} query={searchTerm} />
                  </p>
                )}
                {group.totalBreakdownHours > 0 && (() => {
                  const totalBdMin = Math.round(group.totalBreakdownHours * 60);
                  const maintMin = group.totalMaintenanceMinutes;
                  const netBdMin = Math.max(0, totalBdMin - maintMin);
                  const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };

                  const stoppageLogs = group.logs.filter(
                    (l) => Boolean(l.is_breakdown) || Number(l.breakdown_minutes || 0) > 0 || Number(l.breakdown_hours || 0) > 0
                  );

                  return (
                    <div className="p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1 text-[var(--color-mute)] font-medium">
                          <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                          <span>Total Stoppage: <strong className="font-mono text-[var(--color-ink)]">{fmtMin(totalBdMin)}</strong></span>
                        </div>
                        {maintMin > 0 && (
                          <span className="font-bold text-amber-700 dark:text-amber-300 text-[11px]">
                            MT: <strong className="font-mono">{fmtMin(maintMin)}</strong>
                          </span>
                        )}
                        {netBdMin > 0 && (
                          <span className="font-bold text-rose-700 dark:text-rose-400 text-[11px]">
                            B/D: <strong className="font-mono">{fmtMin(netBdMin)}</strong>
                          </span>
                        )}
                      </div>

                      {stoppageLogs.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-[var(--color-hairline)]">
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

                            return (
                              <div
                                key={bLog.id || bIdx}
                                className="p-1.5 rounded bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-semibold text-[11px] text-[var(--color-ink)]">
                                    Shift {shiftCode} ({op})
                                  </span>
                                  {isFullyMaint ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                      MT {fmtMin(logMaint)} (Maintenance)
                                    </span>
                                  ) : isPartial ? (
                                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                      MT {fmtMin(logMaint)} / {fmtMin(logNetBd)} (B/D)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                      {fmtMin(logBdMin)} (Breakdown)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-mute)]">
                                  <Clock size={11} className="text-sky-600 dark:text-sky-400 shrink-0" />
                                  <span>{timing.timeRange || "(Time unrecorded)"}</span>
                                  <span>•</span>
                                  <span>Duration: {fmtMin(logBdMin)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const OperationsLogsMobileList = React.memo(function OperationsLogsMobileList({
  logs,
  logsViewMode,
  isPending,
  onOpenConflictModal,
  selectedMachineId,
  clientMachines,
  mobileLogsList,
  isLoadingMoreMobile = false,
  loadMoreMobileError,
  onMobileRetry,
  mobileSentinelRef,
  searchTerm,
}: OperationsLogsMobileListProps) {
  const isClientView = logsViewMode === "client";
  const displayLogs = mobileLogsList && mobileLogsList.length > 0 ? mobileLogsList : logs;

  // Group shift logs by machine for client view on mobile
  const machineWiseGroups = useMemo(() => {
    if (!isClientView) return [];

    const logsByMachineId = new Map<string, MachineHourLog[]>();
    for (const log of displayLogs) {
      const mId = log.machine_id || (log.machine as any)?.id || "unassigned";
      const existing = logsByMachineId.get(mId);
      if (existing) {
        existing.push(log);
      } else {
        logsByMachineId.set(mId, [log]);
      }
    }

    const targetMachineIds: string[] = [];
    if (selectedMachineId && selectedMachineId !== "all") {
      targetMachineIds.push(selectedMachineId);
    } else {
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
  }, [isClientView, displayLogs, selectedMachineId, clientMachines]);

  // Standard flat grouping for machine / operator views
  const groupedLogs = useMemo(() => {
    if (isClientView) return [];
    return groupLogsByDate(displayLogs, logsViewMode);
  }, [isClientView, displayLogs, logsViewMode]);

  const sumDayRT = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalRunningHours, 0);
  }, [groupedLogs]);

  const sumWorkingHours = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalWorkingHours, 0);
  }, [groupedLogs]);

  const sumBreakdownHours = useMemo(() => {
    return groupedLogs.reduce((acc, g) => acc + g.totalBreakdownHours, 0);
  }, [groupedLogs]);

  return (
    <div className="block sm:hidden space-y-4">
      {isClientView ? (
        machineWiseGroups.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--color-mute)] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            {isPending ? "Loading daily shift logs..." : "No daily running hour logs found matching active filters."}
          </div>
        ) : (
          machineWiseGroups.map((mGroup) => (
            <div key={mGroup.machineId} className="space-y-2">
              {/* Machine Details Header Card at Top */}
              <div className="p-3 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-sm text-[var(--color-ink)]">
                      {mGroup.machineObj.model || "Equipment"}
                    </span>
                    {(mGroup.machineObj.serial_number || mGroup.machineObj.machine_code) && (
                      <span className="font-mono text-xs font-semibold text-[var(--color-mute)]">
                        (SN: {mGroup.machineObj.serial_number || mGroup.machineObj.machine_code})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono border-t border-[var(--color-hairline)] pt-1.5 text-[var(--color-mute)]">
                  <span>
                    <span className="font-sans text-[10px] uppercase font-bold">Days: </span>
                    <strong className="text-[var(--color-ink)] font-mono">{mGroup.dailyGroups.length}</strong>
                  </span>
                  <span>
                    <span className="font-sans text-[10px] uppercase font-bold">M/C RT: </span>
                    <strong className="text-sky-600 dark:text-sky-400 font-mono">{formatHoursWithUnit(mGroup.sumDayRT)}</strong>
                  </span>
                  <span>
                    <span className="font-sans text-[10px] uppercase font-bold">WH: </span>
                    <strong className="text-[var(--color-ink)] font-mono">{formatHoursWithUnit(mGroup.sumWorkingHours)}</strong>
                  </span>
                </div>
              </div>

              {/* Shift cards for this machine */}
              {mGroup.dailyGroups.map((group, dayIdx) => (
                <OperationsDailyLogMobileCard
                  key={group.date}
                  group={group}
                  dayIndex={dayIdx}
                  logsViewMode={logsViewMode}
                  onOpenConflictModal={onOpenConflictModal}
                  searchTerm={searchTerm}
                />
              ))}

              {/* Dedicated Summary Footer Card for this machine */}
              <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 shadow-2xs font-mono">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-hairline)] pb-1.5">
                  <span>Total for {mGroup.machineObj.model || "Machine"}</span>
                  <span>{mGroup.dailyGroups.length} {mGroup.dailyGroups.length === 1 ? "day" : "days"}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-mute)] block font-sans">Total Day RT</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">
                      {formatHoursWithUnit(mGroup.sumDayRT)}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-mute)] block font-sans">Total Working</span>
                    <span className="font-bold text-[var(--color-ink)] text-sm">
                      {formatHoursWithUnit(mGroup.sumWorkingHours)}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <span className="text-[10px] text-[var(--color-mute)] block font-sans">Total Breakdown</span>
                    <span className="font-bold text-[var(--color-ink)] text-sm">
                      {formatHoursWithUnit(mGroup.sumBreakdownHours)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )
      ) : (
        /* STANDARD UNTOUCHED MOBILE LIST FOR MACHINE / OPERATOR VIEW */
        <>
          {isPending && displayLogs.length === 0 ? (
            <MobileOperationsLogCardSkeletonList count={4} />
          ) : groupedLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--color-mute)] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              No daily running hour logs found matching active filters.
            </div>
          ) : (
            groupedLogs.map((group, dayIdx) => (
              <OperationsDailyLogMobileCard
                key={group.date}
                group={group}
                dayIndex={dayIdx}
                logsViewMode={logsViewMode}
                onOpenConflictModal={onOpenConflictModal}
                searchTerm={searchTerm}
              />
            ))
          )}

          {/* Total Summary Footer Card matching Excel reference */}
          {groupedLogs.length > 0 && !isPending && (
            <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 shadow-2xs font-mono">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-hairline)] pb-1.5">
                <span>Total</span>
                <span>{groupedLogs.length} {groupedLogs.length === 1 ? "day" : "days"}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                  <span className="text-xs text-[var(--color-mute)] block font-sans">Total Day RT</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">
                    {formatHoursWithUnit(sumDayRT)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                  <span className="text-xs text-[var(--color-mute)] block font-sans">Total Working</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">
                    {formatHoursWithUnit(sumWorkingHours)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                  <span className="text-xs text-[var(--color-mute)] block font-sans">Total Breakdown</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">
                    {formatHoursWithUnit(sumBreakdownHours)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
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
    </div>
  );
});
