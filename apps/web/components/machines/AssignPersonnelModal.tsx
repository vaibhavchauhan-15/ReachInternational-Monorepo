"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  Button,
  useToast,
  MultiUserSelect,
  MachineSelect,
  UserSelect,
} from "@/components/ui";
import {
  Clock,
  Moon,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Users,
  Search,
  ChevronDown,
  Wrench,
  Shield,
  Truck,
  Building2,
} from "lucide-react";
import { AnimatedAlertCircle, AnimatedLoader } from "@/components/ui/animated-icons";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User, UserRole, ClientShiftCode } from "@reachinternational/types";
import { isManagerOrAbove } from "@reachinternational/permissions";
import { formatTo12Hour, parseTimeToMinutes } from "@reachinternational/utils";
import { DEFAULT_CLIENT_SHIFTS } from "../operations/entry/ShiftInputs";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import {
  getMachineModalOptionsAction,
  getActiveOperatorAssignmentsAction,
  updateMachinePersonnelAction,
  getMachinePersonnelFreshAction,
} from "@/app/actions/machines";
import {
  getCachedClientShifts,
  setCachedClientShifts,
  CLIENT_SHIFTS_INVALIDATED_EVENT,
} from "@/lib/cache/client-shifts-cache";
import {
  getOperatorActiveAssignmentsAction,
  updateOperatorMachineAssignmentsAction,
  getAssignableMachinesAction,
} from "@/app/actions/assignments";
import type { ActiveOperatorOtherAssignment } from "./OperatorShiftRosterEditor";

function shiftToMinuteRanges(startStr?: string | null, endStr?: string | null): Array<[number, number]> {
  if (!startStr || !endStr) return [];
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (start === null || end === null || start === end) return [];
  if (start < end) {
    return [[start, end]];
  }
  return [[start, 1440], [0, end]];
}

function doRangesOverlap(ranges1: Array<[number, number]>, ranges2: Array<[number, number]>): boolean {
  for (const [s1, e1] of ranges1) {
    for (const [s2, e2] of ranges2) {
      if (Math.max(s1, s2) < Math.min(e1, e2)) {
        return true;
      }
    }
  }
  return false;
}

export interface OperatorAssignmentItem {
  operatorId: string;
  operatorName: string;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
}

export interface MachineAssignmentItem {
  machineId: string;
  machineCode: string;
  machineName?: string;
  model?: string;
  serialNumber?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
  clientShifts?: ClientShiftCode[];
}

export interface AssignPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If machine is fixed:
  machine?: MachineWithEngineer | any | null;
  machineId?: string;
  // If operator is fixed:
  operator?: User | null;
  operatorId?: string;
  // Lists for dropdown / selection:
  supervisors?: any[];
  operators?: any[];
  machines?: any[];
  initialMachineId?: string;
  initialOperatorId?: string;
  userRole?: UserRole | string;
  onSuccess?: (result?: any) => void;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

