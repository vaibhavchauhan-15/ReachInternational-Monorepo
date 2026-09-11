/**
 * ServiceCentric Mobile — Operator Shift Assignment Modal
 * Enforces recurring daily shifts, up to 3 active operators per equipment,
 * equipment shift roster capacity breakdown, profile shift pre-fill, and conflict prevention.
 */

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
  TouchableWithoutFeedback,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, UserCheck, AlertCircle, Check, Sun, Moon, Users, ChevronDown, ShieldAlert, AlertTriangle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { notifyOperatorAssigned, notifyShiftConflictDetected } from '../../lib/notifications';
import {
  parseTimeToMinutes,
  parseProfileShiftTime,
  minutesTo24HourTime,
  formatTo12Hour,
  parseConflictReason,
} from '@reachinternational/utils';
import type { MachineWithAssignments } from '../../app/(app)/operations';

export interface MobileAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  machineCode?: string;
  machineModel?: string;
  allMachines?: MachineWithAssignments[];
  activeAssignmentsCount?: number;
  activeOperators: { id: string; full_name: string; phone?: string; shift_time?: string }[];
  currentUserId: string;
  onSuccess: () => void;
}

export const MobileAssignmentModal: React.FC<MobileAssignmentModalProps> = ({
  visible,
  onClose,
  machineId: initialMachineId,
  machineCode: initialMachineCode,
  machineModel: initialMachineModel,
  allMachines = [],
  activeAssignmentsCount: initialCount,
  activeOperators,
  currentUserId,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();

  // Selected Machine State
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    initialMachineId || (allMachines[0]?.id || '')
  );
  const [showMachinePicker, setShowMachinePicker] = useState(false);

  // Selected Operator & Shift States
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('04:00 PM');
  const [notes, setNotes] = useState('');
  const [hasProfileShift, setHasProfileShift] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Sync initial machine id when prop changes
  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
    } else if (allMachines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(allMachines[0].id);
    }
  }, [initialMachineId, allMachines]);

  // Derive target machine info
  const targetMachine = useMemo(() => {
    if (!selectedMachineId) return null;
    return allMachines.find((m) => m.id === selectedMachineId) || null;
  }, [selectedMachineId, allMachines]);

  const effectiveMachineCode = initialMachineCode || targetMachine?.machine_id || 'Machine';
  const effectiveMachineModel = initialMachineModel || targetMachine?.model;
  const activeAssignments = targetMachine?.active_assignments || [];
  const currentCapacityCount = initialCount !== undefined ? initialCount : activeAssignments.length;

  // When an operator is selected, auto-check and prefill profile shift
  const handleSelectOperator = (opId: string) => {
    setSelectedOperatorId(opId);
    setError('');

    const op = activeOperators.find((o) => o.id === opId);
    if (!op || !op.shift_time) {
      setHasProfileShift(false);
      setShiftStartTime('08:00 AM');
      setShiftEndTime('04:00 PM');
      return;
    }

    const parsed = parseProfileShiftTime(op.shift_time);
    if (parsed) {
      const s12 = formatTo12Hour(parsed.startTime) || '08:00 AM';
      const e12 = formatTo12Hour(parsed.endTime) || '04:00 PM';
      setShiftStartTime(s12);
      setShiftEndTime(e12);
      setHasProfileShift(true);
    } else {
      setHasProfileShift(false);
      setShiftStartTime('08:00 AM');
      setShiftEndTime('04:00 PM');
    }
  };

  const isOvernight = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return false;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return false;
    return e <= s;
  }, [shiftStartTime, shiftEndTime]);

  const shiftDuration = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return null;
    let diff = e - s;
    if (diff <= 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  }, [shiftStartTime, shiftEndTime]);

  const isConflictError = Boolean(
    error &&
      (error.toLowerCase().includes('conflict') ||
        error.toLowerCase().includes('overlapping') ||
        error.toLowerCase().includes('already assigned') ||
        error.toLowerCase().includes('capacity') ||
        error.toLowerCase().includes('max_operators'))
  );

  const parsedConflictError = useMemo(() => {
    if (!isConflictError || !error) return null;
    const op = activeOperators.find((o) => o.id === selectedOperatorId);
    return parseConflictReason(error, {
      machineCode: effectiveMachineCode,
      machineModel: effectiveMachineModel,
      operatorName: op?.full_name,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [isConflictError, error, activeOperators, selectedOperatorId, effectiveMachineCode, effectiveMachineModel, shiftStartTime, shiftEndTime]);

  const handleSubmit = async () => {
    if (!selectedMachineId) {
      setError('Please select an equipment to assign.');
      return;
    }

    if (!selectedOperatorId) {
      setError('Please select an operator to assign.');
      return;
    }

    if (!shiftStartTime || !shiftEndTime) {
      setError('Please specify both shift start and end times.');
      return;
    }

    const sMin = parseTimeToMinutes(shiftStartTime);
    const eMin = parseTimeToMinutes(shiftEndTime);

    if (sMin === null || eMin === null) {
      setError('Invalid shift timing format. Use hh:mm AM/PM (e.g. 08:00 AM).');
      return;
    }

    if (currentCapacityCount >= 3) {
      setError('This equipment has reached maximum capacity of 3 active operators.');
      return;
    }

    const start24 = minutesTo24HourTime(sMin);
    const end24 = minutesTo24HourTime(eMin);

    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('assign_operator_machine_atomic', {
        p_machine_id: selectedMachineId,
        p_operator_id: selectedOperatorId,
        p_shift_start_time: start24,
        p_shift_end_time: end24,
        p_assigned_by: currentUserId,
        p_notes: notes ? notes.trim() : null,
      });

      if (rpcError) {
        if (rpcError.code === '23P01') {
          notifyShiftConflictDetected(effectiveMachineCode, 'Operator already has an active overlapping shift window on another machine.');
          setError('SHIFT CONFLICT: This operator already has an overlapping shift window active on another machine.');
        } else if (rpcError.message?.includes('MAX_OPERATORS_REACHED')) {
          setError('Maximum capacity of 3 active operators reached for this equipment.');
        } else {
          setError(rpcError.message || 'Failed to assign operator.');
        }
        return;
      }

      if (data && !(data as any).success) {
        const d = data as any;
        const msg = d.error || d.message || 'Failed to assign operator.';
        if (msg.toLowerCase().includes('conflict')) {
          notifyShiftConflictDetected(effectiveMachineCode, msg);
        }
        setError(msg);
        return;
      }

      const assignedOp = activeOperators.find((o) => o.id === selectedOperatorId);
      notifyOperatorAssigned(effectiveMachineCode, assignedOp?.full_name || 'Operator', `${shiftStartTime} - ${shiftEndTime}`);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unexpected error while assigning operator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                ]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.colors.ink }]}>Assign Operator Shift</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                      {effectiveMachineCode} {effectiveMachineModel ? `• ${effectiveMachineModel}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>

                {/* Optional Machine Picker (when launched from top "+ Assign Operator") */}
                {!initialMachineId && allMachines.length > 0 && (
                  <View style={styles.machineSelectSection}>
                    <Text style={[styles.label, { color: theme.colors.mute }]}>Target Equipment *</Text>
                    <TouchableOpacity
                      onPress={() => setShowMachinePicker(!showMachinePicker)}
                      style={[
                        styles.dropdownTrigger,
                        { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                      ]}
                    >
                      <Text style={[styles.dropdownTriggerText, { color: theme.colors.ink }]}>
                        {effectiveMachineCode} {effectiveMachineModel ? `(${effectiveMachineModel})` : ''}
                      </Text>
                      <ChevronDown size={16} color={theme.colors.mute} />
                    </TouchableOpacity>

                    {showMachinePicker && (
                      <View
                        style={[
                          styles.dropdownMenu,
                          { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                        ]}
                      >
                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                          {allMachines.map((m) => {
                            const isSel = m.id === selectedMachineId;
                            return (
                              <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                  setSelectedMachineId(m.id);
                                  setShowMachinePicker(false);
                                  setError('');
                                }}
                                style={[
                                  styles.dropdownOption,
                                  {
                                    backgroundColor: isSel
                                      ? isDark
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : 'rgba(0, 112, 243, 0.08)'
                                      : 'transparent',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dropdownOptionText,
                                    { color: isSel ? theme.colors.link : theme.colors.ink },
                                  ]}
                                >
                                  {m.machine_id} {m.model ? `• ${m.model}` : ''}
                                </Text>
                                <Text style={[styles.dropdownOptionSub, { color: theme.colors.mute }]}>
                                  {m.active_assignments?.length || 0}/3 Operators
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* Capacity & Shift Roster Status */}
                <View
                  style={[
                    styles.capacityPill,
                    {
                      backgroundColor:
                        currentCapacityCount >= 3
                          ? '#fee2e2'
                          : currentCapacityCount > 0
                          ? '#e0f2fe'
                          : theme.colors.canvas,
                      borderColor:
                        currentCapacityCount >= 3
                          ? '#f87171'
                          : currentCapacityCount > 0
                          ? '#7dd3fc'
                          : theme.colors.hairline,
                    },
                  ]}
                >
                  <Users size={14} color={currentCapacityCount >= 3 ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#38bdf8' : '#0284c7')} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: currentCapacityCount >= 3 ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#38bdf8' : '#0369a1'),
                    }}
                  >
                    Shift Roster Capacity: {currentCapacityCount} / 3 Operators Assigned
                  </Text>
                </View>

                {error ? (
                  isConflictError && parsedConflictError ? (
                    <View
                      style={[
                        styles.conflictAlertCard,
                        {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                          borderColor: isDark ? '#b91c1c' : '#fca5a5',
                        },
                      ]}
                    >
                      <View style={styles.conflictAlertHeader}>
                        <ShieldAlert size={16} color={isDark ? '#f87171' : '#dc2626'} />
                        <Text style={[styles.conflictAlertTitle, { color: isDark ? '#f87171' : '#991b1b' }]}>{parsedConflictError.title}</Text>
                        <View style={[styles.conflictAlertBadge, { backgroundColor: isDark ? '#dc2626' : '#dc2626' }]}>
                          <Text style={styles.conflictAlertBadgeText}>{parsedConflictError.badgeText}</Text>
                        </View>
                      </View>
                      <Text style={[styles.conflictAlertDesc, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                        {parsedConflictError.description}
                      </Text>
                      {parsedConflictError.bulletWarnings.map((w, i) => (
                        <View key={i} style={styles.conflictBulletRow}>
                          <Text style={[styles.conflictBulletDot, { color: isDark ? '#f87171' : '#dc2626' }]}>•</Text>
                          <Text style={[styles.conflictBulletText, { color: isDark ? '#fca5a5' : '#7f1d1d' }]}>{w}</Text>
                        </View>
                      ))}
                      <View
                        style={[
                          styles.conflictGuidanceBox,
                          {
                            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                          },
                        ]}
                      >
                        <Text style={[styles.conflictGuidanceText, { color: isDark ? '#fecaca' : '#7f1d1d' }]}>
                          💡 <Text style={{ fontWeight: '800' }}>Action Required:</Text>{' '}
                          {parsedConflictError.resolutionGuidance.adjustAdvice}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.errorBox,
                        {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                          borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fca5a5',
                        },
                      ]}
                    >
                      <AlertCircle size={14} color={isDark ? '#f87171' : '#dc2626'} style={{ marginTop: 1 }} />
                      <Text style={{ color: isDark ? '#f87171' : '#b91c1c', fontSize: 11, fontWeight: '600', flex: 1 }}>{error}</Text>
                    </View>
                  )
                ) : null}

                <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                  {/* Operator Selection List */}
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Select Operator to Assign *</Text>
                  <View style={styles.operatorsList}>
                    {activeOperators.map((op) => {
                      const isSelected = selectedOperatorId === op.id;
                      return (
                        <TouchableOpacity
                          key={op.id}
                          onPress={() => handleSelectOperator(op.id)}
                          style={[
                            styles.operatorCard,
                            {
                              backgroundColor: isSelected ? theme.colors.link + '15' : theme.colors.canvas,
                              borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.operatorName, { color: theme.colors.ink }]}>{op.full_name}</Text>
                            {op.phone ? (
                              <Text style={[styles.operatorMeta, { color: theme.colors.mute }]}>📞 {op.phone}</Text>
                            ) : null}
                          </View>
                          {isSelected ? <Check size={16} color={theme.colors.link} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Profile Shift Feedback Banner */}
                  {selectedOperatorId ? (
                    hasProfileShift === true ? (
                      <View
                        style={[
                          styles.shiftBanner,
                          {
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                            borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
                          },
                        ]}
                      >
                        <Check size={12} color={isDark ? '#34d399' : '#059669'} />
                        <Text style={{ fontSize: 10, color: isDark ? '#34d399' : '#047857', fontWeight: '600' }}>
                          Timings auto-filled from operator profile ({shiftStartTime} – {shiftEndTime}). You may adjust below.
                        </Text>
                      </View>
                    ) : hasProfileShift === false ? (
                      <View
                        style={[
                          styles.shiftBanner,
                          {
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                            borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a',
                          },
                        ]}
                      >
                        <AlertCircle size={12} color={isDark ? '#fbbf24' : '#d97706'} />
                        <Text style={{ fontSize: 10, color: isDark ? '#fbbf24' : '#b45309', fontWeight: '600' }}>
                          No profile shift found. Please select start and end times below.
                        </Text>
                      </View>
                    ) : null
                  ) : null}

                  {/* Shift Timings Inputs */}
                  <View style={{ flexDirection: 'row', gap: spacingNumeric.sm, marginTop: spacingNumeric.xs }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Daily Shift Start Time *"
                        placeholder="08:00 AM"
                        value={shiftStartTime}
                        onChangeText={(t) => {
                          setShiftStartTime(t);
                          setError('');
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Daily Shift End Time *"
                        placeholder="04:00 PM"
                        value={shiftEndTime}
                        onChangeText={(t) => {
                          setShiftEndTime(t);
                          setError('');
                        }}
                      />
                    </View>
                  </View>

                  {/* Duration / Overnight Indicator */}
                  {shiftStartTime && shiftEndTime && shiftDuration ? (
                    <View
                      style={[
                        styles.durationBadge,
                        { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                      ]}
                    >
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                        Shift Duration: <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{shiftDuration}</Text>
                      </Text>
                      {isOvernight ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Moon size={12} color="#6366f1" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#4f46e5' }}>Overnight Shift</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Sun size={12} color="#d97706" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>Day Shift</Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Notes */}
                  <Input
                    label="Assignment Notes (Optional)"
                    placeholder="e.g. Primary morning shift, client site operations"
                    value={notes}
                    onChangeText={setNotes}
                  />

                  <View style={{ height: 20 }} />
                </ScrollView>

                {/* Footer Actions */}
                <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    disabled={isSubmitting}
                    style={{ flex: 1, minHeight: 44 }}
                  />
                  <Button
                    label={isSubmitting ? 'Assigning...' : 'Confirm & Assign Shift'}
                    variant="primary"
                    onPress={handleSubmit}
                    disabled={
                      isSubmitting ||
                      !selectedMachineId ||
                      !selectedOperatorId ||
                      !shiftStartTime ||
                      !shiftEndTime ||
                      currentCapacityCount >= 3
                    }
                    style={{ flex: 1, minHeight: 44 }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
    maxHeight: '90%',
  },
  modalContent: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacingNumeric.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  machineSelectSection: {
    marginBottom: spacingNumeric.sm,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownOptionSub: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  capacityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  conflictAlertCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: 4,
  },
  conflictAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  conflictAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b91c1c',
    flex: 1,
  },
  conflictAlertBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conflictAlertBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  conflictAlertDesc: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  conflictBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  conflictBulletDot: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    lineHeight: 15,
  },
  conflictBulletText: {
    fontSize: 10.5,
    color: '#991b1b',
    lineHeight: 14,
    flex: 1,
  },
  conflictGuidanceBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: 2,
  },
  conflictGuidanceText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  formScroll: {
    maxHeight: 380,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  operatorsList: {
    gap: 6,
    marginBottom: spacingNumeric.sm,
  },
  operatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  operatorName: {
    fontSize: 12,
    fontWeight: '700',
  },
  operatorMeta: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
});
