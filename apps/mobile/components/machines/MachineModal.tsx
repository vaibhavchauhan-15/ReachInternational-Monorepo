import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Input, useTheme, SearchableSelect, ShiftCardSelector, SearchInput, Text, type SelectOption, AppModal, showToast } from '../ui';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';
import { Pressable } from '../ui/touch/Pressable';
import { formatTo12Hour, parseTimeToMinutes, sanitizeDatabaseError } from '@reachinternational/utils';
import { X, ChevronDown, AlertCircle, Check, Clock, Search, Phone, Plus } from '../ui/icon';
import { type SelectableUser } from './MultiUserSelectModal';
import { type SelectableClient } from './ClientSelectModal';

export interface MachineModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (savedMachine?: any) => void;
  machineToEdit?: any | null;
  userRole?: string | null;
  initialSection?: 'all' | 'info' | 'personnel' | 'client';
}

const HEALTH_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active', dotColor: '#10b981' },
  { value: 'spare', label: 'Spare', dotColor: '#06b6d4' },
  { value: 'under_maintenance', label: 'Under Maintenance', dotColor: '#f59e0b' },
  { value: 'breakdown', label: 'Breakdown', dotColor: '#ef4444' },
];

export const DEFAULT_MOBILE_SHIFTS: Array<{
  code: string;
  name: string;
  start_time: string;
  end_time: string;
}> = [
  { code: 'S1', name: 'Shift S1', start_time: '06:00:00', end_time: '14:00:00' },
  { code: 'S2', name: 'Shift S2', start_time: '14:00:00', end_time: '22:00:00' },
  { code: 'S3', name: 'Shift S3', start_time: '22:00:00', end_time: '06:00:00' },
];

export interface MobileActiveAssignment {
  operator_id: string;
  machine_id: string;
  shift_code: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  machine_code?: string;
}

function shiftToMinuteRanges(startStr?: string | null, endStr?: string | null): Array<[number, number]> {
  if (!startStr || !endStr) return [];
  const s = parseTimeToMinutes(startStr);
  const e = parseTimeToMinutes(endStr);
  if (s === null || e === null) return [];
  if (e <= s) {
    return [[s, 1440], [0, e]];
  }
  return [[s, e]];
}

function doRangesOverlap(rangesA: Array<[number, number]>, rangesB: Array<[number, number]>): boolean {
  for (const [sA, eA] of rangesA) {
    for (const [sB, eB] of rangesB) {
      if (sA < eB && eA > sB) return true;
    }
  }
  return false;
}

// Session cache for mobile machine modal dropdown options
interface MobileModalOptionsCache {
  supervisors: SelectableUser[];
  operators: SelectableUser[];
  clients: SelectableClient[];
  activeAssignments: MobileActiveAssignment[];
  timestamp: number;
}
let mobileModalOptionsCache: MobileModalOptionsCache | null = null;
const CACHE_TTL_MS = 60_000;

export function invalidateMobileModalOptionsCache() {
  mobileModalOptionsCache = null;
}

