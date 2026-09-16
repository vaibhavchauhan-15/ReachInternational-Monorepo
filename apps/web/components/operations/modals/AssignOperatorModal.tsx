"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  MachineSelect,
  UserSelect,
  CustomTimePicker,
  useToast,
} from "@/components/ui";
import { AnimatedUserCheck, AnimatedX } from "@/components/ui/animated-icons";
import {
  ShieldAlert,
  Users,
  AlertCircle,
  RefreshCw,
  Check,
  Moon,
  Sun,
} from "lucide-react";
import type { Machine, User } from "@/lib/types/database";
import {
  createAssignmentAction,
  getOperatorProfileShiftAction,
} from "@/app/actions/assignments";
import {
  parseConflictReason,
  parseTimeToMinutes,
  formatTo12Hour,
} from "@reachinternational/utils";
import { formatMachineSelectLabel } from "../operations-helpers";

export interface AssignOperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  operators: User[];
  assignments: any[];
  initialMachineId?: string;
  initialOperatorId?: string;
  onSuccess?: (newAssignment?: any) => void;
}

export function AssignOperatorModal({
  isOpen,
  onClose,
  machines,
  operators,
  assignments,
  initialMachineId,
  initialOperatorId,
  onSuccess,
}: AssignOperatorModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedMachineId, setSelectedMachineId] = useState(
    initialMachineId || machines[0]?.id || ""
  );
  const [selectedOperatorId, setSelectedOperatorId] = useState(
    initialOperatorId || ""
  );
  const [shiftStartTime, setShiftStartTime] = useState("08:00 AM");
  const [shiftEndTime, setShiftEndTime] = useState("04:00 PM");
  const [hasProfileShift, setHasProfileShift] = useState<boolean | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [loadingProfileShift, setLoadingProfileShift] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
    }
  }, [initialMachineId]);

  useEffect(() => {
    if (initialOperatorId) {
      handleOperatorSelect(initialOperatorId);
    }
  }, [initialOperatorId]);

  // Active operators pool
  const activeOperators = useMemo(() => {
    return operators.filter((u) => u.status === "active");
  }, [operators]);

  // Active assignments on the selected machine
  const activeAssignmentsOnSelectedMachine = useMemo(() => {
    if (!selectedMachineId) return [];
    return assignments.filter((a) => {
      const machId = a.machine_id || a.machine?.id;
      const isAct = a.is_active !== false && !a.ended_at;
      return machId === selectedMachineId && isAct;
    });
  }, [assignments, selectedMachineId]);

  // Overnight shift detection
  const isOvernightShift = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return false;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return false;
    return e <= s;
  }, [shiftStartTime, shiftEndTime]);

  // Shift duration formatted
  const shiftDurationHours = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return "";
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return "";
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hrs`;
  }, [shiftStartTime, shiftEndTime]);

  // Structured assignment conflict parsing
  const isAssignmentConflict = useMemo(() => {
    if (!assignmentError) return false;
    const lower = assignmentError.toLowerCase();
    return (
      lower.includes("conflict") ||
      lower.includes("overlap") ||
      lower.includes("23p01") ||
      lower.includes("custody") ||
      lower.includes("shift_overlap_conflict")
    );
  }, [assignmentError]);

  const parsedAssignmentConflict = useMemo(() => {
    if (!isAssignmentConflict || !assignmentError) return null;
    const op = operators.find((u) => u.id === selectedOperatorId);
    const mach = machines.find((m) => m.id === selectedMachineId);
    return parseConflictReason(assignmentError, {
      machineCode: mach ? formatMachineSelectLabel(mach) : undefined,
      machineModel: mach?.model || undefined,
      operatorName: op?.full_name || undefined,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [
    isAssignmentConflict,
    assignmentError,
    operators,
    selectedOperatorId,
    machines,
    selectedMachineId,
    shiftStartTime,
    shiftEndTime,
  ]);

  // When selecting an operator, auto-fill profile shift timings
  const handleOperatorSelect = async (opId: string) => {
    setSelectedOperatorId(opId);
    setAssignmentError(null);
    if (!opId) {
      setHasProfileShift(null);
      return;
    }
    setLoadingProfileShift(true);
    try {
      const res = await getOperatorProfileShiftAction(opId);
      if (res.profileShift) {
        const parts = res.profileShift.displayString.split(" - ");
        setShiftStartTime(parts[0] || "08:00 AM");
        setShiftEndTime(parts[1] || "04:00 PM");
        setHasProfileShift(true);
      } else {
        setShiftStartTime("");
        setShiftEndTime("");
        setHasProfileShift(false);
      }
    } catch {
      setHasProfileShift(false);
    } finally {
      setLoadingProfileShift(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignmentError(null);
    if (!selectedMachineId || !selectedOperatorId) {
      toast("error", "Please select both a target machine and an active operator.");
      return;
    }
    if (!shiftStartTime || !shiftEndTime) {
      setAssignmentError("Please specify both shift start time and end time.");
      toast("error", "Shift start time and end time are required.");
      return;
    }

    if (activeAssignmentsOnSelectedMachine.length >= 3) {
      setAssignmentError("This machine has reached its maximum capacity of 3 active operators.");
      toast("error", "Maximum capacity of 3 active operators reached.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAssignmentAction({
        machineId: selectedMachineId,
        operatorId: selectedOperatorId,
        shiftStartTime,
        shiftEndTime,
        notes,
      });

      if (res.success) {
        toast("success", "Operator assigned with shift window successfully.");
        onClose();
        setNotes("");
        setSelectedOperatorId("");
        setShiftStartTime("08:00 AM");
        setShiftEndTime("04:00 PM");
        setHasProfileShift(null);
        if (onSuccess) onSuccess(res.data);
      } else {
        setAssignmentError(res.error || "Failed to assign operator");
        toast("error", res.error || "Failed to assign operator");
      }
    } catch (err: any) {
      setAssignmentError(err?.message || "Failed to assign operator");
      toast("error", err?.message || "Failed to assign operator");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedUserCheck size={18} className="text-sky-500 shrink-0" />
              Assign Operator Shift Window
            </h3>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Assign an operator to recurring daily shift timings for this equipment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <AnimatedX size={16} />
          </button>
        </div>

        {/* Error Banner / Detailed Conflict Warning */}
        {assignmentError &&
          (isAssignmentConflict && parsedAssignmentConflict ? (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-extrabold text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parsedAssignmentConflict.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-600 text-white">
                  {parsedAssignmentConflict.badgeText}
                </span>
              </div>

              <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
                {parsedAssignmentConflict.description}
              </p>

              <ul className="space-y-1 pl-1 pt-0.5">
                {parsedAssignmentConflict.bulletWarnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-1.5">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>

              <div className="p-2.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-rose-500/20 text-[11px] text-rose-900 dark:text-rose-200 flex items-start gap-2">
                <span className="font-extrabold text-rose-600 shrink-0">Action Required:</span>
                <span>{parsedAssignmentConflict.resolutionGuidance.adjustAdvice}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Assignment Error</div>
                <div className="mt-0.5">{assignmentError}</div>
              </div>
            </div>
          ))}

        <div className="space-y-4">
          {/* Select Machine */}
          <div>
            <MachineSelect
              label="Target Equipment *"
              required
              value={selectedMachineId}
              onChange={(mId) => {
                setSelectedMachineId(mId);
                setAssignmentError(null);
              }}
              machines={machines}
            />
          </div>

          {/* Machine Active Shift Roster & Capacity Status */}
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-500" />
                Machine Shift Roster Capacity
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  activeAssignmentsOnSelectedMachine.length >= 3
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : activeAssignmentsOnSelectedMachine.length > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                }`}
              >
                {activeAssignmentsOnSelectedMachine.length} / 3 Operators Assigned
              </span>
            </div>

            {activeAssignmentsOnSelectedMachine.length === 0 ? (
              <p className="text-[11px] text-[var(--color-mute)] italic">
                No active operators currently assigned to this equipment.
              </p>
            ) : (
              <div className="space-y-1.5 pt-1">
                {activeAssignmentsOnSelectedMachine.map((ass: any, idx: number) => {
                  const opObj =
                    activeOperators.find((u) => u.id === ass.operator_id) || (ass.operator as any);
                  const isOvernight =
                    ass.crosses_midnight ||
                    (parseTimeToMinutes(ass.shift_end_time) ?? 0) <=
                      (parseTimeToMinutes(ass.shift_start_time) ?? 0);
                  return (
                    <div
                      key={ass.id || idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[var(--color-ink)]">
                          {opObj?.full_name || "Operator"}
                        </span>
                        <div className="text-[11px] text-[var(--color-mute)] flex items-center gap-1 mt-0.5">
                          {isOvernight ? (
                            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono">
                              <Moon className="w-3 h-3" /> {formatTo12Hour(ass.shift_start_time)} –{" "}
                              {formatTo12Hour(ass.shift_end_time)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono">
                              <Sun className="w-3 h-3" /> {formatTo12Hour(ass.shift_start_time)} –{" "}
                              {formatTo12Hour(ass.shift_end_time)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {activeAssignmentsOnSelectedMachine.length >= 3 && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Maximum capacity reached (3/3). End an existing assignment before adding another operator.
                </span>
              </div>
            )}
          </div>

          {/* Select Operator */}
          <div>
            <UserSelect
              label="Select Operator to Assign *"
              required
              value={selectedOperatorId}
              onChange={handleOperatorSelect}
              users={activeOperators}
              roleFilter={["operator"]}
              placeholder="Search and select active operator..."
            />

            {/* Profile Shift auto-fill status badge */}
            {selectedOperatorId && (
              <div className="mt-1.5">
                {loadingProfileShift ? (
                  <span className="text-[11px] text-[var(--color-mute)] flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Checking profile shift timings...
                  </span>
                ) : hasProfileShift === true ? (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    <span>
                      Timings auto-filled from operator profile ({shiftStartTime} – {shiftEndTime}). You may customize below if needed.
                    </span>
                  </div>
                ) : hasProfileShift === false ? (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>
                      No default profile shift found for this operator. Please select shift start and end times below.
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Shift Timings: CustomTimePicker for Start and End */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <CustomTimePicker
                  label="Daily Shift Start Time *"
                  required
                  value={shiftStartTime}
                  onChange={(v) => {
                    setShiftStartTime(v);
                    setAssignmentError(null);
                  }}
                  placeholder="08:00 AM"
                />
              </div>
              <div>
                <CustomTimePicker
                  label="Daily Shift End Time *"
                  required
                  value={shiftEndTime}
                  onChange={(v) => {
                    setShiftEndTime(v);
                    setAssignmentError(null);
                  }}
                  placeholder="04:00 PM"
                />
              </div>
            </div>

            {/* Duration & Overnight Helper Pill */}
            {shiftStartTime && shiftEndTime && (
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <span className="text-[var(--color-mute)]">
                  Shift Duration: <strong className="text-[var(--color-ink)] font-mono">{shiftDurationHours || "—"}</strong>
                </span>
                {isOvernightShift ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    <Moon className="w-3 h-3" /> Crosses Midnight (Overnight)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <Sun className="w-3 h-3" /> Standard Day Shift
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Assignment Notes */}
          <div>
            <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">
              Assignment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Primary morning shift, client site operations"
              className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={
              submitting ||
              !selectedMachineId ||
              !selectedOperatorId ||
              !shiftStartTime ||
              !shiftEndTime ||
              activeAssignmentsOnSelectedMachine.length >= 3
            }
          >
            Confirm & Assign Shift
          </Button>
        </div>
      </form>
    </div>
  );
}
