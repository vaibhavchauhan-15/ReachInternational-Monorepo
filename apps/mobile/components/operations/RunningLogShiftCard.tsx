import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, HighlightText, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatShiftTimingRange } from '@reachinternational/utils';
import type { HourLogRecord } from '../../app/(app)/running-logs';

export interface RunningLogShiftCardProps {
  log: HourLogRecord;
  searchTerm?: string;
  isLast?: boolean;
}

export const RunningLogShiftCard: React.FC<RunningLogShiftCardProps> = ({
  log,
  searchTerm,
  isLast = false,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.shiftItemCard,
        {
          borderBottomColor: theme.colors.hairline,
          borderBottomWidth: isLast ? 0 : 1,
        },
      ]}
    >
      <View style={styles.shiftItemTop}>
        <View style={styles.shiftCodeBadge}>
          <Text variant="micro" style={{ color: '#0284c7' }}>
            {log.shift_code ? `Shift ${log.shift_code}` : log.shift || 'Shift'}
          </Text>
        </View>
        <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
          {formatShiftTimingRange(log.start_time, log.end_time)}
        </Text>
        <View style={styles.shiftHmrPill}>
          <Text variant="mono" style={{ color: theme.colors.ink }}>
            {log.start_meter} → {log.end_meter} ({log.running_hours}h)
          </Text>
        </View>
      </View>

      <View style={styles.shiftItemBottom}>
        <HighlightText
          text={`${log.operator?.full_name || 'Unassigned'} • ${log.machine?.model || log.machine_code}`}
          query={searchTerm}
          style={[{ color: theme.colors.body }]}
        />
        {log.overtime_hours ? (
          <Text variant="caption" style={{ color: '#0070f3' }}>
            +{log.overtime_hours}h OT
          </Text>
        ) : null}
      </View>

      {log.remarks && (
        <HighlightText
          text={log.remarks}
          query={searchTerm}
          style={[{ color: theme.colors.mute }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  shiftItemCard: {
    paddingVertical: spacingNumeric.sm,
    gap: 4,
  },
  shiftItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  shiftCodeBadge: {
    backgroundColor: '#0284c712',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#0284c725',
  },
  shiftHmrPill: {},
  shiftItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
