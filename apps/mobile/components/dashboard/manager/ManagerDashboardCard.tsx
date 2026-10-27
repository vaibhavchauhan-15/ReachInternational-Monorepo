import { Text } from '../../ui/Text';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { EmptyState } from '../../ui/EmptyState';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { ManagerDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  KPICard,
  PrimaryAction,
} from '../shared';
import {
  Wrench,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
} from '../../ui/icon';

export interface ManagerDashboardCardProps {
  data: ManagerDashboardDTO | null;
}

export const ManagerDashboardCard: React.FC<ManagerDashboardCardProps> = ({
  data,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const totalFleet = data?.machineUtilization?.total ?? 0;
  const rentedFleet = data?.machineUtilization?.rented ?? 0;
  const spareFleet = data?.machineUtilization?.spare ?? 0;
  const breakdownFleet = data?.machineUtilization?.breakdown ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.operationsToday?.totalLogs ?? 0;
  const todayHours = data?.operationsToday?.totalHours ?? 0;

  const hasNoFleetData = totalFleet === 0 && activeAssignments === 0;

  return (
    <View style={styles.container}>
      {/* Empty State when manager fleet is empty */}
      {hasNoFleetData && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="Fleet Directory Empty"
            description="No machinery fleet records found in your fleet roster. Add machines or contact your administrator."
            actionLabel="View Fleet"
            onAction={() => router.push('/machines')}
            compact
          />
        </View>
      )}

      {/* Fleet Utilization KPIs */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Fleet Utilization Breakdown
        </Text>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Fleet"
            value={totalFleet}
            icon={Wrench}
            variant="default"
            href="/machines"
          />
          <KPICard
            label="On Rent"
            value={rentedFleet}
            icon={CheckCircle2}
            variant="success"
            href="/machines"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={Layers}
            variant="info"
            href="/operations"
          />
          <KPICard
            label="Spare / Idle"
            value={spareFleet}
            icon={Clock}
            variant="warning"
            href="/machines"
          />
          <KPICard
            label="Breakdowns"
            value={breakdownFleet}
            icon={AlertTriangle}
            variant={breakdownFleet > 0 ? 'error' : 'default'}
            href="/operations"
          />
        </KPIGrid>
      </View>

      {/* Today's Operational Running Hours */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Today's Production & Running Meter
        </Text>
        <KPIGrid columns={2}>
          <KPICard
            label="Logs Submitted Today"
            value={todayLogs}
            icon={FileSpreadsheet}
            variant="default"
            href="/running-logs"
          />
          <KPICard
            label="Running Hours Today"
            value={`${todayHours.toFixed(1)} hrs`}
            icon={Gauge}
            variant="info"
            href="/running-logs"
          />
        </KPIGrid>
      </View>

      {/* Primary Management Actions */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Operations Management
        </Text>
        <View style={styles.actionList}>
          <PrimaryAction
            title="Daily Operations Review"
            description="Examine shift logs, running hours, and site location records"
            href="/operations"
            icon={FileSpreadsheet}
            variant="primary"
          />
          <PrimaryAction
            title="Machinery Fleet Roster"
            description="Reassign equipment, update rental status, and track maintenance"
            href="/machines"
            icon={Wrench}
            variant="secondary"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.md,
  },
  section: {
    marginBottom: spacingNumeric.xs,
  },
  eyebrowHeader: {
    textTransform: 'uppercase',
    marginBottom: spacingNumeric.sm,
  },
  actionList: {
    gap: spacingNumeric.sm,
  },
});
