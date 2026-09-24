"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, Badge } from "@/components/ui";
import { Clock, Shield, Users, Phone, AlertCircle } from "lucide-react";
import { AnimatedLoader } from "@/components/ui/animated-icons";
import { getMachineAssignmentsAction } from "@/app/actions/machines";
import type { Machine, OperatorMachineAssignment } from "@/lib/types/database";

interface MachineAssignmentsQuickModalProps {
  machine: Machine | null;
  open: boolean;
  onClose: () => void;
}

// Client-side session cache for on-demand assignment fetches
const assignmentsSessionCache = new Map<string, OperatorMachineAssignment[]>();

export function MachineAssignmentsQuickModal({
  machine,
  open,
  onClose,
}: MachineAssignmentsQuickModalProps) {
  const [assignments, setAssignments] = useState<OperatorMachineAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !machine?.id) {
      return;
    }

    const machineId = machine.id;

    // Check client session cache first: instant second opening
    if (assignmentsSessionCache.has(machineId)) {
      setAssignments(assignmentsSessionCache.get(machineId) || []);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getMachineAssignmentsAction(machineId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.assignments) {
          assignmentsSessionCache.set(machineId, res.assignments);
          setAssignments(res.assignments);
        } else {
          setError(res.error || "Failed to load shift assignments");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load assignments");
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
      title={`Shift Assignments — ${machine.machine_id || "Machine"}`}
      description={`24-hour operator coverage and active personnel for ${machine.model || "Asset"}.`}
      size="lg"
    >
      <div className="space-y-4 py-1">
        {/* Machine Summary Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--color-ink)]">{machine.machine_id}</span>
            <span className="text-[var(--color-mute)]">•</span>
            <span className="font-medium text-[var(--color-body)]">{machine.model || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[var(--color-mute)]">Current HMR:</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{machine.hour_meter ?? 0} hrs</span>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-2.5 py-4" aria-label="Loading assignment data...">
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--color-mute)]">
              <AnimatedLoader isSpinning size={18} className="text-sky-500" />
              <span>Fetching active shift assignments on-demand...</span>
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

        {/* Content View */}
        {!loading && !error && (
          <>
            {assignments.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-mute)] space-y-1">
                <Users className="h-8 w-8 mx-auto text-[var(--color-mute)]/50 mb-2" />
                <p className="font-semibold text-[var(--color-ink)]">No Active Shift Assignments Found</p>
                <p className="text-[11px]">
                  Assign operators through the machine edit screen.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-[var(--color-ink)] flex items-center justify-between">
                  <span>Active Operators ({assignments.length})</span>
                  <span className="text-[10px] font-mono text-[var(--color-mute)]">24h Shift Roster</span>
                </div>
                <div className="divide-y divide-[var(--color-hairline)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden text-xs">
                  {assignments.map((assignment, idx) => {
                    const operator = assignment.operator;
                    return (
                      <div
                        key={assignment.id || idx}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[var(--color-hairline-soft-surface)]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 font-bold text-amber-600 dark:text-amber-400 text-xs">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--color-ink)] truncate">
                                {operator?.full_name || "Assigned Operator"}
                              </span>
                              <Badge variant="success" dot className="text-[9px] px-1.5 py-0">
                                Active
                              </Badge>
                            </div>
                            {operator?.phone && (
                              <div className="flex items-center gap-1 text-[11px] text-[var(--color-mute)] mt-0.5">
                                <Phone size={11} className="shrink-0" />
                                <span className="font-mono">{operator.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Shift Timing Chip */}
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs font-mono text-[var(--color-body)]">
                            <Clock size={12} className="text-sky-500" />
                            <span>
                              {assignment.shift_start_time?.slice(0, 5) || "08:00"} –{" "}
                              {assignment.shift_end_time?.slice(0, 5) || "20:00"}
                            </span>
                            {assignment.crosses_midnight && (
                              <span className="text-[10px] text-amber-500 font-bold ml-1">+1d</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assigned Supervisors Section */}
            {machine.current_supervisor && (
              <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-teal-500 shrink-0" />
                  <span className="text-[var(--color-mute)]">Overseeing Supervisor:</span>
                  <span className="font-bold text-[var(--color-ink)]">{machine.current_supervisor.full_name}</span>
                </div>
                {machine.current_supervisor.phone && (
                  <span className="font-mono text-[11px] text-[var(--color-mute)]">
                    {machine.current_supervisor.phone}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
