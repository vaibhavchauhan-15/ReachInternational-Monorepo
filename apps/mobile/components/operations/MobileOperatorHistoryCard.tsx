/**
 * Reach International Mobile — Operator History Card Component
 * Reusable, high-performance card for rendering machine running log history.
 * 100% Visual and Behavioral Parity with Geist Design System and User Feedback Specification.
 *
 * Layout Structure:
 * - Header Row: Exact timestamp date & time (left) + Operating Hours badge & Edit/Lock Action (right)
 * - Machine Row: Machine ID / Model (bold) + Serial Number in parentheses (muted)
 * - Client Row: "Client : " (muted) + Client Name (bold) + City in parentheses (muted)
 * - HMR Row: "HMR: " (muted) + Start Meter + " → " + End Meter (bold)
 * - Shift Date Row: "Shift Date : " (muted) + Shift Date (bold) + Shift Code pill badge
 * - Hairline Divider
 * - Breakdown Row: "Breakdown: 0 (Normal)" (muted) or "Breakdown: [Reason]" (red)
 *
 * Strict Invariants:
 * - React.memo with custom shallow comparator preventing unnecessary re-renders
 * - 0 raw typography properties in StyleSheet (strictly uses <Text variant="..." weight="...">)
 * - 44px minimum touch targets on all interactive actions
 * - Tactile haptics on user interaction
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Pressable } from '../ui/touch/Pressable';
import { Pencil, Lock } from '../ui/icon';
import { SyncStatusBadge } from '../offline/SyncStatusBadge';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  formatDate,
  formatExactTimestamp,
  parseBreakdownDetails,
  addDaysToDateStr,
  getISTDateString,
} from '@reachinternational/utils';
import type { HourLogRecord } from '../../lib/hooks/useOperationsData';
import { haptics } from '../../lib/haptics';

export interface MobileOperatorHistoryCardProps {
  log: HourLogRecord;
  onEditLog?: (log: HourLogRecord) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function isLogWithin7Days(logDate?: string | null): boolean {
  if (!logDate) return false;
  try {
    const rawDateStr = logDate.split('T')[0].trim();
    const todayStr = getISTDateString();
    const sevenDaysAgoStr = addDaysToDateStr(todayStr, -7);
    return rawDateStr >= sevenDaysAgoStr && rawDateStr <= todayStr;
  } catch {
    return false;
  }
}

export function areHistoryCardPropsEqual(
  prev: MobileOperatorHistoryCardProps,
  next: MobileOperatorHistoryCardProps
): boolean {
  return (
    prev.log.id === next.log.id &&
    prev.log.sync_status === next.log.sync_status &&
    prev.log.start_meter === next.log.start_meter &&
    prev.log.end_meter === next.log.end_meter &&
    prev.log.running_hours === next.log.running_hours &&
    prev.log.shift === next.log.shift &&
    prev.log.shift_code === next.log.shift_code &&
    prev.log.is_breakdown === next.log.is_breakdown &&
    prev.log.breakdown_duration === next.log.breakdown_duration &&
    prev.log.remarks === next.log.remarks &&
    prev.onEditLog === next.onEditLog
  );
}

export const MobileOperatorHistoryCard: React.FC<MobileOperatorHistoryCardProps> = React.memo(
  function MobileOperatorHistoryCard({ log, onEditLog, style, testID }) {
    const { theme, isDark } = useTheme();

    const startM = Number(log.start_meter) || 0;
    const endM = Number(log.end_meter) || startM;
    const rt = log.running_hours ?? Math.max(0, Math.round((endM - startM) * 10) / 10);

    // Shift display name (e.g. "Shift A", "Shift B")
    const shiftName = useMemo(() => {
      const raw = (log.shift_code || log.shift || '').trim();
      if (!raw) return 'Shift A';
      if (/^shift/i.test(raw)) {
        return raw.replace(/^shift\s*/i, 'Shift ');
      }
      return `Shift ${raw}`;
    }, [log.shift_code, log.shift]);

    // Machine Title & Serial Number
    const machineIdCode = log.machine?.machine_id || log.machine_code || '';
    const model = log.machine?.model || '';
    const serial = log.machine?.serial_number || '';
    const primaryTitle = machineIdCode || model || 'Equipment';
    const secondaryIdentifier = serial || (model && model !== primaryTitle ? model : '');

    // Client & City Location
    const clientName = log.client?.company_name || 'Base Yard';
    const clientCity =
      log.client?.city ||
      (log.location && log.location.includes(',') ? log.location.split(',')[1]?.trim() : '');

    // Exact Log Timestamp (DD-MM-YYYY, hh:mm A)
    const timestampStr = log.created_at
      ? formatExactTimestamp(log.created_at, false)
      : formatDate(log.log_date);

    const breakdownInfo = log.is_breakdown ? parseBreakdownDetails(log) : null;
    const breakdownText =
      breakdownInfo?.displayText || log.breakdown_duration || 'Breakdown';
    const breakdownNote = (log.remarks || '').trim();
    const canEdit = isLogWithin7Days(log.log_date);

    return (
      <View
        testID={testID}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
          style,
        ]}
      >
        {/* Row 1: Top Header — Exact timestamp date & time (left) + Sync Status Pill + Operating Hours badge & Edit/Lock Action (right) */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              {timestampStr}
            </Text>
            {log.sync_status && log.sync_status !== 'synced' && (
              <SyncStatusBadge status={log.sync_status} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Badge
              variant="success"
              size="sm"
              label={`+${rt.toFixed(1)} hrs`}
            />

            {canEdit && (!log.sync_status || log.sync_status === 'synced') ? (
              <Pressable
                variant="iconButton"
                haptic="tap"
                hitSlopToMin48
                onPress={() => {
                  haptics.tap();
                  onEditLog?.(log);
                }}
                style={styles.headerActionBtn}
                accessibilityLabel="Edit machine log within 7 days"
                accessibilityRole="button"
              >
                <Pencil size={14} color={theme.colors.mute} />
              </Pressable>
            ) : (
              <View
                style={styles.headerActionBtn}
                accessibilityLabel="Locked (archived after 7 days)"
              >
                <Lock size={13} color={theme.colors.mute} />
              </View>
            )}
          </View>
        </View>

        {/* Row 2: Machine Model / ID (Bold) + Serial in parentheses (Muted) */}
        <View style={styles.machineRow}>
          <Text variant="body" weight="bold" style={{ color: theme.colors.ink }}>
            {primaryTitle}
          </Text>
          {secondaryIdentifier ? (
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              {' '}({secondaryIdentifier})
            </Text>
          ) : null}
        </View>

        {/* Row 3: Client : Client Name (Bold) + City in parentheses (Muted) */}
        <View style={styles.clientRow}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Client :{' '}
          </Text>
          <Text
            variant="body"
            weight="bold"
            style={{ color: theme.colors.ink }}
            numberOfLines={1}
          >
            {clientName}
          </Text>
          {clientCity ? (
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              {' '}({clientCity})
            </Text>
          ) : null}
        </View>

        {/* Row 4: HMR: Start → End (Bold) */}
        <View style={styles.hmrRow}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            HMR:{' '}
          </Text>
          <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
            {startM.toFixed(1)}
          </Text>
          <Text variant="caption" style={[styles.arrow, { color: theme.colors.mute }]}>
            →
          </Text>
          <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
            {endM.toFixed(1)}
          </Text>
        </View>

        {/* Row 5: Shift Date : Shift Date (Bold) + Shift Badge */}
        <View style={styles.shiftDateRow}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Shift Date :{' '}
          </Text>
          <Text
            variant="caption"
            weight="bold"
            style={[styles.shiftDateText, { color: theme.colors.ink }]}
          >
            {formatDate(log.log_date)}
          </Text>
          <Badge variant="info" size="sm" label={shiftName} />
          {log.overtime_hours ? (
            <Badge
              variant="warning"
              size="sm"
              label={`+${log.overtime_hours}h OT`}
              style={styles.otBadge}
            />
          ) : null}
        </View>

        {/* Row 6: Hairline Divider Line */}
        <View style={[styles.divider, { borderTopColor: theme.colors.hairline }]} />

        {/* Row 7: Breakdown: 0 (Normal) or Breakdown: [Reason] */}
        {log.is_breakdown ? (
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownContentRow}>
              <Text
                variant="caption"
                weight="bold"
                style={{ color: isDark ? '#f87171' : '#ee0000' }}
              >
                Breakdown:{' '}
              </Text>
              <Text
                variant="caption"
                weight="medium"
                style={{ color: isDark ? '#f87171' : '#ee0000' }}
                numberOfLines={1}
              >
                {breakdownText}
              </Text>
            </View>
            {breakdownNote ? (
              <Text
                variant="micro"
                style={[styles.breakdownNoteText, { color: theme.colors.mute }]}
                numberOfLines={2}
              >
                Note: {breakdownNote}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.breakdownRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Breakdown:{' '}
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              0 (Normal)
            </Text>
          </View>
        )}
      </View>
    );
  },
  areHistoryCardPropsEqual
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
    flexWrap: 'wrap',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  hmrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  arrow: {
    marginHorizontal: 5,
  },
  shiftDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  shiftDateText: {
    marginRight: 4,
  },
  otBadge: {
    marginLeft: 2,
  },
  divider: {
    borderTopWidth: 1,
    marginTop: 10,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  breakdownContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  breakdownNoteText: {
    width: '100%',
    marginTop: 2,
  },
});
