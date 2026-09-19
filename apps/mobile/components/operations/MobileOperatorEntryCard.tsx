/**
 * Reach International Mobile — Operator Entry Card Component
 * Ultra-fast native entry form pre-filled from single RPC read model:
 * [Operator, Assigned Machine, Client, Last HMR, Shift Timing]
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, Input, TimeInput, useTheme } from '../ui';
import { OperatorEntryContext } from '@reachinternational/types';
import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { offlineQueueManager } from '../../lib/offline/OfflineQueueManager';
import { notifyLogEntryCreated, notifyMachineStatusChanged } from '../../lib/notifications';
import {
  computeShiftTiming,
  computeBreakdownDuration,
  getISTDateString,
  formatTo12Hour,
  formatDate,
} from '@reachinternational/utils';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Building2,
  Gauge,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';



export interface MobileOperatorEntryCardProps {
  entryContext: OperatorEntryContext | null | undefined;
  isLoading?: boolean;
  onSuccess?: () => void;
}

export const MobileOperatorEntryCard: React.FC<MobileOperatorEntryCardProps> = ({
  entryContext,
  isLoading = false,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();

  const [logDate, setLogDate] = useState(() => getISTDateString());
  const [startMeter, setStartMeter] = useState('');
  const [endMeter, setEndMeter] = useState('');
  const [startTime, setStartTime] = useState('08:00 AM');
  const [endTime, setEndTime] = useState('04:00 PM');
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState('11:00 AM');
  const [breakdownEndTime, setBreakdownEndTime] = useState('12:00 PM');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Pre-fill form from entry context
  useEffect(() => {
    if (entryContext) {
      if (entryContext.last_hmr !== undefined && entryContext.last_hmr !== null) {
        const hmrStr = String(entryContext.last_hmr);
        setStartMeter(hmrStr);
        setEndMeter((prev) => (prev === '' ? hmrStr : prev));
      }
      if (entryContext.operator?.shift_start) {
        const parsedStart = formatTo12Hour(entryContext.operator.shift_start);
        if (parsedStart) setStartTime(parsedStart);
      }
      if (entryContext.operator?.shift_end) {
        const parsedEnd = formatTo12Hour(entryContext.operator.shift_end);
        if (parsedEnd) setEndTime(parsedEnd);
      }
    }
  }, [entryContext]);

  // Derived Running Hours
  const startNum = parseFloat(startMeter) || 0;
  const endNum = parseFloat(endMeter) || 0;
  const runningHours = endMeter.trim() !== '' && !isNaN(endNum) ? Math.max(0, Number((endNum - startNum).toFixed(1))) : 0;
  const isMeterReversed = endMeter.trim() !== '' && !isNaN(endNum) && endNum < startNum;
  const isMeterExcessive = runningHours > 24;

  // Real-time Shift Timing Computation
  const shiftStats = useMemo(() => {
    return computeShiftTiming({
      logDate,
      startTime,
      endTime,
    });
  }, [startTime, endTime, logDate]);

  // Breakdown Calculation
  const breakdownStats = useMemo(() => {
    if (!isBreakdown) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  // Handle Log Submission
  const handleSubmit = async () => {
    setStatusMessage(null);

    if (!entryContext?.operator?.id) {
      setStatusMessage({ type: 'error', text: 'Operator profile not found.' });
      return;
    }

    if (!entryContext?.machine?.id) {
      setStatusMessage({ type: 'error', text: 'No assigned machine found for this account.' });
      return;
    }

    if (!startMeter.trim() || isNaN(startNum) || startNum < 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid start meter reading.' });
      return;
    }

    if (!endMeter.trim() || isNaN(endNum) || endNum <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid end meter reading.' });
      return;
    }

    if (endNum < startNum) {
      setStatusMessage({ type: 'error', text: 'End meter reading cannot be less than start meter.' });
      return;
    }

    if (runningHours > 24) {
      setStatusMessage({ type: 'error', text: 'Running hours cannot exceed 24 hours in a single log.' });
      return;
    }

    if (isBreakdown && !breakdownStats?.isValid) {
      setStatusMessage({ type: 'error', text: breakdownStats?.errorMessage || 'Please specify valid breakdown times.' });
      return;
    }

    setIsSubmitting(true);

    try {
      let bkdDurationFormatted = '';
      let bkdStart = '';
      let bkdEnd = '';
      let bkdDecimalHours = 0;

      if (isBreakdown && breakdownStats?.isValid) {
        bkdDurationFormatted = breakdownStats.fullBreakdownString;
        bkdStart = breakdownStartTime.trim();
        bkdEnd = breakdownEndTime.trim();
        bkdDecimalHours = breakdownStats.durationDecimalHours;
      }

      let remarksPayload = '';
      if (isBreakdown) {
        const reason = remarks.trim();
        const durationPart = bkdDurationFormatted ? `[Breakdown Duration: ${bkdDurationFormatted}]` : '';
        remarksPayload = [durationPart, reason].filter(Boolean).join(' ').trim();
      }

      const logPayload = {
        machine_id: entryContext.machine.id,
        machine_code: entryContext.machine.machine_id || 'Equipment',
        model: entryContext.machine.model || '',
        serial_number: entryContext.machine.serial_number || '',
        client_id: entryContext.client?.id || null,
        location: entryContext.client?.site || null,
        start_meter: startNum,
        end_meter: endNum,
        running_hours: runningHours,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        overtime_hours: shiftStats.overtimeHours,
        normal_working_hours: shiftStats.normalWorkingHours,
        is_breakdown: isBreakdown,
        breakdown_start_time: bkdStart || null,
        breakdown_end_time: bkdEnd || null,
        breakdown_duration: bkdDurationFormatted || null,
        breakdown_hours: bkdDecimalHours,
        machine_condition: isBreakdown ? 'breakdown' : 'good',
        remarks: remarksPayload || null,
        operator_id: entryContext.operator.id,
        log_date: shiftStats.resolvedStartDate,
        end_date: shiftStats.resolvedEndDate,
        start_datetime: shiftStats.startDateTime?.toISOString(),
        end_datetime: shiftStats.endDateTime?.toISOString(),
      };

      if (isOffline) {
        await offlineQueueManager.enqueue('SUBMIT_HOUR_LOG', logPayload);
        notifyLogEntryCreated(entryContext.machine.machine_id || 'Machine', runningHours, shiftStats.overtimeHours);
        if (isBreakdown) {
          notifyMachineStatusChanged(entryContext.machine.machine_id || 'Machine', 'breakdown');
        }
        setStatusMessage({
          type: 'success',
          text: 'Shift log saved locally! Will sync automatically when online.',
        });
        setStartMeter(String(endNum));
        setEndMeter(String(endNum));
        if (onSuccess) onSuccess();
        return;
      }

      const { error: insertErr } = await supabase
        .from('machine_hour_logs')
        .insert(logPayload);

      if (insertErr) throw insertErr;

      // Invalidate context to refresh last_hmr
      queryClient.invalidateQueries({
        queryKey: ['operator', 'entry-context', entryContext.operator.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['operations', 'logs'],
      });

      setStatusMessage({
        type: 'success',
        text: `Log recorded successfully! (${runningHours} operating hours)`,
      });

      // Update start meter to new end meter for next log
      setStartMeter(String(endNum));
      setEndMeter(String(endNum));
      setRemarks('');
      setIsBreakdown(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Submit log error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to submit log. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card style={[styles.containerCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.link} />
          <Text style={[styles.loadingText, { color: theme.colors.mute }]}>
            Loading operator assignment & meter data...
          </Text>
        </View>
      </Card>
    );
  }

  if (!entryContext || !entryContext.operator) {
    return (
      <Card style={[styles.containerCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
        <View style={styles.emptyContainer}>
          <AlertCircle size={28} color={theme.colors.mute} />
          <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
            No Assignment Data
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
            Could not retrieve active machine assignment for your operator profile.
          </Text>
        </View>
      </Card>
    );
  }

  const { operator, machine, client, last_hmr } = entryContext;

  return (
    <Card
      style={[
        styles.containerCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* 1. Context Cards Grid: Machine & Client */}
      <View style={styles.contextGrid}>
        {/* Machine Summary Card */}
        <View
          style={[
            styles.summaryPillCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.summaryIconWrap}>
            <Truck size={14} color={theme.colors.link} />
            <Text style={[styles.summaryPillLabel, { color: theme.colors.mute }]}>Machine</Text>
          </View>
          <Text style={[styles.summaryPillTitle, { color: theme.colors.ink }]} numberOfLines={1}>
            {machine ? `${machine.model || 'Equipment'} (${machine.machine_id})` : 'Unassigned'}
          </Text>
          {machine?.serial_number ? (
            <Text style={[styles.summaryPillSub, { color: theme.colors.mute }]} numberOfLines={1}>
              S/N: {machine.serial_number}
            </Text>
          ) : null}
        </View>

        {/* Client & Site Summary Card */}
        <View
          style={[
            styles.summaryPillCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.summaryIconWrap}>
            <Building2 size={14} color={theme.colors.link} />
            <Text style={[styles.summaryPillLabel, { color: theme.colors.mute }]}>Client & Site</Text>
          </View>
          <Text style={[styles.summaryPillTitle, { color: theme.colors.ink }]} numberOfLines={1}>
            {client?.company_name || 'No Client Assigned'}
          </Text>
          {client?.site ? (
            <Text style={[styles.summaryPillSub, { color: theme.colors.mute }]}>
              Site: {client.site}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 3. Last Recorded Log Banner */}
      {entryContext.last_log ? (
        <View
          style={[
            styles.hmrBanner,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
              paddingVertical: 10,
              paddingHorizontal: 12,
            },
          ]}
        >
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#6ee7b7' : '#047857', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 6 }}>
            Last Recorded Machine Log
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 10, color: isDark ? '#a7f3d0' : '#065f46' }}>Last Recorded Date</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#ecfdf5' : '#064e3b', fontFamily: 'monospace', marginTop: 2 }}>
                {formatDate(entryContext.last_log.log_date)}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: isDark ? '#a7f3d0' : '#065f46' }}>Shift End Time</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#ecfdf5' : '#064e3b', fontFamily: 'monospace', marginTop: 2 }}>
                {formatTo12Hour(entryContext.last_log.end_time) || entryContext.last_log.end_time || '—'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: isDark ? '#a7f3d0' : '#065f46' }}>Last Entry By</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#ecfdf5' : '#064e3b', marginTop: 2 }} numberOfLines={1}>
                {entryContext.last_log.operator_name || 'Operator'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.hmrBanner,
            {
              backgroundColor: isDark ? 'rgba(0, 112, 243, 0.08)' : '#eff6ff',
              borderColor: isDark ? 'rgba(0, 112, 243, 0.25)' : '#dbeafe',
            },
          ]}
        >
          <View style={styles.hmrBannerContent}>
            <Gauge size={18} color={theme.colors.link} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.hmrBannerLabel, { color: theme.colors.mute }]}>
                Previous Recorded Reading
              </Text>
              <Text style={[styles.hmrBannerValue, { color: theme.colors.ink }]}>
                {last_hmr.toFixed(1)} hrs
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 4. Status / Error Message */}
      {statusMessage && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                statusMessage.type === 'error'
                  ? isDark
                    ? '#3f1d24'
                    : '#fff1f2'
                  : isDark
                  ? '#064e3b'
                  : '#f0fdf4',
              borderColor:
                statusMessage.type === 'error'
                  ? isDark
                    ? '#fb718540'
                    : '#fecdd3'
                  : isDark
                  ? '#34d39940'
                  : '#bbf7d0',
            },
          ]}
        >
          {statusMessage.type === 'error' ? (
            <AlertTriangle size={15} color={isDark ? '#fb7185' : '#e11d48'} />
          ) : (
            <CheckCircle2 size={15} color={isDark ? '#34d399' : '#059669'} />
          )}
          <Text
            style={[
              styles.statusText,
              {
                color:
                  statusMessage.type === 'error'
                    ? isDark
                      ? '#fca5a5'
                      : '#b91c1c'
                    : isDark
                    ? '#6ee7b7'
                    : '#047857',
              },
            ]}
          >
            {statusMessage.text}
          </Text>
        </View>
      )}

      {/* 5. Interactive Form Inputs */}
      <View style={styles.formSection}>
        {/* Date Selection Chip */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.mute }]}>Log Date</Text>
          <View style={styles.dateChipRow}>
            <TouchableOpacity
              onPress={() => setLogDate(getISTDateString())}
              style={[
                styles.dateChip,
                logDate === getISTDateString()
                  ? [styles.dateChipActive, { backgroundColor: theme.colors.ink }]
                  : [styles.dateChipInactive, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated }],
              ]}
            >
              <Calendar size={13} color={logDate === getISTDateString() ? theme.colors.canvas : theme.colors.ink} />
              <Text
                style={[
                  styles.dateChipText,
                  { color: logDate === getISTDateString() ? theme.colors.canvas : theme.colors.ink },
                ]}
              >
                Today ({getISTDateString()})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meter Readings Row */}
        <View style={styles.twoColumnRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Start Meter"
              required
              keyboardType="decimal-pad"
              value={startMeter}
              onChangeText={setStartMeter}
              placeholder="0.0"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="End Meter"
              required
              keyboardType="decimal-pad"
              value={endMeter}
              onChangeText={setEndMeter}
              placeholder="0.0"
            />
          </View>
        </View>

        {/* Running Hours Live Indicator */}
        <View
          style={[
            styles.runningHoursCard,
            {
              backgroundColor: isMeterReversed
                ? isDark ? '#3f1d24' : '#fff1f2'
                : isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              borderColor: isMeterReversed ? '#fecdd3' : theme.colors.hairline,
            },
          ]}
        >
          <Text style={[styles.runningHoursLabel, { color: theme.colors.mute }]}>
            Calculated Operating Hours:
          </Text>
          <Text
            style={[
              styles.runningHoursValue,
              {
                color: isMeterReversed
                  ? '#e11d48'
                  : isMeterExcessive
                  ? '#d97706'
                  : theme.colors.link,
              },
            ]}
          >
            {runningHours} hrs
          </Text>
        </View>

        {/* Shift Timings */}
        <View style={styles.twoColumnRow}>
          <View style={{ flex: 1 }}>
            <TimeInput
              label="Shift Start"
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimeInput
              label="Shift End"
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>
        </View>

        {/* Overtime live indicator */}
        {shiftStats.overtimeHours > 0 && (
          <View style={styles.overtimeIndicator}>
            <Clock size={13} color="#d97706" />
            <Text style={styles.overtimeText}>
              Overtime detected: {shiftStats.overtimeHours} hrs (Regular: {shiftStats.normalWorkingHours} hrs)
            </Text>
          </View>
        )}

        {/* Breakdown Toggle */}
        <View style={[styles.toggleRow, { borderTopColor: theme.colors.hairline, borderBottomColor: theme.colors.hairline }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.toggleTitle, { color: theme.colors.ink }]}>
              Breakdown / Maintenance?
            </Text>
            <Text style={[styles.toggleSubtitle, { color: theme.colors.mute }]}>
              Toggle if machine halted due to technical faults
            </Text>
          </View>
          <Switch
            value={isBreakdown}
            onValueChange={setIsBreakdown}
            trackColor={{ false: theme.colors.hairline, true: '#fb7185' }}
            thumbColor={isBreakdown ? '#e11d48' : '#ffffff'}
          />
        </View>

        {/* Breakdown Fields (Conditional) */}
        {isBreakdown && (
          <View style={styles.breakdownSection}>
            <View style={styles.twoColumnRow}>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Fault Start"
                  value={breakdownStartTime}
                  onChangeText={setBreakdownStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Fault End"
                  value={breakdownEndTime}
                  onChangeText={setBreakdownEndTime}
                />
              </View>
            </View>
            {breakdownStats?.isValid && (
              <Text style={styles.breakdownDurationText}>
                Breakdown Duration: {breakdownStats.durationFormatted} ({breakdownStats.durationDecimalHours} hrs)
              </Text>
            )}
            <Input
              label="Breakdown Reason & Action Taken"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="e.g. Hydraulic pipe leakage replaced..."
            />
          </View>
        )}

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          label={isSubmitting ? 'Submitting Log...' : `Submit Log (${runningHours} hrs)`}
          onPress={handleSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          style={styles.submitButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  containerCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  loadingContainer: {
    paddingVertical: spacingNumeric.xl,
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: spacingNumeric.xl,
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  operatorShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  shiftText: {
    fontSize: 12,
  },
  contextGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacingNumeric.sm,
  },
  summaryPillCard: {
    flex: 1,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  summaryIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  summaryPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryPillTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryPillSub: {
    fontSize: 11,
    marginTop: 2,
  },
  hmrBanner: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  hmrBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hmrBannerLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  hmrBannerValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  formSection: {
    gap: spacingNumeric.sm,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.md,
  },
  dateChipActive: {},
  dateChipInactive: {
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  runningHoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  runningHoursLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  runningHoursValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  overtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radiusNumeric.md,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  overtimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 11,
  },
  breakdownSection: {
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  breakdownDurationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e11d48',
  },
  submitButton: {
    marginTop: spacingNumeric.xs,
    minHeight: 46,
  },
});
