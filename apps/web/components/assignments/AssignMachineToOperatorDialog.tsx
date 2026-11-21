"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Truck, Plus, Trash2, Clock, AlertCircle, CalendarDays } from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentSearch } from "./AssignmentSearch";
import { AssignmentSelectableList, type AssignmentCandidateItem } from "./AssignmentSelectableList";
import { AssignmentSelectionSummary, type SelectedAssignmentSummaryItem } from "./AssignmentSelectionSummary";
import { AssignmentShiftPicker } from "./AssignmentShiftPicker";
import { AssignmentActions } from "./AssignmentActions";
import { useToast } from "@/components/ui/Toast";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import type { User, ClientShiftCode } from "@reachinternational/types";
import {
  getUserInitials,
  formatEmployeeId,
  formatTo12Hour,
  shiftToMinuteRanges,
  doRangesOverlap,
  getAssignmentDateKind,
  resolveAssignmentDate,
  getISTDateString,
  ASSIGNMENT_DATE_WINDOW_PAST_DAYS,
  ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS,
} from "@reachinternational/utils";
import { DEFAULT_CLIENT_SHIFTS } from "../operations/entry/ShiftInputs";
import {
  getAssignableMachinesAction,
  getOperatorActiveAssignmentsAction,
  updateOperatorMachineAssignmentsAction,
} from "@/app/actions/assignments";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import {
  getCachedClientShifts,
  setCachedClientShifts,
} from "@/lib/cache/client-shifts-cache";

export interface OperatorMachineRosterItem {
  machineId: string;
  machineCode: string;
  machineModel?: string;
  clientId?: string | null;
  clientName?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
}

export interface AssignMachineToOperatorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  operator: User | any;
  userRole?: string;
  /** When false the dialog is locked to TODAY and renders no date control. */
  allowDateSelection?: boolean;
  /**
   * Preferred assignment date when the dialog opens (YYYY-MM-DD, IST).
   * Clamped into [today - 7 .. today + 1]; falls back to today when missing or out of window.
   */
  initialAssignmentDate?: string | null;
  onSuccess?: (result?: any) => void;
}

