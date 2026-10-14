/**
 * ReachInternational Mobile — Polished Assign Machine Operator Dialog Box
 * Matches canonical reference design (Screenshots 3, 4, 5):
 * 1. Modal Header: "Assign Machine Operator", Machine ID badge, Model & S/N subtitle, close (X).
 * 2. Section 1: "SELECT MACHINERY EQUIPMENT *" with "{count} Total" badge, pill trigger,
 *    and clean search dropdown popover (Model, Code pill, S/N, selected checkmark).
 * 3. Section 2: "ASSIGNED SUPERVISORS" with multi-select chips, Clear button,
 *    and clean search popover with role badges (ADMIN, MANAGER, SUPERVISOR), shift timings,
 *    contact info, and radio/checkbox selectors.
 * 4. Section 3: "ASSIGNED OPERATORS (24H)" with "{count}/3 Shifts Assigned",
 *    operator cards (amber circle index, name, shift pill, trash delete button, contact,
 *    and S1/S2/S3 shift selector buttons), plus "+ Assign Operator" accordion search.
 * 5. Action Footer: "Cancel" & "Save Assignments" buttons with 44px min touch targets.
 * 6. Rich tactile touch feedback (Haptics, activeOpacity, visual pressed states) and zero layout clipping.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useTheme, ShiftCardSelector, SearchInput, Text, AppModal } from '../ui';
import { haptics } from '../../lib/haptics';
import { Pressable } from '../ui/touch/Pressable';
import { supabase } from '../../lib/supabase';
import { broadcastMobileAssignmentChanged } from '../../lib/realtime-roster';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useAuth } from '../../lib/auth/useAuth';
import { isManagerOrAbove } from '@reachinternational/permissions';
import {
  X,
  Check,
  Clock,
  Truck,
  Moon,
  AlertCircle,
  ChevronDown,
  Users,
  Trash2,
  Plus,
  Search,
  Phone,
  Mail,
  Shield,
  Lock,
} from '../ui/icon';
import {
  formatTo12Hour,
  parseTimeToMinutes,
} from '@reachinternational/utils';

export interface MobileAssignPersonnelModalProps {
  visible: boolean;
  onClose: () => void;
  initialMachineId?: string;
  initialOperatorId?: string;
  initialSupervisorId?: string;
  targetUser?: {
    id: string;
    full_name?: string;
    role?: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  userRole?: string;
  onSuccess?: (assignedOperators?: OperatorAssignmentRow[]) => void;
}

export interface ClientShiftItem {
  id?: string;
  code: string;
  name?: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
}

export interface OperatorAssignmentRow {
  operatorId: string;
  operatorName: string;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  assignmentId?: string;
}

export interface SupervisorItem {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
}

const DEFAULT_SHIFTS: ClientShiftItem[] = [
  { code: 'S1', name: 'Shift S1', start_time: '06:00 AM', end_time: '02:00 PM' },
  { code: 'S2', name: 'Shift S2', start_time: '02:00 PM', end_time: '10:00 PM' },
  { code: 'S3', name: 'Shift S3', start_time: '10:00 PM', end_time: '06:00 AM', crosses_midnight: true },
];

function shiftToMinuteRanges(startStr?: string | null, endStr?: string | null): Array<[number, number]> {
  if (!startStr || !endStr) return [];
  const s = parseTimeToMinutes(startStr);
  const e = parseTimeToMinutes(endStr);
  if (s === null || e === null || s === e) return [];
  if (e <= s) {
    return [[s, 1440], [0, e]];
  }
  return [[s, e]];
}

function doRangesOverlap(rangesA: Array<[number, number]>, rangesB: Array<[number, number]>): boolean {
  for (const [sA, eA] of rangesA) {
    for (const [sB, eB] of rangesB) {
      if (Math.max(sA, sB) < Math.min(eA, eB)) {
        return true;
      }
    }
  }
  return false;
}

function to24HourTime(str?: string | null): string {
  if (!str) return '06:00:00';
  const mins = parseTimeToMinutes(str);
  if (mins === null) {
    const trimmed = str.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }
    return str;
  }
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

export const MobileAssignPersonnelModal: React.FC<MobileAssignPersonnelModalProps> = ({
  visible,
  onClose,
  initialMachineId,
  initialOperatorId,
  initialSupervisorId,
  targetUser,
  userRole,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;
  const { user: authUser, role: authRole } = useAuth();
  const effectiveRole = (userRole || authRole || '').toLowerCase();
  const isSupervisorRole = effectiveRole === 'supervisor';
  const canEditSupervisor = (!effectiveRole || isManagerOrAbove(effectiveRole as any)) && !isSupervisorRole;

  // Data pools
  const [machines, setMachines] = useState<any[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<SupervisorItem[]>([]);
  const [allOperators, setAllOperators] = useState<any[]>([]);
  const [fleetAssignments, setFleetAssignments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Active form state
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || '');
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [machineOperators, setMachineOperators] = useState<OperatorAssignmentRow[]>([]);
  const [initialDbAssignments, setInitialDbAssignments] = useState<any[]>([]);
  const [clientShifts, setClientShifts] = useState<ClientShiftItem[]>(DEFAULT_SHIFTS);

  // Dropdown open states
  const [isMachineDropdownOpen, setIsMachineDropdownOpen] = useState(false);
  const [isSupervisorDropdownOpen, setIsSupervisorDropdownOpen] = useState(false);
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);

  // Search queries
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState('');
  const [operatorSearchQuery, setOperatorSearchQuery] = useState('');

  // Debounced search queries for smooth typing & zero stutter
  const [debouncedMachineSearch, setDebouncedMachineSearch] = useState('');
  const [debouncedSupervisorSearch, setDebouncedSupervisorSearch] = useState('');
  const [debouncedOperatorSearch, setDebouncedOperatorSearch] = useState('');

  // Pagination / lazy display slice limits
  const [visibleMachineLimit, setVisibleMachineLimit] = useState(25);
  const [visibleSupervisorLimit, setVisibleSupervisorLimit] = useState(25);
  const [visibleOperatorLimit, setVisibleOperatorLimit] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMachineSearch(machineSearchQuery);
      setVisibleMachineLimit(25);
    }, 150);
    return () => clearTimeout(timer);
  }, [machineSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSupervisorSearch(supervisorSearchQuery);
      setVisibleSupervisorLimit(25);
    }, 150);
    return () => clearTimeout(timer);
  }, [supervisorSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOperatorSearch(operatorSearchQuery);
      setVisibleOperatorLimit(25);
    }, 150);
    return () => clearTimeout(timer);
  }, [operatorSearchQuery]);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Haptic feedback trigger helper
  const triggerHaptic = useCallback((type: 'selection' | 'impact' | 'success' | 'warning' | 'error' = 'selection') => {
    if (type === 'selection') haptics.select();
    else if (type === 'impact') haptics.tap();
    else if (type === 'success') haptics.confirm();
    else if (type === 'warning') haptics.select();
    else if (type === 'error') haptics.reject();
  }, []);

  // Web outside-click dismissal
  useEffect(() => {
    if (Platform.OS !== 'web' || (!isMachineDropdownOpen && !isSupervisorDropdownOpen)) return;

    const handleWebClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.('[data-dropdown-container]')) {
        return;
      }
      setIsMachineDropdownOpen(false);
      setIsSupervisorDropdownOpen(false);
    };

    const handleWebKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMachineDropdownOpen(false);
        setIsSupervisorDropdownOpen(false);
        setIsAddOperatorOpen(false);
      }
    };

    document.addEventListener('click', handleWebClick);
    document.addEventListener('keydown', handleWebKeyDown);

    return () => {
      document.removeEventListener('click', handleWebClick);
      document.removeEventListener('keydown', handleWebKeyDown);
    };
  }, [isMachineDropdownOpen, isSupervisorDropdownOpen]);

  // Load machines, supervisors, operators, and fleet assignments when modal opens
  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoadingData(true);
    setSubmitError(null);

    // Build machines query respecting supervisor role scope
    let machQuery = supabase
      .from('machines')
      .select('id, machine_id, model, serial_number, client_id, supervisor_ids, current_supervisor_id, health_status, status, client:clients(id, company_name)')
      .order('machine_id', { ascending: true });

    if (isSupervisorRole && authUser?.id) {
      machQuery = machQuery.or(`current_supervisor_id.eq.${authUser.id},supervisor_ids.cs.{${authUser.id}}`);
    }

    Promise.all([
      // 1. Fleet machines (scoped if supervisor)
      machQuery,

      // 2. Supervisors / Managers / Admins
      supabase
        .from('users')
        .select('id, full_name, phone, email, role, shift_start_time, shift_end_time, status')
        .in('role', ['supervisor', 'manager', 'admin', 'super_admin'])
        .neq('status', 'inactive')
        .order('full_name', { ascending: true }),

      // 3. Operators
      supabase
        .from('users')
        .select('id, full_name, phone, email, shift_start_time, shift_end_time, status')
        .eq('role', 'operator')
        .neq('status', 'inactive')
        .order('full_name', { ascending: true }),

      // 4. Fleet active assignments (including machine info for descriptive conflict banners)
      supabase
        .from('operator_machine_assignments')
        .select('id, operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active, operator:users(id, full_name, phone, email), machine:machines(id, machine_id, model)')
        .eq('is_active', true),
    ])
      .then(([mRes, sRes, oRes, assRes]) => {
        if (!active) return;
        const machList = mRes.data || [];
        const flAssignments = assRes.data || [];
        setMachines(machList);
        setAllSupervisors((sRes.data as SupervisorItem[]) || []);
        setAllOperators(oRes.data || []);
        setFleetAssignments(flAssignments);

        // Resolve target machine ID:
        // Priority: initialMachineId -> machine where targetUser is already assigned -> selectedMachineId -> first fleet machine
        let targetMachId = initialMachineId;
        if (!targetMachId && targetUser?.id) {
          const targetAss = flAssignments.find((a: any) => a.operator_id === targetUser.id);
          if (targetAss?.machine_id && machList.some((m) => m.id === targetAss.machine_id)) {
            targetMachId = targetAss.machine_id;
          }
        }
        if (!targetMachId) {
          targetMachId = selectedMachineId || machList[0]?.id || '';
        }
        if (targetMachId) {
          setSelectedMachineId(targetMachId);
        }
      })
      .catch((err) => {
        console.warn('Error loading personnel dialog data:', err);
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [visible, initialMachineId, isSupervisorRole, authUser?.id, targetUser?.id]);

  // Active Machine resolution
  const activeMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || machines[0] || null;
  }, [machines, selectedMachineId]);

  // Load client shift codes whenever active machine changes
  useEffect(() => {
    if (!visible || !activeMachine?.client_id) {
      setClientShifts(DEFAULT_SHIFTS);
      return;
    }

    let active = true;
    const fetchShifts = async () => {
      try {
        const { data, error } = await supabase
          .from('client_shift_codes')
          .select('id, code, name, start_time, end_time, crosses_midnight')
          .eq('client_id', activeMachine.client_id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (!active) return;
        if (!error && data && data.length > 0) {
          setClientShifts(
            data.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              start_time: formatTo12Hour(s.start_time) || s.start_time,
              end_time: formatTo12Hour(s.end_time) || s.end_time,
              crosses_midnight: s.crosses_midnight,
            }))
          );
        } else {
          setClientShifts(DEFAULT_SHIFTS);
        }
      } catch (err) {
        console.warn('Error fetching client shift codes:', err);
      }
    };

    fetchShifts();

    return () => {
      active = false;
    };
  }, [visible, activeMachine?.client_id]);

  // Sync supervisors & operators whenever selectedMachineId or machines list changes
  useEffect(() => {
    if (!visible || !activeMachine) return;

    // 1. Sync supervisor IDs from machine
    const supIds: string[] = Array.isArray(activeMachine.supervisor_ids)
      ? [...activeMachine.supervisor_ids]
      : activeMachine.current_supervisor_id
      ? [activeMachine.current_supervisor_id]
      : [];
    const effectiveSupId = targetUser?.role === 'supervisor' ? targetUser.id : initialSupervisorId;
    if (effectiveSupId && !supIds.includes(effectiveSupId)) {
      supIds.push(effectiveSupId);
    }
    setSelectedSupervisorIds(supIds);

    // 2. Sync active operator assignments for this machine
    let active = true;
    const fetchMachineAssignments = async () => {
      try {
        const { data } = await supabase
          .from('operator_machine_assignments')
          .select('id, operator_id, shift_code, shift_start_time, shift_end_time, operator:users(id, full_name, phone, email)')
          .eq('machine_id', activeMachine.id)
          .eq('is_active', true)
          .order('shift_code', { ascending: true });

        if (!active) return;
        const rows = data || [];
        setInitialDbAssignments(rows);

        const mapped: OperatorAssignmentRow[] = rows.map((r: any) => ({
          assignmentId: r.id,
          operatorId: r.operator_id || r.operator?.id,
          operatorName: r.operator?.full_name || 'Operator',
          phone: r.operator?.phone || null,
          email: r.operator?.email || null,
          shiftCode: (r.shift_code || 'S1').toUpperCase(),
          shiftStartTime: formatTo12Hour(r.shift_start_time) || r.shift_start_time || '06:00 AM',
          shiftEndTime: formatTo12Hour(r.shift_end_time) || r.shift_end_time || '02:00 PM',
        }));

        // If targetUser or initialOperatorId was passed and is not already in the list, pre-add if capacity permits
        const effectiveOpId = targetUser?.role === 'operator' ? targetUser.id : initialOperatorId;
        if (effectiveOpId && !mapped.some((m) => m.operatorId === effectiveOpId) && mapped.length < 3) {
          const opObj = allOperators.find((u) => u.id === effectiveOpId) || (targetUser?.id === effectiveOpId ? targetUser : null);
          if (opObj) {
            const usedCodes = new Set(mapped.map((m) => m.shiftCode.toUpperCase()));
            const nextShift = clientShifts.find((s) => !usedCodes.has(s.code.toUpperCase())) || clientShifts[0] || DEFAULT_SHIFTS[0];
            mapped.push({
              operatorId: opObj.id,
              operatorName: opObj.full_name || 'Operator',
              phone: opObj.phone || null,
              email: opObj.email || null,
              shiftCode: nextShift.code.toUpperCase(),
              shiftStartTime: nextShift.start_time,
              shiftEndTime: nextShift.end_time,
            });
          }
        }

        setMachineOperators(mapped);
      } catch (err) {
        console.warn('Error fetching machine assignments:', err);
      }
    };

    fetchMachineAssignments();

    return () => {
      active = false;
    };
  }, [visible, activeMachine?.id, allOperators, initialOperatorId, initialSupervisorId, targetUser, clientShifts]);

  // Compute next available shift code
  const nextAvailableShift = useMemo((): ClientShiftItem => {
    const assignedCodes = new Set(machineOperators.map((o) => o.shiftCode.toUpperCase()));
    return clientShifts.find((s) => !assignedCodes.has(s.code.toUpperCase())) || clientShifts[0] || DEFAULT_SHIFTS[0];
  }, [machineOperators, clientShifts]);

  // Filtered Machines for Machinery Dropdown
  const filteredMachines = useMemo(() => {
    const q = debouncedMachineSearch.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) => {
      const codeMatch = (m.machine_id || '').toLowerCase().includes(q);
      const modelMatch = (m.model || '').toLowerCase().includes(q);
      const serialMatch = (m.serial_number || '').toLowerCase().includes(q);
      const clientMatch = (m.client?.company_name || '').toLowerCase().includes(q);
      return codeMatch || modelMatch || serialMatch || clientMatch;
    });
  }, [machines, debouncedMachineSearch]);

  const displayedMachines = useMemo(() => {
    return filteredMachines.slice(0, visibleMachineLimit);
  }, [filteredMachines, visibleMachineLimit]);

  // Filtered Supervisors for Supervisor Dropdown
  const filteredSupervisors = useMemo(() => {
    const q = debouncedSupervisorSearch.trim().toLowerCase();
    if (!q) return allSupervisors;
    return allSupervisors.filter((s) => {
      const nameMatch = (s.full_name || '').toLowerCase().includes(q);
      const phoneMatch = (s.phone || '').toLowerCase().includes(q);
      const emailMatch = (s.email || '').toLowerCase().includes(q);
      const roleMatch = (s.role || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch || roleMatch;
    });
  }, [allSupervisors, debouncedSupervisorSearch]);

  const displayedSupervisors = useMemo(() => {
    return filteredSupervisors.slice(0, visibleSupervisorLimit);
  }, [filteredSupervisors, visibleSupervisorLimit]);

  // Filtered Operators for "+ Assign Operator" list
  const availableOperators = useMemo(() => {
    const q = debouncedOperatorSearch.trim().toLowerCase();
    return allOperators.filter((op) => {
      // Exclude if already assigned to all 3 shifts or maximum fleet capacity
      const opFleetAssignments = fleetAssignments.filter((a) => a.operator_id === op.id);
      const isAlreadyOnThisMach = machineOperators.filter((a) => a.operatorId === op.id).length;
      if (opFleetAssignments.length >= 3 && isAlreadyOnThisMach === 0) return false;

      if (!q) return true;
      const nameMatch = (op.full_name || '').toLowerCase().includes(q);
      const phoneMatch = (op.phone || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch;
    });
  }, [allOperators, fleetAssignments, machineOperators, debouncedOperatorSearch]);

  const displayedOperators = useMemo(() => {
    return availableOperators.slice(0, visibleOperatorLimit);
  }, [availableOperators, visibleOperatorLimit]);

  // Handlers for Supervisor Selection
  const toggleSupervisor = (supId: string) => {
    triggerHaptic('selection');
    setSubmitError(null);
    setSelectedSupervisorIds((prev) =>
      prev.includes(supId) ? prev.filter((id) => id !== supId) : [...prev, supId]
    );
  };

  const removeSupervisor = (supId: string) => {
    triggerHaptic('impact');
    setSubmitError(null);
    setSelectedSupervisorIds((prev) => prev.filter((id) => id !== supId));
  };

  const clearAllSupervisors = () => {
    triggerHaptic('impact');
    setSubmitError(null);
    setSelectedSupervisorIds([]);
  };

  const deselectAllSupervisors = () => {
    triggerHaptic('selection');
    setSubmitError(null);
    setSelectedSupervisorIds([]);
  };

  // Handlers for Operator Roster
  const handleAddOperator = (op: any) => {
    triggerHaptic('selection');
    setSubmitError(null);
    if (machineOperators.length >= 3) return;

    const shift = nextAvailableShift;
    const newRow: OperatorAssignmentRow = {
      operatorId: op.id,
      operatorName: op.full_name,
      phone: op.phone || null,
      email: op.email || null,
      shiftCode: shift.code.toUpperCase(),
      shiftStartTime: shift.start_time,
      shiftEndTime: shift.end_time,
    };

    setMachineOperators((prev) => [...prev, newRow]);
    setOperatorSearchQuery('');

    // If reached 3/3, automatically collapse search
    if (machineOperators.length + 1 >= 3) {
      setIsAddOperatorOpen(false);
    }
  };

  const handleRemoveOperator = (index: number) => {
    triggerHaptic('impact');
    setSubmitError(null);
    setMachineOperators((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeOperatorShift = (
    index: number,
    shift: { code: string; start_time?: string; end_time?: string }
  ) => {
    triggerHaptic('selection');
    setSubmitError(null);
    setMachineOperators((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        shiftCode: shift.code.toUpperCase(),
        shiftStartTime: shift.start_time || '06:00 AM',
        shiftEndTime: shift.end_time || '02:00 PM',
      };
      return copy;
    });
  };

  // Save Assignments
  const savingRef = useRef(false);
  const handleSaveAssignments = async () => {
    if (!activeMachine?.id) return;
    if (savingRef.current) return;
    savingRef.current = true;
    triggerHaptic('selection');
    setSubmitError(null);

    // 1. Local validation: Duplicate shifts on the same machine
    const shiftCodes = machineOperators.map((o) => o.shiftCode.toUpperCase());
    const duplicateShifts = shiftCodes.filter((item, index) => shiftCodes.indexOf(item) !== index);
    if (duplicateShifts.length > 0) {
      triggerHaptic('error');
      setSubmitError(`Shift ${duplicateShifts[0]} is assigned to multiple operators on this equipment. Each operator must have a distinct shift.`);
      savingRef.current = false;
      return;
    }

    // 2. Local validation: Operator shift overlap & 3-shift (24h) cap across fleet
    for (const op of machineOperators) {
      const otherActive = fleetAssignments.filter(
        (a) => a.operator_id === op.operatorId && a.machine_id !== activeMachine.id && a.is_active !== false
      );
      if (otherActive.length >= 3) {
        triggerHaptic('error');
        setSubmitError(`${op.operatorName} has already reached the maximum limit of 3 active shifts (24h) across the fleet.`);
        savingRef.current = false;
        return;
      }
      const opRanges = shiftToMinuteRanges(op.shiftStartTime, op.shiftEndTime);
      for (const other of otherActive) {
        const otherRanges = shiftToMinuteRanges(other.shift_start_time, other.shift_end_time);
        if (doRangesOverlap(opRanges, otherRanges)) {
          triggerHaptic('error');
          const otherMachCode = other.machine?.machine_id || 'another equipment';
          const opTimes = `${formatTo12Hour(op.shiftStartTime) || op.shiftStartTime} – ${formatTo12Hour(op.shiftEndTime) || op.shiftEndTime}`;
          const otherTimes = `${formatTo12Hour(other.shift_start_time) || other.shift_start_time} – ${formatTo12Hour(other.shift_end_time) || other.shift_end_time}`;
          setSubmitError(`${op.operatorName}'s Shift ${op.shiftCode} (${opTimes}) collides with active shift on ${otherMachCode} (${otherTimes}). An operator cannot work overlapping shifts.`);
          savingRef.current = false;
          return;
        }
      }
    }

    setIsSaving(true);

    try {
      const { data: userAuth } = await supabase.auth.getUser();
      const currentUserId = userAuth?.user?.id || null;

      // 1. Update machines table with supervisor assignments
      const isNeedsActivation = Boolean(
        activeMachine?.health_status === 'breakdown' ||
        activeMachine?.health_status === 'under_maintenance' ||
        activeMachine?.status === 'under_maintenance'
      );

      const machineUpdatePayload: any = {
        operator_ids: Array.from(new Set(machineOperators.map((o) => o.operatorId))),
        current_operator_id: machineOperators[0]?.operatorId || null,
        updated_at: new Date().toISOString(),
      };

      if (canEditSupervisor) {
        machineUpdatePayload.supervisor_ids = selectedSupervisorIds;
        machineUpdatePayload.current_supervisor_id = selectedSupervisorIds[0] || null;
      }

      if (isNeedsActivation) {
        machineUpdatePayload.health_status = 'active';
        machineUpdatePayload.status = activeMachine.client_id ? 'rented' : 'active';
      }

      const { error: machineUpdateError } = await supabase
        .from('machines')
        .update(machineUpdatePayload)
        .eq('id', activeMachine.id);

      if (machineUpdateError) throw machineUpdateError;

      // 2. Relieve assignments that existed in DB but were removed from current roster
      for (const initAss of initialDbAssignments) {
        const stillPresent = machineOperators.some(
          (m) =>
            m.operatorId === initAss.operator_id &&
            m.shiftCode.toUpperCase() === (initAss.shift_code || '').toUpperCase()
        );

        if (!stillPresent && initAss.id) {
          await supabase.rpc('end_operator_machine_assignment_atomic', {
            p_assignment_id: initAss.id,
            p_ended_by: currentUserId,
            p_end_reason: 'Updated via mobile assign dialog',
          });
        }
      }

      // 3. Atomically assign/update operators on this machine
      for (const opItem of machineOperators) {
        // Only run atomic RPC if not already an identical active assignment in DB
        const alreadyActive = initialDbAssignments.some(
          (a) =>
            a.operator_id === opItem.operatorId &&
            a.shift_code?.toUpperCase() === opItem.shiftCode.toUpperCase() &&
            a.is_active !== false
        );

        if (!alreadyActive) {
          const { error: rpcErr } = await supabase.rpc('assign_operator_machine_atomic', {
            p_machine_id: activeMachine.id,
            p_operator_id: opItem.operatorId,
            p_shift_start_time: to24HourTime(opItem.shiftStartTime),
            p_shift_end_time: to24HourTime(opItem.shiftEndTime),
            p_shift_code: opItem.shiftCode,
            p_assigned_by: currentUserId,
            p_notes: 'Assigned via mobile personnel dialog',
          });

          if (rpcErr) {
            let msg = rpcErr.message;
            if (rpcErr.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
              msg = `${opItem.operatorName} has reached the maximum of 3 active shifts (24h) across the fleet.`;
            } else if (msg.includes('OVERLAPPING_SHIFT_FOR_OPERATOR') || msg.includes('overlap')) {
              msg = `${opItem.operatorName}'s shift collides with an existing active assignment across the fleet.`;
            }
            throw new Error(msg);
          }
        }
      }

      // 4. Real-time broadcast for instant synchronization across all connected clients
      broadcastMobileAssignmentChanged({
        action: 'assigned',
        machineId: activeMachine.id,
        operatorId: machineOperators[0]?.operatorId || '',
        shiftCode: machineOperators[0]?.shiftCode || '',
      });

      triggerHaptic('success');
      if (onSuccess) onSuccess(machineOperators);
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      let msg = err?.message || 'Failed to save assignments.';
      if (err?.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('3 active shifts')) {
        msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
      } else if (msg.includes('OVERLAPPING_SHIFT_FOR_OPERATOR') || msg.includes('overlap') || msg.includes('conflict')) {
        msg = 'Shift schedule conflicts with another active assignment for this operator.';
      }
      setSubmitError(msg);
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'bottom'}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 580,
              width: '100%',
              alignSelf: 'center',
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : {
              maxHeight: '92%',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }
      }
    >
      <View
        style={[
          styles.drawerContainer,
          {
            backgroundColor: theme.colors.canvasElevated,
          },
          isDesktop && {
            borderRadius: radiusNumeric.lg,
            borderWidth: 1,
            borderColor: theme.colors.hairline,
            maxWidth: 580,
            width: '100%',
            alignSelf: 'center',
            overflow: 'hidden',
          },
        ]}
      >
        {/* ═══════════════════════════════════════════════════════ */}
        {/* HEADER (Clean & Compact)                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerTitleWrap}>
            <Text variant="heading" style={[styles.headerTitle, { color: theme.colors.ink }]}>
              {targetUser
                ? targetUser.role === 'operator'
                  ? 'Assign Machine Operator'
                  : 'Assign Machinery'
                : 'Assign Machine Operator'}
            </Text>
            <Text
              variant="caption"
              style={[styles.headerSubtitle, { color: theme.colors.mute }]}
              numberOfLines={1}
            >
              {targetUser?.full_name
                ? `${targetUser.full_name} • ${(targetUser.role || 'operator').toUpperCase()}`
                : 'Configure equipment shifts and operators'}
            </Text>
          </View>

          <Pressable
            variant="iconButton"
            haptic="tap"
            hitSlopToMin48
            onPress={onClose}
            style={[
              styles.closeBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
                borderWidth: 1,
              },
            ]}
            accessibilityLabel="Close dialog"
          >
            <X size={16} color={theme.colors.mute} />
          </Pressable>
        </View>

          {loadingData ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
                Loading fleet machinery and personnel...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Error Alert */}
              {submitError && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                    },
                  ]}
                >
                  <AlertCircle size={15} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text style={styles.errorText}>{submitError}</Text>
                </View>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION 1: SELECT MACHINERY EQUIPMENT (Screenshot 3 & 4) */}
              {/* ═══════════════════════════════════════════════════════ */}
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                {...({ 'data-dropdown-container': 'true' } as any)}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionLabelWithIcon}>
                    <Truck size={14} color="#0284c7" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      SELECT MACHINERY EQUIPMENT *
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.countBadgeText, { color: theme.colors.mute }]}>
                      {machines.length} Total
                    </Text>
                  </View>
                </View>

                {/* Trigger Button */}
                <Pressable variant="card" haptic="select" onPress={() => { setIsMachineDropdownOpen((prev) => !prev); setIsSupervisorDropdownOpen(false); setMachineSearchQuery(''); }} style={[styles.selectTriggerBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: isMachineDropdownOpen ? '#0284c7' : theme.colors.hairline }]} accessibilityRole="button" accessibilityLabel="Select machine">
                  <View style={styles.triggerValueRow}>
                    <View style={styles.machineTriggerCodePill}>
                      <Text style={styles.machineTriggerCodeText}>
                        {activeMachine?.machine_id || 'M/C-0001'}
                      </Text>
                    </View>
                    <Text
                      style={[styles.triggerSerialText, { color: theme.colors.mute }]}
                      numberOfLines={1}
                    >
                      (S/N: {activeMachine?.serial_number || 'N/A'})
                    </Text>
                  </View>
                  <ChevronDown
                    size={15}
                    color={isMachineDropdownOpen ? '#0284c7' : theme.colors.mute}
                    style={{
                      transform: [{ rotate: isMachineDropdownOpen ? '180deg' : '0deg' }],
                    }}
                  />
                </Pressable>

                {/* Machinery Dropdown Inline Panel */}
                {isMachineDropdownOpen && (
                  <View
                    style={[
                      styles.dropdownInlinePanel,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    {/* Search Input using canonical SearchInput */}
                    <SearchInput
                      placeholder="Search by Model, Code, S/N..."
                      value={machineSearchQuery}
                      onChangeText={setMachineSearchQuery}
                      autoFocus
                      containerStyle={styles.searchBoxOverride}
                    />

                    {/* Machine List */}
                    <ScrollView
                      style={styles.dropdownListScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredMachines.length === 0 ? (
                        <View style={styles.dropdownEmptyRow}>
                          <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                          <Text variant="caption" style={[styles.dropdownEmptyText, { color: theme.colors.mute }]}>
                            {machineSearchQuery ? `No equipment matching "${machineSearchQuery}"` : 'No equipment available'}
                          </Text>
                          {Boolean(machineSearchQuery) && (
                            <Pressable
                              variant="ghost"
                              haptic="tap"
                              onPress={() => setMachineSearchQuery('')}
                              style={{ marginTop: 4, paddingVertical: 4, paddingHorizontal: 8 }}
                            >
                              <Text variant="caption" style={{ color: '#0284c7' }}>Clear search</Text>
                            </Pressable>
                          )}
                        </View>
                      ) : (
                        <>
                          {displayedMachines.map((m) => {
                            const isSelected = m.id === activeMachine?.id;
                            return (
                              <Pressable
                                key={m.id}
                                variant="listRow"
                                haptic="select"
                                onPress={() => {
                                  setSelectedMachineId(m.id);
                                  setIsMachineDropdownOpen(false);
                                  setMachineSearchQuery('');
                                  setSubmitError(null);
                                }}
                                style={[
                                  styles.machineDropdownItem,
                                  {
                                    backgroundColor: isSelected
                                      ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff')
                                      : theme.colors.canvas,
                                    borderColor: isSelected
                                      ? (isDark ? 'rgba(56, 189, 248, 0.35)' : '#bae6fd')
                                      : theme.colors.hairline,
                                  },
                                ]}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <View style={styles.machineItemTopRow}>
                                    <Text
                                      style={[
                                        styles.machineItemModel,
                                        {
                                          color: isSelected
                                            ? '#0284c7'
                                            : theme.colors.ink,
                                        },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {m.model || 'Equipment'}
                                    </Text>
                                    <View style={styles.machineItemCodeBadge}>
                                      <Text style={styles.machineItemCodeText}>
                                        {m.machine_id}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text
                                    style={[
                                      styles.machineItemSerial,
                                      { color: theme.colors.mute },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    S/N: {m.serial_number || 'N/A'}
                                  </Text>
                                </View>

                                {isSelected && (
                                  <View style={styles.checkIconWrap}>
                                    <Check size={13} color="#ffffff" />
                                  </View>
                                )}
                              </Pressable>
                            );
                          })}
                          {filteredMachines.length > visibleMachineLimit && (
                            <Pressable
                              variant="ghost"
                              haptic="tap"
                              onPress={() => setVisibleMachineLimit((prev) => prev + 25)}
                              style={styles.showMoreRow}
                            >
                              <Text variant="caption" style={{ color: '#0284c7' }}>
                                Show more ({filteredMachines.length - visibleMachineLimit} remaining)
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Breakdown or Maintenance Warning Banner */}
              {activeMachine &&
                (activeMachine.health_status === 'breakdown' ||
                  activeMachine.health_status === 'under_maintenance' ||
                  activeMachine.status === 'under_maintenance') && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
                      marginBottom: 4,
                    }}
                  >
                    <AlertCircle size={15} color={isDark ? '#f87171' : '#dc2626'} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        variant="label"
                        style={{
                          color: isDark ? '#fca5a5' : '#991b1b',
                        }}
                      >
                        Equipment Status:{' '}
                        {activeMachine.health_status === 'breakdown'
                          ? 'Breakdown'
                          : 'Under Maintenance'}
                      </Text>
                      <Text
                        variant="caption"
                        style={{
                          color: isDark ? '#fecaca' : '#b91c1c',
                        }}
                      >
                        This machinery is currently flagged as{' '}
                        {activeMachine.health_status === 'breakdown'
                          ? 'Breakdown'
                          : 'Under Maintenance'}
                        . Saving assignments will automatically reactivate this equipment for active operational service.
                      </Text>
                    </View>
                  </View>
                )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION 2: ASSIGNED SUPERVISORS (Screenshot 3 & 5)     */}
              {/* ═══════════════════════════════════════════════════════ */}
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                {...({ 'data-dropdown-container': 'true' } as any)}
              >
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                    ASSIGNED SUPERVISORS
                  </Text>
                  {!canEditSupervisor && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                      }}
                    >
                      <Lock size={10} color={theme.colors.mute} />
                      <Text variant="micro" style={{ color: theme.colors.mute }}>
                        Read Only
                      </Text>
                    </View>
                  )}
                </View>

                {!canEditSupervisor && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
                      marginBottom: 8,
                    }}
                  >
                    <Shield size={12} color={theme.colors.mute} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Supervisors cannot reassign machine supervisors.
                    </Text>
                  </View>
                )}

                {/* Supervisor Multi-Select Trigger */}
                <Pressable
                  variant="card"
                  haptic="select"
                  disabled={!canEditSupervisor}
                  onPress={() => {
                    if (!canEditSupervisor) return;
                    setIsSupervisorDropdownOpen((prev) => !prev);
                    setIsMachineDropdownOpen(false);
                    setSupervisorSearchQuery('');
                  }}
                  style={[
                    styles.supervisorTriggerBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: isSupervisorDropdownOpen ? '#0284c7' : theme.colors.hairline,
                      opacity: !canEditSupervisor ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Select supervisors"
                >
                  <View style={styles.supervisorChipsContainer}>
                    {selectedSupervisorIds.length === 0 ? (
                      <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
                        {canEditSupervisor ? 'Search & assign supervisors...' : 'No supervisors assigned'}
                      </Text>
                    ) : (
                      selectedSupervisorIds.map((sId) => {
                        const sup = allSupervisors.find((s) => s.id === sId);
                        const name = sup?.full_name || 'Supervisor';
                        return (
                          <View
                            key={sId}
                            style={[
                              styles.supervisorChip,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Text style={[styles.supervisorChipText, { color: theme.colors.ink }]}>
                              {name}
                            </Text>
                            {canEditSupervisor && (
                              <Pressable
                                variant="iconButton"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={(e) => {
                                  // @ts-ignore
                                  e?.stopPropagation?.();
                                  removeSupervisor(sId);
                                }}
                                style={styles.chipRemoveBtn}
                                accessibilityLabel={`Remove ${name}`}
                              >
                                <X size={11} color={theme.colors.mute} />
                              </Pressable>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>

                  <View style={styles.supervisorTriggerRightActions}>
                    {canEditSupervisor && selectedSupervisorIds.length > 0 && (
                      <Pressable
                        variant="ghost"
                        haptic="tap"
                        hitSlopToMin48
                        onPress={(e) => {
                          // @ts-ignore
                          e?.stopPropagation?.();
                          clearAllSupervisors();
                        }}
                      >
                        <Text style={[styles.clearBtnText, { color: theme.colors.mute }]}>
                          Clear
                        </Text>
                      </Pressable>
                    )}
                    {canEditSupervisor ? (
                      <ChevronDown
                        size={15}
                        color={isSupervisorDropdownOpen ? '#0284c7' : theme.colors.mute}
                        style={{
                          transform: [{ rotate: isSupervisorDropdownOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    ) : (
                      <Lock size={13} color={theme.colors.mute} />
                    )}
                  </View>
                </Pressable>

                {/* Supervisor Inline Dropdown Panel */}
                {isSupervisorDropdownOpen && (
                  <View
                    style={[
                      styles.dropdownInlinePanel,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    {/* Search Bar using canonical SearchInput */}
                    <SearchInput
                      placeholder="Search staff by name, shift, role..."
                      value={supervisorSearchQuery}
                      onChangeText={setSupervisorSearchQuery}
                      autoFocus
                      containerStyle={styles.searchBoxOverride}
                    />

                    {/* Subheader: Selected Count + Deselect All */}
                    <View
                      style={[
                        styles.supervisorSubHeader,
                        { borderBottomColor: theme.colors.hairline },
                      ]}
                    >
                      <Text style={[styles.selectionCountText, { color: theme.colors.mute }]}>
                        {selectedSupervisorIds.length} of {allSupervisors.length} selected
                      </Text>
                      <Pressable variant="ghost" haptic="tap" hitSlopToMin48 onPress={deselectAllSupervisors}>
                        <Text style={styles.deselectAllActionText}>
                          {selectedSupervisorIds.length > 0 ? 'Deselect All' : 'Select'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Staff List */}
                    <ScrollView
                      style={styles.dropdownListScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredSupervisors.length === 0 ? (
                        <View style={styles.dropdownEmptyRow}>
                          <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                          <Text variant="caption" style={[styles.dropdownEmptyText, { color: theme.colors.mute }]}>
                            {supervisorSearchQuery ? `No supervisors matching "${supervisorSearchQuery}"` : 'No supervisors available'}
                          </Text>
                          {Boolean(supervisorSearchQuery) && (
                            <Pressable
                              variant="ghost"
                              haptic="tap"
                              onPress={() => setSupervisorSearchQuery('')}
                              style={{ marginTop: 4, paddingVertical: 4, paddingHorizontal: 8 }}
                            >
                              <Text variant="caption" style={{ color: '#0284c7' }}>Clear search</Text>
                            </Pressable>
                          )}
                        </View>
                      ) : (
                        <>
                          {displayedSupervisors.map((staff) => {
                            const isSelected = selectedSupervisorIds.includes(staff.id);
                            const roleUpper = (staff.role || 'SUPERVISOR').toUpperCase();

                            // Role badge theme colors
                            let badgeBg = isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe';
                            let badgeText = '#0284c7';
                            if (roleUpper.includes('ADMIN')) {
                              badgeBg = isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6';
                              badgeText = '#e11d48';
                            } else if (roleUpper.includes('MANAGER')) {
                              badgeBg = isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff';
                              badgeText = '#9333ea';
                            }

                            return (
                              <Pressable
                                key={staff.id}
                                variant="listRow"
                                haptic="select"
                                onPress={() => toggleSupervisor(staff.id)}
                                style={[
                                  styles.staffCardItem,
                                  {
                                    backgroundColor: theme.colors.canvas,
                                    borderColor: isSelected ? '#0284c7' : theme.colors.hairline,
                                  },
                                ]}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  {/* Line 1: Name + Role Badge */}
                                  <View style={styles.staffCardTopRow}>
                                    <Text
                                      style={[styles.staffCardName, { color: theme.colors.ink }]}
                                      numberOfLines={1}
                                    >
                                      {staff.full_name}
                                    </Text>
                                    <View
                                      style={[
                                        styles.staffRoleBadge,
                                        { backgroundColor: badgeBg },
                                      ]}
                                    >
                                      <Text
                                        style={[styles.staffRoleBadgeText, { color: badgeText }]}
                                      >
                                        {roleUpper}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Line 2: Shift timing */}
                                  <View style={styles.staffMetaRow}>
                                    <Clock size={11} color="#10b981" />
                                    <Text style={styles.staffShiftTimeText}>
                                      {staff.shift_start_time && staff.shift_end_time
                                        ? `${formatTo12Hour(staff.shift_start_time)} - ${formatTo12Hour(staff.shift_end_time)}`
                                        : '09:00 - 18:00'}
                                    </Text>
                                  </View>

                                  {/* Line 3: Phone */}
                                  {staff.phone ? (
                                    <View style={styles.staffMetaRow}>
                                      <Phone size={11} color="#f43f5e" />
                                      <Text
                                        style={[styles.staffContactText, { color: theme.colors.mute }]}
                                        numberOfLines={1}
                                      >
                                        {staff.phone}
                                      </Text>
                                    </View>
                                  ) : null}

                                  {/* Line 4: Email */}
                                  {staff.email ? (
                                    <View style={styles.staffMetaRow}>
                                      <Mail size={11} color="#a855f7" />
                                      <Text
                                        style={[styles.staffContactText, { color: theme.colors.mute }]}
                                        numberOfLines={1}
                                      >
                                        {staff.email}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>

                                {/* Circular Radio / Checkbox Indicator */}
                                <View
                                  style={[
                                    styles.radioCircle,
                                    {
                                      borderColor: isSelected ? '#0284c7' : theme.colors.hairline,
                                      backgroundColor: isSelected ? '#0284c7' : 'transparent',
                                    },
                                  ]}
                                >
                                  {isSelected && <Check size={12} color="#ffffff" />}
                                </View>
                              </Pressable>
                            );
                          })}
                          {filteredSupervisors.length > visibleSupervisorLimit && (
                            <Pressable
                              variant="ghost"
                              haptic="tap"
                              onPress={() => setVisibleSupervisorLimit((prev) => prev + 25)}
                              style={styles.showMoreRow}
                            >
                              <Text variant="caption" style={{ color: '#0284c7' }}>
                                Show more ({filteredSupervisors.length - visibleSupervisorLimit} remaining)
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION 3: ASSIGNED OPERATORS (24H) (Screenshot 3 & 5) */}
              {/* ═══════════════════════════════════════════════════════ */}
              <View
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                    ASSIGNED OPERATORS (24H)
                  </Text>
                  <Text style={[styles.assignedShiftsCountText, { color: theme.colors.mute }]}>
                    {machineOperators.length}/3 Shifts Assigned
                  </Text>
                </View>

                {/* Operator Cards List */}
                <View style={styles.operatorsListContainer}>
                  {machineOperators.length === 0 ? (
                    <View
                      style={[
                        styles.emptyOperatorsWell,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Users size={22} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                      <Text style={[styles.emptyOperatorsTitle, { color: theme.colors.ink }]}>
                        No Operators Assigned
                      </Text>
                      <Text style={[styles.emptyOperatorsSubtitle, { color: theme.colors.mute }]}>
                        Assign operators below to designate 24h equipment coverage.
                      </Text>
                    </View>
                  ) : (
                    machineOperators.map((item, idx) => {
                      return (
                        <View
                          key={`${item.operatorId}-${item.shiftCode}-${idx}`}
                          style={[
                            styles.operatorCard,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          {/* Card Top Row: Number badge, Name, Shift badge, Trash button */}
                          <View style={styles.operatorCardHeader}>
                            <View style={styles.operatorCardLeftInfo}>
                              {/* Amber circle index badge */}
                              <View style={styles.operatorIndexCircle}>
                                <Text style={styles.operatorIndexText}>{idx + 1}</Text>
                              </View>

                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.operatorNameAndBadgeRow}>
                                  <Text
                                    style={[styles.operatorNameText, { color: theme.colors.ink }]}
                                    numberOfLines={1}
                                  >
                                    {item.operatorName}
                                  </Text>
                                  <View style={styles.shiftCodeBadge}>
                                    <Text style={styles.shiftCodeBadgeText}>
                                      SHIFT {item.shiftCode}
                                    </Text>
                                  </View>
                                </View>

                                {/* Contact string */}
                                {(item.phone || item.email) && (
                                  <Text
                                    style={[styles.operatorContactLine, { color: theme.colors.mute }]}
                                    numberOfLines={1}
                                  >
                                    {[item.phone, item.email].filter(Boolean).join(' • ')}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Trash Relieve Button */}
                            <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleRemoveOperator(idx)} style={styles.trashBtn} accessibilityLabel={`Remove ${item.operatorName}`}>
                              <Trash2 size={15} color="#ef4444" />
                            </Pressable>
                          </View>

                          {/* Shift Selection Section */}
                          <View
                            style={[
                              styles.shiftSelectorSection,
                              { borderTopColor: theme.colors.hairline },
                            ]}
                          >
                            <View style={styles.shiftSelectorLabelRow}>
                              <Clock size={11} color="#0284c7" />
                              <Text style={[styles.shiftSelectorLabel, { color: theme.colors.mute }]}>
                                SELECT ASSIGNED SHIFT:
                              </Text>
                            </View>

                            {/* Shift Cards Grow & Shrink Selector */}
                            <ShiftCardSelector
                              shiftCodes={clientShifts}
                              selectedCode={item.shiftCode}
                              onSelect={(sc) =>
                                handleChangeOperatorShift(idx, {
                                  ...sc,
                                  start_time: sc.start_time || '06:00 AM',
                                  end_time: sc.end_time || '02:00 PM',
                                })
                              }
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                {/* + Assign Operator Accordion / Search (Screenshot 3 & 5 Match) */}
                {machineOperators.length < 3 ? (
                  <View style={styles.addOperatorSection}>
                    <Pressable variant="card" haptic="select" onPress={() => { setIsAddOperatorOpen((prev) => !prev); setOperatorSearchQuery(''); }} style={[styles.addOperatorAccordionTrigger, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]} accessibilityRole="button">
                      <View style={styles.addOperatorTriggerLeft}>
                        <Plus size={14} color="#0284c7" />
                        <Text
                          style={[styles.addOperatorTriggerText, { color: theme.colors.ink }]}
                        >
                          Assign Operator ({machineOperators.length}/3) — Next Shift: {nextAvailableShift.code}
                        </Text>
                      </View>
                      <ChevronDown
                        size={14}
                        color={theme.colors.mute}
                        style={{
                          transform: [{ rotate: isAddOperatorOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    </Pressable>

                    {/* Expandable Operator Search & List */}
                    {isAddOperatorOpen && (
                      <View
                        style={[
                          styles.addOperatorExpandedPanel,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        {/* Search Bar */}
                        {/* Search Bar using canonical SearchInput */}
                        <SearchInput
                          placeholder="Search active operator by name..."
                          value={operatorSearchQuery}
                          onChangeText={setOperatorSearchQuery}
                          autoFocus
                          containerStyle={styles.searchBoxOverride}
                        />

                        {/* Operators List */}
                        <ScrollView
                          style={styles.addOperatorListScroll}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled
                        >
                          {availableOperators.length === 0 ? (
                            <View style={styles.dropdownEmptyRow}>
                              <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                              <Text variant="caption" style={[styles.dropdownEmptyText, { color: theme.colors.mute }]}>
                                {operatorSearchQuery
                                  ? `No operators matching "${operatorSearchQuery}"`
                                  : 'All operators currently assigned'}
                              </Text>
                              {Boolean(operatorSearchQuery) && (
                                <Pressable
                                  variant="ghost"
                                  haptic="tap"
                                  onPress={() => setOperatorSearchQuery('')}
                                  style={{ marginTop: 4, paddingVertical: 4, paddingHorizontal: 8 }}
                                >
                                  <Text variant="caption" style={{ color: '#0284c7' }}>Clear search</Text>
                                </Pressable>
                              )}
                            </View>
                          ) : (
                            <>
                              {displayedOperators.map((op) => {
                                const alreadyOnMach = machineOperators.filter(
                                  (m) => m.operatorId === op.id
                                ).length;
                                const fleetCount = fleetAssignments.filter(
                                  (a) => a.operator_id === op.id
                                ).length;

                                return (
                                  <Pressable key={op.id} variant="listRow" haptic="select" onPress={() => handleAddOperator(op)} style={[styles.operatorCandidateItem, { borderBottomColor: theme.colors.hairline }]}>
                                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                      <View style={styles.candidateNameRow}>
                                        <Text
                                          style={[
                                            styles.candidateNameText,
                                            { color: theme.colors.ink },
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {op.full_name}
                                        </Text>
                                        {alreadyOnMach > 0 ? (
                                          <View style={styles.alreadyOnMachinePill}>
                                            <Text style={styles.alreadyOnMachineText}>
                                              Already on machine ({alreadyOnMach}/3)
                                            </Text>
                                          </View>
                                        ) : fleetCount > 0 ? (
                                          <View style={styles.shiftsAssignedPill}>
                                            <Text style={styles.shiftsAssignedText}>
                                              {fleetCount}/3 Shifts
                                            </Text>
                                          </View>
                                        ) : (
                                          <View style={styles.availablePill}>
                                            <Text style={styles.availableText}>Available</Text>
                                          </View>
                                        )}
                                      </View>

                                      {op.phone ? (
                                        <Text
                                          style={[
                                            styles.candidatePhoneText,
                                            { color: theme.colors.mute },
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {op.phone}
                                        </Text>
                                      ) : null}
                                    </View>

                                    <View style={styles.addNextShiftBadge}>
                                      <Text style={styles.addNextShiftBadgeText}>
                                        + Shift {nextAvailableShift.code}
                                      </Text>
                                    </View>
                                  </Pressable>
                                );
                              })}
                              {availableOperators.length > visibleOperatorLimit && (
                                <Pressable
                                  variant="ghost"
                                  haptic="tap"
                                  onPress={() => setVisibleOperatorLimit((prev) => prev + 25)}
                                  style={styles.showMoreRow}
                                >
                                  <Text variant="caption" style={{ color: '#0284c7' }}>
                                    Show more ({availableOperators.length - visibleOperatorLimit} remaining)
                                  </Text>
                                </Pressable>
                              )}
                            </>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.fullCoverageBanner,
                      {
                        backgroundColor: isDark
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'rgba(16, 185, 129, 0.08)',
                        borderColor: isDark
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(16, 185, 129, 0.25)',
                      },
                    ]}
                  >
                    <Check size={14} color="#10b981" />
                    <Text style={styles.fullCoverageText}>
                      Full shift coverage roster (3/3 shifts assigned).
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* FOOTER ACTIONS (Screenshot 3 Match)                    */}
          {/* ═══════════════════════════════════════════════════════ */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Pressable variant="outline" haptic="tap" onPress={onClose} disabled={isSaving} style={[styles.cancelBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.cancelBtnText, { color: theme.colors.ink }]}>Cancel</Text>
            </Pressable>

            <Pressable variant="primary" haptic="none" onPress={handleSaveAssignments} disabled={isSaving || !activeMachine?.id} style={[styles.saveAssignmentsBtn, { backgroundColor: isSaving || !activeMachine?.id ? '#94a3b8' : '#0284c7' }]}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveAssignmentsBtnText}>Save Assignments</Text>
              )}
            </Pressable>
          </View>
        </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    width: '100%',
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'column',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm + 2,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: spacingNumeric.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerTitle: {
  },
  headerMachineCodePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  headerMachineCodeText: {
  },
  headerSubtitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll Area */
  scrollArea: {
    maxHeight: 620,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 28,
  },

  /* Loading & Error */
  loadingWrap: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  errorText: {
    color: '#ef4444',
    flex: 1,
  },

  /* Section Card */
  sectionCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 12,
    position: 'relative',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  countBadgeText: {
  },

  /* Triggers */
  selectTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  triggerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  machineTriggerCodePill: {
    backgroundColor: '#0284c718',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c733',
  },
  machineTriggerCodeText: {
    color: '#0284c7',
  },
  triggerSerialText: {
    flexShrink: 1,
  },

  /* Supervisor Multi-Select Trigger */
  supervisorTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  supervisorChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  placeholderText: {
  },
  supervisorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  supervisorChipText: {
  },
  chipRemoveBtn: {
    padding: 2,
  },
  supervisorTriggerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  clearBtnText: {
  },

  /* Anchored Popover Menus */
  dropdownInlinePanel: {
    marginTop: 10,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  searchBoxOverride: {
    marginBottom: 4,
  },
  checkIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  anchoredDropdownPopover: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      } as any,
    }),
  },
  dropdownListScroll: {
    maxHeight: 230,
  },
  dropdownEmptyRow: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  dropdownEmptyText: {
  },

  /* Machine Items inside Popover */
  machineDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  machineItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  machineItemModel: {
    flexShrink: 1,
  },
  machineItemCodeBadge: {
    backgroundColor: '#0284c718',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c733',
  },
  machineItemCodeText: {
    color: '#0284c7',
  },
  machineItemSerial: {
    marginTop: 2,
  },

  /* Supervisor Items inside Popover */
  supervisorSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
  },
  selectionCountText: {
  },
  deselectAllActionText: {
    color: '#0284c7',
  },
  staffCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  staffCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  staffCardName: {
    flexShrink: 1,
  },
  staffRoleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  staffRoleBadgeText: {
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  staffShiftTimeText: {
    color: '#10b981',
  },
  staffContactText: {
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  /* Section 3: Operator Roster */
  assignedShiftsCountText: {
  },
  operatorsListContainer: {
    gap: 10,
  },
  emptyOperatorsWell: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyOperatorsTitle: {
    marginTop: 4,
  },
  emptyOperatorsSubtitle: {
    textAlign: 'center',
  },

  /* Operator Card */
  operatorCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
  },
  operatorCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  operatorCardLeftInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  operatorIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  operatorIndexText: {
    color: '#d97706',
  },
  operatorNameAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  operatorNameText: {
    flexShrink: 1,
  },
  shiftCodeBadge: {
    backgroundColor: '#0284c718',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c733',
  },
  shiftCodeBadgeText: {
    color: '#0284c7',
  },
  operatorContactLine: {
    marginTop: 2,
  },
  trashBtn: {
    padding: 4,
    marginLeft: 6,
  },

  /* Shift Selection inside Operator Card */
  shiftSelectorSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  shiftSelectorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  shiftSelectorLabel: {
  },
  shiftsGrid: {
    gap: 6,
  },
  shiftButtonCard: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'space-between',
  },
  shiftButtonCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftCodePillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  shiftCodeMiniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c733',
  },
  shiftCodeMiniText: {
  },
  shiftButtonTitle: {
    flexShrink: 1,
  },
  shiftButtonCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  shiftButtonTiming: {
    flex: 1,
  },
  shiftDurationTag: {
  },

  /* Add Operator Accordion */
  addOperatorSection: {
    marginTop: 10,
  },
  addOperatorAccordionTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
  },
  addOperatorTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  addOperatorTriggerText: {
    flexShrink: 1,
  },
  addOperatorExpandedPanel: {
    marginTop: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 10,
  },
  addOperatorListScroll: {
    maxHeight: 180,
  },
  operatorCandidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  candidateNameText: {
  },
  availablePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  availableText: {
    color: '#059669',
  },
  alreadyOnMachinePill: {
    backgroundColor: '#0284c718',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c733',
  },
  alreadyOnMachineText: {
    color: '#0284c7',
  },
  shiftsAssignedPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  shiftsAssignedText: {
    color: '#d97706',
  },
  candidatePhoneText: {
    marginTop: 2,
  },
  addNextShiftBadge: {
    backgroundColor: '#0284c718',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: '#0284c740',
  },
  showMoreRow: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNextShiftBadgeText: {
    color: '#0284c7',
  },

  fullCoverageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: 6,
  },
  fullCoverageText: {
    color: '#10b981',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
  },
  saveAssignmentsBtn: {
    flex: 1,
    height: 44,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
      },
      default: {
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  saveAssignmentsBtnText: {
    color: '#ffffff',
  },
});
