import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, useTheme } from '../../ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { AdminDashboardDTO } from '@reachinternational/types';

export interface AdminDashboardCardProps {
  data: AdminDashboardDTO | null;
}

export const AdminDashboardCard: React.FC<AdminDashboardCardProps> = ({ data }) => {
  const { theme } = useTheme();

  return (
    <>
      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
        ORGANIZATION OVERVIEW
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.totalMachines ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Machines</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.activeUsers ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Active Users</Text>
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

      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.md }]}>
        OPERATIONAL KPIS
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text
            style={[
              styles.kpiValue,
              {
                color:
                  (data?.operationalKpis?.breakdowns ?? 0) > 0 ? '#dc2626' : theme.colors.ink,
              },
            ]}
          >
            {data?.operationalKpis?.breakdowns ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Breakdowns</Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
            {data?.operationalKpis?.overtimeEntries ?? 0}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Overtime Shifts</Text>
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