export function AssignMachineToOperatorDialog({
  isOpen,
  onClose,
  operator,
  allowDateSelection = true,
  initialAssignmentDate,
  onSuccess,
}: AssignMachineToOperatorDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [assignableMachines, setAssignableMachines] = useState<any[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [operatorRoster, setOperatorRoster] = useState<OperatorMachineRosterItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<OperatorMachineRosterItem[]>([]);

  // Date-based assignment (today - 7 days .. today + 1 day, IST).
  // The preferred date (caller supplied) is clamped into the canonical window; today by default.
  const [assignmentDate, setAssignmentDate] = useState<string>(() =>
    resolveAssignmentDate(initialAssignmentDate)
  );
  const todayIst = useMemo(() => getISTDateString(), []);
  const isTodayAssignment = assignmentDate === todayIst;
  const dateKind = useMemo(() => getAssignmentDateKind(assignmentDate, todayIst), [assignmentDate, todayIst]);
  const isPastAssignment = dateKind === "past";
  const isTomorrowPlan = dateKind === "tomorrow";

  // Every time the dialog opens, reset to the caller's preferred (in-window) date
  useEffect(() => {
    if (!isOpen) return;
    setAssignmentDate(resolveAssignmentDate(initialAssignmentDate));
    setSubmitError(null);
  }, [isOpen, initialAssignmentDate]);

  // Selection state
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>("S1");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active machine's client shifts
  const [machineClientShifts, setMachineClientShifts] = useState<ClientShiftCode[]>(DEFAULT_CLIENT_SHIFTS);

  // Load assignable machines and the operator's assignments for the selected date on open
  useEffect(() => {
    if (!isOpen || !operator?.id) return;

    let mounted = true;
    setIsLoadingMachines(true);
    setSubmitError(null);
    setSelectedMachineId("");
    setSearchQuery("");

    Promise.all([
      getAssignableMachinesAction(),
      getOperatorActiveAssignmentsAction(operator.id, assignmentDate),
    ])
      .then(([machinesRes, assignmentsRes]) => {
        if (!mounted) return;
        if (machinesRes.success && machinesRes.machines) {
          setAssignableMachines(machinesRes.machines);
        }

        const loaded: OperatorMachineRosterItem[] = (assignmentsRes.assignments || []).map((a: any) => ({
          machineId: a.machine_id,
          machineCode: a.machine?.machine_id || a.machine_code || "Machine",
          machineModel: a.machine?.model || a.machine_model || "Equipment",
          clientId: a.machine?.client_id || null,
          clientName: a.machine?.client?.company_name || null,
          shiftCode: a.shift_code || "S1",
          shiftStartTime: a.shift_start_time || null,
          shiftEndTime: a.shift_end_time || null,
          notes: "Assigned via operator equipment dialog",
        }));

        setOperatorRoster(loaded);
        setInitialSnapshot(loaded);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("[AssignMachineToOperatorDialog] load error:", err);
      })
      .finally(() => {
        if (mounted) setIsLoadingMachines(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, operator?.id, assignmentDate]);

  // When selectedMachineId changes, load client shifts for that machine
  useEffect(() => {
    if (!selectedMachineId) {
      setMachineClientShifts(DEFAULT_CLIENT_SHIFTS);
      return;
    }

    const mach = assignableMachines.find((m) => m.id === selectedMachineId);
    const cId = mach?.client_id;
    if (!cId) {
      setMachineClientShifts(DEFAULT_CLIENT_SHIFTS);
      return;
    }

    const cached = getCachedClientShifts(cId);
    if (cached && cached.length > 0) {
      setMachineClientShifts(cached);
      return;
    }

    let active = true;
    getClientShiftCodesAction(cId).then((res) => {
      if (!active) return;
      if (res.success && res.data && res.data.length > 0) {
        const formatted: ClientShiftCode[] = res.data
          .filter((s: any) => s.is_active !== false)
          .map((s: any) => ({
            ...s,
            raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
            raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
            start_time: formatTo12Hour(s.start_time) || s.start_time,
            end_time: formatTo12Hour(s.end_time) || s.end_time,
          }));
        const finalShifts = formatted.length > 0 ? formatted : DEFAULT_CLIENT_SHIFTS;
        setCachedClientShifts(cId, finalShifts);
        setMachineClientShifts(finalShifts);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedMachineId, assignableMachines]);

  // Candidates: available machines not already assigned with 3 shifts
  const candidateMachines: AssignmentCandidateItem[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return assignableMachines
      .filter((m) => {
        const code = (m.machine_id || m.machine_code || "").toLowerCase();
        const model = (m.model || "").toLowerCase();
        const client = (m.client_name || m.client?.company_name || "").toLowerCase();
        if (!q) return true;
        return code.includes(q) || model.includes(q) || client.includes(q);
      })
      .map((m) => {
        const shiftsOnThisMach = operatorRoster.filter((r) => r.machineId === m.id).length;
        const isMaxShiftsOnMach = shiftsOnThisMach >= 3;
        const isAssignedToThisOp = shiftsOnThisMach > 0;
        const isOperatorFull = operatorRoster.length >= 3;

        let statusLabel = m.status === "rented" ? "Rented" : "Available";
        let statusVariant: "default" | "success" | "warning" | "error" | "info" | "neutral" =
          m.status === "rented" ? "info" : "success";

        if (isMaxShiftsOnMach) {
          statusLabel = "3/3 Shifts Assigned";
          statusVariant = "neutral";
        } else if (isAssignedToThisOp) {
          statusLabel = `${shiftsOnThisMach}/3 Shifts Assigned`;
          statusVariant = "info";
        }

        return {
          id: m.id,
          title: m.machine_id || m.machine_code || "Machine",
          subtitle: m.model || "Asset",
          meta: m.client_name || m.client?.company_name || "Unallocated (Yard)",
          statusBadge: {
            label: statusLabel,
            variant: statusVariant,
          } as const,
          disabled: isMaxShiftsOnMach || isOperatorFull,
        };
      });
  }, [assignableMachines, operatorRoster, searchQuery]);

  // Check shift overlap between candidate machine shift and current roster
  const shiftConflictNotice = useMemo(() => {
    const notices: Record<string, string> = {};
    if (!selectedMachineId) return notices;

    machineClientShifts.forEach((shift) => {
      const candidateRanges = shiftToMinuteRanges(shift.start_time, shift.end_time);

      // Check collision against already assigned shifts in operatorRoster
      for (const existing of operatorRoster) {
        if (existing.machineId === selectedMachineId && existing.shiftCode === shift.code) {
          notices[shift.code] = "Already assigned on this machine";
          break;
        }

        const existingRanges = shiftToMinuteRanges(existing.shiftStartTime, existing.shiftEndTime);
        if (doRangesOverlap(candidateRanges, existingRanges)) {
          notices[shift.code] = `Overlaps with ${existing.machineCode} (Shift ${existing.shiftCode})`;
          break;
        }
      }
    });

    return notices;
  }, [selectedMachineId, machineClientShifts, operatorRoster]);

  // Add machine to roster
  const handleAddMachineToRoster = () => {
    if (!selectedMachineId || !selectedShiftCode) return;
    if (operatorRoster.length >= 3) {
      toast("warning", "Limit reached", "An operator can be assigned to a maximum of 3 shifts (24h).");
      return;
    }

    const mach = assignableMachines.find((m) => m.id === selectedMachineId);
    if (!mach) return;

    const shift = machineClientShifts.find(
      (s) => s.code.trim().toUpperCase() === selectedShiftCode.trim().toUpperCase()
    );

    const newItem: OperatorMachineRosterItem = {
      machineId: mach.id,
      machineCode: mach.machine_id || mach.machine_code || "Machine",
      machineModel: mach.model || "Equipment",
      clientId: mach.client_id || null,
      clientName: mach.client_name || mach.client?.company_name || null,
      shiftCode: selectedShiftCode,
      shiftStartTime: shift?.start_time || null,
      shiftEndTime: shift?.end_time || null,
      notes: "Assigned via operator equipment dialog",
    };

    setOperatorRoster([...operatorRoster, newItem]);
    setSelectedMachineId("");
    toast("info", "Equipment added", `Added ${newItem.machineCode} (${newItem.shiftCode}) to operator shift schedule.`);
  };

  const handleRemoveFromRoster = (machineId: string, shiftCode?: string) => {
    setOperatorRoster((prev) =>
      prev.filter((r) => !(r.machineId === machineId && (!shiftCode || r.shiftCode === shiftCode)))
    );
  };

  const isDirty = useMemo(() => {
    if (operatorRoster.length !== initialSnapshot.length) return true;
    const initSet = new Set(initialSnapshot.map((r) => `${r.machineId}-${r.shiftCode}`));
    return operatorRoster.some((r) => !initSet.has(`${r.machineId}-${r.shiftCode}`));
  }, [operatorRoster, initialSnapshot]);

  const summaryItems: SelectedAssignmentSummaryItem[] = useMemo(() => {
    return operatorRoster.map((r) => ({
      id: r.machineId,
      title: r.machineCode,
      subtitle: `${r.machineModel || "Equipment"}${r.clientName ? ` • ${r.clientName}` : " • Yard"}`,
      shiftCode: r.shiftCode,
      shiftTiming: r.shiftStartTime && r.shiftEndTime ? `${r.shiftStartTime} – ${r.shiftEndTime}` : null,
    }));
  }, [operatorRoster]);

  // Submit with safe rollback
  const handleSave = async () => {
    if (!operator?.id || isSaving) return;

    setIsSaving(true);
    setSubmitError(null);

    try {
      const res = await updateOperatorMachineAssignmentsAction(operator.id, {
        machineAssignments: operatorRoster.map((a) => ({
          machineId: a.machineId,
          shiftCode: a.shiftCode,
          shiftStartTime: a.shiftStartTime,
          shiftEndTime: a.shiftEndTime,
          notes: a.notes,
        })),
        assignmentDate,
      });

      if (!res.success || res.error) {
        const err = res.error || "Failed to update operator assignments.";
        setSubmitError(err);
        toast("error", "Save failed", err);
        return;
      }

      toast(
        "success",
        isTodayAssignment ? "Assignments saved" : isPastAssignment ? "Past roster updated" : "Tomorrow's roster planned",
        isTodayAssignment
          ? `Equipment shift assignments updated for ${operator.full_name}.`
          : isPastAssignment
          ? `Corrected ${operator.full_name}'s equipment shifts for ${assignmentDate}. Today's and tomorrow's assignments stay untouched.`
          : `Equipment shift plan stored for ${assignmentDate}. Today's assignments stay untouched.`
      );
      onSuccess?.(res);
      onClose();
      router.refresh();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
        window.dispatchEvent(
          new CustomEvent("reach:refresh-user-assignments", { detail: { userId: operator.id } })
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update assignments";
      setSubmitError(msg);
      toast("error", "Save failed", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Equipment to Operator"
      description={`Allocate machinery fleet and daily shifts for ${operator.full_name || "Operator"}.`}
      size="lg"
      targetEntity={{
        type: "operator",
        title: operator.full_name || "Operator",
        code: formatEmployeeId(operator.id),
        subtitle: `Role: Operator • ${operatorRoster.length}/3 Shifts Allocated`,
      }}
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
          disabled={!isDirty || isSaving}
          submitLabel={
            isSaving
              ? "Saving..."
              : isTodayAssignment
                ? "Save Equipment Assignments"
                : `Save Plan for ${assignmentDate}`
          }
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      <div className="space-y-3.5">
        {/* SECTION 1: Assignment Date — 7 past days + today + tomorrow (IST).
            Hidden entirely when the caller locks the dialog to today. */}
        {allowDateSelection ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 p-2.5 sm:p-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--color-ink)] select-none">
                    Assignment date
                  </span>
                  {isPastAssignment && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-none">
                      Past Correction
                    </span>
                  )}
                  {isTomorrowPlan && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 leading-none">
                      Tomorrow Plan
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--color-mute)] truncate">
                  {isPastAssignment
                    ? "Past correction — today stays untouched"
                    : isTomorrowPlan
                    ? "Tomorrow only — today stays untouched"
                    : "Carries forward until changed"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 sm:ml-auto w-full sm:w-auto">
              {!isTodayAssignment && (
                <button
                  type="button"
                  onClick={() => setAssignmentDate(todayIst)}
                  disabled={isSaving}
                  className="shrink-0 h-9 px-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:border-sky-500/40 active:scale-95 transition-all cursor-pointer touch-manipulation disabled:opacity-50"
                  title="Jump to Today"
                >
                  Today
                </button>
              )}
              <CustomDatePicker
                value={assignmentDate}
                onChange={(nextDate) => {
                  if (!nextDate) return;
                  setSubmitError(null);
                  setAssignmentDate(resolveAssignmentDate(nextDate));
                }}
                maxDaysOld={ASSIGNMENT_DATE_WINDOW_PAST_DAYS}
                allowFutureDays={ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS}
                showRelativeBadge
                required
                disabled={isSaving}
                placeholder="Select assignment date..."
                className="flex-1 sm:w-[210px]"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 px-3 py-2 text-[11px] text-[var(--color-mute)] select-none">
            <div className="h-6 w-6 rounded-md bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <span>
              Editing <span className="font-semibold text-[var(--color-ink)]">today&apos;s</span> roster ·{" "}
              {new Date(`${todayIst}T00:00:00`).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Active Allocated Equipment Roster */}
        <AssignmentSelectionSummary
          items={summaryItems}
          onRemoveItem={handleRemoveFromRoster}
          maxCapacity={3}
          capacityLabel="Allocated Machinery Shifts"
          emptyTitle="No Equipment Assigned"
          emptyDescription="Select available fleet machinery below to assign this operator."
          disabled={isSaving}
        />

        {/* Add Machine Section (if < 3) */}
        {operatorRoster.length < 3 && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                Select Equipment & Shift
              </span>
              <span className="text-[11px] text-[var(--color-mute)] font-mono">
                {3 - operatorRoster.length} slot{3 - operatorRoster.length === 1 ? "" : "s"} remaining
              </span>
            </div>

            {/* Machine Search */}
            <AssignmentSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search machinery by code, model, client..."
              totalCount={assignableMachines.length}
              filteredCount={candidateMachines.length}
            />

            {/* Selectable Machine Candidates */}
            <AssignmentSelectableList
              items={candidateMachines}
              selectedIds={selectedMachineId ? [selectedMachineId] : []}
              onSelect={(item) => setSelectedMachineId(item.id)}
              isMultiSelect={false}
              emptyMessage={searchQuery ? `No machines matching "${searchQuery}"` : "No machines available"}
              listMaxHeight="max-h-[200px]"
            />

            {/* Shift Picker for chosen machine */}
            {selectedMachineId && (
              <AssignmentShiftPicker
                shifts={machineClientShifts}
                selectedCode={selectedShiftCode}
                onSelectShift={setSelectedShiftCode}
                conflictNotice={shiftConflictNotice}
                disabled={isSaving}
              />
            )}

            {/* Add to Roster Action */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!selectedMachineId || Boolean(shiftConflictNotice[selectedShiftCode]) || isSaving}
                onClick={handleAddMachineToRoster}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary)]/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Equipment to Shift {selectedShiftCode}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AssignmentDialog>
  );
}
