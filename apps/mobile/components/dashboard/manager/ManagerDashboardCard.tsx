import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
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
} from 'lucide-react-native';

export interface ManagerDashboardCardProps {
  data: ManagerDashboardDTO | null;
}

export const ManagerDashboardCard: React.FC<ManagerDashboardCardProps> = ({
  data,
}) => {
  const { theme } = useTheme();

  const totalFleet = data?.machineUtilization?.total ?? 0;
  const rentedFleet = data?.machineUtilization?.rented ?? 0;
  const spareFleet = data?.machineUtilization?.spare ?? 0;
  const breakdownFleet = data?.machineUtilization?.breakdown ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.operationsToday?.totalLogs ?? 0;
  const todayHours = data?.operationsToday?.totalHours ?? 0;

  return (
    <View style={styles.container}>
      {/* Fleet Utilization KPIs */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          FLEET UTILIZATION BREAKDOWN
        </Text>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Fleet"
            value={totalFleet}
            icon={Wrench}
            href="/machines"
            variant="default"
          />
          <KPICard
            label="On Rent"
            value={rentedFleet}
            icon={CheckCircle2}
            href="/machines"
            variant="success"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={Layers}
            href="/operations"
            variant="info"
          />
          <KPICard
            label="Spare / Idle"
            value={spareFleet}
            icon={Clock}
            href="/machines"
            variant="warning"
          />
          <KPICard
            label="Breakdowns"
            value={breakdownFleet}
            icon={AlertTriangle}
            href="/machines"
            variant={breakdownFleet > 0 ? 'error' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Today's Operational Running Hours */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          TODAY'S PRODUCTION & RUNNING METER
        </Text>
        <KPIGrid columns={2}>
          <KPICard
            label="Logs Submitted Today"
            value={todayLogs}
            icon={FileSpreadsheet}
            href="/operations"
            variant="default"
          />
          <KPICard
            label="Running Hours Today"
            value={`${todayHours.toFixed(1)} hrs`}
            icon={Gauge}
            href="/operations"
            variant="info"
          />
        </KPIGrid>
      </View>

      {/* Primary Management Actions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          OPERATIONS MANAGEMENT
        </Text>
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacingNumeric.xs + 2,
  },
});
