/**
 * ReachInternational Mobile — Canonical Assign Machine Operator Dialog Box
 * 
 * 1. Modal Header: "Assign Machine Operator", Machine ID badge, Model & S/N subtitle, close (X).
 * 2. Section 1: "SELECT MACHINERY EQUIPMENT *" with canonical Badge count, pill trigger,
 *    and clean search dropdown popover (Model, Code pill, S/N, selected checkmark).
 * 3. Section 2: "ASSIGNED SUPERVISORS" with multi-select chips, Clear button,
 *    and clean search popover showing strictly SUPERVISOR role employees with full_name & employee_id.
 * 4. Section 3: "ASSIGNED OPERATORS (24H)" with "{count}/3 Shifts Assigned" Badge,
 *    operator cards (amber index, name, employee_id, shift badge, trash button,
 *    and S1/S2/S3 shift selector buttons), plus "+ Assign Operator" accordion search.
 * 5. Action Footer: "Cancel" & "Save Assignments" buttons with 44px min touch targets.
 * 6. Performance, Animations & UX:
 *    - Skeleton loading for smooth upward slide
 *    - Smooth LayoutAnimation transitions on dropdown expansion & contraction
 *    - Keyboard awareness with dynamic viewport sizing preventing menu clipping
 *    - Contained scroll containers with dedicated gutter padding preventing scrollbar overlap
 *    - Optimistic UI: instant haptic, toast, callback and downward slide on save
 *    - Lazy loading: Queries execute when selectors open with 30-60s cache TTL
 *    - 100% Geist Design System typography & zero raw typography properties
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTheme,
  ShiftCardSelector,
  SearchInput,
  Text,
  Badge,
  Skeleton,
  AppModal,
  showToast,
} from '../ui';
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
  AlertCircle,
  ChevronDown,
  Users,
  Trash2,
  Plus,
  Search,
  Shield,
  Lock,
} from '../ui/icon';
import {
  formatTo12Hour,
  parseTimeToMinutes,
} from '@reachinternational/utils';
import {
  useAssignPersonnelModalData,
  useClientShiftCodes,
  MachineOptionItem,
  DEFAULT_MODAL_SHIFTS,
  ClientShiftOption,
} from '../../lib/hooks/useAssignPersonnelModalData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EMPTY_ARRAY: any[] = Object.freeze([]) as any;

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
    employee_id?: string | null;
  } | null;
  userRole?: string;
  onSuccess?: (assignedOperators?: OperatorAssignmentRow[]) => void;
}

export type ClientShiftItem = ClientShiftOption;

export interface OperatorAssignmentRow {
  operatorId: string;
  operatorName: string;
  employeeId?: string | null;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime: string;
  shiftEndTime: string;
  assignmentId?: string;
}

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

/**
 * High-fidelity Skeleton loader matching exact modal layout and height
 * Ensures the bottom sheet slides up smoothly to its final height without layout shift.
 */
const AssignPersonnelModalSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={styles.scrollContent}>
      {/* Section 1 Skeleton */}
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
          <View style={styles.sectionLabelWithIcon}>
            <Skeleton width={14} height={14} borderRadius={3} />
            <Skeleton width={160} height={12} borderRadius={4} />
          </View>
          <Skeleton width={52} height={20} borderRadius={9999} />
        </View>
        <Skeleton
          width="100%"
          height={44}
          borderRadius={radiusNumeric.md}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Section 2 Skeleton */}
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
          <Skeleton width={140} height={12} borderRadius={4} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <Skeleton width={110} height={32} borderRadius={6} />
          <Skeleton width={90} height={32} borderRadius={6} />
        </View>
      </View>

      {/* Section 3 Skeleton */}
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
          <Skeleton width={150} height={12} borderRadius={4} />
          <Skeleton width={80} height={18} borderRadius={9999} />
        </View>
        <View
          style={[
            styles.operatorCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              marginTop: 8,
            },
          ]}
        >
          <View style={styles.operatorCardHeader}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Skeleton width={22} height={22} borderRadius={6} />
              <View style={{ gap: 4 }}>
                <Skeleton width={120} height={14} borderRadius={4} />
                <Skeleton width={80} height={10} borderRadius={4} />
              </View>
            </View>
            <Skeleton width={60} height={18} borderRadius={9999} />
          </View>
          <View style={{ marginTop: 12, gap: 6 }}>
            <Skeleton width={110} height={10} borderRadius={4} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Skeleton width="31%" height={46} borderRadius={8} />
              <Skeleton width="31%" height={46} borderRadius={8} />
              <Skeleton width="31%" height={46} borderRadius={8} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

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
  const queryClient = useQueryClient();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 640;
  const { user: authUser, role: authRole } = useAuth();
  const effectiveRole = (userRole || authRole || '').toLowerCase();
  const isSupervisorRole = effectiveRole === 'supervisor';
  const canEditSupervisor = (!effectiveRole || isManagerOrAbove(effectiveRole as any)) && !isSupervisorRole;

  // Active form state
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || '');
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [machineOperators, setMachineOperators] = useState<OperatorAssignmentRow[]>([]);
  const [initialDbAssignments, setInitialDbAssignments] = useState<any[]>([]);

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

  // Keyboard height awareness for dynamic dropdown positioning
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Sliced display limits for lazy rendering of large rosters
  const [visibleMachineLimit, setVisibleMachineLimit] = useState(25);
  const [visibleSupervisorLimit, setVisibleSupervisorLimit] = useState(25);
  const [visibleOperatorLimit, setVisibleOperatorLimit] = useState(25);

  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keyboard listeners for dynamic height calculation
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Compute dynamic max height for dropdown scroll containers
  const maxDropdownListHeight = useMemo(() => {
    if (keyboardHeight > 0) {
      return Math.max(130, Math.min(190, windowHeight - keyboardHeight - 280));
    }
    return 230;
  }, [windowHeight, keyboardHeight]);

  // Smooth layout animation helper
  const animateLayout = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {}
    }
  }, []);

  // Initialization tracking refs to prevent re-entrant loops and preserve user edits
  const initializedSupervisorMachineIdRef = useRef<string | null>(null);
  const hasInitializedRosterMachineIdRef = useRef<string | null>(null);

  // Reset initialization tracking when modal visibility closes
  useEffect(() => {
    if (!visible) {
      initializedSupervisorMachineIdRef.current = null;
      hasInitializedRosterMachineIdRef.current = null;
    }
  }, [visible]);

  // Derive relevant operator IDs on the active equipment to eagerly resolve metadata
  const relevantOperatorIdsKey = useMemo(() => {
    if (!selectedMachineId || !initialDbAssignments.length) return '';
    const ids = initialDbAssignments
      .filter((a) => a.machine_id === selectedMachineId && a.is_active !== false)
      .map((a) => a.operator_id);
    const effectiveOpId = targetUser?.role === 'operator' ? targetUser.id : initialOperatorId;
    if (effectiveOpId && !ids.includes(effectiveOpId)) {
      ids.push(effectiveOpId);
    }
    return [...ids].sort().join(',');
  }, [selectedMachineId, initialDbAssignments, targetUser?.role, targetUser?.id, initialOperatorId]);

  const relevantOperatorIds = useMemo(() => {
    return relevantOperatorIdsKey ? relevantOperatorIdsKey.split(',') : (EMPTY_ARRAY as string[]);
  }, [relevantOperatorIdsKey]);

  // 1. TanStack Query: Lazy data loading on modal open with 30-60s cache TTL
  const {
    data: modalData,
    isLoading: loadingData,
  } = useAssignPersonnelModalData({
    visible,
    isSupervisorRole,
    supervisorId: authUser?.id,
    isMachineDropdownOpen,
    isSupervisorDropdownOpen,
    isAddOperatorOpen,
    machineSearch: debouncedMachineSearch,
    supervisorSearch: debouncedSupervisorSearch,
    operatorSearch: debouncedOperatorSearch,
    relevantSupervisorIds: selectedSupervisorIds,
    relevantOperatorIds,
    initialMachineId,
  });

  const machines = modalData?.machines ?? EMPTY_ARRAY;
  const allSupervisors = modalData?.supervisors ?? EMPTY_ARRAY;
  const allOperators = modalData?.operators ?? EMPTY_ARRAY;
  const fleetAssignments = modalData?.fleetAssignments ?? EMPTY_ARRAY;

  // Active Machine resolution
  const activeMachine = useMemo((): MachineOptionItem | null => {
    if (!machines.length) return null;
    return machines.find((m) => m.id === selectedMachineId) || machines[0] || null;
  }, [machines, selectedMachineId]);

  // 2. Fetch client shift codes cached per client_id with 60s TTL
  const { data: clientShiftsData } = useClientShiftCodes(activeMachine?.client_id, visible);
  const clientShifts = useMemo(() => clientShiftsData || DEFAULT_MODAL_SHIFTS, [clientShiftsData]);

  // Resolve initial target machine
  useEffect(() => {
    if (!visible || !machines.length) return;

    let targetMachId = initialMachineId;
    if (!targetMachId && targetUser?.id) {
      const targetAss = fleetAssignments.find((a) => a.operator_id === targetUser.id);
      if (targetAss?.machine_id && machines.some((m) => m.id === targetAss.machine_id)) {
        targetMachId = targetAss.machine_id;
      }
    }
    if (!targetMachId) {
      targetMachId = selectedMachineId || machines[0]?.id || '';
    }
    if (targetMachId && targetMachId !== selectedMachineId) {
      setSelectedMachineId(targetMachId);
    }
  }, [visible, initialMachineId, targetUser?.id, machines, fleetAssignments, selectedMachineId]);

  // Debounced search queries
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

  // Synchronize supervisors and operator roster when activeMachine changes
  useEffect(() => {
    if (!visible || !activeMachine) return;

    // 1. Sync supervisor IDs only when initializing for a new active machine
    if (initializedSupervisorMachineIdRef.current !== activeMachine.id) {
      initializedSupervisorMachineIdRef.current = activeMachine.id;
      const supIds: string[] = Array.isArray(activeMachine.supervisor_ids)
        ? [...activeMachine.supervisor_ids]
        : activeMachine.current_supervisor_id
        ? [activeMachine.current_supervisor_id]
        : [];
      const effectiveSupId = targetUser?.role === 'supervisor' ? targetUser.id : initialSupervisorId;
      if (effectiveSupId && !supIds.includes(effectiveSupId)) {
        supIds.push(effectiveSupId);
      }
      setSelectedSupervisorIds((prev) => {
        if (
          prev.length === supIds.length &&
          prev.every((id, idx) => id === supIds[idx])
        ) {
          return prev;
        }
        return supIds;
      });
    }

    // 2. Derive active operator assignments for this machine from fleet assignments (Zero extra network call)
    const activeOnThisMachine = fleetAssignments.filter(
      (a) => a.machine_id === activeMachine.id && a.is_active !== false
    );
    setInitialDbAssignments((prev) => {
      if (
        prev.length === activeOnThisMachine.length &&
        prev.every((item, idx) => item.id === activeOnThisMachine[idx]?.id)
      ) {
        return prev;
      }
      return activeOnThisMachine;
    });

    const isNewMachineForRoster = hasInitializedRosterMachineIdRef.current !== activeMachine.id;
    if (isNewMachineForRoster) {
      hasInitializedRosterMachineIdRef.current = activeMachine.id;

      const mapped: OperatorAssignmentRow[] = activeOnThisMachine.map((r) => {
        const opInfo = allOperators.find((o) => o.id === r.operator_id);
        return {
          assignmentId: r.id,
          operatorId: r.operator_id,
          operatorName: opInfo?.full_name || 'Operator',
          employeeId: opInfo?.employee_id || null,
          phone: null,
          email: null,
          shiftCode: (r.shift_code || 'S1').toUpperCase(),
          shiftStartTime: formatTo12Hour(r.shift_start_time) || r.shift_start_time || '06:00 AM',
          shiftEndTime: formatTo12Hour(r.shift_end_time) || r.shift_end_time || '02:00 PM',
        };
      });

      // If targetUser or initialOperatorId was passed, pre-add if capacity permits
      const effectiveOpId = targetUser?.role === 'operator' ? targetUser.id : initialOperatorId;
      if (effectiveOpId && !mapped.some((m) => m.operatorId === effectiveOpId) && mapped.length < 3) {
        const opObj = allOperators.find((u) => u.id === effectiveOpId) || (targetUser?.id === effectiveOpId ? targetUser : null);
        if (opObj) {
          const usedCodes = new Set(mapped.map((m) => m.shiftCode.toUpperCase()));
          const nextShift = clientShifts.find((s) => !usedCodes.has(s.code.toUpperCase())) || clientShifts[0] || DEFAULT_MODAL_SHIFTS[0];
          mapped.push({
            operatorId: opObj.id,
            operatorName: opObj.full_name || 'Operator',
            employeeId: (opObj as any).employee_id || (targetUser as any)?.employee_id || null,
            phone: null,
            email: null,
            shiftCode: nextShift.code.toUpperCase(),
            shiftStartTime: nextShift.start_time,
            shiftEndTime: nextShift.end_time,
          });
        }
      }

      setMachineOperators(mapped);
    } else {
      // Machine is same, but allOperators metadata might have resolved: hydrate missing operatorName/employeeId
      if (allOperators.length > 0) {
        setMachineOperators((prev) => {
          let hasDiff = false;
          const updated = prev.map((row) => {
            if (row.operatorName === 'Operator' || !row.employeeId) {
              const op = allOperators.find((o) => o.id === row.operatorId);
              if (op && (op.full_name !== row.operatorName || op.employee_id !== row.employeeId)) {
                hasDiff = true;
                return {
                  ...row,
                  operatorName: op.full_name || row.operatorName,
                  employeeId: op.employee_id ?? row.employeeId,
                };
              }
            }
            return row;
          });
          return hasDiff ? updated : prev;
        });
      }
    }
  }, [
    visible,
    activeMachine?.id,
    activeMachine?.current_supervisor_id,
    activeMachine?.supervisor_ids,
    fleetAssignments,
    allOperators,
    initialOperatorId,
    initialSupervisorId,
    targetUser,
    clientShifts,
  ]);

  // Compute next available shift code
  const nextAvailableShift = useMemo((): ClientShiftItem => {
    const assignedCodes = new Set(machineOperators.map((o) => o.shiftCode.toUpperCase()));
    return clientShifts.find((s) => !assignedCodes.has(s.code.toUpperCase())) || clientShifts[0] || DEFAULT_MODAL_SHIFTS[0];
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

  // Filtered Supervisors for Supervisor Dropdown (Strictly role = 'supervisor', show only name & employee_id)
  const filteredSupervisors = useMemo(() => {
    const q = debouncedSupervisorSearch.trim().toLowerCase();
    if (!q) return allSupervisors;
    return allSupervisors.filter((s) => {
      const nameMatch = (s.full_name || '').toLowerCase().includes(q);
      const idMatch = (s.employee_id || '').toLowerCase().includes(q);
      return nameMatch || idMatch;
    });
  }, [allSupervisors, debouncedSupervisorSearch]);

  const displayedSupervisors = useMemo(() => {
    return filteredSupervisors.slice(0, visibleSupervisorLimit);
  }, [filteredSupervisors, visibleSupervisorLimit]);

  // Filtered Operators for "+ Assign Operator" list (Show only name & employee_id)
  const availableOperators = useMemo(() => {
    const q = debouncedOperatorSearch.trim().toLowerCase();
    return allOperators.filter((op) => {
      const opFleetAssignments = fleetAssignments.filter((a) => a.operator_id === op.id);
      const isAlreadyOnThisMach = machineOperators.filter((a) => a.operatorId === op.id).length;
      if (opFleetAssignments.length >= 3 && isAlreadyOnThisMach === 0) return false;

      if (!q) return true;
      const nameMatch = (op.full_name || '').toLowerCase().includes(q);
      const idMatch = (op.employee_id || '').toLowerCase().includes(q);
      return nameMatch || idMatch;
    });
  }, [allOperators, fleetAssignments, machineOperators, debouncedOperatorSearch]);

  const displayedOperators = useMemo(() => {
    return availableOperators.slice(0, visibleOperatorLimit);
  }, [availableOperators, visibleOperatorLimit]);

  // Dropdown toggle handlers with smooth LayoutAnimation
  const toggleMachineDropdown = () => {
    triggerHaptic('selection');
    animateLayout();
    setIsMachineDropdownOpen((prev) => !prev);
    setIsSupervisorDropdownOpen(false);
    setMachineSearchQuery('');
  };

  const toggleSupervisorDropdown = () => {
    if (!canEditSupervisor) return;
    triggerHaptic('selection');
    animateLayout();
    setIsSupervisorDropdownOpen((prev) => !prev);
    setIsMachineDropdownOpen(false);
    setSupervisorSearchQuery('');
  };

  const toggleAddOperator = () => {
    triggerHaptic('selection');
    animateLayout();
    setIsAddOperatorOpen((prev) => !prev);
    setOperatorSearchQuery('');
  };

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
    animateLayout();
    setSubmitError(null);
    setSelectedSupervisorIds((prev) => prev.filter((id) => id !== supId));
  };

  const clearAllSupervisors = () => {
    triggerHaptic('impact');
    animateLayout();
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
    animateLayout();
    setSubmitError(null);
    if (machineOperators.length >= 3) return;

    const shift = nextAvailableShift;
    const newRow: OperatorAssignmentRow = {
      operatorId: op.id,
      operatorName: op.full_name,
      employeeId: op.employee_id || null,
      phone: null,
      email: null,
      shiftCode: shift.code.toUpperCase(),
      shiftStartTime: shift.start_time,
      shiftEndTime: shift.end_time,
    };

    setMachineOperators((prev) => [...prev, newRow]);
    setOperatorSearchQuery('');

    if (machineOperators.length + 1 >= 3) {
      setIsAddOperatorOpen(false);
    }
  };

  const handleRemoveOperator = (index: number) => {
    triggerHaptic('impact');
    animateLayout();
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

  // ═════════════════════════════════════════════════════════════════════════
  // Optimistic UI Save Handler
  // 1. Performs instant client-side validation
  // 2. Immediately triggers success haptic, fires toast, invokes onSuccess,
  //    and smoothly closes the modal downward (0ms lag, zero blocking spinner)
  // 3. Executes database mutations and RPCs asynchronously in the background
  // 4. In case of background error: alerts with toast and rolls back cache
  // ═════════════════════════════════════════════════════════════════════════
  const savingRef = useRef(false);
  const handleSaveAssignments = async () => {
    if (!activeMachine?.id) return;
    if (savingRef.current) return;
    savingRef.current = true;
    triggerHaptic('selection');
    setSubmitError(null);

    // 1. Local validation: Duplicate shifts on the same equipment
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

    // ═══════════════════════════════════════════════════════════════════════
    // OPTIMISTIC TRANSITION: Instant Feedback & Smooth Downward Slide Exit
    // ═══════════════════════════════════════════════════════════════════════
    const currentRosterSnapshot = [...machineOperators];
    const targetMachineSnapshot = { ...activeMachine };
    const selectedSupervisorsSnapshot = [...selectedSupervisorIds];
    const relievedAssignmentsSnapshot = [...initialDbAssignments];

    triggerHaptic('success');
    showToast('success', 'Assignment Saved', 'Operator assignment updated successfully.');
    if (onSuccess) onSuccess(currentRosterSnapshot);
    onClose();

    // Background Execution Task
    (async () => {
      try {
        const { data: userAuth } = await supabase.auth.getUser();
        const currentUserId = userAuth?.user?.id || null;

        const isNeedsActivation = Boolean(
          targetMachineSnapshot.health_status === 'breakdown' ||
          targetMachineSnapshot.health_status === 'under_maintenance' ||
          targetMachineSnapshot.status === 'under_maintenance'
        );

        const machineUpdatePayload: any = {
          operator_ids: Array.from(new Set(currentRosterSnapshot.map((o) => o.operatorId))),
          current_operator_id: currentRosterSnapshot[0]?.operatorId || null,
          updated_at: new Date().toISOString(),
        };

        if (canEditSupervisor) {
          machineUpdatePayload.supervisor_ids = selectedSupervisorsSnapshot;
          machineUpdatePayload.current_supervisor_id = selectedSupervisorsSnapshot[0] || null;
        }

        if (isNeedsActivation) {
          machineUpdatePayload.health_status = 'active';
          machineUpdatePayload.status = targetMachineSnapshot.client_id ? 'rented' : 'active';
        }

        const { error: machineUpdateError } = await supabase
          .from('machines')
          .update(machineUpdatePayload)
          .eq('id', targetMachineSnapshot.id);

        if (machineUpdateError) throw machineUpdateError;

        // Relieve assignments that existed in DB but were removed from current roster
        for (const initAss of relievedAssignmentsSnapshot) {
          const stillPresent = currentRosterSnapshot.some(
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

        // Atomically assign/update operators on this machine
        for (const opItem of currentRosterSnapshot) {
          const alreadyActive = relievedAssignmentsSnapshot.some(
            (a) =>
              a.operator_id === opItem.operatorId &&
              a.shift_code?.toUpperCase() === opItem.shiftCode.toUpperCase() &&
              a.is_active !== false
          );

          if (!alreadyActive) {
            const { error: rpcErr } = await supabase.rpc('assign_operator_machine_atomic', {
              p_machine_id: targetMachineSnapshot.id,
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

        // Real-time broadcast for instant synchronization across all connected clients
        broadcastMobileAssignmentChanged({
          action: 'assigned',
          machineId: targetMachineSnapshot.id,
          operatorId: currentRosterSnapshot[0]?.operatorId || '',
          shiftCode: currentRosterSnapshot[0]?.shiftCode || '',
        });

        // Targeted cache invalidation
        queryClient.invalidateQueries({ queryKey: ['operations-today-shift-monitor'] });
        queryClient.invalidateQueries({ queryKey: ['machines'] });
        queryClient.invalidateQueries({ queryKey: ['assign-personnel-modal-data'] });
      } catch (err: any) {
        triggerHaptic('error');
        let msg = err?.message || 'Failed to sync assignments to server.';
        if (err?.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('3 active shifts')) {
          msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
        } else if (msg.includes('OVERLAPPING_SHIFT_FOR_OPERATOR') || msg.includes('overlap') || msg.includes('conflict')) {
          msg = 'Shift schedule conflicts with another active assignment for this operator.';
        }
        showToast('error', 'Assignment Sync Error', msg);
        // Invalidate to reconcile UI back to database state
        queryClient.invalidateQueries({ queryKey: ['operations-today-shift-monitor'] });
        queryClient.invalidateQueries({ queryKey: ['machines'] });
        queryClient.invalidateQueries({ queryKey: ['assign-personnel-modal-data'] });
      } finally {
        savingRef.current = false;
      }
    })();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ width: '100%', flexShrink: 1 }}
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
              <Text variant="heading" style={{ color: theme.colors.ink }}>
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
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <AssignPersonnelModalSkeleton />
            </ScrollView>
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
                      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                      borderColor: isDark ? '#991b1b' : '#fecaca',
                    },
                  ]}
                >
                  <AlertCircle size={15} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text variant="caption" style={styles.errorText}>{submitError}</Text>
                </View>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* SECTION 1: SELECT MACHINERY EQUIPMENT                   */}
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
                    <Truck size={13} color="#0284c7" />
                    <Text variant="micro" style={{ color: theme.colors.mute }}>
                      SELECT MACHINERY EQUIPMENT
                    </Text>
                    <Text variant="micro" style={{ color: '#ef4444' }}>*</Text>
                  </View>
                  <Badge
                    variant="outline"
                    size="sm"
                    label={`${machines.length} Total`}
                  />
                </View>

                {/* Trigger Button */}
                <Pressable
                  variant="card"
                  haptic="select"
                  onPress={toggleMachineDropdown}
                  style={[
                    styles.selectTriggerBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: isMachineDropdownOpen ? '#0284c7' : theme.colors.hairline,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Select machine"
                >
                  <View style={styles.triggerValueRow}>
                    <Badge
                      variant="info"
                      size="sm"
                      label={activeMachine?.machine_id || 'M/C-0001'}
                    />
                    {activeMachine?.model && (
                      <Text variant="body" style={{ color: theme.colors.ink }} numberOfLines={1}>
                        {activeMachine.model}
                      </Text>
                    )}
                    <Text
                      variant="caption"
                      style={{ color: theme.colors.mute, flexShrink: 1 }}
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
                    <SearchInput
                      placeholder="Search by Model, Code, S/N..."
                      value={machineSearchQuery}
                      onChangeText={setMachineSearchQuery}
                      autoFocus
                      containerStyle={styles.searchBoxOverride}
                    />

                    {/* Machine List */}
                    <ScrollView
                      style={[styles.dropdownListScroll, { maxHeight: maxDropdownListHeight }]}
                      contentContainerStyle={styles.dropdownListScrollContent}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredMachines.length === 0 ? (
                        <View style={styles.dropdownEmptyRow}>
                          <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
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
                                      ? (isDark ? '#082f49' : '#f0f9ff')
                                      : theme.colors.canvas,
                                    borderColor: isSelected
                                      ? (isDark ? '#38bdf8' : '#bae6fd')
                                      : theme.colors.hairline,
                                  },
                                ]}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <View style={styles.machineItemTopRow}>
                                    <Text
                                      variant="body"
                                      style={{
                                        color: isSelected ? '#0284c7' : theme.colors.ink,
                                        flexShrink: 1,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {m.model || 'Equipment'}
                                    </Text>
                                    <Badge
                                      variant="info"
                                      size="sm"
                                      label={m.machine_id}
                                    />
                                  </View>
                                  <Text
                                    variant="caption"
                                    style={{ color: theme.colors.mute, marginTop: 2 }}
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
                    style={[
                      styles.maintenanceWarningBanner,
                      {
                        backgroundColor: isDark ? '#450a0a' : '#fee2e2',
                        borderColor: isDark ? '#991b1b' : '#fca5a5',
                      },
                    ]}
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
              {/* SECTION 2: ASSIGNED SUPERVISORS (Role = Supervisor Only) */}
              {/* Shows only supervisor name and employee ID               */}
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
                  <Text variant="micro" style={{ color: theme.colors.mute }}>
                    ASSIGNED SUPERVISORS
                  </Text>
                  {!canEditSupervisor && (
                    <Badge variant="outline" size="sm" label="Read Only" />
                  )}
                </View>

                {!canEditSupervisor && (
                  <View
                    style={[
                      styles.supervisorReadOnlyBanner,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
                      },
                    ]}
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
                  onPress={toggleSupervisorDropdown}
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
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
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
                            <Text variant="label" style={{ color: theme.colors.ink }}>
                              {name}
                            </Text>
                            {Boolean(sup?.employee_id) && (
                              <Badge variant="outline" size="sm" label={sup?.employee_id || ''} />
                            )}
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
                                <X size={12} color={theme.colors.mute} />
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
                        <Text variant="caption" style={{ color: theme.colors.mute }}>
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

                {/* Supervisor Inline Dropdown Panel (Only role = supervisor, name & employee_id) */}
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
                    <SearchInput
                      placeholder="Search supervisors by name or ID..."
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
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        {selectedSupervisorIds.length} of {allSupervisors.length} selected
                      </Text>
                      <Pressable variant="ghost" haptic="tap" hitSlopToMin48 onPress={deselectAllSupervisors}>
                        <Text variant="caption" style={{ color: '#0284c7' }}>
                          {selectedSupervisorIds.length > 0 ? 'Deselect All' : 'Select'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Staff List with contained scrollbar padding */}
                    <ScrollView
                      style={[styles.dropdownListScroll, { maxHeight: maxDropdownListHeight }]}
                      contentContainerStyle={styles.dropdownListScrollContent}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredSupervisors.length === 0 ? (
                        <View style={styles.dropdownEmptyRow}>
                          <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
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
                                  <View style={styles.staffCardTopRow}>
                                    <Text
                                      variant="label"
                                      style={{ color: theme.colors.ink, flexShrink: 1 }}
                                      numberOfLines={1}
                                    >
                                      {staff.full_name}
                                    </Text>
                                    {Boolean(staff.employee_id) && (
                                      <Badge
                                        variant="outline"
                                        size="sm"
                                        label={staff.employee_id || ''}
                                      />
                                    )}
                                  </View>
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
              {/* SECTION 3: ASSIGNED OPERATORS (24H)                      */}
              {/* Shows only operator name and employee ID                 */}
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
                  <Text variant="micro" style={{ color: theme.colors.mute }}>
                    ASSIGNED OPERATORS (24H)
                  </Text>
                  <Badge
                    variant={machineOperators.length === 3 ? 'success' : 'outline'}
                    size="sm"
                    label={`${machineOperators.length}/3 Shifts Assigned`}
                  />
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
                      <Text variant="label" style={{ color: theme.colors.ink, marginTop: 4 }}>
                        No Operators Assigned
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center' }}>
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
                          {/* Card Top Row: Number badge, Name, Employee ID, Shift badge, Trash button */}
                          <View style={styles.operatorCardHeader}>
                            <View style={styles.operatorCardLeftInfo}>
                              {/* Amber index badge */}
                              <View
                                style={[
                                  styles.operatorIndexCircle,
                                  {
                                    backgroundColor: isDark ? '#451a03' : '#fef3c7',
                                  },
                                ]}
                              >
                                <Text variant="caption" style={{ color: '#d97706' }}>
                                  {idx + 1}
                                </Text>
                              </View>

                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.operatorNameAndBadgeRow}>
                                  <Text
                                    variant="label"
                                    style={{ color: theme.colors.ink, flexShrink: 1 }}
                                    numberOfLines={1}
                                  >
                                    {item.operatorName}
                                  </Text>
                                  <Badge
                                    variant="info"
                                    size="sm"
                                    label={`SHIFT ${item.shiftCode}`}
                                  />
                                </View>

                                {/* Employee ID string */}
                                {Boolean(item.employeeId) && (
                                  <Text
                                    variant="caption"
                                    style={{ color: theme.colors.mute, marginTop: 2 }}
                                    numberOfLines={1}
                                  >
                                    {item.employeeId}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Trash Relieve Button */}
                            <Pressable
                              variant="iconButton"
                              haptic="tap"
                              hitSlopToMin48
                              onPress={() => handleRemoveOperator(idx)}
                              style={styles.trashBtn}
                              accessibilityLabel={`Remove ${item.operatorName}`}
                            >
                              <Trash2 size={16} color="#ef4444" />
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
                              <Text variant="micro" style={{ color: theme.colors.mute }}>
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

                {/* + Assign Operator Accordion / Search */}
                {machineOperators.length < 3 ? (
                  <View style={styles.addOperatorSection}>
                    <Pressable
                      variant="card"
                      haptic="select"
                      onPress={toggleAddOperator}
                      style={[
                        styles.addOperatorAccordionTrigger,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.addOperatorTriggerLeft}>
                        <Plus size={14} color="#0284c7" />
                        <Text
                          variant="label"
                          style={{ color: theme.colors.ink, flexShrink: 1 }}
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
                        <SearchInput
                          placeholder="Search active operator by name or ID..."
                          value={operatorSearchQuery}
                          onChangeText={setOperatorSearchQuery}
                          autoFocus
                          containerStyle={styles.searchBoxOverride}
                        />

                        {/* Operators List with contained scrollbar padding */}
                        <ScrollView
                          style={[styles.addOperatorListScroll, { maxHeight: maxDropdownListHeight }]}
                          contentContainerStyle={styles.addOperatorListScrollContent}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={true}
                        >
                          {availableOperators.length === 0 ? (
                            <View style={styles.dropdownEmptyRow}>
                              <Search size={16} color={theme.colors.mute} style={{ opacity: 0.6 }} />
                              <Text variant="caption" style={{ color: theme.colors.mute }}>
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
                                  <Pressable
                                    key={op.id}
                                    variant="listRow"
                                    haptic="select"
                                    onPress={() => handleAddOperator(op)}
                                    style={[
                                      styles.operatorCandidateItem,
                                      { borderBottomColor: theme.colors.hairline },
                                    ]}
                                  >
                                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                      <View style={styles.candidateNameRow}>
                                        <Text
                                          variant="label"
                                          style={{ color: theme.colors.ink }}
                                          numberOfLines={1}
                                        >
                                          {op.full_name}
                                        </Text>
                                        {Boolean(op.employee_id) && (
                                          <Badge
                                            variant="outline"
                                            size="sm"
                                            label={op.employee_id || ''}
                                          />
                                        )}
                                        {alreadyOnMach > 0 ? (
                                          <Badge
                                            variant="info"
                                            size="sm"
                                            label={`Already on machine (${alreadyOnMach}/3)`}
                                          />
                                        ) : fleetCount > 0 ? (
                                          <Badge
                                            variant="warning"
                                            size="sm"
                                            label={`${fleetCount}/3 Shifts`}
                                          />
                                        ) : (
                                          <Badge
                                            variant="success"
                                            size="sm"
                                            label="Available"
                                          />
                                        )}
                                      </View>
                                    </View>

                                    <Badge
                                      variant="info"
                                      size="sm"
                                      label={`+ Shift ${nextAvailableShift.code}`}
                                    />
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
                        backgroundColor: isDark ? '#022c22' : '#f0fdf4',
                        borderColor: isDark ? '#065f46' : '#bbf7d0',
                      },
                    ]}
                  >
                    <Check size={14} color="#10b981" />
                    <Text variant="caption" style={{ color: '#10b981' }}>
                      Full shift coverage roster (3/3 shifts assigned).
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* FOOTER ACTIONS                                          */}
          {/* ═══════════════════════════════════════════════════════ */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Pressable
              variant="outline"
              haptic="tap"
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="label" style={{ color: theme.colors.ink }}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              variant="primary"
              haptic="none"
              onPress={handleSaveAssignments}
              disabled={!activeMachine?.id}
              style={[
                styles.saveAssignmentsBtn,
                {
                  backgroundColor: !activeMachine?.id ? '#94a3b8' : '#0284c7',
                },
              ]}
            >
              <Text variant="label" style={{ color: '#ffffff' }}>
                Save Assignments
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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

  /* Error Banner */
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
    gap: 5,
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
  supervisorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
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
  supervisorReadOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
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
  dropdownListScroll: {
    maxHeight: 230,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        scrollbarWidth: 'thin',
        scrollbarGutter: 'stable',
      },
    }),
  },
  dropdownListScrollContent: {
    paddingRight: 10,
    paddingLeft: 2,
    paddingVertical: 2,
  },
  dropdownEmptyRow: {
    paddingVertical: 18,
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  operatorNameAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  addOperatorExpandedPanel: {
    marginTop: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 10,
  },
  addOperatorListScroll: {
    maxHeight: 180,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        scrollbarWidth: 'thin',
        scrollbarGutter: 'stable',
      },
    }),
  },
  addOperatorListScrollContent: {
    paddingRight: 12,
    paddingLeft: 2,
    paddingVertical: 2,
  },
  operatorCandidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 6,
    borderBottomWidth: 1,
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  showMoreRow: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  maintenanceWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
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
});
