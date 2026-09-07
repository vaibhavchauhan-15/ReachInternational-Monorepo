/**
 * ServiceCentric Mobile — Overtime Conflict Resolution Modal
 * Allows supervisors to review realized overtime crossing assignments,
 * and either acknowledge (approve) or adjust end time.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, ShieldAlert, Check, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatTo12Hour, formatShiftTimingRange, minutesTo24HourTime, parseTimeToMinutes } from '@reachinternational/utils';

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
    operator?: { full_name: string } | null;
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
  const { theme } = useTheme();

  const [action, setAction] = useState<'acknowledge' | 'adjust'>('acknowledge');
  const [adjustedEndTime, setAdjustedEndTime] = useState(log?.end_time || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!log) return null;

  const handleResolve = async () => {
    let adj24: string | null = null;
    if (action === 'adjust') {
      if (!adjustedEndTime) {
        setError('Please specify the adjusted shift end time.');
        return;
      }
      const min = parseTimeToMinutes(adjustedEndTime);
      if (min === null) {
        setError('Invalid adjusted end time format.');
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
        setError(rpcError.message || 'Failed to resolve conflict.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error resolving conflict.');
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={18} color="#f59e0b" />
                <Text style={[styles.title, { color: theme.colors.ink }]}>Resolve Overtime Conflict</Text>
              </View>
              <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                {log.machine_code} • {log.operator?.full_name || 'Operator'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Conflict Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>Log Date</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.ink }]}>{log.log_date}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>Logged Hours</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.ink }]}>
                {formatShiftTimingRange(log.start_time, log.end_time)} ({log.running_hours || 0} hrs)
              </Text>
            </View>
            {log.overtime_hours ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.mute }]}>Overtime</Text>
                <Text style={[styles.summaryValue, { color: '#d97706', fontWeight: '700' }]}>
                  +{log.overtime_hours} hrs OT
                </Text>
              </View>
            ) : null}
            <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />
            <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>
              Reason: {log.conflict_reason || 'Shift overlap with another active operator.'}
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
              <Text style={{ color: '#b91c1c', fontSize: 11, fontWeight: '600' }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Resolution Action Toggle */}
            <Text style={[styles.label, { color: theme.colors.mute }]}>Supervisor Action *</Text>
            <View style={styles.actionToggleRow}>
              <TouchableOpacity
                onPress={() => setAction('acknowledge')}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: action === 'acknowledge' ? '#e0f2fe' : theme.colors.canvas,
                    borderColor: action === 'acknowledge' ? '#0284c7' : theme.colors.hairline,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Check size={14} color="#0284c7" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: action === 'acknowledge' ? '#0369a1' : theme.colors.mute }}>
                    Acknowledge
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: theme.colors.mute, marginTop: 2 }}>
                  Keep recorded hours as approved field overtime.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAction('adjust')}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: action === 'adjust' ? '#fef3c7' : theme.colors.canvas,
                    borderColor: action === 'adjust' ? '#d97706' : theme.colors.hairline,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} color="#d97706" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: action === 'adjust' ? '#b45309' : theme.colors.mute }}>
                    Adjust Time
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: theme.colors.mute, marginTop: 2 }}>
                  Trim end time to eliminate shift overlap.
                </Text>
              </TouchableOpacity>
            </View>

            {action === 'adjust' ? (
              <Input
                label="Adjusted End Time *"
                placeholder="e.g. 04:00 PM"
                value={adjustedEndTime}
                onChangeText={setAdjustedEndTime}
              />
            ) : null}

            <Input
              label="Resolution Notes"
              placeholder="Reason for decision..."
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
    maxHeight: '80%',
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
  summaryCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: 'GeistMono_700Bold',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  errorBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  formScroll: {
    maxHeight: 320,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
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
  footer: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
});