export function AssignPersonnelModal({
  isOpen,
  onClose,
  machine: propMachine,
  machineId: propMachineId,
  operator: propOperator,
  operatorId: propOperatorId,
  supervisors = [],
  operators = [],
  machines = [],
  initialMachineId,
  initialOperatorId,
  userRole = "admin",
  onSuccess,
  onMachineUpdated,
}: AssignPersonnelModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const isSupervisorRole = userRole === "supervisor";
  const canEditSupervisor = (!userRole || isManagerOrAbove(userRole as any)) && !isSupervisorRole;

  // Determine fixed contexts
  const hasFixedMachine = Boolean(propMachine || propMachineId);
  const hasFixedOperator = Boolean(propOperator || propOperatorId);

  // If neither is fixed, allow toggling between "machine" and "operator" mode
  const [activeTabMode, setActiveTabMode] = useState<"machine" | "operator">(() => {
    if (hasFixedOperator && !hasFixedMachine) return "operator";
    if (initialOperatorId && !initialMachineId) return "operator";
    return "machine";
  });

  useEffect(() => {
    if (hasFixedOperator && !hasFixedMachine) {
      setActiveTabMode("operator");
    } else if (hasFixedMachine) {
      setActiveTabMode("machine");
    }
  }, [hasFixedOperator, hasFixedMachine]);

  // ═══════════════════════════════════════════════════════════════════
  // 1. DATA POOLS (Machines, Operators, Supervisors, Active Conflicts)
  // ═══════════════════════════════════════════════════════════════════
  const [lazySupervisors, setLazySupervisors] = useState<any[]>(() => {
    const list: any[] = [...(supervisors || [])];
    const initialSups = [
      ...(Array.isArray(propMachine?.supervisors) ? propMachine.supervisors : []),
      propMachine?.current_supervisor,
    ].filter(Boolean);
    initialSups.forEach((s: any) => {
      if (s && s.id && !list.some((existing) => existing.id === s.id)) {
        list.push(s);
      }
    });
    return list;
  });
  const [lazyOperators, setLazyOperators] = useState<any[]>(() => operators || []);
  const [lazyMachines, setLazyMachines] = useState<any[]>(() => machines || []);
  const [otherAssignments, setOtherAssignments] = useState<ActiveOperatorOtherAssignment[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  useEffect(() => {
    if (supervisors && supervisors.length > 0) {
      setLazySupervisors((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        supervisors.forEach((s) => s && s.id && map.set(s.id, s));
        return Array.from(map.values());
      });
    }
  }, [supervisors]);

  useEffect(() => {
    if (operators && operators.length > 0) setLazyOperators(operators);
  }, [operators]);

  useEffect(() => {
    if (machines && machines.length > 0) setLazyMachines(machines);
  }, [machines]);

  // Load modal options and active assignments when open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingOptions(true);

    const promises: Promise<any>[] = [];

    if (lazySupervisors.length === 0 || lazyOperators.length === 0 || otherAssignments.length === 0) {
      promises.push(
        getMachineModalOptionsAction().then((data) => {
          if (!isMounted) return;
          if (data.supervisors && data.supervisors.length > 0) {
            setLazySupervisors((prev) => {
              const map = new Map(prev.map((s) => [s.id, s]));
              data.supervisors.forEach((s) => s && s.id && map.set(s.id, s));
              return Array.from(map.values());
            });
          }
          if (data.operators && data.operators.length > 0) setLazyOperators(data.operators);
          if (data.activeAssignments && data.activeAssignments.length > 0) {
            setOtherAssignments(data.activeAssignments);
          }
        })
      );
    }

    if (lazyMachines.length === 0) {
      promises.push(
        getAssignableMachinesAction().then((res) => {
          if (!isMounted) return;
          if (res.success && res.machines) {
            setLazyMachines(res.machines);
          }
        })
      );
    }

    Promise.all(promises)
      .catch((err) => console.error("Error loading personnel options", err))
      .finally(() => {
        if (isMounted) setIsLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lazySupervisors.length, lazyOperators.length, lazyMachines.length, otherAssignments.length]);

  // ═══════════════════════════════════════════════════════════════════
  // 2. STATE FOR MACHINE-CENTRIC ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════
  const selectedMachineId = propMachine?.id || propMachineId || initialMachineId || (lazyMachines[0]?.id || "");
  const [currentMachineId, setCurrentMachineId] = useState<string>(selectedMachineId);

  useEffect(() => {
    if (propMachine?.id) setCurrentMachineId(propMachine.id);
    else if (propMachineId) setCurrentMachineId(propMachineId);
    else if (initialMachineId) setCurrentMachineId(initialMachineId);
    else if (!currentMachineId && lazyMachines.length > 0) setCurrentMachineId(lazyMachines[0].id);
  }, [propMachine, propMachineId, initialMachineId, lazyMachines, currentMachineId]);

  const activeMachine = useMemo(() => {
    if (propMachine && propMachine.id === currentMachineId) return propMachine;
    return lazyMachines.find((m) => m.id === currentMachineId) || propMachine || null;
  }, [propMachine, currentMachineId, lazyMachines]);

  const machineSelectItems = useMemo(() => {
    return lazyMachines.map((m) => ({
      ...m,
      id: m.id,
      machine_code: m.machine_id || m.machine_code,
      machine_name: m.model || m.machine_name,
      model: m.model,
      serial_number: m.serial_number,
      city: m.client_name,
    }));
  }, [lazyMachines]);

  // Client shifts for active machine
  const initialClientShifts = useMemo((): ClientShiftCode[] => {
    const rawShifts = propMachine?.client_shifts;
    if (Array.isArray(rawShifts) && rawShifts.length > 0) {
      return rawShifts.map((s: any) => ({
        ...s,
        raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
        raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
        start_time: formatTo12Hour(s.start_time) || s.start_time,
        end_time: formatTo12Hour(s.end_time) || s.end_time,
      }));
    }
    const cId = propMachine?.client_id || propMachine?.client?.id;
    if (cId) {
      const cached = getCachedClientShifts(cId);
      if (cached && cached.length > 0) return cached;
    }
    return DEFAULT_CLIENT_SHIFTS;
  }, [propMachine]);

  const [machineClientShifts, setMachineClientShifts] = useState<ClientShiftCode[]>(initialClientShifts);
  const clientId = activeMachine?.client_id || activeMachine?.client?.id || propMachine?.client_id || propMachine?.client?.id;

  useEffect(() => {
    if (Array.isArray(activeMachine?.client_shifts) && activeMachine.client_shifts.length > 0) {
      const formatted: ClientShiftCode[] = activeMachine.client_shifts.map((s: any) => ({
        ...s,
        raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
        raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
        start_time: formatTo12Hour(s.start_time) || s.start_time,
        end_time: formatTo12Hour(s.end_time) || s.end_time,
      }));
      if (clientId) setCachedClientShifts(clientId, formatted);
      setMachineClientShifts(formatted);
      return;
    }

    if (!isOpen || !clientId) {
      setMachineClientShifts(DEFAULT_CLIENT_SHIFTS);
      return;
    }

    const cached = getCachedClientShifts(clientId);
    if (cached && cached.length > 0) {
      setMachineClientShifts(cached);
      return;
    }

    let active = true;
    getClientShiftCodesAction(clientId)
      .then((res) => {
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
          setCachedClientShifts(clientId, finalShifts);
          setMachineClientShifts(finalShifts);
        } else {
          setMachineClientShifts(DEFAULT_CLIENT_SHIFTS);
        }
      })
      .catch(() => {
        if (active) setMachineClientShifts(DEFAULT_CLIENT_SHIFTS);
      });

    return () => {
      active = false;
    };
  }, [isOpen, clientId, activeMachine?.client_shifts]);

  // Synchronize shifts dynamically when client shift codes are created or renamed
  useEffect(() => {
    if (!isOpen || !clientId) return;
    const handleShiftInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ clientId?: string | null }>;
      if (!customEvent.detail?.clientId || customEvent.detail.clientId === clientId) {
        getClientShiftCodesAction(clientId).then((res) => {
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
            setCachedClientShifts(clientId, finalShifts);
            setMachineClientShifts(finalShifts);
          }
        });
      }
    };
    window.addEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleShiftInvalidation);
    return () => {
      window.removeEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleShiftInvalidation);
    };
  }, [isOpen, clientId]);

  // Supervisors state for active machine
  const [machineSupervisorIds, setMachineSupervisorIds] = useState<string[]>([]);
  // Assigned operators for active machine
  const [machineOperators, setMachineOperators] = useState<OperatorAssignmentItem[]>([]);
  const [initialMachineOperators, setInitialMachineOperators] = useState<OperatorAssignmentItem[]>([]);
  const [initialSupervisorIds, setInitialSupervisorIds] = useState<string[]>([]);

  // Hydrate machine operators and supervisors
  useEffect(() => {
    if (!isOpen || !activeMachine) return;

    // Supervisors
    const sIds = Array.isArray(activeMachine.supervisor_ids)
      ? activeMachine.supervisor_ids
      : activeMachine.current_supervisor_id ? [activeMachine.current_supervisor_id] : [];
    setMachineSupervisorIds(sIds);
    setInitialSupervisorIds(sIds);

    const activeSups = [
      ...(Array.isArray(activeMachine.supervisors) ? activeMachine.supervisors : []),
      activeMachine.current_supervisor,
    ].filter(Boolean);
    if (activeSups.length > 0) {
      setLazySupervisors((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        activeSups.forEach((s: any) => s && s.id && map.set(s.id, s));
        return Array.from(map.values());
      });
    }

    // Operators
    const rawOps: any[] = Array.isArray(activeMachine.operators) && activeMachine.operators.length > 0
      ? activeMachine.operators
      : activeMachine.current_operator
      ? [activeMachine.current_operator]
      : [];

    const opIds: string[] = Array.isArray(activeMachine.operator_ids)
      ? activeMachine.operator_ids
      : activeMachine.current_operator_id ? [activeMachine.current_operator_id] : [];

    const hydrated: OperatorAssignmentItem[] = [];
    const seenKeys = new Set<string>();

    rawOps.forEach((o: any, idx: number) => {
      if (!o || !o.id) return;
      const rawCode = o.shift_code || o.shiftCode;
      const matchedShift = machineClientShifts.find(
        (s) => s.code.trim().toUpperCase() === (rawCode || "").trim().toUpperCase()
      ) || machineClientShifts[idx % machineClientShifts.length];

      const shiftCode = rawCode || matchedShift?.code || `S${(idx % 3) + 1}`;
      const shiftStartTime = matchedShift?.start_time || o.shift_start_time || o.shiftStartTime || null;
      const shiftEndTime = matchedShift?.end_time || o.shift_end_time || o.shiftEndTime || null;

      const key = `${o.id}-${shiftCode}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      hydrated.push({
        operatorId: o.id,
        operatorName: o.full_name || (o as any).name || "Operator",
        phone: o.phone || null,
        email: o.email || null,
        shiftCode: shiftCode,
        shiftStartTime: shiftStartTime,
        shiftEndTime: shiftEndTime,
        notes: "Assigned via personnel modal",
      });
    });

    const assignedOperatorIds = new Set(hydrated.map((h) => h.operatorId));
    opIds.forEach((id: string, idx: number) => {
      if (assignedOperatorIds.has(id)) return;
      assignedOperatorIds.add(id);
      const matchedUser = lazyOperators.find((u) => u.id === id) || (activeMachine.current_operator?.id === id ? activeMachine.current_operator : null);
      const matchedShift = machineClientShifts[hydrated.length % machineClientShifts.length];
      const shiftCode = (matchedUser as any)?.shift_code || matchedShift?.code || `S${(hydrated.length % 3) + 1}`;
      hydrated.push({
        operatorId: id,
        operatorName: matchedUser?.full_name || (matchedUser as any)?.name || "Operator",
        phone: matchedUser?.phone || null,
        email: matchedUser?.email || null,
        shiftCode: shiftCode,
        shiftStartTime: matchedShift?.start_time || (matchedUser as any)?.shift_start_time || null,
        shiftEndTime: matchedShift?.end_time || (matchedUser as any)?.shift_end_time || null,
        notes: "Assigned via personnel modal",
      });
    });

    setMachineOperators(hydrated);
    setInitialMachineOperators(hydrated);
  }, [isOpen, activeMachine, lazyOperators, machineClientShifts]);

  // Fetch fresh personnel directly from DB to capture exact shift assignments
  useEffect(() => {
    if (!isOpen || !activeMachine?.id) return;
    let isMounted = true;
    getMachinePersonnelFreshAction(activeMachine.id)
      .then((res) => {
        if (!isMounted || !res.success || !res.data) return;
        const fresh = res.data;
        if (fresh.supervisors && fresh.supervisors.length > 0) {
          setLazySupervisors((prev) => {
            const map = new Map(prev.map((s) => [s.id, s]));
            fresh.supervisors.forEach((s: any) => {
              if (s && s.id) map.set(s.id, s);
            });
            return Array.from(map.values());
          });
        }
        if (fresh.supervisor_ids) {
          setMachineSupervisorIds(fresh.supervisor_ids);
          setInitialSupervisorIds(fresh.supervisor_ids);
        }
        if (fresh.operators && fresh.operators.length > 0) {
          const freshHydrated: OperatorAssignmentItem[] = fresh.operators.map((o: any, idx: number) => {
            const rawCode = o.shift_code || o.shiftCode;
            const matchedShift = machineClientShifts.find(
              (s) => s.code.trim().toUpperCase() === (rawCode || "").trim().toUpperCase()
            ) || machineClientShifts[idx % machineClientShifts.length];

            const shiftCode = rawCode || matchedShift?.code || `S${(idx % 3) + 1}`;
            return {
              operatorId: o.id,
              operatorName: o.full_name || "Operator",
              phone: o.phone || null,
              email: o.email || null,
              shiftCode: shiftCode,
              shiftStartTime: o.shift_start_time || matchedShift?.start_time || null,
              shiftEndTime: o.shift_end_time || matchedShift?.end_time || null,
              notes: "Assigned via personnel modal",
            };
          });
          setMachineOperators(freshHydrated);
          setInitialMachineOperators(freshHydrated);
        }
      })
      .catch((err) => console.error("Error refreshing machine personnel", err));

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeMachine?.id, machineClientShifts]);

  // Reconcile operator shift codes whenever machineClientShifts loads/changes
  useEffect(() => {
    if (!machineClientShifts || machineClientShifts.length === 0 || machineOperators.length === 0) return;
    const clientCodes = new Set(machineClientShifts.map((s) => s.code.trim().toUpperCase()));
    let needsReconciliation = false;

    const reconciled = machineOperators.map((item, idx) => {
      const codeUpper = (item.shiftCode || "").trim().toUpperCase();
      if (!clientCodes.has(codeUpper)) {
        // Find matching client shift by timing or fallback to index
        const matchedByTime = machineClientShifts.find((s) => {
          if (!item.shiftStartTime) return false;
          const t1 = parseTimeToMinutes(item.shiftStartTime);
          const t2 = parseTimeToMinutes(s.start_time);
          return t1 !== null && t2 !== null && Math.abs(t1 - t2) < 30;
        });
        const targetShift = matchedByTime || machineClientShifts[idx % machineClientShifts.length];
        if (targetShift) {
          needsReconciliation = true;
          return {
            ...item,
            shiftCode: targetShift.code,
            shiftStartTime: targetShift.start_time,
            shiftEndTime: targetShift.end_time,
          };
        }
      }
      return item;
    });

    if (needsReconciliation) {
      setMachineOperators(reconciled);
      setInitialMachineOperators(reconciled);
    }
  }, [machineClientShifts]);

  // ═══════════════════════════════════════════════════════════════════
  // 3. STATE FOR OPERATOR-CENTRIC ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════
  const selectedOperatorId = propOperator?.id || propOperatorId || initialOperatorId || (lazyOperators[0]?.id || "");
  const [currentOperatorId, setCurrentOperatorId] = useState<string>(selectedOperatorId);

  useEffect(() => {
    if (propOperator?.id) setCurrentOperatorId(propOperator.id);
    else if (propOperatorId) setCurrentOperatorId(propOperatorId);
    else if (initialOperatorId) setCurrentOperatorId(initialOperatorId);
    else if (!currentOperatorId && lazyOperators.length > 0) setCurrentOperatorId(lazyOperators[0].id);
  }, [propOperator, propOperatorId, initialOperatorId, lazyOperators, currentOperatorId]);

  const activeOperator = useMemo(() => {
    if (propOperator && propOperator.id === currentOperatorId) return propOperator;
    return lazyOperators.find((o) => o.id === currentOperatorId) || propOperator || null;
  }, [propOperator, currentOperatorId, lazyOperators]);

  const [operatorSupervisors, setOperatorSupervisors] = useState<Array<{ id: string; full_name: string }>>([]);
  const [operatorMachineAssignments, setOperatorMachineAssignments] = useState<MachineAssignmentItem[]>([]);
  const [initialOperatorAssignments, setInitialOperatorAssignments] = useState<MachineAssignmentItem[]>([]);
  const [isLoadingOperatorAssignments, setIsLoadingOperatorAssignments] = useState(false);

  // Load operator assignments when currentOperatorId changes
  useEffect(() => {
    if (!isOpen || activeTabMode !== "operator" || !currentOperatorId) return;

    let active = true;
    setIsLoadingOperatorAssignments(true);

    getOperatorActiveAssignmentsAction(currentOperatorId)
      .then((res) => {
        if (!active) return;
        if (res.success && res.assignments) {
          setOperatorSupervisors(res.supervisors || []);
          const mapped: MachineAssignmentItem[] = res.assignments.map((a) => ({
            machineId: a.machineId,
            machineCode: a.machineCode,
            machineName: a.machineName,
            model: a.model,
            serialNumber: a.serialNumber,
            clientId: a.clientId,
            clientName: a.clientName,
            shiftCode: a.shiftCode || "S1",
            shiftStartTime: a.shiftStartTime,
            shiftEndTime: a.shiftEndTime,
            notes: a.notes,
          }));
          setOperatorMachineAssignments(mapped);
          setInitialOperatorAssignments(mapped);
        }
      })
      .catch((err) => console.error("Failed to load operator active assignments", err))
      .finally(() => {
        if (active) setIsLoadingOperatorAssignments(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, activeTabMode, currentOperatorId]);

  // ═══════════════════════════════════════════════════════════════════
  // 4. ADD OPERATOR / MACHINE ACCORDION DROPDOWN STATES
  // ═══════════════════════════════════════════════════════════════════
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [operatorSearchQuery, setOperatorSearchQuery] = useState("");

  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [machineSearchQuery, setMachineSearchQuery] = useState("");

  // Cross-machine assignment lookup map
  const otherAssignmentsMap = useMemo(() => {
    const map = new Map<string, ActiveOperatorOtherAssignment[]>();
    for (const a of otherAssignments) {
      if (a.machineId === currentMachineId) continue;
      const list = map.get(a.operatorId) || [];
      list.push(a);
      map.set(a.operatorId, list);
    }
    return map;
  }, [otherAssignments, currentMachineId]);

  // Filter available operators for active machine (max 2 shifts allowed per operator platform-wide)
  const availableOperators = useMemo(
    () =>
      lazyOperators.filter((op) => {
        if (op.role && op.role !== "operator") return false;
        if (op.status === "inactive") return false;

        const thisCount = machineOperators.filter((a) => a.operatorId === op.id).length;
        const otherCount = (otherAssignmentsMap.get(op.id) || []).length;
        const totalShifts = thisCount + otherCount;

        // Operator has already reached max 3 shifts
        if (totalShifts >= 3) return false;
        if (thisCount >= 3) return false;

        const query = operatorSearchQuery.toLowerCase();
        return (
          query === "" ||
          op.full_name?.toLowerCase().includes(query) ||
          op.phone?.includes(query) ||
          op.email?.toLowerCase().includes(query)
        );
      }),
    [lazyOperators, machineOperators, otherAssignmentsMap, operatorSearchQuery]
  );

  // Filter available machines for active operator (max 3 shifts allowed per operator platform-wide)
  const availableMachines = useMemo(() => {
    if (operatorMachineAssignments.length >= 3) return [];

    return lazyMachines.filter((m) => {
      const opCountOnMachine = operatorMachineAssignments.filter((a) => a.machineId === m.id).length;
      if (opCountOnMachine >= 3) return false;

      const query = machineSearchQuery.toLowerCase();
      return (
        query === "" ||
        m.machine_id?.toLowerCase().includes(query) ||
        m.model?.toLowerCase().includes(query) ||
        m.serial_number?.toLowerCase().includes(query)
      );
    });
  }, [lazyMachines, operatorMachineAssignments, machineSearchQuery]);

  // ═══════════════════════════════════════════════════════════════════
  // 5. VALIDATIONS & CONFLICT DETECTION
  // ═══════════════════════════════════════════════════════════════════

  // Machine Mode: Duplicate shift code validation on this machine
  const duplicateShiftCodes = useMemo(() => {
    const shiftCounts = new Map<string, number>();
    for (const a of machineOperators) {
      if (!a.shiftCode) continue;
      const code = a.shiftCode.toUpperCase();
      shiftCounts.set(code, (shiftCounts.get(code) || 0) + 1);
    }
    const duplicates: string[] = [];
    for (const [code, count] of shiftCounts.entries()) {
      if (count > 1) duplicates.push(code);
    }
    return duplicates;
  }, [machineOperators]);

  // Machine Mode: Overlapping shifts validation on this machine
  const overlappingShifts = useMemo(() => {
    const conflicts: string[] = [];
    for (let i = 0; i < machineOperators.length; i++) {
      for (let j = i + 1; j < machineOperators.length; j++) {
        const op1 = machineOperators[i];
        const op2 = machineOperators[j];
        if (op1.shiftStartTime && op1.shiftEndTime && op2.shiftStartTime && op2.shiftEndTime) {
          const r1 = shiftToMinuteRanges(op1.shiftStartTime, op1.shiftEndTime);
          const r2 = shiftToMinuteRanges(op2.shiftStartTime, op2.shiftEndTime);
          if (doRangesOverlap(r1, r2)) {
            conflicts.push(
              `"${op1.operatorName}" (${op1.shiftCode}: ${op1.shiftStartTime}–${op1.shiftEndTime}) overlaps with "${op2.operatorName}" (${op2.shiftCode}: ${op2.shiftStartTime}–${op2.shiftEndTime})`
            );
          }
        }
      }
    }
    return conflicts;
  }, [machineOperators]);

  // Machine Mode: Cross-machine operator collision validation
  const otherMachineConflicts = useMemo(() => {
    const conflicts: Array<{
      operatorId: string;
      operatorName: string;
      otherMachineCode: string;
      otherShiftTiming: string;
      shortMessage: string;
    }> = [];

    for (const a of machineOperators) {
      const others = otherAssignmentsMap.get(a.operatorId);
      if (!others || others.length === 0) continue;

      const myRanges = shiftToMinuteRanges(a.shiftStartTime, a.shiftEndTime);
      if (myRanges.length === 0) continue;

      for (const other of others) {
        const otherRanges = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
        if (otherRanges.length === 0) continue;

        if (doRangesOverlap(myRanges, otherRanges)) {
          const otherTiming = `${formatTo12Hour(other.shiftStartTime)} – ${formatTo12Hour(other.shiftEndTime)}`;
          const myTiming = `${formatTo12Hour(a.shiftStartTime)} – ${formatTo12Hour(a.shiftEndTime)}`;
          conflicts.push({
            operatorId: a.operatorId,
            operatorName: a.operatorName,
            otherMachineCode: other.machineCode,
            otherShiftTiming: otherTiming,
            shortMessage: `${a.operatorName}'s Shift ${a.shiftCode || ""} (${myTiming}) overlaps with active shift on ${other.machineCode} (${otherTiming}). An operator cannot be assigned to overlapping shifts.`,
          });
          break;
        }
      }
    }
    return conflicts;
  }, [machineOperators, otherAssignmentsMap]);

  // Machine Mode: Max 3 shifts per operator validation across fleet (24h)
  const machineOperatorShiftExceeded = useMemo(() => {
    const opCounts = new Map<string, number>();
    for (const a of machineOperators) {
      opCounts.set(a.operatorId, (opCounts.get(a.operatorId) || 0) + 1);
    }
    const exceeded: string[] = [];
    for (const [opId, count] of opCounts.entries()) {
      const others = (otherAssignmentsMap.get(opId) || []).length;
      if (count + others > 3) {
        const opName = machineOperators.find((m) => m.operatorId === opId)?.operatorName || "Operator";
        exceeded.push(`${opName} is assigned to ${count + others} shifts (maximum allowed is 3 shifts or 24h).`);
      }
    }
    return exceeded;
  }, [machineOperators, otherAssignmentsMap]);

  // Operator Mode: Overlapping shifts between machines assigned to this operator
  const operatorCollidingMachines = useMemo(() => {
    const conflicts: string[] = [];
    for (let i = 0; i < operatorMachineAssignments.length; i++) {
      for (let j = i + 1; j < operatorMachineAssignments.length; j++) {
        const m1 = operatorMachineAssignments[i];
        const m2 = operatorMachineAssignments[j];
        if (m1.shiftStartTime && m1.shiftEndTime && m2.shiftStartTime && m2.shiftEndTime) {
          const r1 = shiftToMinuteRanges(m1.shiftStartTime, m1.shiftEndTime);
          const r2 = shiftToMinuteRanges(m2.shiftStartTime, m2.shiftEndTime);
          if (doRangesOverlap(r1, r2)) {
            const t1 = `${formatTo12Hour(m1.shiftStartTime)} – ${formatTo12Hour(m1.shiftEndTime)}`;
            const t2 = `${formatTo12Hour(m2.shiftStartTime)} – ${formatTo12Hour(m2.shiftEndTime)}`;
            conflicts.push(
              `${m1.machineCode} (Shift ${m1.shiftCode}: ${t1}) collides with ${m2.machineCode} (Shift ${m2.shiftCode}: ${t2}). An operator cannot work overlapping shifts.`
            );
          }
        }
      }
    }
    return conflicts;
  }, [operatorMachineAssignments]);

  // Operator Mode: Duplicate shift on same machine validation
  const operatorDuplicateShifts = useMemo(() => {
    const shiftKeys = new Set<string>();
    for (const a of operatorMachineAssignments) {
      const key = `${a.machineId}:${a.shiftCode.toUpperCase()}`;
      if (shiftKeys.has(key)) return true;
      shiftKeys.add(key);
    }
    return false;
  }, [operatorMachineAssignments]);

  const operatorShiftLimitExceeded = operatorMachineAssignments.length > 3;

  // Dirty State Calculation
  const isMachineDirty = useMemo(() => {
    const supChanged = JSON.stringify([...machineSupervisorIds].sort()) !== JSON.stringify([...initialSupervisorIds].sort());
    const opsChanged =
      JSON.stringify(
        machineOperators
          .map((o) => ({ id: o.operatorId, shift: o.shiftCode }))
          .sort((a, b) => `${a.id}-${a.shift}`.localeCompare(`${b.id}-${b.shift}`))
      ) !==
      JSON.stringify(
        initialMachineOperators
          .map((o) => ({ id: o.operatorId, shift: o.shiftCode }))
          .sort((a, b) => `${a.id}-${a.shift}`.localeCompare(`${b.id}-${b.shift}`))
      );
    return canEditSupervisor ? (supChanged || opsChanged) : opsChanged;
  }, [machineSupervisorIds, initialSupervisorIds, machineOperators, initialMachineOperators, canEditSupervisor]);

  const isOperatorDirty = useMemo(() => {
    const current = operatorMachineAssignments
      .map((a) => ({ mId: a.machineId, sCode: a.shiftCode }))
      .sort((a, b) => `${a.mId}-${a.sCode}`.localeCompare(`${b.mId}-${b.sCode}`));
    const initial = initialOperatorAssignments
      .map((a) => ({ mId: a.machineId, sCode: a.shiftCode }))
      .sort((a, b) => `${a.mId}-${a.sCode}`.localeCompare(`${b.mId}-${b.sCode}`));
    return JSON.stringify(current) !== JSON.stringify(initial);
  }, [operatorMachineAssignments, initialOperatorAssignments]);

  const isDirty = activeTabMode === "machine" ? isMachineDirty : isOperatorDirty;
  const hasValidationError =
    activeTabMode === "machine"
      ? otherMachineConflicts.length > 0 ||
        duplicateShiftCodes.length > 0 ||
        overlappingShifts.length > 0 ||
        machineOperatorShiftExceeded.length > 0
      : operatorCollidingMachines.length > 0 ||
        operatorDuplicateShifts ||
        operatorShiftLimitExceeded;

  // ═══════════════════════════════════════════════════════════════════
  // 6. MUTATION HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const getNextAvailableMachineShift = (): ClientShiftCode => {
    const assignedCodes = new Set(machineOperators.map((a) => a.shiftCode.toUpperCase()));
    for (const sc of machineClientShifts) {
      if (!assignedCodes.has(sc.code.toUpperCase())) {
        return sc;
      }
    }
    return machineClientShifts[0] || DEFAULT_CLIENT_SHIFTS[0];
  };

  const handleAddOperatorToMachine = (op: User) => {
    const nextShift = getNextAvailableMachineShift();
    const newItem: OperatorAssignmentItem = {
      operatorId: op.id,
      operatorName: op.full_name || "Operator",
      phone: op.phone || null,
      email: op.email || null,
      shiftCode: nextShift.code,
      shiftStartTime: nextShift.start_time,
      shiftEndTime: nextShift.end_time,
      notes: "Assigned via personnel modal",
    };
    setMachineOperators((prev) => [...prev, newItem]);
    setIsAddOperatorOpen(false);
    setOperatorSearchQuery("");
  };

  const handleRemoveOperatorFromMachine = (index: number) => {
    setMachineOperators((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMachineShiftChange = (index: number, shift: ClientShiftCode) => {
    setMachineOperators((prev) =>
      prev.map((a, idx) => {
        if (idx !== index) return a;
        return {
          ...a,
          shiftCode: shift.code,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
        };
      })
    );
  };

  const handleAddMachineToOperator = async (m: any) => {
    if (operatorMachineAssignments.length >= 3) {
      toast("warning", "Shift limit reached", "An operator can be assigned to a maximum of 3 shifts (24h) only.");
      return;
    }

    let shifts = DEFAULT_CLIENT_SHIFTS;
    if (m.client_id) {
      try {
        const res = await getClientShiftCodesAction(m.client_id);
        if (res.success && res.data && res.data.length > 0) {
          shifts = res.data.map((s: any) => ({
            ...s,
            start_time: formatTo12Hour(s.start_time) || s.start_time,
            end_time: formatTo12Hour(s.end_time) || s.end_time,
          }));
        }
      } catch {
        shifts = DEFAULT_CLIENT_SHIFTS;
      }
    }

    const assignedCodesOnMachine = new Set(
      operatorMachineAssignments
        .filter((a) => a.machineId === m.id)
        .map((a) => a.shiftCode.toUpperCase())
    );
    const nextShift = shifts.find((s) => !assignedCodesOnMachine.has(s.code.toUpperCase())) || shifts[0];

    const newItem: MachineAssignmentItem = {
      machineId: m.id,
      machineCode: m.machine_id,
      machineName: m.machine_name || m.model,
      model: m.model,
      serialNumber: m.serial_number,
      clientId: m.client_id,
      clientName: m.client_name || m.client?.company_name,
      shiftCode: nextShift.code,
      shiftStartTime: nextShift.start_time,
      shiftEndTime: nextShift.end_time,
      clientShifts: shifts,
    };

    setOperatorMachineAssignments((prev) => [...prev, newItem]);
    setIsAddMachineOpen(false);
    setMachineSearchQuery("");
  };

  const handleRemoveMachineFromOperator = (index: number) => {
    setOperatorMachineAssignments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOperatorShiftChange = (index: number, shift: ClientShiftCode) => {
    setOperatorMachineAssignments((prev) =>
      prev.map((a, idx) => {
        if (idx !== index) return a;
        return {
          ...a,
          shiftCode: shift.code,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
        };
      })
    );
  };

  const handleSave = async () => {
    if (hasValidationError) {
      const msg = "Please resolve shift schedule conflicts before saving assignments.";
      setSubmitError(msg);
      toast("error", "Cannot save assignments", msg);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);

    try {
      if (activeTabMode === "machine") {
        if (!activeMachine?.id) {
          setSubmitError("No machine selected.");
          setIsSaving(false);
          return;
        }

        // Optimistic UI callback
        if (onMachineUpdated) {
          const optOps = machineOperators.map((item, idx) => ({
            id: item.operatorId,
            full_name: item.operatorName,
            phone: item.phone || null,
            email: item.email || null,
            shift_time: item.shiftStartTime && item.shiftEndTime
              ? `${item.shiftStartTime} - ${item.shiftEndTime}`
              : "08:00 AM - 04:00 PM",
            shift_code: item.shiftCode || `S${idx + 1}`,
            shift_start_time: item.shiftStartTime || null,
            shift_end_time: item.shiftEndTime || null,
            role: "operator",
          }));

          const uniqueOpIds = Array.from(new Set(machineOperators.map((a) => a.operatorId)));

          onMachineUpdated({
            supervisor_ids: canEditSupervisor ? machineSupervisorIds : activeMachine.supervisor_ids,
            current_supervisor_id: machineSupervisorIds[0] || null,
            operator_ids: uniqueOpIds,
            current_operator_id: uniqueOpIds[0] || null,
            operators: optOps as any,
          });
        }

        const res = await updateMachinePersonnelAction(activeMachine.id, {
          supervisorIds: canEditSupervisor ? machineSupervisorIds : undefined,
          operators: machineOperators.map((item) => ({
            operatorId: item.operatorId,
            shiftCode: item.shiftCode,
            shiftStartTime: item.shiftStartTime,
            shiftEndTime: item.shiftEndTime,
            notes: item.notes || "Assigned via personnel modal",
          })),
        });

        if (!res.success || res.error) {
          const err = res.error || "Failed to update machine personnel.";
          setSubmitError(err);
          toast("error", "Save failed", err);
          return;
        }

        toast("success", "Assignments saved", "Machine shift assignments updated successfully.");
        onSuccess?.(res);
        onClose();
        router.refresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
        }
      } else {
        // Operator mode save
        if (!currentOperatorId) {
          setSubmitError("No operator selected.");
          setIsSaving(false);
          return;
        }

        const res = await updateOperatorMachineAssignmentsAction(currentOperatorId, {
          machineAssignments: operatorMachineAssignments.map((a) => ({
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

        toast("success", "Assignments saved", "Operator equipment assignments updated successfully.");
        onSuccess?.(res);
        onClose();
        router.refresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("reach:refresh-machine-personnel"));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save assignments";
      setSubmitError(msg);
      toast("error", "Save failed", msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Header Title Construction
  const titleDisplay = (
    <div className="flex items-center gap-2 flex-wrap min-w-0 pr-6">
      <span className="font-bold text-sm sm:text-base text-[var(--color-ink)]">
        {activeTabMode === "machine" ? "Assign Machine Operator" : "Assign Equipment Roster"}
      </span>
      {activeTabMode === "machine" && activeMachine && (
        <>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-normal">
            {activeMachine.machine_id}
          </span>
          {(activeMachine.model || activeMachine.serial_number) && (
            <span className="text-xs text-[var(--color-mute)] font-normal flex items-center gap-1 truncate">
              <span>•</span>
              {activeMachine.model && <span className="font-medium text-[var(--color-ink)]">{activeMachine.model}</span>}
              {activeMachine.model && activeMachine.serial_number && <span>-</span>}
              {activeMachine.serial_number && <span className="font-mono">{activeMachine.serial_number}</span>}
            </span>
          )}
        </>
      )}
      {activeTabMode === "operator" && activeOperator && (
        <>
          <span className="font-medium text-xs px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
            {activeOperator.full_name}
          </span>
          {(activeOperator.phone || activeOperator.email) && (
            <span className="text-xs text-[var(--color-mute)] font-mono truncate">
              • {activeOperator.phone || activeOperator.email}
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={titleDisplay}
      size="lg"
      className="p-0 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"
      bodyClassName="p-3.5 sm:p-5 space-y-3.5 custom-scrollbar min-h-0"
      footer={
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[var(--color-mute)] empty:hidden">
            {isDirty && (
              <span
                data-hover-parent
                className="text-amber-500 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs transition-colors cursor-default"
              >
                <AnimatedAlertCircle size={14} className="w-3.5 h-3.5 shrink-0" />
                <span>Unsaved roster changes</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto h-11 sm:h-9 min-h-[44px] sm:min-h-auto px-4 text-xs font-semibold justify-center cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSaving}
              disabled={!isDirty || hasValidationError || isSaving}
              onClick={handleSave}
              className="w-full sm:w-auto h-11 sm:h-9 min-h-[44px] sm:min-h-auto px-5 text-xs font-semibold justify-center cursor-pointer shadow-xs"
            >
              Save Assignments
            </Button>
          </div>
        </div>
      }
      footerClassName="shrink-0 p-3.5 sm:px-5 sm:py-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] block"
    >
      {/* Error Notification Banner */}
      {submitError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="font-bold">Assignment Failed</div>
            <p className="text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              {submitError}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* A. MACHINE-CENTRIC VIEW                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTabMode === "machine" && (
        <>
          {/* Top Selector if Machine was NOT pre-fixed */}
          {!hasFixedMachine && (
            <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
              <MachineSelect
                label={
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                    <Truck size={13} className="text-sky-500" />
                    Select Machinery Equipment *
                  </span>
                }
                count={lazyMachines.length}
                value={currentMachineId}
                onChange={(mId) => {
                  if (mId) setCurrentMachineId(mId);
                }}
                machines={machineSelectItems}
                placeholder={
                  isLoadingOptions && lazyMachines.length === 0
                    ? "Loading fleet machinery..."
                    : "Search or select machinery equipment..."
                }
                disabled={isSaving}
              />
            </div>
          )}

            {/* SECTION 1: ASSIGNED SUPERVISORS */}
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Assigned Supervisors
                </span>
                {!canEditSupervisor && (
                  <span className="text-[10px] text-[var(--color-mute)] font-medium">
                    Managed by Administrators
                  </span>
                )}
              </div>

              {canEditSupervisor ? (
                <MultiUserSelect
                  label=""
                  users={lazySupervisors}
                  values={machineSupervisorIds}
                  onChange={setMachineSupervisorIds}
                  placeholder={isLoadingOptions && lazySupervisors.length === 0 ? "Loading supervisors..." : "Search & assign supervisors..."}
                  disabled={isSaving}
                />
              ) : (
                <div className="space-y-2 text-xs">
                  {lazySupervisors.filter((s) => machineSupervisorIds.includes(s.id)).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {lazySupervisors
                        .filter((s) => machineSupervisorIds.includes(s.id))
                        .map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-ink)] shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                            <span>{s.full_name}</span>
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--color-mute)] italic">No supervisors designated</p>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: ASSIGNED OPERATORS (24H) */}
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Assigned Operators (24h)
                </span>
                <span className="text-[10px] text-[var(--color-mute)] font-medium font-mono">
                  {machineOperators.length}/{machineClientShifts.length || 3} Shifts Assigned
                </span>
              </div>

              {/* Conflict Warnings */}
              {otherMachineConflicts.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] leading-relaxed font-medium">
                    {otherMachineConflicts.map((c) => c.shortMessage).join(" ")}
                  </div>
                </div>
              )}

              {duplicateShiftCodes.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-medium">
                    Shift <span className="font-mono font-bold">{duplicateShiftCodes.join(", ")}</span> is assigned multiple times. Each operator must cover a distinct shift.
                  </div>
                </div>
              )}

              {machineOperatorShiftExceeded.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-medium leading-relaxed">
                    {machineOperatorShiftExceeded.join(" ")}
                  </div>
                </div>
              )}

              {/* Operator Cards List */}
              <div className="space-y-2.5">
                {machineOperators.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--color-mute)] italic bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] p-4">
                    <Users className="h-6 w-6 text-[var(--color-mute)] mx-auto mb-1.5 opacity-40" />
                    <p className="font-bold text-[var(--color-ink)] text-xs">No Operators Assigned</p>
                    <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                      Assign operators below to designate 24h equipment coverage.
                    </p>
                  </div>
                ) : (
                  machineOperators.map((item, idx) => {
                    const otherConflict = otherMachineConflicts.find((c) => c.operatorId === item.operatorId);
                    const hasConflict = duplicateShiftCodes.includes(item.shiftCode.toUpperCase()) || !!otherConflict;
                    const isMultiShiftOnMachine = machineOperators.filter((o) => o.operatorId === item.operatorId).length > 1;

                    return (
                      <div
                        key={`${item.operatorId}-${item.shiftCode}-${idx}`}
                        className={`p-3 rounded-xl border transition-colors ${
                          hasConflict
                            ? "bg-rose-500/5 border-rose-500/40"
                            : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)]"
                        }`}
                      >
                        {/* Header: Number + Name + Shift Pill + Remove */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate">
                                  {item.operatorName}
                                </span>
                                {isMultiShiftOnMachine && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                    {machineOperators.filter((o) => o.operatorId === item.operatorId).length === 3 ? "3 Shifts (24h) on Machine" : "2 Shifts on Machine"}
                                  </span>
                                )}
                                {(() => {
                                  const matchingShift = machineClientShifts.find(
                                    (s) => s.code.trim().toUpperCase() === item.shiftCode.trim().toUpperCase()
                                  );
                                  const shiftLabel = matchingShift?.name
                                    ? (matchingShift.name.toLowerCase().startsWith("shift") ? matchingShift.name : `Shift ${item.shiftCode} (${matchingShift.name})`)
                                    : `Shift ${item.shiftCode}`;
                                  return (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                                        hasConflict
                                          ? "bg-rose-500/10 text-rose-600 border-rose-500/25"
                                          : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25"
                                      }`}
                                      title={shiftLabel}
                                    >
                                      {shiftLabel}
                                    </span>
                                  );
                                })()}
                              </div>
                              {(item.phone || item.email) && (
                                <div className="text-[10px] text-[var(--color-mute)] truncate mt-0.5">
                                  {[item.phone, item.email].filter(Boolean).join(" • ")}
                                </div>
                              )}
                              {otherConflict && (
                                <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                  <AlertCircle size={10} className="shrink-0" />
                                  <span>Assigned to {otherConflict.otherMachineCode} ({otherConflict.otherShiftTiming})</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveOperatorFromMachine(idx)}
                            title={`Remove ${item.operatorName}`}
                            className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Shift Selection Cards */}
                        <div className="mt-2.5 pt-2 border-t border-[var(--color-hairline)]">
                          <div className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Clock size={11} className="text-sky-500" />
                            <span>Select Assigned Shift:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            {machineClientShifts.map((sc) => {
                              const isSelected = item.shiftCode.trim().toUpperCase() === sc.code.trim().toUpperCase();
                              const others = otherAssignmentsMap.get(item.operatorId);
                              const isCollision = others?.some((other) => {
                                const rOther = shiftToMinuteRanges(other.shiftStartTime, other.shiftEndTime);
                                const rSc = shiftToMinuteRanges(sc.start_time, sc.end_time);
                                return doRangesOverlap(rOther, rSc);
                              });

                              return (
                                <button
                                  key={sc.code}
                                  type="button"
                                  onClick={() => handleMachineShiftChange(idx, sc)}
                                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[52px] ${
                                    isSelected
                                      ? isCollision
                                        ? "bg-rose-600 text-white border-rose-700 shadow-2xs ring-1 ring-rose-600 font-semibold"
                                        : "bg-sky-500 text-white border-sky-600 shadow-2xs ring-1 ring-sky-500 font-semibold"
                                      : isCollision
                                      ? "bg-rose-500/5 text-[var(--color-ink)] border-rose-500/30 hover:border-rose-500/50"
                                      : "bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-sky-500/40"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5 w-full">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                                          isSelected
                                            ? "bg-white/25 text-white"
                                            : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                                        }`}
                                      >
                                        {sc.code}
                                      </span>
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isSelected ? "text-white" : "text-[var(--color-ink)]"
                                        }`}
                                        title={sc.name || `Shift ${sc.code}`}
                                      >
                                        {sc.name || `Shift ${sc.code}`}
                                      </span>
                                    </div>
                                    {sc.crosses_midnight && (
                                      <Moon
                                        size={11}
                                        className={isSelected ? "text-white/90" : "text-indigo-500 shrink-0"}
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-1 mt-1 text-[10px] font-mono">
                                    <span className={`truncate ${isSelected ? "text-white/90" : "text-[var(--color-mute)]"}`}>
                                      {sc.start_time} – {sc.end_time}
                                    </span>
                                    {sc.scheduled_minutes ? (
                                      <span
                                        className={`text-[9px] shrink-0 font-medium ${
                                          isSelected ? "text-white/80" : "text-[var(--color-mute)]"
                                        }`}
                                      >
                                        {Math.round(sc.scheduled_minutes / 60)}h
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Operator Accordion / Search */}
              {machineOperators.length < (machineClientShifts.length || 3) ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddOperatorOpen(!isAddOperatorOpen)}
                    className="w-full h-10 px-3.5 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-1.5 text-[var(--color-ink)] group-hover:text-sky-600 transition-colors">
                      <Plus size={14} className="text-sky-500" />
                      <span>
                        Assign Operator ({machineOperators.length}/{machineClientShifts.length || 3}) — Next Shift: {getNextAvailableMachineShift().code}
                      </span>
                    </span>
                    <ChevronDown size={14} className={`text-[var(--color-mute)] transition-transform duration-150 ${isAddOperatorOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Inline Search Expansion */}
                  {isAddOperatorOpen && (
                    <div className="mt-2 p-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 animate-in fade-in duration-100">
                      <div className="relative flex items-center">
                        <Search size={13} className="absolute left-2.5 text-[var(--color-mute)] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search active operator by name..."
                          value={operatorSearchQuery}
                          onChange={(e) => setOperatorSearchQuery(e.target.value)}
                          autoFocus
                          className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-[var(--color-hairline)]">
                        {availableOperators.length === 0 ? (
                          <div className="p-3 text-center text-xs text-[var(--color-mute)] italic">
                            {operatorSearchQuery ? "No matching operators found" : "All available operators already assigned"}
                          </div>
                        ) : (
                          availableOperators.map((op) => {
                            const thisCount = machineOperators.filter((a) => a.operatorId === op.id).length;
                            const otherAssList = otherAssignmentsMap.get(op.id) || [];
                            const otherAss = otherAssList[0];
                            const totalCount = thisCount + otherAssList.length;

                            const nextShift = getNextAvailableMachineShift();
                            const willOverlap = otherAss && doRangesOverlap(
                              shiftToMinuteRanges(nextShift.start_time, nextShift.end_time),
                              shiftToMinuteRanges(otherAss.shiftStartTime, otherAss.shiftEndTime)
                            );

                            return (
                              <button
                                key={op.id}
                                type="button"
                                onClick={() => handleAddOperatorToMachine(op)}
                                className="w-full p-2 text-left hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between cursor-pointer transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-semibold truncate flex items-center gap-1.5 flex-wrap">
                                    <span>{op.full_name}</span>
                                    {thisCount > 0 ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                        Already on this machine ({thisCount}/3)
                                      </span>
                                    ) : totalCount > 0 ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                        {totalCount}/3 Shifts
                                      </span>
                                    ) : null}
                                    {otherAss && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                                          willOverlap
                                            ? "bg-rose-500/10 text-rose-600 border-rose-500/25"
                                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                        }`}
                                      >
                                        {otherAss.machineCode} ({formatTo12Hour(otherAss.shiftStartTime)}–{formatTo12Hour(otherAss.shiftEndTime)})
                                      </span>
                                    )}
                                  </div>
                                  {op.phone && <div className="text-[10px] text-[var(--color-mute)] font-mono">{op.phone}</div>}
                                </div>
                                <span className="text-[10px] font-mono font-bold text-sky-600 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0">
                                  + Shift {nextShift.code}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Full shift coverage roster ({machineOperators.length}/{machineClientShifts.length || 3} shifts assigned).</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* B. OPERATOR-CENTRIC VIEW                              */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeTabMode === "operator" && (
          <>
            {/* Top Selector if Operator was NOT pre-fixed */}
            {!hasFixedOperator && (
              <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                <UserSelect
                  label={
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                      <Users size={13} className="text-amber-500" />
                      Select Operator *
                    </span>
                  }
                  count={lazyOperators.length}
                  value={currentOperatorId}
                  onChange={(uId) => {
                    if (uId) setCurrentOperatorId(uId);
                  }}
                  users={lazyOperators}
                  placeholder={
                    isLoadingOptions && lazyOperators.length === 0
                      ? "Loading operators..."
                      : "Search or select operator..."
                  }
                  disabled={isSaving}
                />
              </div>
            )}

            {/* SECTION 1: ASSIGNED SUPERVISORS */}
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-2.5 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Designated Supervisors
                </span>
                <span className="text-[10px] text-[var(--color-mute)] font-medium">
                  Managed by Administrators
                </span>
              </div>
              {operatorSupervisors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {operatorSupervisors.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-ink)] shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span>{s.full_name}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-mute)] italic">No site supervisor assigned</p>
              )}
            </div>

            {/* SECTION 2: ASSIGNED FLEET MACHINERY & SHIFTS */}
            <div
              data-hover-parent
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Assigned Machinery Fleet (24h)
                </span>
                <span className="text-[10px] text-[var(--color-mute)] font-medium font-mono">
                  {operatorMachineAssignments.length}/3 Shifts Assigned
                </span>
              </div>

              {/* Overlap warnings between assigned machines */}
              {operatorCollidingMachines.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-medium leading-relaxed">
                    Shift conflict: {operatorCollidingMachines.join("; ")}. An operator cannot work simultaneous shifts across equipment.
                  </div>
                </div>
              )}

              {operatorDuplicateShifts && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-medium leading-relaxed">
                    Duplicate shift assigned: This operator cannot be assigned to the same machine and shift code multiple times.
                  </div>
                </div>
              )}

              {operatorShiftLimitExceeded && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-medium leading-relaxed">
                    Shift limit exceeded: An operator can be assigned to a maximum of 3 shifts (24h) only.
                  </div>
                </div>
              )}

              {/* Machinery Cards List */}
              <div className="space-y-2.5">
                {isLoadingOperatorAssignments ? (
                  <div className="py-6 text-center text-xs text-[var(--color-mute)] flex items-center justify-center gap-2">
                    <AnimatedLoader isSpinning size={16} className="text-sky-500" />
                    <span>Loading active machine assignments...</span>
                  </div>
                ) : operatorMachineAssignments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--color-mute)] italic bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] p-4">
                    <Truck className="h-6 w-6 text-[var(--color-mute)] mx-auto mb-1.5 opacity-40" />
                    <p className="font-bold text-[var(--color-ink)] text-xs">No Machinery Assigned</p>
                    <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                      Assign equipment below to designate machine custody for this operator.
                    </p>
                  </div>
                ) : (
                  operatorMachineAssignments.map((item, idx) => {
                    const shifts = item.clientShifts || DEFAULT_CLIENT_SHIFTS;
                    return (
                      <div
                        key={`${item.machineId}-${item.shiftCode}-${idx}`}
                        className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2.5 transition-colors"
                      >
                        {/* Header: Badge + Machine ID + Model + Trash */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold font-mono text-xs sm:text-sm text-[var(--color-ink)]">
                                  {item.machineCode}
                                </span>
                                {item.model && (
                                  <span className="text-xs font-semibold text-[var(--color-ink)]">
                                    • {item.model}
                                  </span>
                                )}
                                {item.clientName && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 font-medium truncate max-w-[140px]">
                                    {item.clientName}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/10 text-sky-600 border border-sky-500/25">
                                  {shifts.find((s) => s.code.toUpperCase() === item.shiftCode.toUpperCase())?.name
                                    ? `${shifts.find((s) => s.code.toUpperCase() === item.shiftCode.toUpperCase())?.name} (${item.shiftCode})`
                                    : `Shift ${item.shiftCode}`}
                                </span>
                              </div>
                              {item.serialNumber && (
                                <div className="text-[10px] text-[var(--color-mute)] font-mono mt-0.5">
                                  SN: {item.serialNumber}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMachineFromOperator(idx)}
                            title={`Relieve ${item.machineCode}`}
                            className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Shift Selection Cards for this Machine */}
                        <div className="pt-2 border-t border-[var(--color-hairline)]">
                          <div className="text-[10px] font-semibold text-[var(--color-mute)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Clock size={11} className="text-sky-500" />
                            <span>Select Assigned Shift:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            {shifts.map((sc) => {
                              const isSelected = item.shiftCode.toUpperCase() === sc.code.toUpperCase();
                              return (
                                <button
                                  key={sc.code}
                                  type="button"
                                  onClick={() => handleOperatorShiftChange(idx, sc)}
                                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[50px] ${
                                    isSelected
                                      ? "bg-sky-500 text-white border-sky-600 shadow-2xs ring-1 ring-sky-500 font-semibold"
                                      : "bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-sky-500/40"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5 w-full">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                                          isSelected
                                            ? "bg-white/25 text-white"
                                            : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25"
                                        }`}
                                      >
                                        {sc.code}
                                      </span>
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isSelected ? "text-white" : "text-[var(--color-ink)]"
                                        }`}
                                        title={sc.name || `Shift ${sc.code}`}
                                      >
                                        {sc.name || `Shift ${sc.code}`}
                                      </span>
                                    </div>
                                    {sc.crosses_midnight && (
                                      <Moon
                                        size={11}
                                        className={isSelected ? "text-white/90" : "text-indigo-500 shrink-0"}
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-1 mt-1 text-[10px] font-mono">
                                    <span className={`truncate ${isSelected ? "text-white/90" : "text-[var(--color-mute)]"}`}>
                                      {sc.start_time} – {sc.end_time}
                                    </span>
                                    {sc.scheduled_minutes ? (
                                      <span
                                        className={`text-[9px] shrink-0 font-medium ${
                                          isSelected ? "text-white/80" : "text-[var(--color-mute)]"
                                        }`}
                                      >
                                        {Math.round(sc.scheduled_minutes / 60)}h
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Machine Accordion or Capacity Banner */}
              {operatorMachineAssignments.length >= 3 ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Maximum shift capacity reached (3/3 shifts assigned to this operator).</span>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddMachineOpen(!isAddMachineOpen)}
                    className="w-full h-10 px-3.5 rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-1.5 text-[var(--color-ink)] group-hover:text-sky-600 transition-colors">
                      <Plus size={14} className="text-sky-500" />
                      <span>Assign Equipment ({operatorMachineAssignments.length}/3 Shifts)</span>
                    </span>
                    <ChevronDown size={14} className={`text-[var(--color-mute)] transition-transform duration-150 ${isAddMachineOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isAddMachineOpen && (
                    <div className="mt-2 p-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 animate-in fade-in duration-100">
                      <div className="relative flex items-center">
                        <Search size={13} className="absolute left-2.5 text-[var(--color-mute)] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search fleet machine by ID or model..."
                          value={machineSearchQuery}
                          onChange={(e) => setMachineSearchQuery(e.target.value)}
                          autoFocus
                          className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-[var(--color-hairline)]">
                        {availableMachines.length === 0 ? (
                          <div className="p-3 text-center text-xs text-[var(--color-mute)] italic">
                            {machineSearchQuery ? "No matching machines found" : "All fleet machines assigned"}
                          </div>
                        ) : (
                          availableMachines.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleAddMachineToOperator(m)}
                              className="w-full p-2 text-left hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between cursor-pointer transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold truncate flex items-center gap-1.5">
                                  <span className="font-mono font-bold">{m.machine_id}</span>
                                  <span>• {m.model}</span>
                                </div>
                                <div className="text-[10px] text-[var(--color-mute)]">
                                  {m.client_name ? `Client: ${m.client_name}` : "Available in fleet"}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 shrink-0">
                                + Assign
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
    </Modal>
  );
}
