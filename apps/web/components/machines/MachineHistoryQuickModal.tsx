"use client";

import { useState, useEffect } from "react";
import { Modal, Badge } from "@/components/ui";
import { History, Clock, Calendar, AlertCircle } from "lucide-react";
import { AnimatedLoader } from "@/components/ui/animated-icons";
import { getMachineHourLogsAction } from "@/app/actions/machines";
import type { Machine } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";

interface MachineHistoryQuickModalProps {
  machine: Machine | null;
  open: boolean;
  onClose: () => void;
}

// Client session cache for on-demand machine running hour logs
const historySessionCache = new Map<string, any[]>();

export function MachineHistoryQuickModal({
  machine,
  open,
  onClose,
}: MachineHistoryQuickModalProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !machine?.id) {
      return;
    }

    const machineId = machine.id;

    // Check client session cache first: instant second opening
    if (historySessionCache.has(machineId)) {
      setLogs(historySessionCache.get(machineId) || []);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getMachineHourLogsAction(machineId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.logs) {
          historySessionCache.set(machineId, res.logs);
          setLogs(res.logs);
        } else {
          setError(res.error || "Failed to load running logs");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load logs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, machine?.id]);

  if (!machine) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Running Hours History — ${machine.machine_id || "Machine"}`}
      description={`Daily operation logbook and meter records for ${machine.model || "Asset"}.`}
      size="xl"
    >
      <div className="space-y-4 py-1">
        {/* Machine Summary Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--color-ink)]">{machine.machine_id}</span>
            <span className="text-[var(--color-mute)]">•</span>
            <span className="font-medium text-[var(--color-body)]">{machine.model || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Current Meter:</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{machine.hour_meter ?? 0} hrs</span>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-2.5 py-6" aria-label="Loading running logs...">
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--color-mute)]">
              <AnimatedLoader isSpinning size={18} className="text-sky-500" />
              <span>Fetching machine running history on-demand...</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {!loading && error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loaded Logs Table */}
        {!loading && !error && (
          <>
            {logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-mute)] space-y-1">
                <History className="h-8 w-8 mx-auto text-[var(--color-mute)]/50 mb-2" />
                <p className="font-semibold text-[var(--color-ink)]">No Running Logs Recorded Yet</p>
                <p className="text-[11px]">Daily running entries by operators will appear here automatically.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
                <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-hairline)] text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--color-hairline-soft-surface)] sticky top-0 z-10 text-[10px] uppercase font-bold text-[var(--color-mute)] tracking-wider">
                      <tr>
                        <th className="p-2.5 pl-3">Date</th>
                        <th className="p-2.5">Start</th>
                        <th className="p-2.5">End</th>
                        <th className="p-2.5">Run Hours</th>
                        <th className="p-2.5">OT</th>
                        <th className="p-2.5">Operator</th>
                        <th className="p-2.5 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-hairline)] font-mono text-[11px]">
                      {logs.map((log: any, idx: number) => {
                        const operatorName = log.operator?.full_name || "—";
                        const runHours = Number(log.running_hours) || 0;
                        const otHours = Number(log.overtime_hours) || 0;
                        return (
                          <tr key={log.id || idx} className="hover:bg-[var(--color-hairline-soft-surface)]/40 transition-colors">
                            <td className="p-2.5 pl-3 text-[var(--color-ink)] font-semibold font-sans">
                              {log.log_date ? formatDate(log.log_date) : "—"}
                            </td>
                            <td className="p-2.5 text-[var(--color-mute)]">{log.start_meter ?? "—"}</td>
                            <td className="p-2.5 text-[var(--color-ink)] font-bold">{log.end_meter ?? "—"}</td>
                            <td className="p-2.5 text-sky-600 dark:text-sky-400 font-bold">{runHours} hrs</td>
                            <td className="p-2.5 text-amber-600 dark:text-amber-400">{otHours > 0 ? `+${otHours}` : "—"}</td>
                            <td className="p-2.5 font-sans truncate max-w-[110px]" title={operatorName}>
                              {operatorName}
                            </td>
                            <td className="p-2.5 pr-3 font-sans">
                              {log.is_breakdown ? (
                                <Badge variant="overdue" className="text-[9px] px-1.5 py-0">Breakdown</Badge>
                              ) : (
                                <Badge variant="success" className="text-[9px] px-1.5 py-0">Operational</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
