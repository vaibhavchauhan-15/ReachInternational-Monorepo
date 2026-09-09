/**
 * OfflineCollisionModal — Non-Destructive Collision Resolution Bottom Sheet
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-05, D-08, STRIDE mitigation T-14-04, and Vercel Geist design tokens.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Input, TimeInput, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, AlertTriangle, Clock, RefreshCw, Trash2, ShieldAlert } from 'lucide-react-native';
import { QueuedMutation } from '../../lib/offline/types';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { computeShiftTiming, formatCompactTiming } from '@reachinternational/utils';

export interface OfflineCollisionModalProps {
  visible: boolean;
  onClose: () => void;
  queuedMutation: QueuedMutation | null;
  onResubmitSuccess?: () => void;
}

export const OfflineCollisionModal: React.FC<OfflineCollisionModalProps> = ({
  visible,
  onClose,
  queuedMutation,
  onResubmitSuccess,
}) => {
  const { theme, isDark } = useTheme();

  const payload = (queuedMutation?.payload || {}) as Record<string, any>;
  const conflict = queuedMutation?.server_conflict;

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [startMeter, setStartMeter] = useState('');
  const [endMeter, setEndMeter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (queuedMutation) {
      setStartTime(payload.start_time || '06:00 AM');
      setEndTime(payload.end_time || '02:00 PM');
      setStartMeter(String(payload.start_meter ?? '0'));
      setEndMeter(String(payload.end_meter ?? '0'));
      setError('');
    }
  }, [queuedMutation]);

  if (!queuedMutation) return null;

  const handleResubmit = async () => {
    setError('');

    const startVal = parseFloat(startMeter);
    const endVal = parseFloat(endMeter);

    if (isNaN(startVal) || isNaN(endVal)) {
      setError('Please enter valid starting and ending meter readings.');
      return;
    }

    if (endVal < startVal) {
      setError('Ending hour meter reading cannot be less than starting hour meter reading.');
      return;
    }

    const shiftCalc = computeShiftTiming({
      logDate: payload.log_date || new Date().toISOString().split('T')[0],
      startTime,
      endTime,
      manualOvertime: payload.overtime_hours,
      disallowFutureEnd: true,
    });

    if (!shiftCalc.isValid) {
      setError(shiftCalc.errorMessage || 'Invalid shift start and end times.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update payload with adjusted shift parameters (T-14-04)
      const updatedPayload: Record<string, unknown> = {
        ...payload,
        start_meter: startVal,
        end_meter: endVal,
        running_hours: endVal - startVal,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        log_date: shiftCalc.resolvedStartDate,
        end_date: shiftCalc.resolvedEndDate,
        start_datetime: shiftCalc.startDateTime?.toISOString(),
        end_datetime: shiftCalc.endDateTime?.toISOString(),
        normal_working_hours: shiftCalc.normalWorkingHours,
        overtime_hours: shiftCalc.overtimeHours,
      };

      // Reset status to pending and clear conflict details
      await offlineQueueManager.updateMutation(queuedMutation.id, {
        payload: updatedPayload,
        status: 'pending',
        last_error: undefined,
        server_conflict: undefined,
        retry_count: 0,
      });

      // Trigger queue drain in background
      offlineQueueManager.drainQueue().catch(() => {});

      if (onResubmitSuccess) {
        onResubmitSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update queued draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Offline Draft?',
      'Are you sure you want to discard this shift submission? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await offlineQueueManager.removeMutation(queuedMutation.id);
              onClose();
            } catch (err) {
              console.warn('[OfflineCollisionModal] Discard error:', err);
            }
          },
        },
      ]
    );
  };

  const alertBg = isDark ? '#450a0a' : '#fef2f2';
  const alertBorder = isDark ? '#991b1b' : '#fee2e2';
  const alertText = isDark ? '#f87171' : '#dc2626';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.canvas, borderTopColor: theme.colors.hairline }]}>
          {/* Top Notch Drag Indicator */}
          <View style={styles.notchWrap}>
            <View style={[styles.notch, { backgroundColor: theme.colors.hairline }]} />
          </View>

          {/* Sheet Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.colors.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.iconCircle, { backgroundColor: alertBg, borderColor: alertBorder }]}>
                <AlertTriangle size={18} color={alertText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: theme.colors.ink }]}>
                  Shift Overlap Detected
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.colors.mute }]}>
                  Resolve schedule conflict and resubmit
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.canvasElevated }]}>
              <X size={18} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Conflict Context Banner */}
            <View style={[styles.conflictBanner, { backgroundColor: alertBg, borderColor: alertBorder }]}>
              <ShieldAlert size={16} color={alertText} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.conflictBannerTitle, { color: alertText }]}>
                  Server Rejected Submission
                </Text>
                <Text style={[styles.conflictBannerBody, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                  {conflict?.server_message || queuedMutation.last_error || 'A conflicting shift exists in this time range.'}
                </Text>
                {conflict?.conflicting_operator ? (
                  <Text style={[styles.conflictMeta, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                    Conflicting Operator: <Text style={{ fontWeight: '700' }}>{conflict.conflicting_operator}</Text>
                  </Text>
                ) : null}
                {conflict?.conflicting_start_time && conflict?.conflicting_end_time ? (
                  <Text style={[styles.conflictMeta, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
                    Occupied Window: {formatCompactTiming(conflict.conflicting_start_time, conflict.conflicting_end_time)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Error Message if local validation fails */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: alertBg, borderColor: alertBorder }]}>
                <Text style={[styles.errorText, { color: alertText }]}>{error}</Text>
              </View>
            ) : null}

            {/* Shift Timing Adjustment Section */}
            <View style={styles.sectionHeader}>
              <Clock size={14} color={theme.colors.mute} />
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                Adjust Shift Timings
              </Text>
            </View>

            <View style={styles.twoColGrid}>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Start Time"
                  value={startTime}
                  onChange={setStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="End Time"
                  value={endTime}
                  onChange={setEndTime}
                />
              </View>
            </View>

            {/* Meter Readings Adjustment Section */}
            <View style={[styles.sectionHeader, { marginTop: spacingNumeric.md }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                Hour Meter Readings
              </Text>
            </View>

            <View style={styles.twoColGrid}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Meter"
                  value={startMeter}
                  onChangeText={setStartMeter}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Meter"
                  value={endMeter}
                  onChangeText={setEndMeter}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Actions Strip */}
            <View style={styles.actionsStrip}>
              <Button
                label={isSubmitting ? 'Resubmitting...' : 'Resubmit Log'}
                onPress={handleResubmit}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />

              <TouchableOpacity
                onPress={handleDiscard}
                style={[styles.discardBtn, { borderColor: alertBorder, backgroundColor: alertBg }]}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={alertText} />
                <Text style={[styles.discardText, { color: alertText }]}>Discard</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  notchWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  notch: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    paddingHorizontal: spacingNumeric.md,
  },
  bodyContent: {
    paddingVertical: spacingNumeric.md,
    gap: spacingNumeric.xs,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  conflictBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  conflictBannerBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  conflictMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  twoColGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacingNumeric.lg,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  discardText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
