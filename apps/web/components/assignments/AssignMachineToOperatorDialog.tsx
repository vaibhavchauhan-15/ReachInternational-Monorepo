"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Truck, Plus, Trash2, Clock, AlertCircle } from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentSearch } from "./AssignmentSearch";
import { AssignmentSelectableList, type AssignmentCandidateItem } from "./AssignmentSelectableList";
import { AssignmentSelectionSummary, type SelectedAssignmentSummaryItem } from "./AssignmentSelectionSummary";
import { AssignmentShiftPicker } from "./AssignmentShiftPicker";
import { AssignmentActions } from "./AssignmentActions";
import { useToast } from "@/components/ui/Toast";
import type { User, ClientShiftCode } from "@reachinternational/types";
import {
  getUserInitials,
  formatEmployeeId,
  formatTo12Hour,
  shiftToMinuteRanges,
  doRangesOverlap,
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
  onSuccess?: (result?: any) => void;
}

export function AssignMachineToOperatorDialog({
  isOpen,
  onClose,
  operator,
  onSuccess,
}: AssignMachineToOperatorDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [assignableMachines, setAssignableMachines] = useState<any[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [operatorRoster, setOperatorRoster] = useState<OperatorMachineRosterItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<OperatorMachineRosterItem[]>([]);

  // Selection state
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>("S1");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active machine's client shifts
  const [machineClientShifts, setMachineClientShifts] = useState<ClientShiftCode[]>(DEFAULT_CLIENT_SHIFTS);

  // Load assignable machines and operator active assignments on open
  useEffect(() => {
    if (!isOpen || !operator?.id) return;

    let mounted = true;
    setIsLoadingMachines(true);
    setSubmitError(null);
    setSelectedMachineId("");
    setSearchQuery("");

    Promise.all([
      getAssignableMachinesAction(),
      getOperatorActiveAssignmentsAction(operator.id),
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
  }, [isOpen, operator?.id]);

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
  const assignedMachineIds = useMemo(() => {
    return new Set(operatorRoster.map((r) => r.machineId));
  }, [operatorRoster]);

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
        const isAssignedToThisOp = assignedMachineIds.has(m.id);
        return {
          id: m.id,
          title: m.machine_id || m.machine_code || "Machine",
          subtitle: m.model || "Asset",
          meta: m.client_name || m.client?.company_name || "Unallocated (Yard)",
          statusBadge: {
            label: isAssignedToThisOp ? "Already Assigned" : m.status === "rented" ? "Rented" : "Available",
            variant: isAssignedToThisOp ? "neutral" : m.status === "rented" ? "info" : "success",
          } as const,
        };
      });
  }, [assignableMachines, assignedMachineIds, searchQuery]);

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
      });

      if (!res.success || res.error) {
        const err = res.error || "Failed to update operator assignments.";
        setSubmitError(err);
        toast("error", "Save failed", err);
        return;
      }

      toast("success", "Assignments saved", `Equipment shift assignments updated for ${operator.full_name}.`);
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
          submitLabel={isSaving ? "Saving..." : "Save Equipment Assignments"}
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      <div className="space-y-5">
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
