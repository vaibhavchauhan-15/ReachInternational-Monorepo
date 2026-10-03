import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Input, useTheme, SearchableSelect, ShiftCardSelector, type SelectOption } from '../ui';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatTo12Hour, parseTimeToMinutes } from '@reachinternational/utils';
import { X, ChevronDown, AlertCircle, Check, Clock, Search, Phone, Plus } from 'lucide-react-native';
import { type SelectableUser } from './MultiUserSelectModal';
import { type SelectableClient } from './ClientSelectModal';

export interface MachineModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
        setModel(machineToEdit.model || '');
        setSerialNumber(machineToEdit.serial_number || '');
        setManufacturer(machineToEdit.manufacturer || '');
        setYearOfMfg(machineToEdit.year_of_mfg || '');
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
    Haptics.selectionAsync().catch(() => {});
    setSupervisorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRemoveSupervisor = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
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
    Haptics.selectionAsync().catch(() => {});
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
    Haptics.selectionAsync().catch(() => {});
    setOperatorIds((prev) => prev.filter((item) => item !== id));
    setOperatorShifts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSelectOperatorShift = (opId: string, shiftCode: string) => {
    Haptics.selectionAsync().catch(() => {});
    setOperatorShifts((prev) => ({
      ...prev,
      [opId]: shiftCode,
    }));
  };

  const handleSave = async () => {
    setFieldErrors({});
    setFormError('');

    const errors: Record<string, string> = {};
    const cleanModel = model.trim();
    const cleanSerial = serialNumber.trim();
    const cleanYum = yearOfMfg.trim();
    const cleanMfr = manufacturer.trim();

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

      if (isSupervisor && machineToEdit?.id) {
        // Supervisor limited update payload
        const supervisorPayload: any = {
          hour_meter: numericHmr,
          status: effectiveStatus,
          health_status: healthStatus,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: effectiveClientId,
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
          year_of_mfg: cleanYum || null,
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
          year_of_mfg: cleanYum || null,
          hour_meter: numericHmr,
          status: effectiveStatus,
          health_status: healthStatus,
          supervisor_ids: supervisorIds,
          current_supervisor_id: supervisorIds[0] || null,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: effectiveClientId,
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

      invalidateMobileModalOptionsCache();
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save machine details.';
      setFormError(msg);
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>{modalTitle}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Form Error Banner */}
          {formError ? (
            <View style={[styles.errorBanner, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
              <AlertCircle size={15} color="#ef4444" style={{ marginTop: 1 }} />
              <Text style={styles.errorBannerText}>{formError}</Text>
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
                  <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
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
                    onChangeText={setSerialNumber}
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
                  <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
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
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                          Assigned Supervisors
                        </Text>
                        <Text style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                          {supervisorIds.length} assigned
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setIsSupervisorDropdownOpen((prev) => !prev);
                          setIsOperatorDropdownOpen(false);
                          setSupervisorSearchQuery('');
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.multiSelectTrigger,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: isSupervisorDropdownOpen ? theme.colors.ink : theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.selectedPillsWrap}>
                          {selectedSupervisors.length === 0 ? (
                            <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
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
                                <Text style={[styles.userChipText, { color: theme.colors.ink }]}>
                                  {s.full_name}
                                </Text>
                                <TouchableOpacity
                                  onPress={(e) => {
                                    // @ts-ignore
                                    e?.stopPropagation?.();
                                    handleRemoveSupervisor(s.id);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <X size={11} color={theme.colors.mute} />
                                </TouchableOpacity>
                              </View>
                            ))
                          )}
                        </View>

                        <View style={styles.triggerRightActions}>
                          {supervisorIds.length > 0 && (
                            <TouchableOpacity
                              onPress={(e) => {
                                // @ts-ignore
                                e?.stopPropagation?.();
                                Haptics.selectionAsync().catch(() => {});
                                setSupervisorIds([]);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.clearBtnText, { color: theme.colors.mute }]}>
                                Clear
                              </Text>
                            </TouchableOpacity>
                          )}
                          <ChevronDown
                            size={14}
                            color={isSupervisorDropdownOpen ? '#0284c7' : theme.colors.mute}
                            style={{
                              transform: [{ rotate: isSupervisorDropdownOpen ? '180deg' : '0deg' }],
                            }}
                          />
                        </View>
                      </TouchableOpacity>

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
                          {/* Search Input */}
                          <View
                            style={[
                              styles.dropdownSearchBox,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Search size={14} color={theme.colors.mute} />
                            <TextInput
                              style={[styles.dropdownSearchInput, { color: theme.colors.ink }]}
                              placeholder="Search supervisors by name, phone..."
                              placeholderTextColor={theme.colors.mute}
                              value={supervisorSearchQuery}
                              onChangeText={setSupervisorSearchQuery}
                              autoFocus
                            />
                            {supervisorSearchQuery ? (
                              <TouchableOpacity onPress={() => setSupervisorSearchQuery('')} hitSlop={8}>
                                <X size={13} color={theme.colors.mute} />
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          {/* Subheader: Selected Count + Deselect / Clear */}
                          <View
                            style={[
                              styles.dropdownSubHeader,
                              { borderBottomColor: theme.colors.hairline },
                            ]}
                          >
                            <Text style={[styles.selectionCountText, { color: theme.colors.mute }]}>
                              {supervisorIds.length} of {supervisorsList.length} selected
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                if (supervisorIds.length > 0) {
                                  setSupervisorIds([]);
                                } else {
                                  setSupervisorIds(supervisorsList.map((s) => s.id));
                                }
                              }}
                              hitSlop={6}
                            >
                              <Text style={styles.deselectAllActionText}>
                                {supervisorIds.length > 0 ? 'Clear All' : 'Select All'}
                              </Text>
                            </TouchableOpacity>
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
                                <Text style={[styles.emptyDropdownText, { color: theme.colors.mute }]}>
                                  No supervisors matching search
                                </Text>
                              </View>
                            ) : (
                              filteredSupervisors.map((s) => {
                                const isSelected = supervisorIds.includes(s.id);
                                const roleUpper = (s.role || 'SUPERVISOR').toUpperCase();
                                return (
                                  <TouchableOpacity
                                    key={s.id}
                                    onPress={() => handleToggleSupervisor(s.id)}
                                    activeOpacity={0.7}
                                    style={[
                                      styles.dropdownStaffItem,
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
                                          <Text style={[styles.staffRolePillText, { color: '#0284c7' }]}>
                                            {roleUpper}
                                          </Text>
                                        </View>
                                      </View>

                                      {/* Timing & Phone */}
                                      <View style={styles.staffMetaRow}>
                                        <Clock size={11} color="#10b981" />
                                        <Text style={styles.staffTimingText}>
                                          {s.shift_start_time && s.shift_end_time
                                            ? `${formatTo12Hour(s.shift_start_time)} - ${formatTo12Hour(s.shift_end_time)}`
                                            : s.shift_time || '08:00 - 20:00'}
                                        </Text>
                                        {s.phone && (
                                          <Text style={[styles.staffPhoneText, { color: theme.colors.mute }]}>
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
                                  </TouchableOpacity>
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
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                          Designated Supervisors
                        </Text>
                        <Text style={[styles.assignedCountText, { color: theme.colors.mute }]}>
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
                            <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
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
                                <Text style={[styles.userChipText, { color: theme.colors.ink }]}>
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
                      <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                        Assigned Operators (24h)
                      </Text>
                      <Text style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                        {operatorIds.length}/{maxMobileShifts} assigned
                      </Text>
                    </View>

                    {operatorIds.length < maxMobileShifts ? (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setIsOperatorDropdownOpen((prev) => !prev);
                          setIsSupervisorDropdownOpen(false);
                          setOperatorSearchQuery('');
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.addOperatorTrigger,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: isOperatorDropdownOpen ? theme.colors.ink : theme.colors.hairline,
                          },
                        ]}
                      >
                        <Text style={[styles.addOperatorText, { color: theme.colors.ink }]}>
                          + Search & Assign Operators ({operatorIds.length}/{maxMobileShifts})
                        </Text>
                        <ChevronDown
                          size={14}
                          color={isOperatorDropdownOpen ? '#0284c7' : theme.colors.mute}
                          style={{
                            transform: [{ rotate: isOperatorDropdownOpen ? '180deg' : '0deg' }],
                          }}
                        />
                      </TouchableOpacity>
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
                        {/* Search Input */}
                        <View
                          style={[
                            styles.dropdownSearchBox,
                            {
                              backgroundColor: theme.colors.canvas,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          <Search size={14} color={theme.colors.mute} />
                          <TextInput
                            style={[styles.dropdownSearchInput, { color: theme.colors.ink }]}
                            placeholder="Search operators by name, phone..."
                            placeholderTextColor={theme.colors.mute}
                            value={operatorSearchQuery}
                            onChangeText={setOperatorSearchQuery}
                            autoFocus
                          />
                          {operatorSearchQuery ? (
                            <TouchableOpacity onPress={() => setOperatorSearchQuery('')} hitSlop={8}>
                              <X size={13} color={theme.colors.mute} />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {/* Operators List */}
                        <ScrollView
                          style={styles.dropdownScrollList}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={true}
                        >
                          {filteredOperators.length === 0 ? (
                            <View style={styles.emptyDropdownList}>
                              <Text style={[styles.emptyDropdownText, { color: theme.colors.mute }]}>
                                {operatorSearchQuery ? 'No matching operators found' : 'All operators assigned'}
                              </Text>
                            </View>
                          ) : (
                            filteredOperators.map((op) => {
                              const isAlreadyAssigned = operatorIds.includes(op.id);
                              const nextShift = getNextAvailableShift();
                              const conflict = getOperatorConflict(op.id, nextShift.code);

                              return (
                                <TouchableOpacity
                                  key={op.id}
                                  onPress={() => handleAddOperator(op)}
                                  activeOpacity={0.7}
                                  style={[
                                    styles.dropdownStaffItem,
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
                                          <Text style={[styles.staffRolePillText, { color: '#0284c7' }]}>
                                            ASSIGNED
                                          </Text>
                                        </View>
                                      )}
                                    </View>

                                    {/* Timing & Phone */}
                                    <View style={styles.staffMetaRow}>
                                      <Clock size={11} color="#10b981" />
                                      <Text style={styles.staffTimingText}>
                                        {op.shift_start_time && op.shift_end_time
                                          ? `${formatTo12Hour(op.shift_start_time)} - ${formatTo12Hour(op.shift_end_time)}`
                                          : op.shift_time || '06:00 - 14:00'}
                                      </Text>
                                      {op.phone && (
                                        <Text style={[styles.staffPhoneText, { color: theme.colors.mute }]}>
                                          • {op.phone}
                                        </Text>
                                      )}
                                    </View>

                                    {/* Conflict indication if any */}
                                    {conflict && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                        <AlertCircle size={10} color="#ef4444" />
                                        <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '600' }} numberOfLines={1}>
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
                                      <Text style={[styles.assignShiftActionText, { color: '#0284c7' }]}>
                                        + Shift {nextShift.code}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
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
                        <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
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
                                    <Text style={styles.operatorIndexText}>{idx + 1}</Text>
                                  </View>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <Text style={[styles.operatorCardName, { color: theme.colors.ink }]} numberOfLines={1}>
                                        {o.full_name}
                                      </Text>
                                      <View style={[styles.shiftBadge, conflictMsg ? { backgroundColor: '#ef444420', borderColor: '#ef444450' } : null]}>
                                        <Text style={[styles.shiftBadgeText, conflictMsg ? { color: '#ef4444' } : null]}>
                                          Shift {currentShift}
                                        </Text>
                                      </View>
                                    </View>
                                    {(o.phone || o.email) && (
                                      <Text style={[styles.operatorContactSubtitle, { color: theme.colors.mute }]} numberOfLines={1}>
                                        {[o.phone, o.email].filter(Boolean).join(' • ')}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleRemoveOperator(o.id)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={styles.removeOperatorBtn}
                                  accessibilityLabel={`Remove ${o.full_name}`}
                                >
                                  <X size={15} color={theme.colors.mute} />
                                </TouchableOpacity>
                              </View>

                              {/* Overlap Conflict Pill */}
                              {conflictMsg && (
                                <View style={styles.operatorConflictBadge}>
                                  <AlertCircle size={12} color="#ef4444" style={{ marginTop: 1 }} />
                                  <Text style={styles.operatorConflictText}>{conflictMsg}</Text>
                                </View>
                              )}

                              {/* Shift Selection: Smooth Grow & Shrink ShiftCardSelector */}
                              <View style={styles.shiftSelectionSection}>
                                <View style={styles.shiftSelectionHeader}>
                                  <Clock size={11} color="#0284c7" />
                                  <Text style={[styles.shiftSelectionLabel, { color: theme.colors.mute }]}>
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
                  <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
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
                        }
                      }}
                      placeholder="Search or select client to rent..."
                      modalTitle="Select Client"
                    />
                  </View>

                  {/* Automatic Rental Status Indicator */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Rental Status (Auto-Linked)</Text>
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
                        <Text style={[styles.selectValueText, { color: theme.colors.ink, fontWeight: '600' }]}>
                          {selectedClient ? 'Rented' : 'Available'}
                        </Text>
                        {selectedClient && (
                          <Text style={[styles.assignedCountText, { color: theme.colors.mute, marginLeft: 6 }]}>
                            (Deployed)
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.assignedCountText, { color: theme.colors.mute, marginTop: 4 }]}>
                      {selectedClient
                        ? `Automatically rented to ${selectedClient.company_name}.`
                        : 'Automatically available when no client is assigned.'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Actions (Screenshot 1 Match) */}
            <View style={styles.bottomButtonsWrap}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryActionBtnText, { color: theme.colors.onPrimary }]}>
                    {isSupervisor || initialSection === 'personnel' ? 'Save Assignments' : isEdit ? 'Update Machine' : 'Register Machine'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                disabled={isSaving}
                style={[
                  styles.cancelActionBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelActionBtnText, { color: theme.colors.ink }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Sub-Modals */}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '92%',
    ...Platform.select({
      web: {
        boxShadow: '0 -8px 20px rgba(0, 0, 0, 0.35)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 16,
      },
    }),
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
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
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
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
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
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  assignedCountText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  userChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  triggerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 13.5,
  },
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
  addOperatorText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
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
  operatorCardName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  shiftBadge: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e940',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shiftBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  shiftChipText: {
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
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
  selectValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelActionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
    fontSize: 12.5,
    fontWeight: '600',
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
    fontSize: 13,
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
  selectionCountText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  deselectAllActionText: {
    fontSize: 12,
    fontWeight: '600',
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
  emptyDropdownText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
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
  staffNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  staffRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radiusNumeric.sm,
  },
  staffRolePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  staffTimingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  staffPhoneText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
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
  assignShiftActionText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
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
    fontSize: 12,
    fontWeight: '800',
  },
  operatorContactSubtitle: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  shiftSelectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
