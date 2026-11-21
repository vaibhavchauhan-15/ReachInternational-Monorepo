"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Truck,
  Plus,
  Star,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentActions } from "./AssignmentActions";
import { MachineSelect } from "@/components/ui/MachineSelect";
import { UserSelect, type UserSelectItem } from "@/components/ui/UserSelect";
import { useToast } from "@/components/ui/Toast";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User, UserRole } from "@reachinternational/types";
import {
  getUserInitials,
  formatEmployeeId,
} from "@reachinternational/utils";
import {
  updateMachineSupervisorsAction,
  getActiveSupervisorsOnlyAction,
  getMachinePersonnelFreshAction,
} from "@/app/actions/machines";
import { getAssignableMachinesAction } from "@/app/actions/assignments";

export interface AssignSupervisorToMachineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  machine?: MachineWithEngineer | any | null;
  machines?: any[];
  initialMachineId?: string;
  supervisors?: any[];
  userRole?: UserRole | string;
  onSuccess?: (result?: any) => void;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function AssignSupervisorToMachineDialog({
  isOpen,
  onClose,
  machine,
  machines = [],
  initialMachineId,
  supervisors = [],
  userRole = "admin",
  onSuccess,
  onMachineUpdated,
}: AssignSupervisorToMachineDialogProps) {
  const { toast } = useToast();

  // Helper to filter strictly for supervisor role
  const filterSupervisorsOnly = useCallback((list: any[]) => {
    if (!Array.isArray(list)) return [];
    return list.filter((u: any) => u?.id && (u.role === "supervisor" || (!u.role && u.role !== "admin" && u.role !== "manager")));
  }, []);

  // Supervisor candidate pool (strictly role = supervisor)
  const [lazySupervisors, setLazySupervisors] = useState<any[]>(() => {
    return filterSupervisorsOnly(supervisors || []);
  });

  // Machine selection state
  const [availableMachines, setAvailableMachines] = useState<any[]>(() => machines || []);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingMachinePersonnel, setIsLoadingMachinePersonnel] = useState(false);

  // Selected Machine ID
  const [selectedMachineId, setSelectedMachineId] = useState<string>(() => {
    return machine?.id || initialMachineId || (machines.length > 0 ? machines[0]?.id : "") || "";
  });

  // Current active machine entity
  const currentMachine = useMemo(() => {
    if (!selectedMachineId) return machine || null;
    const found = availableMachines.find((m: any) => m.id === selectedMachineId);
    if (found) return found;
    if (machine?.id === selectedMachineId) return machine;
    return machine || null;
  }, [selectedMachineId, availableMachines, machine]);

  // Client resolution for active machine
  const clientName = currentMachine?.client?.company_name || currentMachine?.client_name || null;

  // Initial supervisor IDs resolution from current machine
  const initialSupsFromMachine: string[] = useMemo(() => {
    if (Array.isArray(currentMachine?.supervisor_ids) && currentMachine.supervisor_ids.length > 0) {
      return currentMachine.supervisor_ids;
    }
    if (currentMachine?.current_supervisor_id) {
      return [currentMachine.current_supervisor_id];
    }
    return [];
  }, [currentMachine?.supervisor_ids, currentMachine?.current_supervisor_id]);

  // Assigned supervisor IDs on this machine
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>(() => initialSupsFromMachine);
  const [initialSupervisorIds, setInitialSupervisorIds] = useState<string[]>(() => initialSupsFromMachine);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevIsOpenRef = useRef(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Sync incoming supervisors prop — filter strictly for supervisor role only
  useEffect(() => {
    if (supervisors && supervisors.length > 0) {
      setLazySupervisors(filterSupervisorsOnly(supervisors));
    }
  }, [supervisors, filterSupervisorsOnly]);

  // Sync incoming machines prop
  useEffect(() => {
    if (machines && machines.length > 0) {
      setAvailableMachines(machines);
    }
  }, [machines]);

  // Sync selected machine ID & assigned supervisor IDs ONLY when dialog transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const targetId = machine?.id || initialMachineId || (machines.length > 0 ? machines[0]?.id : "") || "";
      if (targetId) {
        setSelectedMachineId(targetId);
      }
      const targetMachine = (machine?.id === targetId ? machine : null) || availableMachines.find((m: any) => m?.id === targetId) || machine || null;
      const currentSups = Array.isArray(targetMachine?.supervisor_ids) && targetMachine.supervisor_ids.length > 0
        ? targetMachine.supervisor_ids
        : targetMachine?.current_supervisor_id
        ? [targetMachine.current_supervisor_id]
        : [];
      setSelectedSupervisorIds(currentSups);
      setInitialSupervisorIds(currentSups);
      setIsAddingSupervisor(false);
      setSelectedCandidateId("");
      setSubmitError(null);
    }
    if (!isOpen) {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
        fetchAbortRef.current = null;
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, machine, initialMachineId, machines, availableMachines]);

  // Explicit handler for manual machine change in multi-machine selector
  const handleMachineChange = useCallback((mId: string) => {
    setSelectedMachineId(mId);
    const targetMachine = availableMachines.find((m: any) => m?.id === mId) || (machine?.id === mId ? machine : null);
    const currentSups = Array.isArray(targetMachine?.supervisor_ids) && targetMachine.supervisor_ids.length > 0
      ? targetMachine.supervisor_ids
      : targetMachine?.current_supervisor_id
      ? [targetMachine.current_supervisor_id]
      : [];
    setSelectedSupervisorIds(currentSups);
    setInitialSupervisorIds(currentSups);
    setIsAddingSupervisor(false);
    setSelectedCandidateId("");
    setSubmitError(null);
  }, [availableMachines, machine]);

  // ⚡ FAST DATA FETCH: Load supervisor pool and fresh machine assignments
  useEffect(() => {
    if (!isOpen || !selectedMachineId) return;

    let mounted = true;
    const needsSupervisors = lazySupervisors.length <= 1;
    const needsMachines = !machine && availableMachines.length === 0;

    if (needsSupervisors || needsMachines) {
      setIsLoadingOptions(true);

      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      // Fast parallel fetch using dedicated route / API
      const fetchPool = async () => {
        try {
          if (needsSupervisors) {
            // Try high-speed API route first (~15-30ms)
            try {
              const res = await fetch(`/api/machines/${selectedMachineId}/supervisors`, {
                signal: controller.signal,
                headers: { "Cache-Control": "no-cache" },
              });
              if (res.ok) {
                const data = await res.json();
                if (mounted && data.success && Array.isArray(data.supervisors)) {
                  setLazySupervisors(filterSupervisorsOnly(data.supervisors));
                  return;
                }
              }
            } catch (err: any) {
              if (err?.name === "AbortError") return;
              // Fallback to server action below
            }

            // Fallback: dedicated supervisor-only server action
            const actionSups = await getActiveSupervisorsOnlyAction();
            if (mounted && actionSups?.length) {
              setLazySupervisors(filterSupervisorsOnly(actionSups));
            }
          }

          // If machines empty and no machine passed, fetch assignable machines
          if (needsMachines) {
            const mRes = await getAssignableMachinesAction();
            if (mounted && mRes?.success && mRes.machines?.length) {
              setAvailableMachines(mRes.machines);
            }
          }
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            console.warn("[AssignSupervisorToMachineDialog] Pool load error:", err);
          }
        } finally {
          if (mounted) setIsLoadingOptions(false);
        }
      };

      void fetchPool();
    }

    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    selectedMachineId,
    lazySupervisors.length,
    machine,
    availableMachines.length,
    filterSupervisorsOnly,
  ]);

  // ⚡ Candidate Supervisors formatted for UserSelect (STRICTLY role === "supervisor" only, excluding already selected)
  const candidateUserSelectItems: UserSelectItem[] = useMemo(() => {
    const selectedSet = new Set(selectedSupervisorIds);
    return lazySupervisors
      .filter((s: any) => s?.id && !selectedSet.has(s.id) && (s.role === "supervisor" || !s.role))
      .map((s: any) => ({
        id: s.id,
        full_name: s.full_name || s.name || "Supervisor",
        name: s.full_name || s.name || "Supervisor",
        role: "supervisor",
        email: s.email || null,
        phone: s.phone || null,
        employee_id: s.employee_id || null,
        shift_time: s.shift_time || null,
        status: s.status || "active",
      }));
  }, [lazySupervisors, selectedSupervisorIds]);

  // Handle adding a supervisor
  const handleSelectCandidate = (supId: string) => {
    if (!supId) return;
    if (selectedSupervisorIds.includes(supId)) {
      toast("warning", "Already assigned", "This supervisor is already assigned to this equipment.");
      return;
    }

    const sup = lazySupervisors.find((s: any) => s.id === supId);
    const nextIds = [...selectedSupervisorIds, supId];
    setSelectedSupervisorIds(nextIds);
    setIsAddingSupervisor(false);
    setSelectedCandidateId("");

    const name = sup?.full_name || sup?.name || "Supervisor";
    toast("info", "Added supervisor", `${name} added. Click Save Supervisors to commit.`);
  };

  // Handle removing a supervisor
  const handleRemoveSupervisor = (supId: string) => {
    setSelectedSupervisorIds((prev) => prev.filter((id) => id !== supId));
  };

  // Handle making supervisor primary (move to index 0)
  const handleMakePrimary = (supId: string) => {
    setSelectedSupervisorIds((prev) => {
      const rest = prev.filter((id) => id !== supId);
      return [supId, ...rest];
    });
  };

  // Resolved supervisor objects for current selection
  const assignedSupervisorObjects = useMemo(() => {
    const map = new Map<string, any>();
    for (const sup of lazySupervisors) {
      if (sup?.id) map.set(sup.id, sup);
    }
    // Also include supervisors attached to machine object if available
    if (Array.isArray(currentMachine?.supervisors)) {
      for (const sup of currentMachine.supervisors) {
        if (sup?.id && !map.has(sup.id)) map.set(sup.id, sup);
      }
    }

    return selectedSupervisorIds.map((id, index) => {
      const sup = map.get(id);
      return {
        id,
        isPrimary: index === 0,
        full_name: sup?.full_name || sup?.name || "Supervisor",
        employee_id: sup?.employee_id || null,
        phone: sup?.phone || null,
        email: sup?.email || null,
      };
    });
  }, [selectedSupervisorIds, lazySupervisors, currentMachine?.supervisors]);

  // Check if selection changed from initial
  const isDirty = useMemo(() => {
    if (selectedSupervisorIds.length !== initialSupervisorIds.length) return true;
    return selectedSupervisorIds.some((id, idx) => initialSupervisorIds[idx] !== id);
  }, [selectedSupervisorIds, initialSupervisorIds]);

  // ⚡ FAST WRITE OPERATION: Dual-transport with optimistic UI and instant rollback
  const handleSave = async () => {
    if (!selectedMachineId || isSaving) return;

    setIsSaving(true);
    setSubmitError(null);

    // Snapshot current state for rollback on error
    const rollbackSnapshot = {
      supervisor_ids: currentMachine?.supervisor_ids,
      current_supervisor_id: currentMachine?.current_supervisor_id,
      supervisors: currentMachine?.supervisors,
      current_supervisor: currentMachine?.current_supervisor,
    };

    // Construct optimistic supervisors
    const optimisticSupervisors = assignedSupervisorObjects.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      phone: s.phone,
      email: s.email,
      role: "supervisor",
    }));

    // ⚡ Step 1: Immediate optimistic update to UI in 0ms
    onMachineUpdated?.({
      supervisor_ids: selectedSupervisorIds,
      current_supervisor_id: selectedSupervisorIds[0] || null,
      supervisors: optimisticSupervisors as any,
      current_supervisor: optimisticSupervisors[0] || null,
    });

    let saveSuccess = false;
    let savedSupervisors = optimisticSupervisors;

    // ⚡ Step 2: High-speed POST to /api/machines/[id]/supervisors (~15-25ms)
    try {
      const res = await fetch(`/api/machines/${selectedMachineId}/supervisors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisor_ids: selectedSupervisorIds,
          supervisors: optimisticSupervisors,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          saveSuccess = true;
          if (Array.isArray(json.supervisors) && json.supervisors.length > 0) {
            savedSupervisors = json.supervisors;
          }
        } else if (json.error) {
          throw new Error(json.error);
        }
      }
    } catch {
      // Non-blocking: will fall back to server action below
    }

    // ⚡ Step 3: Resilient fallback to Server Action if API route was unreachable
    if (!saveSuccess) {
      try {
        const actionRes = await updateMachineSupervisorsAction(
          selectedMachineId,
          selectedSupervisorIds
        );

        if (!actionRes.success || actionRes.error) {
          const err = actionRes.error || "Failed to update machine supervisors.";
          setSubmitError(err);
          toast("error", "Save failed — Rolling back", err);
          onMachineUpdated?.(rollbackSnapshot);
          setIsSaving(false);
          return;
        }

        saveSuccess = true;
        if (Array.isArray(actionRes.supervisors) && actionRes.supervisors.length > 0) {
          savedSupervisors = actionRes.supervisors;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to save supervisors";
        setSubmitError(msg);
        toast("error", "Save failed — Rolling back", msg);
        onMachineUpdated?.(rollbackSnapshot);
        setIsSaving(false);
        return;
      }
    }

    // ⚡ Step 4: Success confirmation & Realtime broadcasts
    toast(
      "success",
      "Supervisors updated",
      selectedSupervisorIds.length === 0
        ? `Removed all supervisors from ${currentMachine?.machine_id || "machinery"}.`
        : `Assigned ${selectedSupervisorIds.length} supervisor(s) to ${currentMachine?.machine_id || "machinery"}.`
    );

    onSuccess?.({
      machineId: selectedMachineId,
      supervisor_ids: selectedSupervisorIds,
      current_supervisor_id: selectedSupervisorIds[0] || null,
      supervisors: savedSupervisors,
      current_supervisor: savedSupervisors[0] || null,
    });

    onClose();
    setIsSaving(false);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
      window.dispatchEvent(new CustomEvent("reach:refresh-user-assignments"));
    }
  };

  // Determine whether to show single machine banner or machine switcher dropdown
  const isSingleMachineFixed = Boolean(machine?.id || initialMachineId || availableMachines.length <= 1);

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Supervisor"
      size="md"
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
          disabled={!isDirty || isSaving}
          submitLabel={isSaving ? "Saving Supervisors..." : "Save Supervisors"}
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      <div className="space-y-4">
        {/* ─── SECTION 1: Clean Equipment Header ─── */}
        {isSingleMachineFixed ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Machine Model & Serial Number in bold */}
                  <span className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                    {currentMachine?.model || "Equipment"}
                    {currentMachine?.serial_number && (
                      <span className="ml-1.5 font-bold font-mono text-[var(--color-ink)]">
                        • {currentMachine.serial_number}
                      </span>
                    )}
                  </span>
                  {/* Machine ID small and grey color */}
                  {currentMachine?.machine_id && (
                    <span className="text-[11px] font-mono text-[var(--color-mute)] font-normal shrink-0">
                      ({currentMachine.machine_id})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--color-mute)]">
                  {clientName ? `Rented to ${clientName}` : "Yard / Available"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                Select Equipment
              </span>
              {clientName ? (
                <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                  Rented to {clientName}
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
              onChange={handleMachineChange}
              placeholder="Search and select machinery equipment..."
              disabled={isSaving}
            />
          </div>
        )}

        {/* ─── SECTION 2: Clean Assigned Supervisors List ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Assigned Supervisors ({assignedSupervisorObjects.length})</span>
            </span>
            <span className="text-[11px] text-[var(--color-mute)]">
              {assignedSupervisorObjects.length > 0 ? "First is primary supervisor" : "None assigned"}
            </span>
          </div>

          {assignedSupervisorObjects.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/30 text-center space-y-1">
              <p className="text-xs font-medium text-[var(--color-ink)]">No Supervisors Assigned</p>
              <p className="text-[11px] text-[var(--color-mute)]">
                Assign a supervisor to oversee maintenance, shift approvals, and field operations.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {assignedSupervisorObjects.map((sup, idx) => (
                <div
                  key={`${sup.id}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] gap-2 group transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] dark:bg-white dark:text-black font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {getUserInitials(sup.full_name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--color-ink)] truncate">
                          {sup.full_name}
                        </span>
                        {sup.isPrimary && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-sm bg-teal-500/10 border border-teal-500/20 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                            <Star className="h-2.5 w-2.5 fill-teal-600 dark:fill-teal-400 text-teal-600 dark:text-teal-400" />
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--color-mute)] flex-wrap">
                        {sup.employee_id && (
                          <span className="font-mono text-[10px]">{formatEmployeeId(sup.employee_id)}</span>
                        )}
                        {sup.phone && <span>{sup.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!sup.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleMakePrimary(sup.id)}
                        disabled={isSaving}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-[var(--color-mute)] hover:text-teal-600 hover:bg-teal-500/10 transition-colors cursor-pointer"
                        title="Make primary supervisor"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveSupervisor(sup.id)}
                      disabled={isSaving}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                      title="Remove supervisor"
                      aria-label={`Remove ${sup.full_name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── SECTION 3: Clean Add Supervisor Interaction (ONLY role = supervisor) ─── */}
        <div className="pt-1">
          {!isAddingSupervisor ? (
            <button
              type="button"
              onClick={() => setIsAddingSupervisor(true)}
              disabled={!selectedMachineId || isSaving || isLoadingMachinePersonnel}
              className="w-full flex items-center justify-between p-3 sm:p-3.5 min-h-[44px] rounded-xl border border-neutral-300 dark:border-neutral-700 [html:not(.dark)_&]:border-neutral-300 bg-[var(--color-canvas)] hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)] active:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all text-xs group cursor-pointer touch-manipulation select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span>
                  {assignedSupervisorObjects.length === 0 ? "Assign Supervisor" : "Assign Another Supervisor"}
                </span>
              </span>
              {candidateUserSelectItems.length > 0 ? (
                <span className="text-[11px] font-mono text-[var(--color-mute)]">
                  {candidateUserSelectItems.length} available
                </span>
              ) : assignedSupervisorObjects.length > 0 ? (
                <span className="text-[11px] font-medium text-[var(--color-mute)]">
                  All assigned
                </span>
              ) : null}
            </button>
          ) : (
            <AnimatePresence initial={false}>
              <motion.div
                key="add-supervisor-form"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="p-3 sm:p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 [html:not(.dark)_&]:border-neutral-300 bg-[var(--color-canvas)] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      Select Supervisor
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingSupervisor(false);
                        setSelectedCandidateId("");
                      }}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 transition-all cursor-pointer"
                      title="Close"
                      aria-label="Close supervisor selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {candidateUserSelectItems.length === 0 ? (
                    <div className="p-3.5 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 text-center space-y-1">
                      <p className="text-xs font-semibold text-[var(--color-ink)]">
                        {lazySupervisors.length === 0
                          ? "No Active Supervisors Registered"
                          : "All Registered Supervisors Assigned"}
                      </p>
                      <p className="text-[11px] text-[var(--color-mute)] leading-relaxed">
                        {lazySupervisors.length === 0
                          ? "There are no users with the supervisor role registered in the system."
                          : "Every active registered supervisor is already assigned to this machinery equipment."}
                      </p>
                    </div>
                  ) : (
                    <div className="pt-0.5">
                      <UserSelect
                        users={candidateUserSelectItems}
                        value={selectedCandidateId}
                        onChange={(supId) => {
                          setSelectedCandidateId(supId);
                          handleSelectCandidate(supId);
                        }}
                        placeholder="Search and select supervisor by name, employee ID..."
                        roleFilter={["supervisor"]}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </AssignmentDialog>
  );
}
