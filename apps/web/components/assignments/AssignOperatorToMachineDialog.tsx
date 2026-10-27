"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Clock,
  ShieldCheck,
  AlertCircle,
  Plus,
  Truck,
  Building2,
  Check,
  X,
} from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentSelectionSummary, type SelectedAssignmentSummaryItem } from "./AssignmentSelectionSummary";
import { AssignmentShiftPicker } from "./AssignmentShiftPicker";
import { AssignmentActions } from "./AssignmentActions";
import { MachineSelect } from "@/components/ui/MachineSelect";
import { UserSelect } from "@/components/ui/UserSelect";
import { useToast } from "@/components/ui/Toast";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User, UserRole, ClientShiftCode, ActiveOperatorOtherAssignment } from "@reachinternational/types";
import { isManagerOrAbove } from "@reachinternational/permissions";
import {
  formatTo12Hour,
  parseTimeToMinutes,
  shiftToMinuteRanges,
  doRangesOverlap,
  checkShiftIntervalOverlap,
  getUserInitials,
  formatEmployeeId,
} from "@reachinternational/utils";
import { DEFAULT_CLIENT_SHIFTS } from "../operations/entry/ShiftInputs";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import {
  getMachineModalOptionsAction,
  updateMachinePersonnelAction,
  getMachinePersonnelFreshAction,
} from "@/app/actions/machines";
import { getAssignableMachinesAction } from "@/app/actions/assignments";
import { getClientSupervisorsAction } from "@/app/actions/client-supervisors";
import {
  getCachedClientShifts,
  setCachedClientShifts,
} from "@/lib/cache/client-shifts-cache";

export interface OperatorRosterItem {
  operatorId: string;
  operatorName: string;
  employeeId?: string | null;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftName?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
}

