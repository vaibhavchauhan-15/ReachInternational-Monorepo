import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Text, HighlightText, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Calendar,
  MessageSquare,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ChevronDown,
} from '../ui/icon';
import type { HourLogRecord } from '../../lib/hooks/useOperationsData';

export interface RunningLogShiftCardProps {
  log: HourLogRecord;
  logsViewMode?: 'machine' | 'client' | 'operator';
  searchTerm?: string;
  onOpenConflictModal?: (log: HourLogRecord) => void;
  isLast?: boolean;
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatExcelDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const day = parts[2] < 10 ? `0${parts[2]}` : `${parts[2]}`;
      const mon = MONTH_ABBR[parts[1] - 1] || '';
      const yearStr = String(parts[0]).slice(-2);
      return `${day}-${mon}-${yearStr}`;
    }
  } catch {}
  return String(dateStr);
}

export function formatEntryTimestamp(timestampStr?: string | null): string | null {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;
    const day = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
    const mon = MONTH_ABBR[d.getMonth()] || '';
    const yearStr = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const minutes = d.getMinutes() < 10 ? `0${d.getMinutes()}` : `${d.getMinutes()}`;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `${day}-${mon}-${yearStr} ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return null;
  }
}

export function resolveShiftCode(log: HourLogRecord): string {
  if (log.shift_code && log.shift_code.trim()) {
    const c = log.shift_code.trim().toUpperCase();
    return c.startsWith('SHIFT') ? c.replace(/^SHIFT\s*/i, '') : c;
  }
  if (log.shift && log.shift.trim()) {
    const s = log.shift.trim();
    if (/^(S\d|[A-D]|\d)$/i.test(s)) return s.toUpperCase();
    if (s.toLowerCase().startsWith('shift')) return s.replace(/^shift\s*/i, '').toUpperCase();
    return s;
  }
  return 'A';
}

export function formatHoursWithUnit(val?: number | null): string {
  if (val == null || isNaN(val)) return '0h';
  const num = Number(val);
  const rounded = Math.abs(num - Math.round(num)) < 0.05 ? Math.round(num) : Math.round(num * 10) / 10;
  return `${rounded}h`;
}

export function calculateWorkingHours(log: HourLogRecord): number {
  if (log.normal_working_hours != null && Number(log.normal_working_hours) > 0) {
    const normal = Number(log.normal_working_hours);
    const ot = Number(log.overtime_hours || 0);
    return normal + ot;
  }
  if (log.start_time && log.end_time) {
    const sParts = log.start_time.split(':').map(Number);
    const eParts = log.end_time.split(':').map(Number);
    if (!isNaN(sParts[0]) && !isNaN(eParts[0])) {
      const sMin = sParts[0] * 60 + (sParts[1] || 0);
      let eMin = eParts[0] * 60 + (eParts[1] || 0);
      if (eMin <= sMin) {
        if (eParts[0] === 23 && (eParts[1] || 0) === 59) {
          eMin = 1440;
        } else {
          eMin += 1440;
        }
      }
      return Math.round(((eMin - sMin) / 60) * 10) / 10;
    }
  }
  if (log.shift_scheduled_minutes != null && Number(log.shift_scheduled_minutes) > 0) {
    return Math.round((Number(log.shift_scheduled_minutes) / 60) * 10) / 10;
  }
  return 8.0;
}

export const RunningLogShiftCard = React.memo<RunningLogShiftCardProps>(function RunningLogShiftCard({
  log,
  logsViewMode = 'client',
  searchTerm,
  onOpenConflictModal,
  isLast = false,
}) {
  const { theme, isDark } = useTheme();
  const [isRemarksOpen, setIsRemarksOpen] = useState(false);

  const remarksProgress = useSharedValue(isRemarksOpen ? 1 : 0);

  useEffect(() => {
    remarksProgress.value = withTiming(isRemarksOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isRemarksOpen, remarksProgress]);

  const remarksChevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${remarksProgress.value * 180}deg` }],
    };
  });

  const remarksAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: remarksProgress.value,
      maxHeight: interpolate(remarksProgress.value, [0, 1], [0, 220]),
      overflow: 'hidden' as const,
    };
  });

  const formattedDate = useMemo(() => formatExcelDate(log.log_date), [log.log_date]);
  const entryTimestamp = useMemo(() => formatEntryTimestamp(log.created_at), [log.created_at]);
  const shiftCode = useMemo(() => resolveShiftCode(log), [log]);
  const runningHoursFormatted = useMemo(() => formatHoursWithUnit(log.running_hours), [log.running_hours]);
  const workingHoursFormatted = useMemo(() => formatHoursWithUnit(calculateWorkingHours(log)), [log]);

  const breakdownHours = useMemo(() => {
    if (!log.is_breakdown) return 0;
    return Number(log.breakdown_hours) || 0;
  }, [log.is_breakdown, log.breakdown_hours]);

  const breakdownHoursFormatted = useMemo(() => formatHoursWithUnit(breakdownHours), [breakdownHours]);

  // Secondary text shown on the top-right of the card:
  // - Client view: Machine Model
  // - Machine view: Client Company Name
  // - Operator view: Machine Model
  const secondaryTitle = useMemo(() => {
    if (logsViewMode === 'client') {
      return log.machine?.model || log.machine_code || 'Equipment';
    }
    if (logsViewMode === 'machine') {
      return log.client?.company_name || log.client?.name || log.location || 'Client';
    }
    return log.machine?.model || log.machine_code || 'Equipment';
  }, [logsViewMode, log]);

  // Secondary entity displayed in metadata row:
  // - In operator view, show Client so operator sees which client they worked for
  // - In client and machine view, show Operator who operated the machine
  const secondaryEntityLabel = useMemo(() => {
    if (logsViewMode === 'operator') return 'Client: ';
    return 'Operator: ';
  }, [logsViewMode]);

  const secondaryEntityValue = useMemo(() => {
    if (logsViewMode === 'operator') {
      return log.client?.company_name || log.client?.name || log.location || 'Client Site';
    }
    return log.operator?.full_name || 'Unassigned Operator';
  }, [logsViewMode, log]);

  const hasConflict = Boolean(log.conflict_flag && log.conflict_status !== 'resolved');
  const hasRemarks = Boolean(log.remarks && log.remarks.trim());
  const hasStoppage = Boolean(log.is_breakdown || breakdownHours > 0);

  const handleToggleRemarks = useCallback(() => {
    setIsRemarksOpen((prev) => !prev);
  }, []);

  const handleConflictPress = useCallback(() => {
    if (onOpenConflictModal) {
      onOpenConflictModal(log);
    }
  }, [onOpenConflictModal, log]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: hasConflict
            ? isDark ? 'rgba(245, 158, 11, 0.4)' : '#f59e0b'
            : theme.colors.hairline,
        },
        hasConflict && styles.conflictCardHighlight,
        isLast && styles.lastCard,
      ]}
    >
      {/* Row 1: Header (Date, Remark/Conflict Icon, Secondary Entity) */}
      <View style={[styles.headerRow, { borderBottomColor: theme.colors.hairline }]}>
        <View style={styles.headerLeft}>
          <Calendar size={14} color={theme.colors.link} />
          <Text variant="subheading" weight="bold" style={[styles.dateText, { color: theme.colors.ink }]}>
            {formattedDate}
          </Text>
          {hasRemarks && (
            <Pressable
              variant="icon"
              haptic="select"
              onPress={handleToggleRemarks}
              style={styles.inlineIconBtn}
              accessibilityLabel="Toggle remarks"
            >
              <MessageSquare size={13} color={theme.colors.link} />
            </Pressable>
          )}
          {hasConflict && (
            <Pressable
              variant="icon"
              haptic="select"
              onPress={handleConflictPress}
              style={styles.inlineIconBtn}
              accessibilityLabel="Conflict detected in shift"
            >
              <ShieldAlert size={14} color="#d97706" />
            </Pressable>
          )}
        </View>

        <View style={styles.headerRight}>
          <Text
            variant="subheading"
            weight="bold"
            style={[styles.secondaryTitleText, { color: theme.colors.ink }]}
            numberOfLines={1}
          >
            {secondaryTitle}
          </Text>
        </View>
      </View>

      {/* Row 2: Shift & Secondary Entity (Operator or Client) */}
      <View style={styles.metadataRow}>
        <View style={styles.shiftTagWrapper}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Shift:{' '}
          </Text>
          <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
            {shiftCode}
          </Text>
        </View>

        <View style={styles.operatorWrapper}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            {secondaryEntityLabel}
          </Text>
          <HighlightText
            text={secondaryEntityValue}
            query={searchTerm}
            style={[{ color: theme.colors.ink }]}
            numberOfLines={1}
          />
        </View>
      </View>

      {/* Shift Entry Timestamp */}
      {Boolean(entryTimestamp) && (
        <View style={styles.timestampRow}>
          <Clock size={11} color={theme.colors.mute} />
          <Text variant="micro" style={{ color: theme.colors.mute }}>
            Entered: {entryTimestamp}
          </Text>
        </View>
      )}

      {/* Row 3: 3 Metric Stat Boxes (M/C RT, WH, B/D) */}
      <View style={[styles.metricsGrid, { borderTopColor: theme.colors.hairline }]}>
        {/* Box 1: Machine Run Time */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="caption" weight="bold" style={[styles.metricLabel, { color: theme.colors.mute }]}>
            M/C RT
          </Text>
          <Text variant="body" weight="bold" style={{ color: theme.colors.link }}>
            {runningHoursFormatted}
          </Text>
        </View>

        {/* Box 2: Working Hours */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="caption" weight="bold" style={[styles.metricLabel, { color: theme.colors.mute }]}>
            WH
          </Text>
          <Text variant="body" weight="bold" style={{ color: theme.colors.ink }}>
            {workingHoursFormatted}
          </Text>
        </View>

        {/* Box 3: Breakdown */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="caption" weight="bold" style={[styles.metricLabel, { color: theme.colors.mute }]}>
            B/D
          </Text>
          <Text
            variant="body"
            weight="bold"
            style={{
              color: breakdownHours > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute,
            }}
          >
            {breakdownHoursFormatted}
          </Text>
        </View>
      </View>

      {/* Row 4: Remarks / Stoppage expandable toggle */}
      {(hasRemarks || hasStoppage) && (
        <View style={[styles.remarksToggleSection, { borderTopColor: theme.colors.hairline }]}>
          <Pressable
            variant="ghost"
            haptic="select"
            onPress={handleToggleRemarks}
            style={styles.remarksToggleBtn}
            accessibilityLabel={isRemarksOpen ? 'Hide remarks details' : 'View remarks details'}
          >
            <MessageSquare size={12} color={theme.colors.link} />
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.link }}>
              {isRemarksOpen
                ? 'Hide Details'
                : hasStoppage
                ? 'View Remarks & Stoppage'
                : 'View Remark'}
            </Text>
            <Animated.View style={remarksChevronAnimatedStyle}>
              <ChevronDown size={11} color={theme.colors.link} />
            </Animated.View>
          </Pressable>

          <Animated.View style={[styles.collapsibleWrapper, remarksAnimatedStyle]}>
            <View style={styles.expandedDetailsContainer}>
              {hasRemarks && (
                <View
                  style={[
                    styles.remarkCallout,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <HighlightText
                    text={log.remarks || ''}
                    query={searchTerm}
                    style={[{ color: theme.colors.ink }]}
                  />
                </View>
              )}

              {hasStoppage && (
                <View
                  style={[
                    styles.stoppageCallout,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.stoppageHeader}>
                    <AlertTriangle size={12} color="#f59e0b" />
                    <Text variant="caption" weight="semibold" style={{ color: theme.colors.mute }}>
                      Total Stoppage:{' '}
                      <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                        {breakdownHoursFormatted}
                      </Text>
                    </Text>
                  </View>

                  {Boolean(log.breakdown_start_time || log.breakdown_end_time) && (
                    <View style={styles.stoppageTimingRow}>
                      <Clock size={11} color={theme.colors.link} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        {log.breakdown_start_time || '00:00'} → {log.breakdown_end_time || '00:00'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
    overflow: 'hidden',
  },
  collapsibleWrapper: {
    overflow: 'hidden',
  },
  conflictCardHighlight: {
    borderLeftWidth: 3,
  },
  lastCard: {
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: spacingNumeric.xs + 2,
    gap: spacingNumeric.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  dateText: {},
  inlineIconBtn: {
    padding: 2,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacingNumeric.xs,
  },
  secondaryTitleText: {
    textAlign: 'right',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.xs + 2,
    paddingBottom: spacingNumeric.xs,
    gap: spacingNumeric.sm,
    flexWrap: 'wrap',
  },
  shiftTagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  operatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '75%',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
    paddingBottom: spacingNumeric.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
    borderTopWidth: 1,
    paddingTop: spacingNumeric.xs + 2,
    marginTop: 2,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.xs + 1,
    paddingHorizontal: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  metricLabel: {
    marginBottom: 2,
  },
  remarksToggleSection: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.xs,
    marginTop: spacingNumeric.xs + 2,
  },
  remarksToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    minHeight: 28,
  },
  expandedDetailsContainer: {
    marginTop: spacingNumeric.xs,
    gap: spacingNumeric.xs,
  },
  remarkCallout: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  stoppageCallout: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  stoppageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stoppageTimingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
