import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatHoursWithUnit } from './RunningLogShiftCard';

export interface RunningLogMachineHeaderCardProps {
  model: string;
  serialNumber?: string;
  machineCode?: string;
  totalDays: number;
  totalRunHours: number;
  totalWorkingHours: number;
}

export const RunningLogMachineHeaderCard = React.memo<RunningLogMachineHeaderCardProps>(
  function RunningLogMachineHeaderCard({
    model,
    serialNumber,
    machineCode,
    totalDays,
    totalRunHours,
    totalWorkingHours,
  }) {
    const { theme } = useTheme();

    const snDisplay = serialNumber || machineCode;

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Text variant="subheading" weight="bold" style={[styles.title, { color: theme.colors.ink }]}>
            {model || 'Equipment'}{' '}
            {snDisplay ? (
              <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                (SN: {snDisplay})
              </Text>
            ) : null}
          </Text>
        </View>

        <View style={[styles.metricsRow, { borderTopColor: theme.colors.hairline }]}>
          <View style={styles.metricItem}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.mute }}>
              DAYS:{' '}
            </Text>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
              {totalDays}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.mute }}>
              M/C RT:{' '}
            </Text>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
              {formatHoursWithUnit(totalRunHours)}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.mute }}>
              WH:{' '}
            </Text>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
              {formatHoursWithUnit(totalWorkingHours)}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm + 2,
    marginBottom: spacingNumeric.sm,
    gap: spacingNumeric.xs + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {},
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: spacingNumeric.xs + 2,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
