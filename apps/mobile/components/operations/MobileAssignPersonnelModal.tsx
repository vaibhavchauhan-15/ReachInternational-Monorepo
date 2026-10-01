import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Button, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { broadcastMobileAssignmentChanged } from '../../lib/realtime-roster';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  X,
  Check,
  Clock,
  UserCheck,
  Truck,
  Building2,
  Moon,
  Sun,
  AlertCircle,
  ChevronDown,
  SlidersHorizontal,
  Users,
  Trash2,
} from 'lucide-react-native';
import {
  formatTo12Hour,
  parseTimeToMinutes,
  parseConflictReason,
} from '@reachinternational/utils';

export interface MobileAssignPersonnelModalProps {
  visible: boolean;
  onClose: () => void;
  initialMachineId?: string;
  initialOperatorId?: string;
  onSuccess?: () => void;
}

export interface ClientShiftItem {
  id?: string;
  code: string;
  name?: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
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

function checkTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const r1 = shiftToMinuteRanges(start1, end1);
  const r2 = shiftToMinuteRanges(start2, end2);
  return doRangesOverlap(r1, r2);
}

export const MobileAssignPersonnelModal: React.FC<MobileAssignPersonnelModalProps> = ({
  visible,
  onClose,
  initialMachineId,
  initialOperatorId,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();

  // Data pools
  const [machines, setMachines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [fleetAssignments, setFleetAssignments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Form state
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || '');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(initialOperatorId || '');
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>('S1');
  const [clientShifts, setClientShifts] = useState<ClientShiftItem[]>(DEFAULT_SHIFTS);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string>('06:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState<string>('12:00 PM');
  const [showManualTimes, setShowManualTimes] = useState(false);
  const [notes, setNotes] = useState('');
  const [activeAssignments, setActiveAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Selector modal states
  const [isMachinePickerOpen, setIsMachinePickerOpen] = useState(false);
  const [isOperatorPickerOpen, setIsOperatorPickerOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load machines and operators when modal opens
  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoadingData(true);
    setAssignmentError(null);

    Promise.all([
      supabase
        .from('machines')
        .select('id, machine_id, model, serial_number, client_id, client:clients(id, company_name)')
        .order('machine_id', { ascending: true }),
      supabase
        .from('users')
        .select('id, full_name, phone, email, shift_start_time, shift_end_time')
        .eq('role', 'operator')
        .neq('status', 'inactive')
        .order('full_name', { ascending: true }),
      supabase
        .from('operator_machine_assignments')
        .select('operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active')
        .eq('is_active', true),
    ])
      .then(([mRes, uRes, assRes]) => {
        if (!active) return;
        const machList = mRes.data || [];
        setMachines(machList);
        setOperators(uRes.data || []);
        setFleetAssignments(assRes.data || []);

        if (!selectedMachineId && machList.length > 0) {
          setSelectedMachineId(initialMachineId || machList[0].id);
        }
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [visible, initialMachineId]);

  // Synchronize initial IDs whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      if (initialMachineId) {
        setSelectedMachineId(initialMachineId);
      } else if (!selectedMachineId && machines.length > 0) {
        setSelectedMachineId(machines[0].id);
      }
      if (initialOperatorId) {
        setSelectedOperatorId(initialOperatorId);
      }
    }
  }, [visible, initialMachineId, initialOperatorId, machines, selectedMachineId]);

  // Selected Machine resolution
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId),
    [machines, selectedMachineId]
  );
  const clientId = selectedMachine?.client_id;
  const clientCompanyName = selectedMachine?.client?.company_name;

  // Selected Operator resolution
  const selectedOperator = useMemo(
    () => operators.find((u) => u.id === selectedOperatorId),
    [operators, selectedOperatorId]
  );

  // Load client shift templates when machine changes
  useEffect(() => {
    if (!visible || !clientId) {
      setClientShifts(DEFAULT_SHIFTS);
      return;
    }

    let active = true;
    const fetchClientShifts = async () => {
      setLoadingShifts(true);
      try {
        const { data, error } = await supabase
          .from('client_shift_codes')
          .select('id, code, name, start_time, end_time, crosses_midnight')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (!active) return;
        if (!error && data && data.length > 0) {
          const formatted: ClientShiftItem[] = data.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            start_time: formatTo12Hour(s.start_time) || s.start_time,
            end_time: formatTo12Hour(s.end_time) || s.end_time,
            crosses_midnight: s.crosses_midnight,
          }));
          setClientShifts(formatted);
          setSelectedShiftCode(formatted[0].code);
          setShiftStartTime(formatted[0].start_time);
          setShiftEndTime(formatted[0].end_time);
        } else {
          setClientShifts(DEFAULT_SHIFTS);
          setSelectedShiftCode(DEFAULT_SHIFTS[0].code);
          setShiftStartTime(DEFAULT_SHIFTS[0].start_time);
          setShiftEndTime(DEFAULT_SHIFTS[0].end_time);
        }
      } catch (err) {
        console.warn('Error fetching client shift codes:', err);
      } finally {
        if (active) setLoadingShifts(false);
      }
    };

    fetchClientShifts();

    return () => {
      active = false;
    };
  }, [visible, clientId]);

  // Load active assignments for the selected machine
  const fetchActiveAssignments = useCallback(async () => {
    if (!selectedMachineId) {
      setActiveAssignments([]);
      return;
    }
    setLoadingAssignments(true);
    try {
      const { data } = await supabase
        .from('operator_machine_assignments')
        .select('id, operator_id, shift_code, shift_start_time, shift_end_time, crosses_midnight, operator:users(id, full_name, phone)')
        .eq('machine_id', selectedMachineId)
        .eq('is_active', true);

      setActiveAssignments(data || []);
    } catch (err) {
      console.warn('Error fetching active assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  }, [selectedMachineId]);

  useEffect(() => {
    if (!visible || !selectedMachineId) {
      setActiveAssignments([]);
      return;
    }

    let active = true;
    fetchActiveAssignments();

    return () => {
      active = false;
    };
  }, [visible, selectedMachineId, fetchActiveAssignments]);

  const handleRemoveAssignment = async (assignment: any) => {
    setAssignmentError(null);
    setRemovingId(assignment.id);
    try {
      const opId = assignment.operator_id || assignment.operator?.id;
      const { data, error } = await supabase.rpc('end_operator_machine_assignment_atomic', {
        p_assignment_id: assignment.id,
        p_ended_by: (await supabase.auth.getUser()).data.user?.id || null,
        p_end_reason: 'Relieved via mobile roster management',
      });

      if (error) {
        setAssignmentError(error.message || 'Failed to relieve operator.');
        return;
      }

      broadcastMobileAssignmentChanged({
        action: 'unassigned',
        machineId: selectedMachineId,
        operatorId: opId,
        shiftCode: assignment.shift_code,
      });

      await fetchActiveAssignments();
      supabase
        .from('operator_machine_assignments')
        .select('operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active')
        .eq('is_active', true)
        .then((res) => {
          if (res.data) setFleetAssignments(res.data);
        });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setAssignmentError(err?.message || 'Failed to relieve operator.');
    } finally {
      setRemovingId(null);
    }
  };

  // Duration computation
  const shiftDurationHours = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return '';
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return '';
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hrs`;
  }, [shiftStartTime, shiftEndTime]);

  // Overnight shift detection
  const isOvernight = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return false;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return false;
    return e <= s;
  }, [shiftStartTime, shiftEndTime]);

  // Handle form submission
  const handleSubmit = async () => {
    setAssignmentError(null);

    if (!selectedMachineId || !selectedOperatorId) {
      setAssignmentError('Please select both a target machine and an active operator.');
      return;
    }
    if (!shiftStartTime || !shiftEndTime) {
      setAssignmentError('Shift start time and end time are required.');
      return;
    }
    if (activeAssignments.length >= 3) {
      setAssignmentError('This machine has reached its maximum capacity of 3 active operators.');
      return;
    }

    // Check if shift code already taken on this machine
    const isShiftCodeTaken = activeAssignments.some((a) => (a.shift_code || '').toUpperCase() === selectedShiftCode.toUpperCase());
    if (isShiftCodeTaken) {
      const shiftObj = clientShifts.find((s) => s.code.toUpperCase() === selectedShiftCode.toUpperCase());
      const shiftDisplay = shiftObj?.name ? `${shiftObj.name} (${selectedShiftCode})` : `Shift ${selectedShiftCode}`;
      setAssignmentError(`${shiftDisplay} is already assigned on this equipment. Please select another shift code.`);
      return;
    }

    // Check operator shift capacity (max 3 shifts across fleet)
    const opShifts = fleetAssignments.filter((a) => a.operator_id === selectedOperatorId);
    if (opShifts.length >= 3) {
      setAssignmentError('This operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.');
      return;
    }

    // Check for shift time overlap with operator's other active shifts across the fleet
    for (const otherShift of opShifts) {
      if (otherShift.shift_start_time && otherShift.shift_end_time) {
        if (checkTimeOverlap(shiftStartTime, shiftEndTime, otherShift.shift_start_time, otherShift.shift_end_time)) {
          const otherMachine = machines.find((m) => m.id === otherShift.machine_id);
          const machLabel = otherMachine?.machine_id ? `equipment ${otherMachine.machine_id}` : 'another equipment';
          const otherStartFmt = formatTo12Hour(otherShift.shift_start_time) || otherShift.shift_start_time;
          const otherEndFmt = formatTo12Hour(otherShift.shift_end_time) || otherShift.shift_end_time;
          const thisStartFmt = formatTo12Hour(shiftStartTime) || shiftStartTime;
          const thisEndFmt = formatTo12Hour(shiftEndTime) || shiftEndTime;
          setAssignmentError(
            `This shift (${thisStartFmt} – ${thisEndFmt}) overlaps with operator's active shift (${otherStartFmt} – ${otherEndFmt}) on ${machLabel}. Shifts for an operator cannot overlap.`
          );
          return;
        }
      }
    }

    // Check for shift time overlap with other active operators on the same equipment
    for (const curAss of activeAssignments) {
      if (curAss.shift_start_time && curAss.shift_end_time && curAss.operator_id !== selectedOperatorId) {
        if (checkTimeOverlap(shiftStartTime, shiftEndTime, curAss.shift_start_time, curAss.shift_end_time)) {
          const curStartFmt = formatTo12Hour(curAss.shift_start_time) || curAss.shift_start_time;
          const curEndFmt = formatTo12Hour(curAss.shift_end_time) || curAss.shift_end_time;
          const thisStartFmt = formatTo12Hour(shiftStartTime) || shiftStartTime;
          const thisEndFmt = formatTo12Hour(shiftEndTime) || shiftEndTime;
          setAssignmentError(
            `This shift (${thisStartFmt} – ${thisEndFmt}) overlaps with active shift (${curStartFmt} – ${curEndFmt}) on this equipment. Shift timings on an equipment cannot overlap.`
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const { data: userAuth } = await supabase.auth.getUser();
      const currentUserId = userAuth?.user?.id || null;

      const { data, error } = await supabase.rpc('assign_operator_machine_atomic', {
        p_machine_id: selectedMachineId,
        p_operator_id: selectedOperatorId,
        p_shift_start_time: shiftStartTime,
        p_shift_end_time: shiftEndTime,
        p_shift_code: selectedShiftCode,
        p_assigned_by: currentUserId,
        p_notes: notes.trim() || 'Assigned via mobile Today Shift Logs',
      });

      if (error) {
        let msg = error.message || 'Failed to assign operator.';
        if (error.code === 'P0002' || msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
          msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
        }
        setAssignmentError(msg);
        return;
      }

      if (data && data.success === false) {
        let msg = data.error || 'Failed to assign operator.';
        if (msg.includes('MAX_OPERATOR_SHIFTS_REACHED') || msg.includes('active shifts')) {
          msg = 'Operator is already assigned to the maximum limit of 3 active shifts (24h) across the fleet.';
        }
        setAssignmentError(msg);
        return;
      }

      // Real-time broadcast dispatch to operations-roster channel for instant multi-user sync
      broadcastMobileAssignmentChanged({
        action: 'assigned',
        machineId: selectedMachineId,
        operatorId: selectedOperatorId,
        shiftCode: selectedShiftCode,
      });

      await fetchActiveAssignments();
      supabase
        .from('operator_machine_assignments')
        .select('operator_id, machine_id, shift_code, shift_start_time, shift_end_time, is_active')
        .eq('is_active', true)
        .then((res) => {
          if (res.data) setFleetAssignments(res.data);
        });

      // Success
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setAssignmentError(err?.message || 'Failed to assign operator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <UserCheck size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>
                  {initialOperatorId ? 'Assign Equipment' : 'Assign Personnel'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  {initialOperatorId
                    ? 'Assign machinery and shift window to operator'
                    : 'Assign operator to recurring machine shift'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.canvas }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.link} />
              <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
                Loading fleet machines and personnel...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Error / Conflict Alert */}
              {assignmentError && (
                <View
                  style={[
                    styles.errorAlert,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                    },
                  ]}
                >
                  <AlertCircle size={16} color="#ef4444" style={styles.errorIcon} />
                  <Text style={styles.errorText}>{assignmentError}</Text>
                </View>
              )}

              {/* 1. Machine Selector Card */}
              <View style={styles.section}>
                <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>
                  TARGET MACHINE *
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSearchFilter('');
                    setIsMachinePickerOpen(true);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.pickerTrigger,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.pickerTriggerLeft}>
                    <Truck size={16} color={theme.colors.link} />
                    <View style={styles.pickerTriggerTextWrap}>
                      <Text style={[styles.pickerTriggerTitle, { color: theme.colors.ink }]}>
                        {selectedMachine
                          ? `${selectedMachine.machine_id} · ${selectedMachine.model || 'Machine'}`
                          : 'Select target equipment...'}
                      </Text>
                      {selectedMachine?.serial_number && (
                        <Text style={[styles.pickerTriggerSub, { color: theme.colors.mute }]}>
                          Serial: {selectedMachine.serial_number}
                        </Text>
                      )}
                    </View>
                  </View>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>

                {clientCompanyName && (
                  <View
                    style={[
                      styles.clientBanner,
                      {
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#f0f9ff',
                        borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#bae6fd',
                      },
                    ]}
                  >
                    <Building2 size={13} color="#0284c7" />
                    <Text style={[styles.clientBannerText, { color: isDark ? '#7dd3fc' : '#0369a1' }]}>
                      Rented to: <Text style={{ fontWeight: '700' }}>{clientCompanyName}</Text>
                    </Text>
                  </View>
                )}
              </View>

              {/* 2. Machine Capacity & Active Roster */}
              <View
                style={[
                  styles.rosterCard,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.rosterHeader}>
                  <View style={styles.rosterHeaderLeft}>
                    <Users size={14} color={theme.colors.link} />
                    <Text style={[styles.rosterTitle, { color: theme.colors.ink }]}>
                      Shift Roster Capacity
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.capacityPill,
                      {
                        backgroundColor:
                          activeAssignments.length >= 3
                            ? 'rgba(239, 68, 68, 0.1)'
                            : activeAssignments.length > 0
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(156, 163, 175, 0.1)',
                        borderColor:
                          activeAssignments.length >= 3
                            ? 'rgba(239, 68, 68, 0.3)'
                            : activeAssignments.length > 0
                            ? 'rgba(16, 185, 129, 0.3)'
                            : 'rgba(156, 163, 175, 0.3)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.capacityText,
                        {
                          color:
                            activeAssignments.length >= 3
                              ? '#ef4444'
                              : activeAssignments.length > 0
                              ? '#10b981'
                              : theme.colors.mute,
                        },
                      ]}
                    >
                      {activeAssignments.length} / 3 Assigned
                    </Text>
                  </View>
                </View>

                {activeAssignments.length === 0 ? (
                  <Text style={[styles.emptyRosterText, { color: theme.colors.mute }]}>
                    No active operators currently assigned to this equipment.
                  </Text>
                ) : (
                  <View style={styles.assignmentsList}>
                    {activeAssignments.map((ass) => (
                      <View
                        key={ass.id}
                        style={[
                          styles.assignmentItem,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.assignmentItemLeft}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.assignmentName, { color: theme.colors.ink }]}>
                              {ass.operator?.full_name || 'Operator'}
                            </Text>
                            {(() => {
                              const count = activeAssignments.filter((a) => (a.operator_id || a.operator?.id) === (ass.operator_id || ass.operator?.id)).length;
                              if (count <= 1) return null;
                              return (
                                <View style={{ backgroundColor: count === 3 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: count === 3 ? '#059669' : '#0284c7' }}>
                                    {count === 3 ? '3 Shifts (24h)' : '2 Shifts'}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                          <Text style={[styles.assignmentTiming, { color: theme.colors.mute }]}>
                            {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.assignmentBadge}>
                            <Text style={styles.assignmentBadgeText}>
                              {clientShifts.find((s) => s.code.toUpperCase() === (ass.shift_code || '').toUpperCase())?.name
                                ? `${clientShifts.find((s) => s.code.toUpperCase() === (ass.shift_code || '').toUpperCase())?.name} (${ass.shift_code})`
                                : `Shift ${ass.shift_code || 'S1'}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveAssignment(ass)}
                            disabled={removingId === ass.id}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              minWidth: 32,
                              minHeight: 32,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            accessibilityLabel={`Relieve operator ${ass.operator?.full_name || ''}`}
                          >
                            {removingId === ass.id ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Trash2 size={13} color="#ef4444" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* 3. Operator Selector Card */}
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>
                    SELECT OPERATOR *
                  </Text>
                  {initialOperatorId && (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.link }}>
                      PRE-SELECTED
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSearchFilter('');
                    setIsOperatorPickerOpen(true);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.pickerTrigger,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.pickerTriggerLeft}>
                    <UserCheck size={16} color={theme.colors.link} />
                    <View style={styles.pickerTriggerTextWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.pickerTriggerTitle, { color: theme.colors.ink }]}>
                          {selectedOperator ? selectedOperator.full_name : 'Select active operator...'}
                        </Text>
                        {selectedOperator && (() => {
                          const opAss = fleetAssignments.filter((a) => a.operator_id === selectedOperator.id);
                          return (
                            <View
                              style={{
                                backgroundColor:
                                  opAss.length >= 2
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : opAss.length === 1
                                    ? 'rgba(2, 132, 199, 0.1)'
                                    : 'rgba(16, 185, 129, 0.1)',
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '700',
                                  color:
                                    opAss.length >= 3
                                      ? '#ef4444'
                                      : opAss.length >= 1
                                      ? '#0284c7'
                                      : '#10b981',
                                }}
                              >
                                {opAss.length}/3 Shifts
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {selectedOperator?.phone && (
                        <Text style={[styles.pickerTriggerSub, { color: theme.colors.mute }]}>
                          Phone: {selectedOperator.phone}
                        </Text>
                      )}
                    </View>
                  </View>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* 4. Shift Selector Pills */}
              <View
                style={[
                  styles.shiftCard,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.shiftHeader}>
                  <View style={styles.shiftHeaderLeft}>
                    <Clock size={14} color={theme.colors.link} />
                    <Text style={[styles.shiftTitle, { color: theme.colors.ink }]}>
                      Select Shift Window *
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowManualTimes(!showManualTimes)}
                    style={[
                      styles.manualTimeToggle,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <SlidersHorizontal size={11} color={theme.colors.mute} />
                    <Text style={[styles.manualTimeToggleText, { color: theme.colors.mute }]}>
                      {showManualTimes ? 'Standard' : 'Custom'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Horizontal Shift Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shiftPillsStrip}
                >
                  {clientShifts.map((sc) => {
                    const isSelected = selectedShiftCode.toUpperCase() === sc.code.toUpperCase();
                    return (
                      <TouchableOpacity
                        key={sc.code}
                        onPress={() => {
                          setSelectedShiftCode(sc.code);
                          setShiftStartTime(sc.start_time);
                          setShiftEndTime(sc.end_time);
                          setAssignmentError(null);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.shiftPill,
                          {
                            backgroundColor: isSelected ? theme.colors.link : theme.colors.canvasElevated,
                            borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.shiftPillTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                            <View
                              style={{
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(2, 132, 199, 0.1)',
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                                borderRadius: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                  fontWeight: '700',
                                  color: isSelected ? '#ffffff' : theme.colors.link,
                                }}
                              >
                                {sc.code}
                              </Text>
                            </View>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.shiftPillCode,
                                { color: isSelected ? '#ffffff' : theme.colors.ink, maxWidth: 140 },
                              ]}
                            >
                              {sc.name || `Shift ${sc.code}`}
                            </Text>
                          </View>
                          {sc.crosses_midnight && (
                            <Moon size={11} color={isSelected ? '#ffffff' : '#6366f1'} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.shiftPillTime,
                            { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.colors.mute },
                          ]}
                        >
                          {sc.start_time} – {sc.end_time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Manual Time Inputs */}
                {showManualTimes && (
                  <View style={[styles.manualInputsWrap, { borderTopColor: theme.colors.hairline }]}>
                    <Text style={[styles.manualInputsHeader, { color: theme.colors.mute }]}>
                      Custom Shift Timings:
                    </Text>
                    <View style={styles.manualInputsRow}>
                      <View style={styles.manualInputCol}>
                        <Text style={[styles.inputSubLabel, { color: theme.colors.mute }]}>
                          Start Time
                        </Text>
                        <TextInput
                          value={shiftStartTime}
                          onChangeText={(t) => {
                            setShiftStartTime(t);
                            setAssignmentError(null);
                          }}
                          placeholder="08:00 AM"
                          placeholderTextColor={theme.colors.mute}
                          style={[
                            styles.timeTextInput,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                              color: theme.colors.ink,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.manualInputCol}>
                        <Text style={[styles.inputSubLabel, { color: theme.colors.mute }]}>
                          End Time
                        </Text>
                        <TextInput
                          value={shiftEndTime}
                          onChangeText={(t) => {
                            setShiftEndTime(t);
                            setAssignmentError(null);
                          }}
                          placeholder="04:00 PM"
                          placeholderTextColor={theme.colors.mute}
                          style={[
                            styles.timeTextInput,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                              color: theme.colors.ink,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Duration info */}
                <View style={[styles.shiftFooter, { borderTopColor: theme.colors.hairline }]}>
                  <Text style={[styles.shiftDurationText, { color: theme.colors.mute }]}>
                    Duration: <Text style={{ color: theme.colors.ink, fontWeight: '700' }}>{shiftDurationHours || '—'}</Text>
                  </Text>
                  {isOvernight ? (
                    <View style={styles.overnightBadge}>
                      <Moon size={11} color="#6366f1" />
                      <Text style={styles.overnightBadgeText}>Overnight Shift</Text>
                    </View>
                  ) : (
                    <View style={styles.dayBadge}>
                      <Sun size={11} color="#d97706" />
                      <Text style={styles.dayBadgeText}>Day Shift</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* 5. Notes */}
              <View style={styles.section}>
                <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>
                  ASSIGNMENT NOTES (OPTIONAL)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Primary morning shift, client site operations"
                  placeholderTextColor={theme.colors.mute}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      color: theme.colors.ink,
                    },
                  ]}
                />
              </View>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[
                styles.cancelButton,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.ink }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !selectedMachineId || !selectedOperatorId || activeAssignments.length >= 3}
              style={[
                styles.confirmButton,
                {
                  backgroundColor:
                    submitting || !selectedMachineId || !selectedOperatorId || activeAssignments.length >= 3
                      ? theme.colors.mute
                      : theme.colors.link,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Assign</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Machine Picker Modal */}
        <Modal
          visible={isMachinePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMachinePickerOpen(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={[styles.subModalCard, { backgroundColor: theme.colors.canvasElevated }]}>
              <View style={[styles.subModalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.subModalTitle, { color: theme.colors.ink }]}>Select Machine</Text>
                <TouchableOpacity onPress={() => setIsMachinePickerOpen(false)}>
                  <X size={18} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={searchFilter}
                onChangeText={setSearchFilter}
                placeholder="Search machine ID or model..."
                placeholderTextColor={theme.colors.mute}
                style={[
                  styles.searchFilterInput,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                    color: theme.colors.ink,
                  },
                ]}
              />
              <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                {machines
                  .filter((m) => {
                    const q = searchFilter.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      m.machine_id?.toLowerCase().includes(q) ||
                      m.model?.toLowerCase().includes(q) ||
                      m.serial_number?.toLowerCase().includes(q)
                    );
                  })
                  .map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => {
                        setSelectedMachineId(m.id);
                        setIsMachinePickerOpen(false);
                      }}
                      style={[
                        styles.pickerItem,
                        {
                          borderBottomColor: theme.colors.hairline,
                          backgroundColor:
                            selectedMachineId === m.id
                              ? isDark
                                ? 'rgba(56, 189, 248, 0.1)'
                                : '#f0f9ff'
                              : 'transparent',
                        },
                      ]}
                    >
                      <View>
                        <Text style={[styles.pickerItemTitle, { color: theme.colors.ink }]}>
                          {m.machine_id} · {m.model || 'Machine'}
                        </Text>
                        <Text style={[styles.pickerItemSub, { color: theme.colors.mute }]}>
                          Serial: {m.serial_number || 'N/A'}{' '}
                          {m.client?.company_name ? `• ${m.client.company_name}` : ''}
                        </Text>
                      </View>
                      {selectedMachineId === m.id && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Operator Picker Modal */}
        <Modal
          visible={isOperatorPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOperatorPickerOpen(false)}
        >
          <View style={styles.subModalOverlay}>
            <View style={[styles.subModalCard, { backgroundColor: theme.colors.canvasElevated }]}>
              <View style={[styles.subModalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.subModalTitle, { color: theme.colors.ink }]}>Select Operator</Text>
                <TouchableOpacity onPress={() => setIsOperatorPickerOpen(false)}>
                  <X size={18} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
              <TextInput
                value={searchFilter}
                onChangeText={setSearchFilter}
                placeholder="Search operator name or phone..."
                placeholderTextColor={theme.colors.mute}
                style={[
                  styles.searchFilterInput,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                    color: theme.colors.ink,
                  },
                ]}
              />
              <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                {operators
                  .filter((u) => {
                    const q = searchFilter.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      u.full_name?.toLowerCase().includes(q) ||
                      u.phone?.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const opAssignments = fleetAssignments.filter((a) => a.operator_id === u.id);
                    const isMax = opAssignments.length >= 3;
                    const isCurrentOnThisMachine = opAssignments.some((a) => a.machine_id === selectedMachineId);
                    const isCurrentSelected = selectedOperatorId === u.id;

                    return (
                      <TouchableOpacity
                        key={u.id}
                        disabled={isMax}
                        onPress={() => {
                          setSelectedOperatorId(u.id);
                          setIsOperatorPickerOpen(false);
                        }}
                        style={[
                          styles.pickerItem,
                          {
                            borderBottomColor: theme.colors.hairline,
                            backgroundColor: isCurrentSelected
                              ? isDark
                                ? 'rgba(56, 189, 248, 0.1)'
                                : '#f0f9ff'
                              : 'transparent',
                            opacity: isMax ? 0.5 : 1,
                          },
                        ]}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.pickerItemTitle, { color: theme.colors.ink }]}>
                              {u.full_name}
                            </Text>
                            {isMax ? (
                              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444' }}>3/3 Shifts</Text>
                              </View>
                            ) : opAssignments.length > 0 ? (
                              <View style={{ backgroundColor: 'rgba(2, 132, 199, 0.1)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#0284c7' }}>
                                  {isCurrentOnThisMachine ? `${opAssignments.length}/3 (On this machine)` : `${opAssignments.length}/3 Shifts`}
                                </Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981' }}>Available</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.pickerItemSub, { color: theme.colors.mute }]}>
                            {u.phone || 'No phone'}
                            {isMax && ' • Max 3 shifts (24h) reached across fleet'}
                          </Text>
                        </View>
                        {isCurrentSelected && <Check size={16} color={theme.colors.link} />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: radiusNumeric.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    padding: spacingNumeric.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.md,
  },
  loadingText: {
    fontSize: 13.5,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.xs,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12.5,
    flex: 1,
    lineHeight: 18,
  },
  section: {
    gap: spacingNumeric.xs,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 48,
  },
  pickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  pickerTriggerTextWrap: {
    flex: 1,
  },
  pickerTriggerTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  pickerTriggerSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  clientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: spacingNumeric.xs,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  clientBannerText: {
    fontSize: 12.5,
  },
  rosterCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rosterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  rosterTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  capacityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyRosterText: {
    fontSize: 12.5,
    fontStyle: 'italic',
  },
  assignmentsList: {
    gap: 6,
  },
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  assignmentItemLeft: {
    flex: 1,
  },
  assignmentName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  assignmentTiming: {
    fontSize: 12,
    marginTop: 2,
  },
  assignmentBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  assignmentBadgeText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
  shiftCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  shiftTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  manualTimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  manualTimeToggleText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  shiftPillsStrip: {
    gap: spacingNumeric.xs,
    paddingVertical: 4,
  },
  shiftPill: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minWidth: 125,
    gap: 2,
  },
  shiftPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  shiftPillCode: {
    fontSize: 13,
    fontWeight: '700',
  },
  shiftPillTime: {
    fontSize: 12,
  },
  manualInputsWrap: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  manualInputsHeader: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  manualInputsRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  manualInputCol: {
    flex: 1,
    gap: 4,
  },
  inputSubLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeTextInput: {
    height: 44,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  shiftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  shiftDurationText: {
    fontSize: 12.5,
  },
  overnightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overnightBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  textInput: {
    minHeight: 44,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderTopWidth: 1,
  },
  cancelButton: {
    height: 44,
    paddingHorizontal: spacingNumeric.lg,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    height: 44,
    paddingHorizontal: spacingNumeric.xl,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  subModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    borderRadius: radiusNumeric.md,
    overflow: 'hidden',
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  subModalTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  searchFilterInput: {
    margin: spacingNumeric.sm,
    height: 44,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
    fontSize: 15,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  pickerItemTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  pickerItemSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