export const MachineModal: React.FC<MachineModalProps> = ({
  visible,
  onClose,
  onSuccess,
  machineToEdit,
  userRole,
  initialSection = 'all',
}) => {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const normalizedRole = (userRole || '').toLowerCase();
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const isEdit = Boolean(machineToEdit);

  // Form state
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [yearOfMfg, setYearOfMfg] = useState('');
  const [hourMeter, setHourMeter] = useState('0');
  const [healthStatus, setHealthStatus] = useState<string>('active');
  const [rentalStatus, setRentalStatus] = useState<string>('available');

  // Personnel assignments
  const [supervisorIds, setSupervisorIds] = useState<string[]>([]);
  const [operatorIds, setOperatorIds] = useState<string[]>([]);
  const [operatorShifts, setOperatorShifts] = useState<Record<string, string>>({});
  const [clientShifts, setClientShifts] = useState(DEFAULT_MOBILE_SHIFTS);
  const [selectedClient, setSelectedClient] = useState<SelectableClient | null>(null);
  const [siteId, setSiteId] = useState<string>('');
  const [clientSites, setClientSites] = useState<Array<{
    id: string;
    site_name: string;
    site_code: string;
    city: string;
    street?: string;
    district?: string;
    pincode?: string;
  }>>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);

  // Available data lists from Supabase
  const [supervisorsList, setSupervisorsList] = useState<SelectableUser[]>([]);
  const [operatorsList, setOperatorsList] = useState<SelectableUser[]>([]);
  const [clientsList, setClientsList] = useState<SelectableClient[]>([]);
  const [activeAssignmentsList, setActiveAssignmentsList] = useState<MobileActiveAssignment[]>([]);

  // Dropdown popover states
  const [isSupervisorDropdownOpen, setIsSupervisorDropdownOpen] = useState(false);
  const [isOperatorDropdownOpen, setIsOperatorDropdownOpen] = useState(false);
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState('');
  const [operatorSearchQuery, setOperatorSearchQuery] = useState('');

  // Web outside-click and Escape key dismissal
  useEffect(() => {
    if (Platform.OS !== 'web' || (!isSupervisorDropdownOpen && !isOperatorDropdownOpen)) return;

    const handleWebClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-dropdown-container]')) {
        setIsSupervisorDropdownOpen(false);
        setIsOperatorDropdownOpen(false);
      }
    };

    const handleWebKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSupervisorDropdownOpen(false);
        setIsOperatorDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleWebClick);
    document.addEventListener('keydown', handleWebKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleWebClick);
      document.removeEventListener('keydown', handleWebKeyDown);
    };
  }, [isSupervisorDropdownOpen, isOperatorDropdownOpen]);

  // Memoized client options for SearchableSelect
  const clientOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'None (Unassigned / Available)' },
      ...clientsList.map((c) => ({
        value: c.id,
        label: c.company_name,
        code: c.code,
        description: [c.contact_person, c.phone, c.city].filter(Boolean).join(' • ') || undefined,
      })),
    ];
  }, [clientsList]);

  // Errors & loading
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (machineToEdit) {
        setModel(machineToEdit.model ? String(machineToEdit.model) : '');
        setSerialNumber(machineToEdit.serial_number ? String(machineToEdit.serial_number) : '');
        setManufacturer(machineToEdit.manufacturer ? String(machineToEdit.manufacturer) : '');
        setYearOfMfg(machineToEdit.year_of_mfg != null ? String(machineToEdit.year_of_mfg) : '');
        setHourMeter(String(machineToEdit.hour_meter ?? 0));
        setHealthStatus(machineToEdit.health_status || 'active');
        setRentalStatus(machineToEdit.status || 'available');

        // Extract supervisor IDs
        const sups = Array.isArray(machineToEdit.supervisor_ids)
          ? machineToEdit.supervisor_ids
          : machineToEdit.current_supervisor_id || machineToEdit.supervisor_id
          ? [machineToEdit.current_supervisor_id || machineToEdit.supervisor_id]
          : [];
        setSupervisorIds(sups);

        // Extract operator IDs
        const ops = Array.isArray(machineToEdit.operator_ids)
          ? machineToEdit.operator_ids
          : machineToEdit.current_operator_id || machineToEdit.operator_id
          ? [machineToEdit.current_operator_id || machineToEdit.operator_id]
          : [];
        setOperatorIds(ops);

        // Extract operator shift codes
        const initialShifts: Record<string, string> = {};
        if (Array.isArray(machineToEdit.operators)) {
          machineToEdit.operators.forEach((o: any, idx: number) => {
            if (o?.id) {
              initialShifts[o.id] = (o.shift_code || DEFAULT_MOBILE_SHIFTS[idx % DEFAULT_MOBILE_SHIFTS.length].code).toUpperCase();
            }
          });
        }
        ops.forEach((id: string, idx: number) => {
          if (!initialShifts[id]) {
            initialShifts[id] = DEFAULT_MOBILE_SHIFTS[idx % DEFAULT_MOBILE_SHIFTS.length].code;
          }
        });
        setOperatorShifts(initialShifts);

        if (machineToEdit.client) {
          setSelectedClient(machineToEdit.client);
        } else if (machineToEdit.client_id) {
          setSelectedClient({
            id: machineToEdit.client_id,
            company_name: machineToEdit.customer_name || 'Assigned Client',
          });
        } else {
          setSelectedClient(null);
        }
        setSiteId(machineToEdit.site_id ? String(machineToEdit.site_id) : '');
      } else {
        setModel('');
        setSerialNumber('');
        setManufacturer('');
        setYearOfMfg(new Date().getFullYear().toString());
        setHourMeter('0');
        setHealthStatus('active');
        setRentalStatus('available');
        setSupervisorIds([]);
        setOperatorIds([]);
        setOperatorShifts({});
        setClientShifts(DEFAULT_MOBILE_SHIFTS);
        setSelectedClient(null);
        setSiteId('');
        setClientSites([]);
      }
      setFieldErrors({});
      setFormError('');
      setIsSupervisorDropdownOpen(false);
      setIsOperatorDropdownOpen(false);
      setSupervisorSearchQuery('');
      setOperatorSearchQuery('');
      fetchDropdownOptions();
    }
  }, [visible, machineToEdit]);

  // Load client shift codes for target client dynamically
  useEffect(() => {
    const targetClientId = selectedClient?.id || machineToEdit?.client_id;
    if (!targetClientId) {
      setClientShifts(DEFAULT_MOBILE_SHIFTS);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('client_shift_codes')
          .select('id, code, name, start_time, end_time, crosses_midnight, is_active')
          .eq('client_id', targetClientId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (isMounted && data && data.length > 0) {
          setClientShifts(
            data.map((s: any) => ({
              id: s.id,
              code: s.code,
              name: s.name || `Shift ${s.code}`,
              start_time: String(s.start_time).slice(0, 8),
              end_time: String(s.end_time).slice(0, 8),
              crosses_midnight: s.crosses_midnight,
            }))
          );
        } else if (isMounted) {
          setClientShifts(DEFAULT_MOBILE_SHIFTS);
        }
      } catch (err) {
        if (isMounted) setClientShifts(DEFAULT_MOBILE_SHIFTS);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedClient?.id, machineToEdit?.client_id, visible]);

  // Load valid deployment sites for selected client dynamically
  useEffect(() => {
    const targetClientId = selectedClient?.id;
    if (!targetClientId) {
      setClientSites([]);
      setSiteId('');
      return;
    }
    let isMounted = true;
    setIsLoadingSites(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('client_sites')
          .select('id, site_code, site_name, street, city, district, pincode')
          .eq('client_id', targetClientId)
          .eq('status', 'active')
          .order('site_name', { ascending: true });
        if (isMounted && data) {
          setClientSites(data);
          // Retain siteId if it belongs to this client's sites; otherwise clear it
          setSiteId((prev) => (prev && data.some((s) => s.id === prev) ? prev : ''));
        } else if (isMounted) {
          setClientSites([]);
          setSiteId('');
        }
      } catch {
        if (isMounted) {
          setClientSites([]);
          setSiteId('');
        }
      } finally {
        if (isMounted) setIsLoadingSites(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedClient?.id, visible]);

  const maxMobileShifts = clientShifts.length > 0 ? clientShifts.length : 3;


  const fetchDropdownOptions = async () => {
    if (
      mobileModalOptionsCache &&
      Date.now() - mobileModalOptionsCache.timestamp < CACHE_TTL_MS
    ) {
      setSupervisorsList(mobileModalOptionsCache.supervisors);
      setOperatorsList(mobileModalOptionsCache.operators);
      setClientsList(mobileModalOptionsCache.clients);
      setActiveAssignmentsList(mobileModalOptionsCache.activeAssignments || []);
      return;
    }
    try {
      const [supsRes, opsRes, clientsRes, assignmentsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, phone, email, role, shift_start_time, shift_end_time')
          .in('role', ['supervisor', 'manager', 'admin', 'super_admin'])
          .eq('status', 'active')
          .order('full_name', { ascending: true }),
        supabase
          .from('users')
          .select('id, full_name, phone, email, role, shift_start_time, shift_end_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name', { ascending: true }),
        supabase
          .from('clients')
          .select('id, code, company_name, contact_person, phone, street, city, district, state, pincode')
          .is('deleted_at', null)
          .order('company_name', { ascending: true }),
        supabase
          .from('operator_machine_assignments')
          .select(`
            operator_id,
            machine_id,
            shift_code,
            shift_start_time,
            shift_end_time,
            is_active,
            machines!operator_machine_assignments_machine_id_fkey (
              id,
              machine_id
            )
          `)
          .eq('is_active', true),
      ]);

      const formatUserShift = (u: any) => ({
        ...u,
        shift_time: (u.shift_start_time && u.shift_end_time)
          ? `${u.shift_start_time.slice(0, 5)} - ${u.shift_end_time.slice(0, 5)}`
          : null,
      });

      const sups = (supsRes.data || []).map(formatUserShift);
      const ops = (opsRes.data || []).map(formatUserShift);
      const cls = clientsRes.data || [];
      const activeAssignments: MobileActiveAssignment[] = (assignmentsRes.data || []).map((a: any) => ({
        operator_id: a.operator_id,
        machine_id: a.machine_id,
        shift_code: a.shift_code,
        shift_start_time: a.shift_start_time,
        shift_end_time: a.shift_end_time,
        machine_code: a.machines?.machine_id || 'Other M/C',
      }));

      mobileModalOptionsCache = {
        supervisors: sups,
        operators: ops,
        clients: cls,
        activeAssignments,
        timestamp: Date.now(),
      };

      setSupervisorsList(sups);
      setOperatorsList(ops);
      setClientsList(cls);
      setActiveAssignmentsList(activeAssignments);
    } catch (e) {
      console.warn('Error fetching machine dropdown options:', e);
    }
  };

  const getOperatorConflict = (opId: string, opShiftCode: string): MobileActiveAssignment | null => {
    if (!opId || !activeAssignmentsList || activeAssignmentsList.length === 0) return null;
    const shiftObj = clientShifts.find((s) => s.code.toUpperCase() === opShiftCode.toUpperCase()) || DEFAULT_MOBILE_SHIFTS[0];
    if (!shiftObj) return null;

    const currentRanges = shiftToMinuteRanges(shiftObj.start_time, shiftObj.end_time);
    if (currentRanges.length === 0) return null;

    const otherAssignments = activeAssignmentsList.filter(
      (a) => a.operator_id === opId && a.machine_id !== machineToEdit?.id
    );

    for (const other of otherAssignments) {
      if (!other.shift_start_time || !other.shift_end_time) continue;
      const otherRanges = shiftToMinuteRanges(other.shift_start_time, other.shift_end_time);
      if (doRangesOverlap(currentRanges, otherRanges)) {
        return other;
      }
    }
    return null;
  };

  const filteredSupervisors = useMemo(() => {
    if (!supervisorSearchQuery.trim()) return supervisorsList;
    const q = supervisorSearchQuery.toLowerCase().trim();
    return supervisorsList.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.shift_time?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q)
    );
  }, [supervisorsList, supervisorSearchQuery]);

  const filteredOperators = useMemo(() => {
    if (!operatorSearchQuery.trim()) return operatorsList;
    const q = operatorSearchQuery.toLowerCase().trim();
    return operatorsList.filter(
      (o) =>
        o.full_name?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q) ||
        o.shift_time?.toLowerCase().includes(q)
    );
  }, [operatorsList, operatorSearchQuery]);

  const handleToggleSupervisor = (id: string) => {
    haptics.select();
    setSupervisorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRemoveSupervisor = (id: string) => {
    haptics.select();
    setSupervisorIds((prev) => prev.filter((item) => item !== id));
  };

  const getNextAvailableShift = () => {
    const assignedCodes = new Set(
      operatorIds.map((id) => (operatorShifts[id] || '').toUpperCase())
    );
    const unused = clientShifts.find((s) => !assignedCodes.has(s.code.toUpperCase()));
    return unused || clientShifts[operatorIds.length % clientShifts.length] || clientShifts[0];
  };

  const handleAddOperator = (op: SelectableUser) => {
    if (operatorIds.includes(op.id)) {
      handleRemoveOperator(op.id);
      return;
    }
    if (operatorIds.length >= maxMobileShifts) return;
    haptics.select();
    const nextShift = getNextAvailableShift();
    setOperatorIds((prev) => [...prev, op.id]);
    setOperatorShifts((prev) => ({
      ...prev,
      [op.id]: nextShift.code,
    }));
    if (operatorIds.length + 1 >= maxMobileShifts) {
      setIsOperatorDropdownOpen(false);
    }
  };

  const handleRemoveOperator = (id: string) => {
    haptics.select();
    setOperatorIds((prev) => prev.filter((item) => item !== id));
    setOperatorShifts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSelectOperatorShift = (opId: string, shiftCode: string) => {
    haptics.select();
    setOperatorShifts((prev) => ({
      ...prev,
      [opId]: shiftCode,
    }));
  };

  const handleSerialBlur = async () => {
    const cleanSerial = serialNumber.trim();
    if (!cleanSerial) return;
    try {
      let duplicateQuery = supabase
        .from('machines')
        .select('id, machine_id, serial_number')
        .ilike('serial_number', cleanSerial);

      if (machineToEdit?.id) {
        duplicateQuery = duplicateQuery.neq('id', machineToEdit.id);
      }

      const { data: existingSerial } = await duplicateQuery.limit(1);
      if (existingSerial && existingSerial.length > 0) {
        const matchCode = existingSerial[0].machine_id || 'existing machine';
        setFieldErrors((prev) => ({
          ...prev,
          serial_number: `Serial number already registered to machine ${matchCode}.`,
        }));
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.serial_number;
          return next;
        });
      }
    } catch {
      // non-blocking pre-check
    }
  };

  const handleSave = async () => {
    setFieldErrors({});
    setFormError('');

    const errors: Record<string, string> = {};
    const cleanModel = String(model || '').trim();
    const cleanSerial = String(serialNumber || '').trim();
    const cleanYum = String(yearOfMfg || '').trim();
    const cleanMfr = String(manufacturer || '').trim();

    const shouldValidateSpecs = !isSupervisor && (initialSection === 'all' || initialSection === 'info');

    if (shouldValidateSpecs) {
      if (!cleanModel) errors.model = 'Model is mandatory.';
      if (!cleanSerial) errors.serial_number = 'Serial number is mandatory.';
      if (!cleanYum) errors.year_of_mfg = 'Year of manufacture is mandatory.';
      if (!cleanMfr) errors.manufacturer = 'Manufacturer is mandatory.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please complete all mandatory machine specification fields.');
      return;
    }

    if (operatorIds.length > maxMobileShifts) {
      setFormError(`A machine can have at most ${maxMobileShifts} assigned operators across shifts for client fleet coverage.`);
      return;
    }

    // Validate duplicate shift codes among assigned operators
    if (operatorIds.length > 0) {
      const shiftCounts = new Map<string, number>();
      for (const opId of operatorIds) {
        const code = (operatorShifts[opId] || 'S1').toUpperCase();
        shiftCounts.set(code, (shiftCounts.get(code) || 0) + 1);
      }
      for (const [code, count] of shiftCounts.entries()) {
        if (count > 1) {
          setFormError(`Shift ${code} is assigned to multiple operators. Each operator must have a distinct shift.`);
          return;
        }
      }
    }

    // Validate that no assigned operator has an overlapping assignment on another machine
    for (const opId of operatorIds) {
      const shiftCode = (operatorShifts[opId] || clientShifts[0]?.code || 'S1').toUpperCase();
      const conflict = getOperatorConflict(opId, shiftCode);
      if (conflict) {
        const opUser = operatorsList.find((u) => u.id === opId);
        const opName = opUser?.full_name || 'Operator';
        const startFmt = formatTo12Hour(conflict.shift_start_time) || conflict.shift_start_time;
        const endFmt = formatTo12Hour(conflict.shift_end_time) || conflict.shift_end_time;
        setFormError(`${opName} is already assigned to ${conflict.machine_code} (${startFmt} – ${endFmt}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (shouldValidateSpecs) {
        // Uniqueness check for Serial Number
        let duplicateQuery = supabase
          .from('machines')
          .select('id, machine_id, serial_number')
          .ilike('serial_number', cleanSerial);

        if (machineToEdit?.id) {
          duplicateQuery = duplicateQuery.neq('id', machineToEdit.id);
        }

        const { data: existingSerial } = await duplicateQuery.limit(1);
        if (existingSerial && existingSerial.length > 0) {
          const matchCode = existingSerial[0].machine_id || 'existing machine';
          setFieldErrors({
            serial_number: `Serial number already registered to machine ${matchCode}.`,
          });
          setFormError(`A machine with Serial Number "${cleanSerial}" already exists (${matchCode}).`);
          setIsSaving(false);
          return;
        }
      }

      const numericHmr = parseFloat(hourMeter) || 0;

      const effectiveStatus = selectedClient?.id ? 'rented' : 'available';
      const effectiveClientId = selectedClient?.id || null;

      // Atomically sync operator assignments table if editing existing machine
      if (machineToEdit?.id && (isSupervisor || initialSection === 'personnel' || initialSection === 'all')) {
        if (operatorIds.length === 0) {
          await supabase
            .from('operator_machine_assignments')
            .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
            .eq('machine_id', machineToEdit.id)
            .eq('is_active', true);
        } else {
          await supabase
            .from('operator_machine_assignments')
            .update({ is_active: false, ended_at: new Date().toISOString(), end_reason: 'removed' })
            .eq('machine_id', machineToEdit.id)
            .eq('is_active', true)
            .not('operator_id', 'in', `(${operatorIds.join(',')})`);

          for (const opId of operatorIds) {
            const shiftCode = (operatorShifts[opId] || 'S1').toUpperCase();
            const shiftObj = clientShifts.find((s) => s.code.toUpperCase() === shiftCode) || DEFAULT_MOBILE_SHIFTS[0];
            const { data: rpcData, error: rpcError } = await supabase.rpc('assign_operator_machine_atomic', {
              p_machine_id: machineToEdit.id,
              p_operator_id: opId,
              p_shift_start_time: shiftObj.start_time,
              p_shift_end_time: shiftObj.end_time,
              p_shift_code: shiftCode,
              p_notes: 'Assigned via mobile app',
            });
            if (rpcError) {
              let msg = rpcError.message;
              if (rpcError.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
                msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
              }
              throw new Error(msg);
            }
            if (rpcData && (rpcData as any).success === false) {
              let msg = (rpcData as any).error || 'Failed to assign operator.';
              if (msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
                msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
              }
              throw new Error(msg);
            }
          }
        }
      }

      const effectiveSiteId = effectiveClientId && siteId ? siteId : null;

      if (isSupervisor && machineToEdit?.id) {
        // Supervisor limited update payload
        const supervisorPayload: any = {
          hour_meter: numericHmr,
          status: effectiveStatus,
          health_status: healthStatus,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: effectiveClientId,
          site_id: effectiveSiteId,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('machines')
          .update(supervisorPayload)
          .eq('id', machineToEdit.id);

        if (error) throw error;
      } else if (machineToEdit?.id && initialSection === 'info') {
        // Dedicated Machine Info update payload
        const infoPayload: any = {
          model: cleanModel,
          serial_number: cleanSerial,
          manufacturer: cleanMfr || null,
          year_of_mfg: cleanYum ? (parseInt(cleanYum, 10) || cleanYum) : null,
          hour_meter: numericHmr,
          health_status: healthStatus,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('machines')
          .update(infoPayload)
          .eq('id', machineToEdit.id);

        if (error) throw error;
      } else if (machineToEdit?.id && initialSection === 'personnel') {
        // Dedicated Shift Personnel update payload
        const personnelPayload: any = {
          supervisor_ids: supervisorIds,
          current_supervisor_id: supervisorIds[0] || null,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('machines')
          .update(personnelPayload)
          .eq('id', machineToEdit.id);

        if (error) throw error;
      } else if (machineToEdit?.id && initialSection === 'client') {
        // Dedicated Client Assignment update payload
        const clientPayload: any = {
          client_id: effectiveClientId,
          site_id: effectiveSiteId,
          status: effectiveStatus,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('machines')
          .update(clientPayload)
          .eq('id', machineToEdit.id);

        if (error) throw error;
      } else {
        // Full Manager/Admin payload
        const payload: any = {
          model: cleanModel,
          serial_number: cleanSerial,
          manufacturer: cleanMfr || null,
          year_of_mfg: cleanYum ? (parseInt(cleanYum, 10) || cleanYum) : null,
          hour_meter: numericHmr,
          status: effectiveStatus,
          health_status: healthStatus,
          supervisor_ids: supervisorIds,
          current_supervisor_id: supervisorIds[0] || null,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: effectiveClientId,
          site_id: effectiveSiteId,
          updated_at: new Date().toISOString(),
        };

        if (machineToEdit?.id) {
          const { error } = await supabase
            .from('machines')
            .update(payload)
            .eq('id', machineToEdit.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('machines')
            .insert([payload]);

          if (error) throw error;
        }
      }

      // Refetch the updated value only from database for the active machine
      let savedResult: any = null;
      if (machineToEdit?.id) {
        try {
          const { data: refreshedMachine } = await supabase
            .from('machines')
            .select(`
              id,
              machine_id,
              model,
              serial_number,
              manufacturer,
              year_of_mfg,
              hour_meter,
              status,
              health_status,
              notes,
              client_id,
              site_id,
              current_supervisor_id,
              current_operator_id,
              supervisor_ids,
              operator_ids,
              client:clients(id, code, company_name, contact_person, phone, street, city, district, state, pincode)
            `)
            .eq('id', machineToEdit.id)
            .maybeSingle();
          if (refreshedMachine) {
            savedResult = refreshedMachine;
          }
        } catch {
          // offline/cached fallback
        }
      }

      if (!savedResult) {
        const finalSupervisors = supervisorsList.filter((s) => supervisorIds.includes(s.id));
        const finalOperators = operatorsList.filter((o) => operatorIds.includes(o.id));
        savedResult = {
          ...(machineToEdit || {}),
          id: machineToEdit?.id || `tmp_mach_${Date.now()}`,
          model: cleanModel,
          serial_number: cleanSerial,
          manufacturer: cleanMfr || null,
          year_of_mfg: cleanYum || null,
          hour_meter: numericHmr,
          status: effectiveStatus,
          health_status: healthStatus,
          supervisor_ids: supervisorIds,
          current_supervisor_id: supervisorIds[0] || null,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: effectiveClientId,
          site_id: effectiveSiteId,
          client: selectedClient || machineToEdit?.client || null,
          supervisors: finalSupervisors.length > 0 ? finalSupervisors : (machineToEdit?.supervisors || []),
          current_supervisor: finalSupervisors[0] || (machineToEdit?.current_supervisor || null),
          operators: finalOperators.length > 0 ? finalOperators : (machineToEdit?.operators || []),
          current_operator: finalOperators[0] || (machineToEdit?.current_operator || null),
          updated_at: new Date().toISOString(),
        };
      }

      haptics.confirm();
      invalidateMobileModalOptionsCache();
      let successTitle = isEdit ? 'Machine Updated' : 'Machine Registered';
      let successMsg = isEdit
        ? `Machine asset ${cleanModel || 'record'} updated successfully.`
        : `Asset ${cleanModel} (${cleanSerial}) registered successfully.`;
      if (initialSection === 'client') {
        successTitle = 'Client Assignment Updated';
        successMsg = effectiveClientId
          ? `Assigned to ${selectedClient?.company_name || 'client'} successfully.`
          : 'Machine unassigned and marked as Available successfully.';
      } else if (initialSection === 'personnel') {
        successTitle = 'Personnel Assigned';
        successMsg = 'Supervisors and operators assigned successfully.';
      } else if (initialSection === 'info') {
        successTitle = 'Machine Info Updated';
        successMsg = `Specifications for ${cleanModel || 'machine'} updated successfully.`;
      }
      showToast('success', successTitle, successMsg);
      onSuccess(savedResult);
      onClose();
    } catch (err: any) {
      haptics.reject();
      const sanitized = sanitizeDatabaseError(err, 'Failed to save machine details.');
      let msg = sanitized.error;
      if (err?.code === '23505' || msg.includes('serial_number') || String(err?.message || '').includes('serial_number')) {
        msg = `A machine with Serial Number "${cleanSerial}" is already registered.`;
        setFieldErrors((prev) => ({
          ...prev,
          serial_number: msg,
        }));
      }
      if (sanitized.fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, ...sanitized.fieldErrors }));
      }
      setFormError(msg);
      showToast('error', 'Update Failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const modalTitle = isSupervisor
    ? `Assign Operator (${machineToEdit?.machine_id || ''})`
    : initialSection === 'info'
    ? `Edit Machine Info (${machineToEdit?.machine_id || ''})`
    : initialSection === 'personnel'
    ? `Manage Shift Personnel (${machineToEdit?.machine_id || ''})`
    : initialSection === 'client'
    ? `Edit Client Assignment (${machineToEdit?.machine_id || ''})`
    : isEdit
    ? `Edit Machine (${machineToEdit?.machine_id || ''})`
    : 'Register New Machine';

  const selectedSupervisors = supervisorIds
    .map((id) => supervisorsList.find((s) => s.id === id))
    .filter(Boolean) as SelectableUser[];

  const selectedOperators = operatorIds
    .map((id) => operatorsList.find((o) => o.id === id))
    .filter(Boolean) as SelectableUser[];

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'bottom'}
      showHandle={false}
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
      <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <Text variant="heading" weight="semibold" style={[styles.title, { color: theme.colors.ink }]}>{modalTitle}</Text>
          <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]} accessibilityLabel="Close dialog">
            <X size={16} color={theme.colors.mute} />
          </Pressable>
        </View>

          {/* Form Error Banner */}
          {formError ? (
            <View style={[styles.errorBanner, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
              <AlertCircle size={15} color="#ef4444" style={{ marginTop: 1 }} />
              <Text variant="caption" weight="medium" style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 0: MACHINE INFO (Shown for Add Machine or when specs editable) */}
            {!isSupervisor && (initialSection === 'all' || initialSection === 'info') && (
              <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" weight="semibold" style={[styles.sectionHeaderTitle, { color: theme.colors.mute }]}>
                    MACHINE INFO
                  </Text>
                </View>

                <View style={styles.sectionFields}>
                  <Input
                    label="Model *"
                    placeholder="e.g. 50B-9 / CAT-320 / S3246"
                    value={model}
                    onChangeText={setModel}
                    error={fieldErrors.model}
                    editable={!isSaving}
                  />

                  <Input
                    label="Serial Number *"
                    placeholder="e.g. HHKHB303EF00000877"
                    value={serialNumber}
                    onChangeText={(val) => {
                      setSerialNumber(val);
                      if (fieldErrors.serial_number) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.serial_number;
                          return next;
                        });
                      }
                    }}
                    onBlur={handleSerialBlur}
                    error={fieldErrors.serial_number}
                    editable={!isSaving}
                  />

                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Year of Mfg (YUM) *"
                        placeholder="2024"
                        value={yearOfMfg}
                        onChangeText={setYearOfMfg}
                        error={fieldErrors.year_of_mfg}
                        keyboardType="numeric"
                        editable={!isSaving}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Manufacturer *"
                        placeholder="e.g. HYUNDAI / TOYOTA"
                        value={manufacturer}
                        onChangeText={setManufacturer}
                        error={fieldErrors.manufacturer}
                        editable={!isSaving}
                      />
                    </View>
                  </View>

                  {/* Hour Meter Reading (Shifted into Machine Info) */}
                  <Input
                    label="Hour Meter Reading (HMR)"
                    placeholder="0"
                    value={hourMeter}
                    onChangeText={setHourMeter}
                    keyboardType="numeric"
                    editable={!isSaving}
                  />

                  {/* Health Status Dropdown (Shifted into Machine Info) */}
                  <View style={styles.fieldGroup}>
                    <SearchableSelect
                      label="Health Status"
                      options={HEALTH_OPTIONS}
                      value={healthStatus}
                      onChange={(val) => {
                        setHealthStatus(val);
                        if (val === 'spare' && rentalStatus !== 'rented') {
                          setRentalStatus('rented');
                        }
                      }}
                      placeholder="Select health status..."
                      modalTitle="Select Health Status"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 1: PERSONNEL ASSIGNMENT (SUPERVISORS & OPERATORS) */}
            {(initialSection === 'all' || initialSection === 'personnel') && (
              <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" weight="semibold" style={[styles.sectionHeaderTitle, { color: theme.colors.mute }]}>
                    {isSupervisor ? 'OPERATOR ASSIGNMENT' : 'PERSONNEL ASSIGNMENT (SUPERVISORS & OPERATORS)'}
                  </Text>
                </View>

                <View style={styles.sectionFields}>
                  {/* Assigned Supervisors */}
                  {!isSupervisor ? (
                    <View
                      style={styles.fieldGroup}
                      {...({ 'data-dropdown-container': 'true' } as any)}
                    >
                      <View style={styles.labelRow}>
                        <Text variant="label" weight="medium" style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                          Assigned Supervisors
                        </Text>
                        <Text variant="caption" style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                          {supervisorIds.length} assigned
                        </Text>
                      </View>

                      <Pressable variant="card" haptic="select" onPress={() => { setIsSupervisorDropdownOpen((prev) => !prev); setIsOperatorDropdownOpen(false); setSupervisorSearchQuery(''); }} style={[styles.multiSelectTrigger,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: isSupervisorDropdownOpen ? theme.colors.ink : theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.selectedPillsWrap}>
                          {selectedSupervisors.length === 0 ? (
                            <Text variant="body" style={[styles.placeholderText, { color: theme.colors.mute }]}>
                              Search & assign supervisors...
                            </Text>
                          ) : (
                            selectedSupervisors.map((s) => (
                              <View
                                key={s.id}
                                style={[
                                  styles.userChip,
                                  {
                                    backgroundColor: theme.colors.canvas,
                                    borderColor: theme.colors.hairline,
                                  },
                                ]}
                              >
                                <Text variant="caption" weight="medium" style={[styles.userChipText, { color: theme.colors.ink }]}>
                                  {s.full_name}
                                </Text>
                                <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={(e) => { // @ts-ignore
                                    e?.stopPropagation?.(); handleRemoveSupervisor(s.id); }} accessibilityLabel={`Remove ${s.full_name}`}>
                                  <X size={11} color={theme.colors.mute} />
                                </Pressable>
                              </View>
                            ))
                          )}
                        </View>

                        <View style={styles.triggerRightActions}>
                          {supervisorIds.length > 0 && (
                            <Pressable variant="ghost" haptic="tap" hitSlopToMin48 onPress={(e) => { // @ts-ignore
                                e?.stopPropagation?.(); setSupervisorIds([]); }}>
                              <Text variant="caption" weight="medium" style={[styles.clearBtnText, { color: theme.colors.mute }]}>
                                Clear
                              </Text>
                            </Pressable>
                          )}
                          <ChevronDown
                            size={14}
                            color={isSupervisorDropdownOpen ? '#0284c7' : theme.colors.mute}
                            style={{
                              transform: [{ rotate: isSupervisorDropdownOpen ? '180deg' : '0deg' }],
                            }}
                          />
                        </View>
                      </Pressable>

                      {/* Supervisor Dropdown Popover */}
                      {isSupervisorDropdownOpen && (
                        <View
                          style={[
                            styles.dropdownPopoverPanel,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          {/* Search Input using canonical SearchInput */}
                          <SearchInput
                            placeholder="Search supervisors by name, phone..."
                            value={supervisorSearchQuery}
                            onChangeText={setSupervisorSearchQuery}
                            autoFocus
                            containerStyle={{ marginBottom: 8 }}
                          />

                          {/* Subheader: Selected Count + Deselect / Clear */}
                          <View
                            style={[
                              styles.dropdownSubHeader,
                              { borderBottomColor: theme.colors.hairline },
                            ]}
                          >
                            <Text variant="caption" style={[styles.selectionCountText, { color: theme.colors.mute }]}>
                              {supervisorIds.length} of {supervisorsList.length} selected
                            </Text>
                            <Pressable
                              variant="ghost"
                              haptic="tap"
                              hitSlopToMin48
                              onPress={() => {
                                if (supervisorIds.length > 0) {
                                  setSupervisorIds([]);
                                } else {
                                  setSupervisorIds(supervisorsList.map((s) => s.id));
                                }
                              }}
                            >
                              <Text variant="caption" weight="semibold" style={styles.deselectAllActionText}>
                                {supervisorIds.length > 0 ? 'Clear All' : 'Select All'}
                              </Text>
                            </Pressable>
                          </View>

                          {/* Supervisors List */}
                          <ScrollView
                            style={styles.dropdownScrollList}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={true}
                          >
                            {filteredSupervisors.length === 0 ? (
                              <View style={styles.emptyDropdownList}>
                                <Text variant="caption" style={[styles.emptyDropdownText, { color: theme.colors.mute }]}>
                                  No supervisors matching search
                                </Text>
                              </View>
                            ) : (
                              filteredSupervisors.map((s) => {
                                const isSelected = supervisorIds.includes(s.id);
                                const roleUpper = (s.role || 'SUPERVISOR').toUpperCase();
                                return (
                                  <Pressable key={s.id} variant="listRow" haptic="select" onPress={() => handleToggleSupervisor(s.id)} style={[styles.dropdownStaffItem,
                                      {
                                        backgroundColor: isSelected
                                          ? (isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff')
                                          : theme.colors.canvas,
                                        borderColor: isSelected ? '#0284c7' : theme.colors.hairline,
                                      },
                                    ]}
                                  >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <View style={styles.staffTitleRow}>
                                        <Text
                                          variant="body"
                                          weight="medium"
                                          style={[
                                            styles.staffNameText,
                                            { color: isSelected ? '#0284c7' : theme.colors.ink },
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {s.full_name}
                                        </Text>
                                        <View
                                          style={[
                                            styles.staffRolePill,
                                            {
                                              backgroundColor: isDark
                                                ? 'rgba(56, 189, 248, 0.15)'
                                                : '#e0f2fe',
                                            },
                                          ]}
                                        >
                                          <Text variant="micro" weight="semibold" style={[styles.staffRolePillText, { color: '#0284c7' }]}>
                                            {roleUpper}
                                          </Text>
                                        </View>
                                      </View>

                                      {/* Timing & Phone */}
                                      <View style={styles.staffMetaRow}>
                                        <Clock size={11} color="#10b981" />
                                        <Text variant="micro" style={styles.staffTimingText}>
                                          {s.shift_start_time && s.shift_end_time
                                            ? `${formatTo12Hour(s.shift_start_time)} - ${formatTo12Hour(s.shift_end_time)}`
                                            : s.shift_time || '08:00 - 20:00'}
                                        </Text>
                                        {Boolean(s.phone) && (
                                          <Text variant="micro" style={[styles.staffPhoneText, { color: theme.colors.mute }]}>
                                            • {s.phone}
                                          </Text>
                                        )}
                                      </View>
                                    </View>

                                    {/* Checkbox indicator */}
                                    <View
                                      style={[
                                        styles.checkboxIndicator,
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
                              })
                            )}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.fieldGroup}>
                      <View style={styles.labelRow}>
                        <Text variant="label" weight="medium" style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                          Designated Supervisors
                        </Text>
                        <Text variant="caption" style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                          Managed by Admin
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.multiSelectTrigger,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                            opacity: 0.85,
                          },
                        ]}
                      >
                        <View style={styles.selectedPillsWrap}>
                          {selectedSupervisors.length === 0 ? (
                            <Text variant="body" style={[styles.placeholderText, { color: theme.colors.mute }]}>
                              No supervisors designated
                            </Text>
                          ) : (
                            selectedSupervisors.map((s) => (
                              <View
                                key={s.id}
                                style={[
                                  styles.userChip,
                                  {
                                    backgroundColor: theme.colors.canvas,
                                    borderColor: theme.colors.hairline,
                                  },
                                ]}
                              >
                                <Text variant="caption" weight="medium" style={[styles.userChipText, { color: theme.colors.ink }]}>
                                  {s.full_name}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Assigned Operators */}
                  <View
                    style={styles.fieldGroup}
                    {...({ 'data-dropdown-container': 'true' } as any)}
                  >
                    <View style={styles.labelRow}>
                      <Text variant="label" weight="medium" style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                        Assigned Operators (24h)
                      </Text>
                      <Text variant="caption" style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                        {operatorIds.length}/{maxMobileShifts} assigned
                      </Text>
                    </View>

                    {operatorIds.length < maxMobileShifts ? (
                      <Pressable variant="card" haptic="select" onPress={() => { setIsOperatorDropdownOpen((prev) => !prev); setIsSupervisorDropdownOpen(false); setOperatorSearchQuery(''); }} style={[styles.addOperatorTrigger,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: isOperatorDropdownOpen ? theme.colors.ink : theme.colors.hairline,
                          },
                        ]}
                      >
                        <Text variant="body" weight="medium" style={[styles.addOperatorText, { color: theme.colors.ink }]}>
                          + Search & Assign Operators ({operatorIds.length}/{maxMobileShifts})
                        </Text>
                        <ChevronDown
                          size={14}
                          color={isOperatorDropdownOpen ? '#0284c7' : theme.colors.mute}
                          style={{
                            transform: [{ rotate: isOperatorDropdownOpen ? '180deg' : '0deg' }],
                          }}
                        />
                      </Pressable>
                    ) : null}

                    {/* Operator Dropdown Popover */}
                    {isOperatorDropdownOpen && operatorIds.length < maxMobileShifts && (
                      <View
                        style={[
                          styles.dropdownPopoverPanel,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        {/* Search Input using canonical SearchInput */}
                        <SearchInput
                          placeholder="Search operators by name, phone..."
                          value={operatorSearchQuery}
                          onChangeText={setOperatorSearchQuery}
                          autoFocus
                          containerStyle={{ marginBottom: 8 }}
                        />

                        {/* Operators List */}
                        <ScrollView
                          style={styles.dropdownScrollList}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={true}
                        >
                          {filteredOperators.length === 0 ? (
                            <View style={styles.emptyDropdownList}>
                              <Text variant="caption" style={[styles.emptyDropdownText, { color: theme.colors.mute }]}>
                                {operatorSearchQuery ? 'No matching operators found' : 'All operators assigned'}
                              </Text>
                            </View>
                          ) : (
                            filteredOperators.map((op) => {
                              const isAlreadyAssigned = operatorIds.includes(op.id);
                              const nextShift = getNextAvailableShift();
                              const conflict = getOperatorConflict(op.id, nextShift.code);

                              return (
                                <Pressable key={op.id} variant="listRow" haptic="select" onPress={() => handleAddOperator(op)} style={[styles.dropdownStaffItem,
                                    {
                                      backgroundColor: isAlreadyAssigned
                                        ? (isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff')
                                        : theme.colors.canvas,
                                      borderColor: isAlreadyAssigned ? '#0284c7' : theme.colors.hairline,
                                    },
                                  ]}
                                >
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={styles.staffTitleRow}>
                                      <Text
                                        variant="body"
                                        weight="medium"
                                        style={[
                                          styles.staffNameText,
                                          { color: isAlreadyAssigned ? '#0284c7' : theme.colors.ink },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {op.full_name}
                                      </Text>
                                      {isAlreadyAssigned && (
                                        <View
                                          style={[
                                            styles.staffRolePill,
                                            {
                                              backgroundColor: isDark
                                                ? 'rgba(56, 189, 248, 0.15)'
                                                : '#e0f2fe',
                                            },
                                          ]}
                                        >
                                          <Text variant="micro" weight="semibold" style={[styles.staffRolePillText, { color: '#0284c7' }]}>
                                            ASSIGNED
                                          </Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* Timing & Phone */}
                                    <View style={styles.staffMetaRow}>
                                      <Clock size={11} color="#10b981" />
                                      <Text variant="micro" style={styles.staffTimingText}>
                                        {op.shift_start_time && op.shift_end_time
                                          ? `${formatTo12Hour(op.shift_start_time)} - ${formatTo12Hour(op.shift_end_time)}`
                                          : op.shift_time || '06:00 - 14:00'}
                                      </Text>
                                      {Boolean(op.phone) && (
                                        <Text variant="micro" style={[styles.staffPhoneText, { color: theme.colors.mute }]}>
                                          • {op.phone}
                                        </Text>
                                      )}
                                    </View>

                                    {/* Conflict indication if any */}
                                    {conflict && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                        <AlertCircle size={10} color="#ef4444" />
                                        <Text variant="caption" style={{ color: '#ef4444' }} numberOfLines={1}>
                                          Assigned to {conflict.machine_code} ({formatTo12Hour(conflict.shift_start_time) || conflict.shift_start_time} - {formatTo12Hour(conflict.shift_end_time) || conflict.shift_end_time})
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Action badge on right */}
                                  {isAlreadyAssigned ? (
                                    <View
                                      style={[
                                        styles.checkboxIndicator,
                                        {
                                          borderColor: '#0284c7',
                                          backgroundColor: '#0284c7',
                                        },
                                      ]}
                                    >
                                      <Check size={12} color="#ffffff" />
                                    </View>
                                  ) : (
                                    <View
                                      style={[
                                        styles.assignShiftActionBadge,
                                        {
                                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                                          borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd',
                                        },
                                      ]}
                                    >
                                      <Text variant="micro" weight="semibold" style={[styles.assignShiftActionText, { color: '#0284c7' }]}>
                                        + Shift {nextShift.code}
                                      </Text>
                                    </View>
                                  )}
                                </Pressable>
                              );
                            })
                          )}
                        </ScrollView>
                      </View>
                    )}

                    {selectedOperators.length === 0 ? (
                      <View
                        style={[
                          styles.emptyOperatorsBox,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <Text variant="body" style={[styles.placeholderText, { color: theme.colors.mute }]}>
                          No operators assigned. Tap above to assign up to {maxMobileShifts} shift operators.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.operatorCardsContainer}>
                        {selectedOperators.map((o, idx) => {
                          const currentShift = (operatorShifts[o.id] || (clientShifts[idx % clientShifts.length]?.code || 'S1')).toUpperCase();
                          const conflict = getOperatorConflict(o.id, currentShift);
                          const conflictMsg = conflict
                            ? `Already assigned to ${conflict.machine_code} (${formatTo12Hour(conflict.shift_start_time) || conflict.shift_start_time} – ${formatTo12Hour(conflict.shift_end_time) || conflict.shift_end_time})`
                            : null;
                          return (
                            <View
                              key={o.id}
                              style={[
                                styles.operatorCard,
                                {
                                  backgroundColor: theme.colors.canvasElevated,
                                  borderColor: conflictMsg ? '#ef4444' : theme.colors.hairline,
                                },
                              ]}
                            >
                              <View style={styles.operatorCardHeader}>
                                <View style={styles.operatorCardInfo}>
                                  <View style={styles.operatorIndexBadge}>
                                    <Text variant="micro" weight="bold" style={styles.operatorIndexText}>{idx + 1}</Text>
                                  </View>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <Text variant="body" weight="semibold" style={[styles.operatorCardName, { color: theme.colors.ink }]} numberOfLines={1}>
                                        {o.full_name}
                                      </Text>
                                      <View style={[styles.shiftBadge, conflictMsg ? { backgroundColor: '#ef444420', borderColor: '#ef444450' } : null]}>
                                        <Text variant="micro" weight="bold" style={[styles.shiftBadgeText, conflictMsg ? { color: '#ef4444' } : null]}>
                                          Shift {currentShift}
                                        </Text>
                                      </View>
                                    </View>
                                    {Boolean(o.phone || o.email) && (
                                      <Text variant="caption" style={[styles.operatorContactSubtitle, { color: theme.colors.mute }]} numberOfLines={1}>
                                        {[o.phone, o.email].filter(Boolean).join(' • ')}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleRemoveOperator(o.id)} style={styles.removeOperatorBtn} accessibilityLabel={`Remove ${o.full_name}`}>
                                  <X size={15} color={theme.colors.mute} />
                                </Pressable>
                              </View>

                              {/* Overlap Conflict Pill */}
                              {conflictMsg && (
                                <View style={styles.operatorConflictBadge}>
                                  <AlertCircle size={12} color="#ef4444" style={{ marginTop: 1 }} />
                                  <Text variant="caption" style={styles.operatorConflictText}>{conflictMsg}</Text>
                                </View>
                              )}

                              {/* Shift Selection: Smooth Grow & Shrink ShiftCardSelector */}
                              <View style={styles.shiftSelectionSection}>
                                <View style={styles.shiftSelectionHeader}>
                                  <Clock size={11} color="#0284c7" />
                                  <Text variant="caption" weight="semibold" style={[styles.shiftSelectionLabel, { color: theme.colors.mute }]}>
                                    SELECT ASSIGNED SHIFT:
                                  </Text>
                                </View>

                                <ShiftCardSelector
                                  shiftCodes={clientShifts}
                                  selectedCode={currentShift}
                                  onSelect={(sc) => handleSelectOperatorShift(o.id, sc.code)}
                                  isConflicting={(code) => Boolean(getOperatorConflict(o.id, code))}
                                />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 2: CLIENT ASSIGNMENT & RENTAL STATUS */}
            {(initialSection === 'all' || initialSection === 'client') && (
              <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" weight="semibold" style={[styles.sectionHeaderTitle, { color: theme.colors.mute }]}>
                    CLIENT ASSIGNMENT & RENTAL STATUS
                  </Text>
                </View>

                <View style={styles.sectionFields}>
                  {/* Assigned Client */}
                  <View style={styles.fieldGroup}>
                    <SearchableSelect
                      label="Assigned Client"
                      options={clientOptions}
                      value={selectedClient?.id || ''}
                      onChange={(val) => {
                        const found = clientsList.find((c) => c.id === val) || null;
                        setSelectedClient(found);
                        if (found) {
                          setRentalStatus('rented');
                        } else {
                          setRentalStatus('available');
                          setSiteId('');
                          setClientSites([]);
                        }
                      }}
                      placeholder="Search or select client to rent..."
                      modalTitle="Select Client"
                    />
                  </View>

                  {/* Client Deployment Site */}
                  {selectedClient ? (
                    <View style={styles.fieldGroup}>
                      <SearchableSelect
                        label="Client Deployment Site"
                        options={[
                          { value: '', label: 'None (No specific site / Yard)' },
                          ...clientSites.map((s) => ({
                            value: s.id,
                            label: `${s.site_name} (${s.site_code})`,
                            code: s.site_code,
                            description: [s.street, s.city, s.district].filter(Boolean).join(' • ') || undefined,
                          })),
                        ]}
                        value={siteId}
                        onChange={(val) => setSiteId(val)}
                        placeholder={isLoadingSites ? "Loading deployment sites..." : "Select deployment site..."}
                        modalTitle="Select Deployment Site"
                        disabled={isLoadingSites || isSaving}
                      />
                    </View>
                  ) : null}

                  {/* Automatic Rental Status Indicator */}
                  <View style={styles.fieldGroup}>
                    <Text variant="label" weight="medium" style={[styles.fieldLabel, { color: theme.colors.ink }]}>Rental Status (Auto-Linked)</Text>
                    <View
                      style={[
                        styles.singleSelectTrigger,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={styles.selectLeft}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: selectedClient ? '#0ea5e9' : '#10b981',
                            },
                          ]}
                        />
                        <Text variant="body" weight="medium" style={[styles.selectValueText, { color: theme.colors.ink }]}>
                          {selectedClient ? 'Rented' : 'Available'}
                        </Text>
                        {selectedClient && (
                          <Text variant="caption" style={[styles.assignedCountText, { color: theme.colors.mute, marginLeft: 6 }]}>
                            (Deployed)
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text variant="caption" style={[styles.helperText, { color: theme.colors.mute }]}>
                      {selectedClient
                        ? `Automatically marked as rented to ${selectedClient.company_name}.`
                        : 'Automatically available when no client is assigned.'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Actions (Screenshot 1 Match) */}
            <View style={styles.bottomButtonsWrap}>
              <Pressable variant="primary" haptic="none" onPress={handleSave} disabled={isSaving} style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                ) : (
                  <Text variant="label" weight="semibold" style={[styles.primaryActionBtnText, { color: theme.colors.onPrimary }]}>
                    {isSupervisor || initialSection === 'personnel' ? 'Save Assignments' : isEdit ? 'Update Machine' : 'Register Machine'}
                  </Text>
                )}
              </Pressable>

              <Pressable variant="outline" haptic="tap" onPress={onClose} disabled={isSaving} style={[styles.cancelActionBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <Text variant="label" weight="medium" style={[styles.cancelActionBtnText, { color: theme.colors.ink }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Sub-Modals */}
        </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  sheetWrapper: {
    width: '100%',
    flexShrink: 1,
  },
  sheet: {
    width: '100%',
    flexShrink: 1,
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  title: {},
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.xs,
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  errorBannerText: {
    color: '#ef4444',
    flex: 1,
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
    paddingBottom: spacingNumeric['2xl'],
  },
  sectionBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitleRow: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionHeaderTitle: {
    textTransform: 'uppercase',
  },
  sectionFields: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  fieldGroup: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {},
  assignedCountText: {
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: 4,
  },
  multiSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 8,
    minHeight: 44,
  },
  selectedPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    marginRight: spacingNumeric.xs,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  userChipText: {},
  triggerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtnText: {},
  placeholderText: {},
  addOperatorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: spacingNumeric.md,
    height: 44,
    marginBottom: spacingNumeric.xs,
  },
  addOperatorText: {},
  emptyOperatorsBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacingNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorCardsContainer: {
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
  },
  operatorCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
  },
  operatorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xs,
  },
  operatorCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flex: 1,
  },
  operatorCardName: {},
  shiftBadge: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e940',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shiftBadgeText: {
    color: '#0ea5e9',
  },
  removeOperatorBtn: {
    padding: 6,
  },
  shiftChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  shiftChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftChipText: {},
  singleSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
    height: 44,
  },
  selectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectValueText: {},
  bottomButtonsWrap: {
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
  },
  primaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radiusNumeric.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryActionBtnText: {},
  cancelActionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelActionBtnText: {},
  operatorConflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.xs,
    paddingVertical: 4,
    backgroundColor: '#ef444415',
    borderColor: '#ef444430',
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
  },
  operatorConflictText: {
    color: '#ef4444',
    flex: 1,
  },
  dropdownPopoverPanel: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    marginTop: 4,
    marginBottom: spacingNumeric.xs,
    maxHeight: 260,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  dropdownSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
  },
  selectionCountText: {},
  deselectAllActionText: {
    color: '#0284c7',
  },
  dropdownScrollList: {
    maxHeight: 180,
  },
  emptyDropdownList: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDropdownText: {},
  dropdownStaffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 6,
    minHeight: 44,
  },
  staffTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  staffNameText: {},
  staffRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radiusNumeric.sm,
  },
  staffRolePillText: {},
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  staffTimingText: {
    color: '#10b981',
  },
  staffPhoneText: {},
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  assignShiftActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginLeft: 8,
  },
  assignShiftActionText: {},
  operatorIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorIndexText: {
    color: '#ffffff',
  },
  operatorContactSubtitle: {
    marginTop: 1,
  },
  shiftSelectionSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  shiftSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  shiftSelectionLabel: {},
});
