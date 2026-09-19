import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from '../../ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { ManagerDashboardDTO } from '@reachinternational/types';

export interface ManagerDashboardCardProps {
  data: ManagerDashboardDTO | null;
}

export const ManagerDashboardCard: React.FC<ManagerDashboardCardProps> = ({ data }) => {
  const { theme } = useTheme();

  return (
    <>
      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
        FLEET UTILIZATION
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.machineUtilization?.total ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Fleet</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
            {data?.machineUtilization?.rented ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>On Rent</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#d97706' }]}>
            {data?.machineUtilization?.spare ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Spare / Idle</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
            {data?.machineUtilization?.breakdown ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Breakdowns</Text>
        </Card>
      </View>

      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.md }]}>
        TODAY'S OPERATIONS
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.operationsToday?.totalLogs ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Logs Today</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
            {data?.operationsToday?.totalHours != null
              ? `${data.operationsToday.totalHours.toFixed(1)}h`
              : '0h'}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Running Hours</Text>
        </Card>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  eyebrowHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.xs,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    padding: spacingNumeric.md,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
