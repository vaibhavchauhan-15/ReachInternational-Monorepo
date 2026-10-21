import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { Icon, AlertTriangle } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import type { HourLogRecord } from '../../lib/hooks/useOperationsData';
import { RunningLogShiftCard } from './RunningLogShiftCard';

export interface RunningLogDayGroupProps {
  date: string;
  dayLogs: HourLogRecord[];
  dayRunningHours: number;
  dayOtHours: number;
  startMeter: number;
  endMeter: number;
  hasBreakdown: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm?: string;
  logsViewMode?: 'machine' | 'client' | 'operator';
}

export const RunningLogDayGroup: React.FC<RunningLogDayGroupProps> = ({
  date,
  dayLogs,
  dayRunningHours,
  dayOtHours,
  startMeter,
  endMeter,
  hasBreakdown,
  isExpanded,
  onToggle,
  searchTerm,
  logsViewMode = 'client',
}) => {
  const { theme, isDark } = useTheme();

  return (
    <Card
      style={[
        styles.dayGroupCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <Pressable
        variant="card"
        haptic="select"
        onPress={onToggle}
        style={styles.dayGroupHeader}
        accessibilityLabel={`Toggle shift logs for ${date}`}
      >
        <View style={styles.dayGroupHeaderLeft}>
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            {formatDate(date)}
          </Text>
          <View style={styles.dayGroupBadges}>
            <View style={[styles.countBadge, { backgroundColor: isDark ? '#262626' : '#f5f5f5' }]}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {dayLogs.length} {dayLogs.length === 1 ? 'shift' : 'shifts'}
              </Text>
            </View>
            {hasBreakdown && (
              <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(238, 0, 0, 0.15)' : '#fee2e2' }]}>
                <AlertTriangle size={10} color={theme.colors.error} />
                <Text variant="caption" style={{ color: theme.colors.error }}>B/D</Text>
              </View>
            )}
            {dayOtHours > 0 && (
              <View style={[styles.otBadge, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe' }]}>
                <Text variant="caption" style={{ color: theme.colors.link }}>+{dayOtHours}h OT</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.dayGroupHeaderRight}>
          <View style={styles.dayGroupTotals}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              HMR: {startMeter} → {endMeter}
            </Text>
            <Text variant="body" style={{ color: theme.colors.ink }}>
              {dayRunningHours}h M/C RT
            </Text>
          </View>
          <Icon
            name="chevron-down"
            size={16}
            color={theme.colors.mute}
            state={isExpanded ? 'open' : 'closed'}
          />
        </View>
      </Pressable>

      {/* Expanded Shifts Mini Table */}
      {isExpanded && (
        <View style={[styles.dayShiftsList, { borderTopColor: theme.colors.hairline }]}>
          {dayLogs.map((log, index) => (
            <RunningLogShiftCard
              key={log.id}
              log={log}
              logsViewMode={logsViewMode}
              searchTerm={searchTerm}
              isLast={index === dayLogs.length - 1}
            />
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  dayGroupCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacingNumeric.md,
    minHeight: 44,
  },
  dayGroupHeaderLeft: {
    gap: 4,
  },
  dayGroupBadges: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  otBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
  },
  dayGroupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  dayGroupTotals: {
    alignItems: 'flex-end',
  },
  dayShiftsList: {
    borderTopWidth: 1,
    paddingHorizontal: spacingNumeric.md,
  },
});
