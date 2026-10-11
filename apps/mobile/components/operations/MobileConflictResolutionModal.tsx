/**
 * ServiceCentric Mobile — Overtime Conflict Resolution Modal
 * Allows supervisors to review realized overtime crossing assignments,
 * examine detailed risk and concurrency advisories,
 * and either acknowledge (approve) or adjust end time with live hour recalculation.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Button, Input, Separator, useTheme, Text } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, ShieldAlert, Check, Clock, AlertTriangle, Info, ArrowRight } from '../ui/icon';
import { supabase } from '../../lib/supabase';
import { notifyConflictResolved } from '../../lib/notifications';
import {
  formatShiftTimingRange,
  minutesTo24HourTime,
  parseTimeToMinutes,
  parseConflictReason,
  calculateAdjustedHours,
} from '@reachinternational/utils';

export interface MobileConflictResolutionModalProps {
  visible: boolean;
  onClose: () => void;
  log: {
    id: string;
    log_date: string;
    machine_code: string;
    start_time?: string;
    end_time?: string;
    running_hours?: number;
    overtime_hours?: number;
    conflict_reason?: string;
    operator?: { full_name: string; phone?: string } | null;
    machine?: { id?: string; model?: string; machine_id?: string; serial_number?: string } | null;
  } | null;
  currentUserId: string;
  onSuccess: () => void;
}

export const MobileConflictResolutionModal: React.FC<MobileConflictResolutionModalProps> = ({
  visible,
  onClose,
  log,
  currentUserId,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();

  const [action, setAction] = useState<'acknowledge' | 'adjust'>('acknowledge');
  const [adjustedEndTime, setAdjustedEndTime] = useState(log?.end_time || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Synchronize adjusted end time if selected log changes
  React.useEffect(() => {
    if (log?.end_time) {
      setAdjustedEndTime(log.end_time);
      setError('');
      setNotes('');
      setAction('acknowledge');
    }
  }, [log]);

  // Parse structured conflict information
  const conflictDetails = useMemo(() => {
    if (!log) return null;
    return parseConflictReason(log.conflict_reason, {
      machineCode: log.machine_code,
      machineModel: log.machine?.model,
      operatorName: log.operator?.full_name,
      startTime: log.start_time,
      endTime: log.end_time,
      runningHours: log.running_hours,
      overtimeHours: log.overtime_hours,
      logDate: log.log_date,
    });
  }, [log]);

  // Live recalculated hours when adjusting time
  const adjustedCalculation = useMemo(() => {
    if (!log?.start_time || !adjustedEndTime) return null;
    return calculateAdjustedHours(log.start_time, adjustedEndTime);
  }, [log?.start_time, adjustedEndTime]);

  if (!log || !conflictDetails) return null;

  const handleResolve = async () => {
    let adj24: string | null = null;
    if (action === 'adjust') {
      if (!adjustedEndTime.trim()) {
        haptics.reject();
        setError('Please specify the adjusted shift end time.');
        return;
      }
      const min = parseTimeToMinutes(adjustedEndTime);
      if (min === null) {
        haptics.reject();
        setError('Invalid adjusted end time format. Use hh:mm AM/PM (e.g. 04:00 PM).');
        return;
      }
      adj24 = minutesTo24HourTime(min);
    }

    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('resolve_hour_log_conflict_atomic', {
        p_log_id: log.id,
        p_resolved_by: currentUserId,
        p_resolver_id: currentUserId,
        p_action: action,
        p_adjusted_end_time: adj24,
        p_notes: notes ? notes.trim() : null,
      });

      if (rpcError) {
        haptics.reject();
        setError(rpcError.message || 'Failed to resolve conflict.');
        return;
      }

      if (data && !(data as any).success && (data as any).error) {
        haptics.reject();
        setError((data as any).error || 'Failed to resolve conflict.');
        return;
      }

      haptics.confirm();
      notifyConflictResolved(
        log.machine?.machine_id || log.machine_code || 'Equipment',
        action === 'adjust' && adjustedCalculation ? adjustedCalculation.runningHours : (log.running_hours || 0)
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      haptics.reject();
      setError(err?.message || 'Unexpected error while resolving conflict.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom">
      <View
        style={[
          styles.modalContent,
          { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
        ]}
      >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={18} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>Resolve Overtime Conflict</Text>
              </View>
              <Text variant="subheading" style={[styles.subtitle, { color: theme.colors.mute }]}>
                {log.machine_code} {log.machine?.model ? `• ${log.machine.model}` : ''} • {log.operator?.full_name || 'Operator'}
              </Text>
            </View>
            <Pressable
              variant="iconButton"
              haptic="tap"
              hitSlopToMin48
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close resolution modal"
            >
              <X size={20} color={theme.colors.mute} />
            </Pressable>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Severity Tag & Title Banner */}
            <View
              style={[
                styles.alertHeaderCard,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a',
                },
              ]}
            >
              <View style={styles.alertHeaderTopRow}>
                <View style={[styles.severityPill, { backgroundColor: isDark ? '#d97706' : '#d97706' }]}>
                  <Text variant="caption" style={styles.severityPillText}>{conflictDetails.badgeText}</Text>
                </View>
                {conflictDetails.overtimeHoursText && (
                  <View
                    style={[
                      styles.otChip,
                      {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                        borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text variant="caption" style={[styles.otChipText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
                      {conflictDetails.overtimeHoursText}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="heading" style={[styles.alertHeading, { color: theme.colors.ink }]}>
                {conflictDetails.title}
              </Text>
              <Text variant="caption" style={[styles.alertNarrative, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                {conflictDetails.description}
              </Text>
            </View>

            {/* Structured Incident Breakdown */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>Incident Breakdown</Text>
              
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Target Equipment</Text>
                  <Text variant="body" style={[styles.summaryValue, { color: theme.colors.ink }]}>
                    {log.machine_code} {log.machine?.model ? `(${log.machine.model})` : ''}
                  </Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Operator</Text>
                  <Text variant="body" style={[styles.summaryValue, { color: theme.colors.ink }]}>
                    {log.operator?.full_name || 'Operator'}
                  </Text>
                </View>
              </View>

              <Separator className="my-1.5" />

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Shift Log Date</Text>
                  <Text variant="body" style={[styles.summaryValue, { color: theme.colors.ink }]}>{log.log_date}</Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Recorded Timings</Text>
                  <Text variant="body" style={[styles.summaryValue, { color: theme.colors.ink }]}>
                    {formatShiftTimingRange(log.start_time, log.end_time)}
                  </Text>
                </View>
              </View>

              <Separator className="my-1.5" />

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Total Duration</Text>
                  <Text variant="body" style={[styles.summaryValue, { color: theme.colors.link }]}>
                    {log.running_hours ?? 0} hrs
                  </Text>
                </View>
                <View style={styles.summaryCol}>
                  <Text variant="caption" style={[styles.summaryLabel, { color: theme.colors.mute }]}>Overtime Claimed</Text>
                  <Text variant="subheading" style={[styles.summaryValue, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                    {log.overtime_hours ? `+${log.overtime_hours} hrs OT` : 'None'}
                  </Text>
                </View>
              </View>

              {conflictDetails.conflictingEntity && (
                <>
                  <Separator className="my-1.5" />
                  <View style={styles.conflictEntityRow}>
                    <AlertTriangle size={14} color={isDark ? '#f87171' : '#dc2626'} />
                    <Text variant="label" style={{ color: isDark ? '#f87171' : '#b91c1c' }}>
                      Conflicting Equipment: {conflictDetails.conflictingEntity}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Operational Risk & Compliance Notice */}
            <View
              style={[
                styles.riskCard,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fca5a5',
                },
              ]}
            >
              <View style={styles.riskHeader}>
                <AlertTriangle size={14} color={isDark ? '#f87171' : '#dc2626'} />
                <Text variant="subheading" style={[styles.riskTitle, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                  Operational Risk & Compliance Warning
                </Text>
              </View>
              {conflictDetails.bulletWarnings.map((warn, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text variant="body" style={[styles.bulletDot, { color: isDark ? '#f87171' : '#dc2626' }]}>•</Text>
                  <Text variant="caption" style={[styles.bulletText, { color: isDark ? '#fca5a5' : '#7f1d1d' }]}>{warn}</Text>
                </View>
              ))}
            </View>

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fca5a5',
                  },
                ]}
              >
                <AlertTriangle size={14} color={isDark ? '#f87171' : '#dc2626'} />
                <Text variant="caption" style={{ color: isDark ? '#f87171' : '#b91c1c', flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            {/* Resolution Action Toggle */}
            <Text variant="label" style={[styles.label, { color: theme.colors.mute, marginTop: 8 }]}>Supervisor Action *</Text>
            <View style={styles.actionToggleRow}>
              <Pressable
                variant="card"
                haptic="select"
                onPress={() => setAction('acknowledge')}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: action === 'acknowledge' ? (isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe') : theme.colors.canvas,
                    borderColor: action === 'acknowledge' ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.hairline,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Acknowledge overtime conflict"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Check size={14} color={action === 'acknowledge' ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.mute} />
                  <Text variant="label" style={{ color: action === 'acknowledge' ? (isDark ? '#38bdf8' : '#0369a1') : theme.colors.mute }}>
                    Acknowledge
                  </Text>
                </View>
                <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 4 }}>
                  {conflictDetails.resolutionGuidance.acknowledgeAdvice}
                </Text>
              </Pressable>

              <Pressable
                variant="card"
                haptic="select"
                onPress={() => setAction('adjust')}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: action === 'adjust' ? (isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7') : theme.colors.canvas,
                    borderColor: action === 'adjust' ? (isDark ? '#fbbf24' : '#d97706') : theme.colors.hairline,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Adjust shift end time"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} color={action === 'adjust' ? (isDark ? '#fbbf24' : '#d97706') : theme.colors.mute} />
                  <Text variant="label" style={{ color: action === 'adjust' ? (isDark ? '#fbbf24' : '#b45309') : theme.colors.mute }}>
                    Adjust Time
                  </Text>
                </View>
                <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 4 }}>
                  {conflictDetails.resolutionGuidance.adjustAdvice}
                </Text>
              </Pressable>
            </View>

            {action === 'adjust' && (
              <View style={[styles.adjustWell, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <Input
                  label="Adjusted End Time *"
                  placeholder="e.g. 04:00 PM"
                  value={adjustedEndTime}
                  onChangeText={(t) => {
                    setAdjustedEndTime(t);
                    setError('');
                  }}
                />

                {/* Live calculation feedback */}
                {adjustedCalculation && (
                  <View
                    style={[
                      styles.calcFeedbackRow,
                      {
                        backgroundColor: adjustedCalculation.valid
                          ? isDark
                            ? 'rgba(16, 185, 129, 0.12)'
                            : '#ecfdf5'
                          : isDark
                          ? 'rgba(239, 68, 68, 0.12)'
                          : '#fef2f2',
                      },
                    ]}
                  >
                    <Info size={13} color={adjustedCalculation.valid ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626')} />
                    <Text
                      variant="caption"
                      style={{
                        color: adjustedCalculation.valid ? (isDark ? '#34d399' : '#047857') : (isDark ? '#f87171' : '#b91c1c'),
                        flex: 1,
                      }}
                    >
                      {adjustedCalculation.message}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Input
              label="Resolution Audit Notes"
              placeholder="Reason for supervisor decision (e.g. Verified with site manager)..."
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
              label={isSubmitting ? 'Submitting...' : 'Confirm Resolution'}
              variant="primary"
              onPress={handleResolve}
              disabled={isSubmitting || (action === 'adjust' && !adjustedEndTime)}
              style={{ flex: 1, minHeight: 44 }}
            />
          </View>
      </View>
    </AppModal>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacingNumeric.sm,
  },
  title: {},
  subtitle: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  alertHeaderCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: 4,
  },
  alertHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  severityPillText: {
    color: '#ffffff',
  },
  otChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  otChipText: {},
  alertHeading: {
    marginTop: 2,
  },
  alertNarrative: {},
  summaryCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 2,
  },
  conflictEntityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  riskCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: 4,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  riskTitle: {},
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {},
  bulletText: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  formScroll: {
    maxHeight: 460,
  },
  label: {
    marginBottom: 6,
  },
  actionToggleRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.sm,
  },
  actionBtn: {
    flex: 1,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  adjustWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: 6,
  },
  calcFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radiusNumeric.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
});
