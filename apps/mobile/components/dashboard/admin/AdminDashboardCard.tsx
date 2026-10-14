import { Text } from '../../ui/Text';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { EmptyState } from '../../ui/EmptyState';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { AdminDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  KPICard,
  PrimaryAction,
} from '../shared';
import {
  Wrench,
  Users,
  Building2,
  CalendarCheck,
  Clock,
  AlertTriangle,
  Timer,
  Layers,
  FileSpreadsheet,
} from '../../ui/icon';

export interface AdminDashboardCardProps {
  data: AdminDashboardDTO | null;
}

export const AdminDashboardCard: React.FC<AdminDashboardCardProps> = ({ data }) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const totalMachines = data?.totalMachines ?? 0;
  const activeUsers = data?.activeUsers ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const breakdowns = data?.operationalKpis?.breakdowns ?? 0;
  const overtime = data?.operationalKpis?.overtimeEntries ?? 0;
  const overlappingLogs = data?.operationalKpis?.overlappingLogs ?? 0;

  const hasNoOrgData = totalMachines === 0 && activeUsers === 0 && totalClients === 0;

  return (
    <View style={styles.container}>
      {/* Empty State when organization has no machines or users initialized */}
      {hasNoOrgData && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="Organization Fleet & Users Empty"
            description="Platform setup in progress. Start by adding equipment or inviting team members."
            actionLabel="Manage Personnel"
            onAction={() => router.push('/users')}
            compact
          />
        </View>
      )}

      {/* Core Fleet & Organization KPIs */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          FLEET & PERSONNEL SUMMARY
        </Text>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Machines"
            value={totalMachines}
            icon={Wrench}
            variant="info"
          />
          <KPICard
            label="Active Users"
            value={activeUsers}
            icon={Users}
            variant="default"
          />
          <KPICard
            label="Clients"
            value={totalClients}
            icon={Building2}
            variant="default"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={CalendarCheck}
            variant="warning"
          />
          <KPICard
            label="Logs Today"
            value={todayLogs}
            icon={Clock}
            variant={todayLogs > 0 ? 'success' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Operational Telemetry & Exceptions */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          TODAY'S OPERATIONAL EXCEPTIONS
        </Text>
        <KPIGrid columns={3}>
          <KPICard
            label="Breakdowns Reported"
            value={breakdowns}
            icon={AlertTriangle}
            variant={breakdowns > 0 ? 'error' : 'default'}
          />
          <KPICard
            label="Overtime Entries"
            value={overtime}
            icon={Timer}
            variant={overtime > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Schedule Conflicts"
            value={overlappingLogs}
            icon={Layers}
            variant={overlappingLogs > 0 ? 'error' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Quick Action Navigation */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          QUICK MANAGEMENT
        </Text>
        <View style={styles.actionList}>
          <PrimaryAction
            title="Operations Hub & Running Logs"
            description="Review daily operator submissions, meter readings, and client worksites"
            href="/operations"
            icon={FileSpreadsheet}
            variant="primary"
          />
          <PrimaryAction
            title="Machinery Fleet & Maintenance"
            description="Configure machine assignments, track hours, and update equipment status"
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
    marginBottom: spacingNumeric.xs + 4,
  },
  actionList: {
    gap: spacingNumeric.sm,
  },
});
