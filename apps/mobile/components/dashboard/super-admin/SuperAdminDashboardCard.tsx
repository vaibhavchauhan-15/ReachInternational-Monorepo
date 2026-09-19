import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from '../../ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { SuperAdminDashboardDTO } from '@reachinternational/types';

export interface SuperAdminDashboardCardProps {
  data: SuperAdminDashboardDTO | null;
}

export const SuperAdminDashboardCard: React.FC<SuperAdminDashboardCardProps> = ({ data }) => {
  const { theme } = useTheme();

  return (
    <>
      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
        GLOBAL PLATFORM METRICS
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.totalUsers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Staff</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.activeMachines ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Active Fleet</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.totalClients ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Clients</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
            {data?.todayLogs ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Logs Today</Text>
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