export interface AssignOperatorToMachineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  machine?: MachineWithEngineer | any | null;
  machines?: any[];
  initialMachineId?: string;
  supervisors?: any[];
  operators?: any[];
  userRole?: UserRole | string;
  onSuccess?: (result?: any) => void;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function AssignOperatorToMachineDialog({
  isOpen,
  onClose,
  machine,
  machines = [],
  initialMachineId,
  supervisors = [],
  operators = [],
  userRole = "admin",
  onSuccess,
  onMachineUpdated,
}: AssignOperatorToMachineDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isSupervisorRole = userRole === "supervisor";
  const canEditSupervisor = (!userRole || isManagerOrAbove(userRole as any)) && !isSupervisorRole;

  // Pools
  const [lazySupervisors, setLazySupervisors] = useState<any[]>(() => supervisors || []);
  const [lazyOperators, setLazyOperators] = useState<any[]>(() => operators || []);
  const [availableMachines, setAvailableMachines] = useState<any[]>(() => machines || []);
  const [otherAssignments, setOtherAssignments] = useState<ActiveOperatorOtherAssignment[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingMachinePersonnel, setIsLoadingMachinePersonnel] = useState(false);

  // Selected Machine ID (can be selected via dropdown)
  const [selectedMachineId, setSelectedMachineId] = useState<string>(() => {
    return machine?.id || initialMachineId || (machines.length > 0 ? machines[0]?.id : "") || "";
  });

  // Current active machine entity
  const currentMachine = useMemo(() => {
    if (!selectedMachineId) return machine || null;
    const found = availableMachines.find((m: any) => m.id === selectedMachineId);
    if (found) return found;
    if (machine?.id === selectedMachineId) return machine;
    return null;
  }, [selectedMachineId, availableMachines, machine]);

  // Client resolution for active machine
  const clientId = currentMachine?.client_id || currentMachine?.client?.id;
  const clientName = currentMachine?.client?.company_name || currentMachine?.client_name || null;
  const [clientInheritedSupervisors, setClientInheritedSupervisors] = useState<any[]>([]);
  const [clientShifts, setClientShifts] = useState<ClientShiftCode[]>(DEFAULT_CLIENT_SHIFTS);

  // Assigned items on this machine
  const [roster, setRoster] = useState<OperatorRosterItem[]>([]);
  const [yardSupervisorIds, setYardSupervisorIds] = useState<string[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<{
    roster: OperatorRosterItem[];
    supervisorIds: string[];
  }>({ roster: [], supervisorIds: [] });

  // Adding state
  const [isAddingToShift, setIsAddingToShift] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>("S1");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync incoming props
  useEffect(() => {
    if (operators && operators.length > 0) setLazyOperators(operators);
  }, [operators]);

  useEffect(() => {
    if (supervisors && supervisors.length > 0) setLazySupervisors(supervisors);
  }, [supervisors]);

  useEffect(() => {
    if (machines && machines.length > 0) setAvailableMachines(machines);
  }, [machines]);

  // Set initial machine ID when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    const targetId = machine?.id || initialMachineId || (machines.length > 0 ? machines[0]?.id : "") || "";
    if (targetId) setSelectedMachineId(targetId);
  }, [isOpen, machine?.id, initialMachineId, machines]);

  // Load available machines and modal options on open if empty
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingOptions(true);
    setSubmitError(null);

    const promises: Promise<any>[] = [];

    // 1. Fetch options if pools empty
    if (lazyOperators.length === 0 || lazySupervisors.length === 0) {
      promises.push(
        getMachineModalOptionsAction().then((data) => {
          if (!mounted) return;
          if (data.operators?.length) setLazyOperators(data.operators);
          if (data.supervisors?.length) setLazySupervisors(data.supervisors);
          if (data.activeAssignments?.length) setOtherAssignments(data.activeAssignments);
        })
      );
    }

    // 2. Fetch fleet machines if availableMachines empty
    if (availableMachines.length === 0) {
      promises.push(
        getAssignableMachinesAction().then((res) => {
          if (!mounted) return;
          if (res.success && res.machines?.length) {
            setAvailableMachines(res.machines);
            if (!selectedMachineId && res.machines[0]?.id) {
              setSelectedMachineId(res.machines[0].id);
            }
          }
        })
      );
    }

    Promise.all(promises)
      .catch((err) => console.error("[AssignOperatorToMachineDialog] options load error:", err))
      .finally(() => {
        if (mounted) setIsLoadingOptions(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, lazyOperators.length, lazySupervisors.length, availableMachines.length, selectedMachineId]);

  // When selectedMachineId changes, load fresh personnel and client shifts
  useEffect(() => {
    if (!isOpen || !selectedMachineId) {
      setRoster([]);
      return;
    }

    let mounted = true;
    setIsLoadingMachinePersonnel(true);
    setIsAddingToShift(false);
    setSelectedCandidateId("");

    const targetClientId = currentMachine?.client_id || currentMachine?.client?.id;

    // Load client shifts
    if (targetClientId) {
      const cached = getCachedClientShifts(targetClientId);
      if (cached && cached.length > 0) {
        setClientShifts(cached);
      } else {
        getClientShiftCodesAction(targetClientId).then((res) => {
          if (!mounted) return;
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
            setCachedClientShifts(targetClientId, finalShifts);
            setClientShifts(finalShifts);
          } else {
            setClientShifts(DEFAULT_CLIENT_SHIFTS);
          }
        });
      }

      // Load client supervisors
      getClientSupervisorsAction(targetClientId)
        .then((sups) => {
          if (mounted) setClientInheritedSupervisors(sups || []);
        })
        .catch(() => {
          if (mounted) setClientInheritedSupervisors([]);
        });
    } else {
      setClientShifts(DEFAULT_CLIENT_SHIFTS);
      setClientInheritedSupervisors([]);
    }

    // Load fresh assignments from DB for this machine
    getMachinePersonnelFreshAction(selectedMachineId)
      .then((res) => {
        if (!mounted || !res.success || !res.data) return;
        const fresh = res.data;
        const sups = fresh.supervisor_ids || (currentMachine?.supervisor_ids as string[]) || [];
        setYardSupervisorIds(sups);

        const loadedRoster: OperatorRosterItem[] = (fresh.operators || []).map((o: any, idx: number) => {
          const shiftCode = o.shift_code || o.shiftCode || `S${(idx % 3) + 1}`;
          return {
            operatorId: o.id,
            operatorName: o.full_name || "Operator",
            employeeId: o.employee_id || null,
            phone: o.phone || null,
            email: o.email || null,
            shiftCode,
            shiftName: o.shift_name || null,
            shiftStartTime: o.shift_start_time || null,
            shiftEndTime: o.shift_end_time || null,
            notes: "Assigned via personnel dialog",
          };
        });

        setRoster(loadedRoster);
        setInitialSnapshot({
          roster: loadedRoster,
          supervisorIds: sups,
        });

        // Set default shift to first open code
        const takenCodes = new Set(loadedRoster.map((r) => r.shiftCode.trim().toUpperCase()));
        const availableShift = (clientShifts.length > 0 ? clientShifts : DEFAULT_CLIENT_SHIFTS).find(
          (s) => !takenCodes.has(s.code.trim().toUpperCase())
        );
        if (availableShift) {
          setSelectedShiftCode(availableShift.code);
        }
      })
      .catch((err) => console.error("[AssignOperatorToMachineDialog] load machine error:", err))
      .finally(() => {
        if (mounted) setIsLoadingMachinePersonnel(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, selectedMachineId, currentMachine?.client_id]);

  // Map of taken shift codes on this machine
  const takenShiftCodes = useMemo(() => {
    return new Set(roster.map((r) => r.shiftCode.trim().toUpperCase()));
  }, [roster]);

  // Eligible Candidate Operators formatted for UserSelect
  const candidateUserSelectItems = useMemo(() => {
    const assignedIds = new Set(roster.map((r) => r.operatorId));
    return lazyOperators
      .filter((o) => !assignedIds.has(o.id))
      .map((o) => {
        const other = otherAssignments.filter((a) => a.operatorId === o.id);
        const isMax = other.length >= 3;
        return {
          id: o.id,
          full_name: o.full_name || o.name || "Operator",
          name: o.full_name || o.name || "Operator",
          employee_id: o.employee_id || null,
          phone: o.phone || null,
          email: o.email || null,
          role: "operator",
          disabled: isMax,
        };
      });
  }, [lazyOperators, roster, otherAssignments]);

  // Shift conflict checking on candidate selection
  const shiftConflictNotice = useMemo(() => {
    const notices: Record<string, string> = {};
    const selectedOp = lazyOperators.find((o) => o.id === selectedCandidateId);
    if (!selectedOp) return notices;

    const opOther = otherAssignments.filter((a) => a.operatorId === selectedOp.id);

    clientShifts.forEach((shift) => {
      // 1. Is shift taken on this machine?
      if (takenShiftCodes.has(shift.code.trim().toUpperCase())) {
        notices[shift.code] = "Shift already assigned on this machine";
        return;
      }

      // 2. Does shift collide with another machine shift for this operator?
      const targetRanges = shiftToMinuteRanges(shift.start_time, shift.end_time);
      for (const other of opOther) {
        const otherRanges = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
        if (doRangesOverlap(targetRanges, otherRanges)) {
          notices[shift.code] = `Conflicts with ${other.machineCode || "another machine"}`;
          break;
        }
      }
    });

    return notices;
  }, [selectedCandidateId, lazyOperators, otherAssignments, clientShifts, takenShiftCodes]);

  // Handle adding candidate to roster upon selecting an operator
  const handleSelectCandidate = (opId: string) => {
    if (!opId || !selectedShiftCode) return;
    if (roster.length >= 3) {
      toast("warning", "Capacity full", "This machine already has the maximum of 3 shifts assigned.");
      return;
    }

    const op = lazyOperators.find((o) => o.id === opId);
    if (!op) return;

    // Shift collision check
    if (takenShiftCodes.has(selectedShiftCode.trim().toUpperCase())) {
      toast("error", "Shift taken", `Shift ${selectedShiftCode} is already assigned on this machine.`);
      return;
    }

    // Cross-machine interval collision check
    const shift = clientShifts.find(
      (s) => s.code.trim().toUpperCase() === selectedShiftCode.trim().toUpperCase()
    );
    const opOther = otherAssignments.filter((a) => a.operatorId === op.id);
    const targetRanges = shiftToMinuteRanges(shift?.start_time, shift?.end_time);
    for (const other of opOther) {
      const otherRanges = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
      if (doRangesOverlap(targetRanges, otherRanges)) {
        toast("error", "Shift Conflict", `Operator has an overlapping shift on ${other.machineCode || "another machine"}.`);
        return;
      }
    }

    const newItem: OperatorRosterItem = {
      operatorId: op.id,
      operatorName: op.full_name || op.name || "Operator",
      employeeId: op.employee_id || null,
      phone: op.phone || null,
      email: op.email || null,
      shiftCode: selectedShiftCode,
      shiftName: shift?.name || `Shift ${selectedShiftCode}`,
      shiftStartTime: shift?.start_time || null,
      shiftEndTime: shift?.end_time || null,
      notes: "Assigned via personnel dialog",
    };

    const nextRoster = [...roster, newItem];
    setRoster(nextRoster);
    setIsAddingToShift(false);
    setSelectedCandidateId("");

    // Advance selected shift to next available
    const nextTaken = new Set(nextRoster.map((r) => r.shiftCode.trim().toUpperCase()));
    const nextAvailable = clientShifts.find((s) => !nextTaken.has(s.code.trim().toUpperCase()));
    if (nextAvailable) setSelectedShiftCode(nextAvailable.code);

    toast("info", "Added to roster", `${newItem.operatorName} assigned to Shift ${newItem.shiftCode}. Save changes to confirm.`);
  };

  // Handle removing operator from roster
  const handleRemoveFromRoster = (opId: string, shiftCode?: string) => {
    setRoster((prev) =>
      prev.filter((r) => !(r.operatorId === opId && (!shiftCode || r.shiftCode === shiftCode)))
    );
  };

  // Roster summary items displaying already assigned operators
  const summaryItems: SelectedAssignmentSummaryItem[] = useMemo(() => {
    return roster.map((r) => {
      const shift = clientShifts.find(
        (s) => s.code.trim().toUpperCase() === r.shiftCode.trim().toUpperCase()
      );
      const start = shift?.start_time || r.shiftStartTime;
      const end = shift?.end_time || r.shiftEndTime;
      const timingStr = start && end ? `${formatTo12Hour(start) || start} – ${formatTo12Hour(end) || end}` : null;
      const shiftName = r.shiftName || shift?.name || null;

      return {
        id: r.operatorId,
        title: r.operatorName,
        subtitle: r.employeeId ? formatEmployeeId(r.employeeId) : formatEmployeeId(r.operatorId),
        shiftCode: r.shiftCode,
        shiftName: shiftName && shiftName.toLowerCase() !== `shift ${r.shiftCode}`.toLowerCase() ? shiftName : null,
        shiftTiming: timingStr,
        avatarInitials: getUserInitials(r.operatorName),
        phone: r.phone || null,
      };
    });
  }, [roster, clientShifts]);

  // Is dirty calculation
  const isDirty = useMemo(() => {
    if (roster.length !== initialSnapshot.roster.length) return true;
    const initialKeys = new Set(initialSnapshot.roster.map((r) => `${r.operatorId}-${r.shiftCode}`));
    return roster.some((r) => !initialKeys.has(`${r.operatorId}-${r.shiftCode}`));
  }, [roster, initialSnapshot]);

  // Submit & Save with safe optimistic update and rollback
  const handleSave = async () => {
    if (!selectedMachineId || isSaving) return;

    setIsSaving(true);
    setSubmitError(null);

    // Snapshot current state for rollback
    const rollbackSnapshot = {
      supervisor_ids: currentMachine?.supervisor_ids,
      current_supervisor_id: currentMachine?.current_supervisor_id,
      operator_ids: currentMachine?.operator_ids,
      current_operator_id: currentMachine?.current_operator_id,
      operators: currentMachine?.operators,
    };

    // Construct optimistic update
    const optimisticOperators = roster.map((item, idx) => ({
      id: item.operatorId,
      full_name: item.operatorName,
      employee_id: item.employeeId || null,
      phone: item.phone || null,
      email: item.email || null,
      shift_time: item.shiftStartTime && item.shiftEndTime
        ? `${item.shiftStartTime} - ${item.shiftEndTime}`
        : "08:00 AM - 04:00 PM",
      shift_code: item.shiftCode || `S${idx + 1}`,
      shift_name: item.shiftName || `Shift ${item.shiftCode}`,
      shift_start_time: item.shiftStartTime || null,
      shift_end_time: item.shiftEndTime || null,
      role: "operator",
    }));

    const uniqueOpIds = Array.from(new Set(roster.map((r) => r.operatorId)));

    // Apply immediate optimistic state to UI
    onMachineUpdated?.({
      supervisor_ids: clientId ? currentMachine?.supervisor_ids : yardSupervisorIds,
      current_supervisor_id: clientId ? currentMachine?.current_supervisor_id : yardSupervisorIds[0] || null,
      operator_ids: uniqueOpIds,
      current_operator_id: uniqueOpIds[0] || null,
      operators: optimisticOperators as any,
    });

    try {
      const isNeedsActivation = Boolean(
        currentMachine?.health_status === "breakdown" ||
        currentMachine?.health_status === "under_maintenance" ||
        currentMachine?.status === "under_maintenance"
      );

      const res = await updateMachinePersonnelAction(selectedMachineId, {
        supervisorIds: clientId ? undefined : (canEditSupervisor ? yardSupervisorIds : undefined),
        activateMachine: isNeedsActivation,
        operators: roster.map((item) => ({
          operatorId: item.operatorId,
          shiftCode: item.shiftCode,
          shiftStartTime: item.shiftStartTime,
          shiftEndTime: item.shiftEndTime,
          notes: item.notes || "Assigned via personnel dialog",
        })),
      });

      if (!res.success || res.error) {
        const err = res.error || "Failed to update machine personnel.";
        setSubmitError(err);
        toast("error", "Save failed — Rolling back", err);
        onMachineUpdated?.(rollbackSnapshot);
        return;
      }

      toast("success", "Assignments saved", `Updated 24h shift roster for ${currentMachine?.machine_id || "machinery"}.`);
      onSuccess?.({
        machineId: selectedMachineId,
        operators: optimisticOperators,
        res,
      });
      onClose();
      router.refresh();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
        window.dispatchEvent(new CustomEvent("reach:refresh-user-assignments"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save assignments";
      setSubmitError(msg);
      toast("error", "Save failed — Rolling back", msg);
      onMachineUpdated?.(rollbackSnapshot);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Operator to Shift"
      description="Manage 24h operator shift coverage and equipment personnel assignments."
      size="lg"
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
          disabled={!isDirty || isSaving}
          submitLabel={isSaving ? "Saving Roster..." : "Save Shift Roster"}
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      <div className="space-y-4">
        {/* SECTION 1: Machine Selector Dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between select-none">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              Select Machinery Equipment
            </span>
            {clientName ? (
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                Rented to {clientName}
              </span>
            ) : clientId ? (
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                Client Deployed
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-mute)]">
                Yard / Unallocated
              </span>
            )}
          </label>
          <MachineSelect
            machines={availableMachines}
            value={selectedMachineId}
            onChange={(machineId) => {
              setSelectedMachineId(machineId);
            }}
            placeholder="Search and select machinery equipment..."
            disabled={isSaving}
          />
        </div>

        {/* SECTION 2: Active 24h Coverage Roster (Displays already assigned operators) */}
        <AssignmentSelectionSummary
          items={summaryItems}
          onRemoveItem={handleRemoveFromRoster}
          maxCapacity={3}
          capacityLabel="24h Operator Shift Coverage"
          emptyTitle="No Operators Assigned to this Machine"
          emptyDescription="Click 'Assign Operator to Shift' below to assign an operator to an open shift slot."
          disabled={isSaving}
        />

        {/* SECTION 3: Assign Operator to Shift Interaction */}
        {roster.length < 3 && (
          <div className="pt-0.5">
            {!isAddingToShift ? (
              <button
                type="button"
                onClick={() => setIsAddingToShift(true)}
                disabled={!selectedMachineId || isSaving || isLoadingMachinePersonnel}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-dashed border-[var(--color-hairline)] hover:border-[var(--color-primary)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-all text-xs group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 font-bold text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Plus className="h-4 w-4" />
                  </span>
                  Assign Operator to Shift
                </span>
                <span className="text-[11px] font-mono text-[var(--color-mute)]">
                  {3 - roster.length} shift slot{3 - roster.length === 1 ? "" : "s"} open
                </span>
              </button>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                    Assign Operator to Shift
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingToShift(false);
                      setSelectedCandidateId("");
                    }}
                    className="p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                    title="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Shift Picker — Displays shift code, shift name, and shift time */}
                <AssignmentShiftPicker
                  shifts={clientShifts}
                  selectedCode={selectedShiftCode}
                  onSelectShift={setSelectedShiftCode}
                  disabledCodes={Array.from(takenShiftCodes)}
                  conflictNotice={shiftConflictNotice}
                  disabled={isSaving}
                />

                {/* Operator Dropdown Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between">
                    <span>Select Operator for Shift {selectedShiftCode}</span>
                    <span className="text-[10px] font-mono text-[var(--color-mute)]">
                      {candidateUserSelectItems.length} available
                    </span>
                  </label>
                  <UserSelect
                    users={candidateUserSelectItems}
                    value={selectedCandidateId}
                    onChange={(opId) => {
                      setSelectedCandidateId(opId);
                      handleSelectCandidate(opId);
                    }}
                    placeholder="Search or select operator by name, employee ID..."
                    roleFilter={["operator"]}
                    disabled={isSaving}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AssignmentDialog>
  );
}
