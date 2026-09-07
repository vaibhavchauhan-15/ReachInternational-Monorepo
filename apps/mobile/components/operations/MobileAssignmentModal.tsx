/**
 * ServiceCentric Mobile — Operator Shift Assignment Modal
 * Enforces recurring daily shifts, up to 3 active operators per equipment,
 * profile shift pre-fill, and conflict prevention.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, UserCheck, AlertCircle, Check, Sun, Moon, Clock, Users } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import {
  parseTimeToMinutes,
  parseProfileShiftTime,
  minutesTo24HourTime,
  formatTo12Hour,
} from '@reachinternational/utils';

export interface MobileAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  machineId: string;
  machineCode: string;
  machineModel?: string;
  activeAssignmentsCount: number;
  activeOperators: { id: string; full_name: string; phone?: string; shift_time?: string }[];
  currentUserId: string;
  onSuccess: () => void;
}

export const MobileAssignmentModal: React.FC<MobileAssignmentModalProps> = ({
  visible,
  onClose,
  machineId,
  machineCode,
  machineModel,
  activeAssignmentsCount,
  activeOperators,
  currentUserId,
  onSuccess,
}) => {
  const { theme } = useTheme();

  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('04:00 PM');
  const [notes, setNotes] = useState('');
  const [hasProfileShift, setHasProfileShift] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // When an operator is selected, auto-check and prefill profile shift
  const handleSelectOperator = (opId: string) => {
    setSelectedOperatorId(opId);
    setError('');

    const op = activeOperators.find((o) => o.id === opId);
    if (!op || !op.shift_time) {
      setHasProfileShift(false);
      setShiftStartTime('');
      setShiftEndTime('');
      return;
    }

    const parsed = parseProfileShiftTime(op.shift_time);
    if (parsed) {
      setShiftStartTime(parsed.startTime);
      setShiftEndTime(parsed.endTime);
      setHasProfileShift(true);
    } else {
      setHasProfileShift(false);
      setShiftStartTime('');
      setShiftEndTime('');
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

  const handleSubmit = async () => {
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
      setError('Invalid shift timing format. Use hh:mm AM/PM.');
      return;
    }

    if (activeAssignmentsCount >= 3) {
      setError('This equipment has reached maximum capacity of 3 active operators.');
      return;
    }

    const start24 = minutesTo24HourTime(sMin);
    const end24 = minutesTo24HourTime(eMin);

    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('assign_operator_machine_atomic', {
        p_machine_id: machineId,
        p_operator_id: selectedOperatorId,
        p_shift_start_time: start24,
        p_shift_end_time: end24,
        p_assigned_by: currentUserId,
        p_notes: notes ? notes.trim() : null,
      });

      if (rpcError) {
        if (rpcError.code === '23P01') {
          setError('SHIFT CONFLICT: This operator already has an overlapping shift window active on another machine.');
        } else if (rpcError.message?.includes('MAX_OPERATORS_REACHED')) {
          setError('Maximum capacity of 3 active operators reached for this equipment.');
        } else {
          setError(rpcError.message || 'Failed to assign operator.');
        }
        return;
      }

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
      <View style={styles.overlay}>
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
                {machineCode} {machineModel ? `• ${machineModel}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Capacity Strip */}
          <View
            style={[
              styles.capacityPill,
              {
                backgroundColor:
                  activeAssignmentsCount >= 3
                    ? '#fee2e2'
                    : activeAssignmentsCount > 0
                    ? '#e0f2fe'
                    : theme.colors.canvas,
                borderColor:
                  activeAssignmentsCount >= 3
                    ? '#f87171'
                    : activeAssignmentsCount > 0
                    ? '#7dd3fc'
                    : theme.colors.hairline,
              },
            ]}
          >
            <Users size={14} color={activeAssignmentsCount >= 3 ? '#dc2626' : '#0284c7'} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: activeAssignmentsCount >= 3 ? '#b91c1c' : '#0369a1',
              }}
            >
              Current Capacity: {activeAssignmentsCount} / 3 Operators Assigned
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
              <AlertCircle size={14} color="#dc2626" style={{ marginTop: 1 }} />
              <Text style={{ color: '#b91c1c', fontSize: 11, fontWeight: '600', flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Operator Selection List */}
            <Text style={[styles.label, { color: theme.colors.mute }]}>Select Operator *</Text>
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
                <View style={[styles.shiftBanner, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Check size={12} color="#059669" />
                  <Text style={{ fontSize: 10, color: '#047857', fontWeight: '600' }}>
                    Auto-filled from profile shift: {shiftStartTime} – {shiftEndTime}
                  </Text>
                </View>
              ) : hasProfileShift === false ? (
                <View style={[styles.shiftBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <AlertCircle size={12} color="#d97706" />
                  <Text style={{ fontSize: 10, color: '#b45309', fontWeight: '600' }}>
                    No profile shift found. Please enter shift times below.
                  </Text>
                </View>
              ) : null
            ) : null}

            {/* Shift Timings Inputs */}
            <View style={{ flexDirection: 'row', gap: spacingNumeric.sm, marginTop: spacingNumeric.xs }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Shift Start Time *"
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
                  label="Shift End Time *"
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
              <View style={[styles.durationBadge, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                  Duration: <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{shiftDuration}</Text>
                </Text>
                {isOvernight ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Moon size={11} color="#6366f1" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#4f46e5' }}>Overnight Shift</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Sun size={11} color="#d97706" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#b45309' }}>Day Shift</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Notes */}
            <Input
              label="Assignment Notes (Optional)"
              placeholder="e.g. Primary site operator"
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
              label={isSubmitting ? 'Assigning...' : 'Confirm Shift'}
              variant="primary"
              onPress={handleSubmit}
              disabled={isSubmitting || !selectedOperatorId || !shiftStartTime || !shiftEndTime || activeAssignmentsCount >= 3}
              style={{ flex: 1, minHeight: 44 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    maxHeight: '85%',
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
    fontFamily: 'GeistMono_500Medium',
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
