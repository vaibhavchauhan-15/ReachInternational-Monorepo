"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  CalendarDays,
} from "lucide-react";
import { AssignmentDialog } from "./AssignmentDialog";
import { AssignmentSelectionSummary, type SelectedAssignmentSummaryItem } from "./AssignmentSelectionSummary";
import { AssignmentShiftPicker } from "./AssignmentShiftPicker";
import { AssignmentActions } from "./AssignmentActions";
import { MachineSelect } from "@/components/ui/MachineSelect";
import { UserSelect } from "@/components/ui/UserSelect";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
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
  getAssignmentDateKind,
  resolveAssignmentDate,
  getISTDateString,
  ASSIGNMENT_DATE_WINDOW_PAST_DAYS,
  ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS,
} from "@reachinternational/utils";
import { DEFAULT_CLIENT_SHIFTS } from "../operations/entry/ShiftInputs";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import {
  getMachineModalOptionsAction,
  updateMachinePersonnelAction,
  getMachinePersonnelFreshAction,
  getActiveOperatorsForUserAction,
  getActiveOperatorAssignmentsAction,
} from "@/app/actions/machines";
import { getAssignableMachinesAction } from "@/app/actions/assignments";
import { broadcastAssignmentChanged } from "@/lib/supabase/realtime-roster";
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
  /** Epoch-safe identity of the underlying assignment range covering the selected date */
  assignmentId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
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
  userId?: string;
  /**
   * When false the dialog is locked to TODAY and renders no date control at all.
   */
  allowDateSelection?: boolean;
  /**
   * Preferred assignment date when the dialog opens (YYYY-MM-DD, IST).
   * Clamped into the canonical window [today - 7 .. today + 1]; falls back to today when the
   * value is missing or outside the window. Used by /operations so editing a historical or
   * next-day roster row opens on the date the user is actually looking at.
   */
  initialAssignmentDate?: string | null;
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
  userId,
  allowDateSelection = true,
  initialAssignmentDate,
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

  // Track modal open transitions & explicit user machine selection
  const prevIsOpenRef = useRef(false);
  const userExplicitlySelectedMachineRef = useRef(false);
  const machineFetchAbortRef = useRef<AbortController | null>(null);

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
  const [clientShifts, setClientShifts] = useState<ClientShiftCode[]>(() => {
    if (clientId) {
      const cached = getCachedClientShifts(clientId);
      if (cached && cached.length > 0) return cached;
    }
    return DEFAULT_CLIENT_SHIFTS;
  });

  // Immediate client shift schedule resolution from local cache when machine/client changes
  useEffect(() => {
    if (!clientId) {
      if (currentMachine && !currentMachine.client_id && !currentMachine.client?.id) {
        setClientShifts(DEFAULT_CLIENT_SHIFTS);
      }
      return;
    }
    const cached = getCachedClientShifts(clientId);
    if (cached && cached.length > 0) {
      setClientShifts(cached);
    }
  }, [clientId, currentMachine]);

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

  // Date-based assignment target — today - 7 days .. today + 1 day (IST), exactly 9 dates.
  // The preferred date (caller supplied) is clamped into the canonical window; today by default.
  const [assignmentDate, setAssignmentDate] = useState<string>(() =>
    resolveAssignmentDate(initialAssignmentDate)
  );
  const todayIst = useMemo(() => getISTDateString(), []);
  const isTodayAssignment = assignmentDate === todayIst;
  const dateKind = useMemo(() => getAssignmentDateKind(assignmentDate, todayIst), [assignmentDate, todayIst]);
  const isPastAssignment = dateKind === "past";
  const isTomorrowPlan = dateKind === "tomorrow";

  /**
   * Callers (e.g. the /operations shift monitor) can display a day older than the editable
   * window. Such a date is clamped to today when the dialog opens — surface that instead of
   * silently editing a different day's roster.
   */
  const clampedSeedDate = useMemo(() => {
    const raw = String(initialAssignmentDate || "").trim().split("T")[0];
    if (!allowDateSelection || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const applied = resolveAssignmentDate(raw);
    return applied === raw ? null : { viewed: raw, applied };
  }, [allowDateSelection, initialAssignmentDate]);

  // Auto-align selectedShiftCode to first valid open shift code whenever clientShifts or roster change
  useEffect(() => {
    if (!clientShifts || clientShifts.length === 0) return;
    const takenCodes = new Set(roster.map((r) => r.shiftCode.trim().toUpperCase()));
    const isCurrentValid = clientShifts.some(
      (s) => s.code.trim().toUpperCase() === selectedShiftCode.trim().toUpperCase() && !takenCodes.has(s.code.trim().toUpperCase())
    );
    if (!isCurrentValid) {
      const firstAvailable = clientShifts.find((s) => !takenCodes.has(s.code.trim().toUpperCase())) || clientShifts[0];
      if (firstAvailable) {
        setSelectedShiftCode(firstAvailable.code);
      }
    }
  }, [clientShifts, roster, selectedShiftCode]);

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

  // Set initial machine ID ONLY when dialog transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      userExplicitlySelectedMachineRef.current = false;
      setAssignmentDate(resolveAssignmentDate(initialAssignmentDate));
      const targetId = machine?.id || initialMachineId || (machines.length > 0 ? machines[0]?.id : "") || "";
      if (targetId) setSelectedMachineId(targetId);
    }
    if (!isOpen) {
      userExplicitlySelectedMachineRef.current = false;
      if (machineFetchAbortRef.current) {
        machineFetchAbortRef.current.abort();
        machineFetchAbortRef.current = null;
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, machine?.id, initialMachineId, initialAssignmentDate]);

  // Load available machines and modal options on open if empty
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingOptions(true);
    setSubmitError(null);

    const promises: Promise<any>[] = [];

    // 1. Fetch options only if operator pool is empty and no machine is currently selected
    // (When selectedMachineId is present, /api/machines/[id]/operators fetches operators and other_assignments in a single roundtrip)
    if (lazyOperators.length === 0 && !selectedMachineId) {
      promises.push(
        getActiveOperatorsForUserAction(userId, userRole).then((ops) => {
          if (!mounted) return;
          if (ops?.length) setLazyOperators(ops);
        })
      );
      promises.push(
        getActiveOperatorAssignmentsAction(assignmentDate).then((res) => {
          if (!mounted) return;
          if (res.success && res.data?.length) setOtherAssignments(res.data);
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
            // Only set first machine if user has not explicitly chosen one and no machine is selected
            if (!userExplicitlySelectedMachineRef.current) {
              setSelectedMachineId((prev) => prev || res.machines[0]?.id || "");
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
  }, [isOpen, lazyOperators.length, availableMachines.length, assignmentDate]);

  // When selectedMachineId / assignmentDate changes, load fresh personnel for that date via fast atomic route
  useEffect(() => {
    if (!isOpen || !selectedMachineId) {
      setRoster([]);
      return;
    }

    let mounted = true;
    setIsLoadingMachinePersonnel(true);
    setIsAddingToShift(false);
    setSelectedCandidateId("");
    setSubmitError(null);

    // Abort previous in-flight request if user rapidly switches equipment or date
    if (machineFetchAbortRef.current) {
      machineFetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    machineFetchAbortRef.current = controller;

    // ⚡ High-speed atomic API fetch (< 25ms execution), date-scoped roster
    const params = new URLSearchParams();
    if (clientId) params.set("client_id", clientId);
    if (assignmentDate) params.set("date", assignmentDate);
    const query = params.toString();
    const targetUrl = `/api/machines/${selectedMachineId}/operators${query ? `?${query}` : ""}`;

    fetch(targetUrl, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!mounted || !data.success) return;

        const loadedRoster: OperatorRosterItem[] = data.roster || [];
        setRoster(loadedRoster);
        setInitialSnapshot({
          roster: loadedRoster,
          supervisorIds: data.machine?.supervisor_ids || [],
        });

        if (Array.isArray(data.client_shifts) && data.client_shifts.length > 0) {
          setClientShifts(data.client_shifts);
          const effectiveCId = data.machine?.client_id || clientId;
          if (effectiveCId) {
            setCachedClientShifts(effectiveCId, data.client_shifts);
          }
        } else if (!data.machine?.client_id && !clientId) {
          setClientShifts(DEFAULT_CLIENT_SHIFTS);
        }

        if (Array.isArray(data.operators) && data.operators.length > 0) {
          setLazyOperators(data.operators);
        }

        if (Array.isArray(data.other_assignments)) {
          setOtherAssignments(data.other_assignments);
        }

        // Set default shift to first open code
        const takenCodes = new Set(loadedRoster.map((r) => r.shiftCode.trim().toUpperCase()));
        const shiftPool = data.client_shifts?.length > 0 ? data.client_shifts : clientShifts;
        const availableShift = shiftPool.find(
          (s: any) => !takenCodes.has(s.code.trim().toUpperCase())
        );
        if (availableShift) {
          setSelectedShiftCode(availableShift.code);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.warn("[AssignOperatorToMachineDialog] Fast route fallback:", err);

        // Resilient Fallback to Server Action
        getMachinePersonnelFreshAction(selectedMachineId)
          .then((res) => {
            if (!mounted || !res.success || !res.data) return;
            const fresh = res.data;
            const sups = fresh.supervisor_ids || (currentMachine?.supervisor_ids as string[]) || [];
            setYardSupervisorIds(sups);

            const loadedRoster: OperatorRosterItem[] = (fresh.operators || []).map((o: any, idx: number) => ({
              operatorId: o.id,
              operatorName: o.full_name || "Operator",
              employeeId: o.employee_id || null,
              phone: o.phone || null,
              email: o.email || null,
              shiftCode: o.shift_code || o.shiftCode || `S${(idx % 3) + 1}`,
              shiftName: o.shift_name || null,
              shiftStartTime: o.shift_start_time || null,
              shiftEndTime: o.shift_end_time || null,
              notes: "Assigned via personnel dialog",
            }));

            setRoster(loadedRoster);
            setInitialSnapshot({ roster: loadedRoster, supervisorIds: sups });

            if (fresh.client_shifts && fresh.client_shifts.length > 0) {
              setClientShifts(fresh.client_shifts);
            }
          })
          .catch((fErr) => console.error("[AssignOperatorToMachineDialog] load machine error:", fErr));
      })
      .finally(() => {
        if (mounted) setIsLoadingMachinePersonnel(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isOpen, selectedMachineId, assignmentDate]);

  // Map of taken shift codes on this machine
  const takenShiftCodes = useMemo(() => {
    return new Set(roster.map((r) => r.shiftCode.trim().toUpperCase()));
  }, [roster]);

  // Eligible Candidate Operators formatted for UserSelect
  // Allows the same operator to be assigned to up to 3 shifts on each machine
  // (fleet-wide operator capacity limit is 3 active shifts or 24h total)
  const candidateUserSelectItems = useMemo(() => {
    // Enforce supervisor RBAC: supervisors only see operators under their supervision
    const filteredPool = isSupervisorRole && userId
      ? lazyOperators.filter((o) => {
          if (o.role && o.role !== "operator") return false;
          if (o.supervisor_id && o.supervisor_id !== userId) return false;
          return true;
        })
      : lazyOperators;

    return filteredPool
      .map((o) => {
        const shiftsOnThisMachine = roster.filter((r) => r.operatorId === o.id).length;
        const other = otherAssignments.filter(
          (a) => a.operatorId === o.id && a.machineId !== selectedMachineId
        );
        const shiftsOnOtherMachines = other.length;
        const totalShifts = shiftsOnThisMachine + shiftsOnOtherMachines;
        const isMaxTotal = totalShifts >= 3;
        const isMaxThisMachine = shiftsOnThisMachine >= 3;
        const isDisabled = isMaxTotal || isMaxThisMachine;

        let badge: string | null = null;
        let badgeVariant: "default" | "info" | "warning" | "success" | "neutral" = "default";
        let badgeTitle: string | null = null;
        let disabledReason: string | null = null;

        if (isMaxTotal) {
          badge = "3/3 Max";
          badgeVariant = "warning";
          disabledReason = "Max 3 shifts (24h) reached";
          badgeTitle = "Max 3 shifts (24h) reached fleet-wide";
        } else if (shiftsOnThisMachine > 0) {
          badge = `${shiftsOnThisMachine}/3`;
          badgeVariant = "info";
          badgeTitle = `${shiftsOnThisMachine}/3 shifts assigned on this machine`;
        } else if (shiftsOnOtherMachines > 0) {
          badge = `${shiftsOnOtherMachines}/3 other`;
          badgeVariant = "warning";
          badgeTitle = `${shiftsOnOtherMachines}/3 shifts assigned on other machines`;
        }

        // Compute descriptive already assigned shift names for this operator
        const myThisMachineShifts = roster.filter((r) => r.operatorId === o.id);
        const assignedShiftDescriptions: string[] = [
          ...myThisMachineShifts.map((r) => {
            const shiftObj = clientShifts.find((s) => s.code.toUpperCase() === r.shiftCode.toUpperCase());
            const shiftName = r.shiftName || shiftObj?.name || `Shift ${r.shiftCode}`;
            return `${shiftName} (This M/C)`;
          }),
          ...other.map((a) => {
            const shiftName = a.shiftName || (a.shiftCode ? `Shift ${a.shiftCode}` : "Active Shift");
            return a.machineCode ? `${shiftName} (${a.machineCode})` : shiftName;
          }),
        ];

        const subtitle = assignedShiftDescriptions.length > 0
          ? `Assigned: ${assignedShiftDescriptions.join(" • ")}`
          : "Available (No active shifts)";
        const assignedShift = assignedShiftDescriptions.length > 0
          ? assignedShiftDescriptions.join(", ")
          : null;

        return {
          id: o.id,
          full_name: o.full_name || o.name || "Operator",
          name: o.full_name || o.name || "Operator",
          employee_id: o.employee_id || null,
          phone: o.phone || null,
          email: o.email || null,
          role: "operator",
          subtitle,
          assigned_shift: assignedShift,
          badge,
          badgeVariant,
          badgeTitle,
          disabled: isDisabled,
          disabledReason,
        };
      })
      .sort((a, b) => {
        // Active/eligible operators first, disabled at bottom
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });
  }, [lazyOperators, roster, otherAssignments, selectedMachineId, clientShifts, isSupervisorRole, userId]);

  // Shift conflict checking on candidate selection
  const shiftConflictNotice = useMemo(() => {
    const notices: Record<string, string> = {};
    const selectedOp = lazyOperators.find((o) => o.id === selectedCandidateId);
    if (!selectedOp) return notices;

    const opRoster = roster.filter((r) => r.operatorId === selectedOp.id);
    const opOther = otherAssignments.filter(
      (a) => a.operatorId === selectedOp.id && a.machineId !== selectedMachineId
    );

    clientShifts.forEach((shift) => {
      // 1. Is shift taken on this machine?
      if (takenShiftCodes.has(shift.code.trim().toUpperCase())) {
        notices[shift.code] = "Shift already assigned on this machine";
        return;
      }

      const targetRanges = shiftToMinuteRanges(shift.start_time, shift.end_time);

      // 2. Does shift collide with another shift on THIS machine for this operator?
      for (const here of opRoster) {
        const hereRanges = shiftToMinuteRanges(here.shiftStartTime, here.shiftEndTime);
        if (doRangesOverlap(targetRanges, hereRanges)) {
          notices[shift.code] = `Overlaps with Shift ${here.shiftCode} on this machine`;
          return;
        }
      }

      // 3. Does shift collide with another machine shift for this operator?
      for (const other of opOther) {
        const otherRanges = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
        if (doRangesOverlap(targetRanges, otherRanges)) {
          notices[shift.code] = `Conflicts with ${other.machineCode || "another machine"}`;
          break;
        }
      }
    });

    return notices;
  }, [selectedCandidateId, lazyOperators, roster, otherAssignments, clientShifts, takenShiftCodes, selectedMachineId]);

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

    // Check operator total shifts cap across platform (max 3 shifts)
    const opHere = roster.filter((r) => r.operatorId === op.id);
    const opOther = otherAssignments.filter(
      (a) => a.operatorId === op.id && a.machineId !== selectedMachineId
    );
    if (opHere.length >= 3) {
      toast("warning", "Shift limit reached", `${op.full_name || "Operator"} is already assigned to all 3 shifts on this machine.`);
      return;
    }
    if (opHere.length + opOther.length >= 3) {
      toast("warning", "Shift limit reached", `${op.full_name || "Operator"} is already assigned to 3 active shifts (24h maximum).`);
      return;
    }

    const shift = clientShifts.find(
      (s) => s.code.trim().toUpperCase() === selectedShiftCode.trim().toUpperCase()
    );
    const targetRanges = shiftToMinuteRanges(shift?.start_time, shift?.end_time);

    // Overlap check with operator's existing shifts on THIS machine
    for (const here of opHere) {
      const hereRanges = shiftToMinuteRanges(here.shiftStartTime, here.shiftEndTime);
      if (doRangesOverlap(targetRanges, hereRanges)) {
        toast("error", "Shift Conflict", `Shift ${selectedShiftCode} overlaps with operator's Shift ${here.shiftCode} on this machine.`);
        return;
      }
    }

    // Cross-machine interval collision check
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
        employeeId: r.employeeId ? formatEmployeeId(r.employeeId) : formatEmployeeId(r.operatorId),
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

    // Apply immediate optimistic state to UI (operators only). Only TODAY's edits may
    // touch the live machine mirror — past back-fills and tomorrow plans never do.
    if (isTodayAssignment) {
      onMachineUpdated?.({
        operator_ids: uniqueOpIds,
        current_operator_id: uniqueOpIds[0] || null,
        operators: optimisticOperators as any,
      });
    }

    try {
      // Machine activation is a live structural change — never triggered by past/tomorrow edits
      const isNeedsActivation = isTodayAssignment && Boolean(
        currentMachine?.health_status === "breakdown" ||
        currentMachine?.health_status === "under_maintenance" ||
        currentMachine?.status === "under_maintenance"
      );

      const payload = {
        activateMachine: isNeedsActivation,
        assignmentDate,
        operators: roster.map((item) => ({
          operatorId: item.operatorId,
          shiftCode: item.shiftCode,
          shiftStartTime: item.shiftStartTime,
          shiftEndTime: item.shiftEndTime,
          notes: item.notes || "Assigned via personnel dialog",
        })),
      };

      // ⚡ High-speed atomic POST execution (< 25ms)
      let saveSuccess = false;
      let saveError: string | null = null;
      let resPayload: any = null;

      try {
        const postRes = await fetch(`/api/machines/${selectedMachineId}/operators`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const postData = await postRes.json();
        if (postRes.ok && postData.success) {
          saveSuccess = true;
          resPayload = postData.res || postData;
        } else {
          saveError = postData.error || "Failed to update operator roster.";
        }
      } catch {
        // Fall back to Server Action
      }

      // Resilient fallback to Server Action
      if (!saveSuccess) {
        const res = await updateMachinePersonnelAction(selectedMachineId, {
          supervisorIds: undefined,
          activateMachine: isNeedsActivation,
          assignmentDate,
          operators: payload.operators,
        });

        if (!res.success || res.error) {
          const err = res.error || saveError || "Failed to update machine personnel.";
          setSubmitError(err);
          toast("error", "Save failed — Rolling back", err);
          if (isTodayAssignment) onMachineUpdated?.(rollbackSnapshot);
          return;
        }
        resPayload = res;
      }

      toast(
        "success",
        isTodayAssignment ? "Assignments saved" : isPastAssignment ? "Past roster updated" : "Tomorrow's roster planned",
        isTodayAssignment
          ? `Updated 24h shift roster for ${currentMachine?.machine_id || "machinery"}.`
          : isPastAssignment
          ? `Corrected the 24h shift roster for ${currentMachine?.machine_id || "machinery"} on ${assignmentDate}. Today's and tomorrow's assignments are untouched.`
          : `Saved tomorrow's 24h shift roster for ${currentMachine?.machine_id || "machinery"} on ${assignmentDate}. Today's assignments stay untouched.`
      );
      onSuccess?.({
        machineId: selectedMachineId,
        assignmentDate,
        operators: optimisticOperators,
        res: resPayload,
      });

      // Broadcast assignment changes for realtime roster sync across all connected sessions
      if (typeof window !== "undefined" && selectedMachineId) {
        const broadcastPromises = optimisticOperators.map((op) =>
          broadcastAssignmentChanged({
            action: "updated",
            machineId: selectedMachineId,
            operatorId: op.id,
            shiftCode: op.shift_code,
          })
        );
        Promise.all(broadcastPromises).catch(() => {
          // Ignore broadcast failures — non-critical
        });
      }

      onClose();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
        window.dispatchEvent(new CustomEvent("reach:refresh-user-assignments"));
        window.dispatchEvent(
          new CustomEvent("reach:assignment-date-changed", { detail: { machineId: selectedMachineId, assignmentDate } })
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save assignments";
      setSubmitError(msg);
      toast("error", "Save failed — Rolling back", msg);
      if (isTodayAssignment) onMachineUpdated?.(rollbackSnapshot);
    } finally {
      setIsSaving(false);
    }
  };

  // Determine whether to show single machine banner or machine switcher dropdown
  const isSingleMachineFixed = Boolean(machine?.id || initialMachineId || availableMachines.length <= 1);

  return (
    <AssignmentDialog
      open={isOpen}
      onClose={onClose}
      title="Assign Operator to Shift"
      size="lg"
      footer={
        <AssignmentActions
          onCancel={onClose}
          onSubmit={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
          disabled={!isDirty || isSaving || isLoadingMachinePersonnel}
          submitLabel={
            isSaving
              ? "Saving Roster..."
              : isTodayAssignment
              ? "Save Shift Roster"
              : `Save Roster for ${assignmentDate}`
          }
          cancelLabel="Cancel"
          errorMessage={submitError}
        />
      }
    >
      <div className="space-y-3.5">
        {/* SECTION 1: Clean Equipment Header / Machine Selector Dropdown */}
        {isSingleMachineFixed ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-hairline)] px-3 py-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-hairline-soft-surface)]/60 flex items-center justify-center shrink-0">
              <Truck className="h-4 w-4 text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Machine Model & Serial Number in bold */}
                <span className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                  {currentMachine?.model || "Equipment"}
                </span>
                {currentMachine?.serial_number && (
                  <span className="font-mono text-[11px] font-semibold text-[var(--color-mute)]">
                    • {currentMachine.serial_number}
                  </span>
                )}
                {currentMachine?.machine_id && (
                  <span className="text-[11px] font-mono text-[var(--color-mute)] shrink-0">
                    ({currentMachine.machine_id})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[var(--color-mute)] truncate block">
                {clientName ? `Rented to ${clientName}` : "Yard / Available"}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                Equipment
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
                userExplicitlySelectedMachineRef.current = true;
                setSelectedMachineId(machineId);
              }}
              placeholder="Search and select machinery equipment..."
              disabled={isSaving}
            />
          </div>
        )}

        {/* SECTION 2: Assignment Date — 7 past days + today + tomorrow (IST).
            When the caller disallows date selection the dialog is locked to TODAY and no
            date control is rendered at all. */}
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

            {clampedSeedDate && assignmentDate === clampedSeedDate.applied && (
              <p className="w-full text-[10.5px] font-medium leading-snug text-amber-600 dark:text-amber-400">
                {clampedSeedDate.viewed} is outside the editable window — this roster edit applies to {clampedSeedDate.applied}.
              </p>
            )}

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

        {/* SECTION 3: Active 24h Coverage Roster (Displays already assigned operators) */}
        <AssignmentSelectionSummary
          items={summaryItems}
          onRemoveItem={handleRemoveFromRoster}
          maxCapacity={3}
          capacityLabel={
            isTodayAssignment
              ? "24h Operator Shift Coverage"
              : `24h Operator Shift Coverage • ${assignmentDate}`
          }
          emptyTitle={
            isPastAssignment
              ? "No Operators Assigned on that Date"
              : isTomorrowPlan
              ? "No Operators Planned for Tomorrow"
              : "No Operators Assigned to this Machine"
          }
          emptyDescription="Click 'Assign Operator to Shift' below to assign an operator to an open shift slot."
          disabled={isSaving}
          isLoading={isLoadingMachinePersonnel}
        />

        {/* SECTION 4: Assign Operator to Shift Interaction */}
        {roster.length < 3 && (
          <div className="pt-0.5">
            {!isAddingToShift ? (
              <button
                type="button"
                onClick={() => setIsAddingToShift(true)}
                disabled={!selectedMachineId || isSaving || isLoadingMachinePersonnel}
                className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-primary)] hover:bg-[var(--color-hairline-soft-surface)]/40 active:scale-[0.995] transition-all text-xs group cursor-pointer touch-manipulation select-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span>Assign Operator to Shift</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--color-mute)]">
                  {3 - roster.length} slot{3 - roster.length === 1 ? "" : "s"} open
                </span>
              </button>
            ) : (
              <AnimatePresence initial={false}>
                <motion.div
                  key="add-operator-form"
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                        Assign Operator to Shift
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingToShift(false);
                          setSelectedCandidateId("");
                        }}
                        className="h-8 w-8 sm:h-7 sm:w-7 flex items-center justify-center rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 transition-all cursor-pointer touch-manipulation"
                        title="Close"
                      >
                        <X className="h-4 w-4" />
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
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </AssignmentDialog>
  );
}
