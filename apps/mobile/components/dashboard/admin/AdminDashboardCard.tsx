import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
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
} from 'lucide-react-native';

export interface AdminDashboardCardProps {
  data: AdminDashboardDTO | null;
}

export const AdminDashboardCard: React.FC<AdminDashboardCardProps> = ({ data }) => {
  const { theme } = useTheme();

  const totalMachines = data?.totalMachines ?? 0;
  const activeUsers = data?.activeUsers ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const breakdowns = data?.operationalKpis?.breakdowns ?? 0;
  const overtime = data?.operationalKpis?.overtimeEntries ?? 0;
  const overlappingLogs = data?.operationalKpis?.overlappingLogs ?? 0;

  return (
    <View style={styles.container}>
      {/* Core Fleet & Organization KPIs */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          FLEET & PERSONNEL SUMMARY
        </Text>
        <KPIGrid columns={5}>
          <KPICard
            label="Total Machines"
            value={totalMachines}
            icon={Wrench}
            href="/machines"
            variant="info"
          />
          <KPICard
            label="Active Users"
            value={activeUsers}
            icon={Users}
            href="/users"
            variant="default"
          />
          <KPICard
            label="Clients"
            value={totalClients}
            icon={Building2}
            href="/clients"
            variant="default"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={CalendarCheck}
            href="/operations"
            variant="warning"
          />
          <KPICard
            label="Logs Today"
            value={todayLogs}
            icon={Clock}
            href="/operations"
            variant={todayLogs > 0 ? 'success' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Operational Telemetry & Exceptions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          TODAY'S OPERATIONAL EXCEPTIONS
        </Text>
        <KPIGrid columns={3}>
          <KPICard
            label="Breakdowns Reported"
            value={breakdowns}
            icon={AlertTriangle}
            href="/operations"
            variant={breakdowns > 0 ? 'error' : 'default'}
          />
          <KPICard
            label="Overtime Entries"
            value={overtime}
            icon={Timer}
            href="/operations"
            variant={overtime > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Schedule Conflicts"
            value={overlappingLogs}
            icon={Layers}
            href="/operations"
            variant={overlappingLogs > 0 ? 'error' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Quick Action Navigation */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          QUICK MANAGEMENT
        </Text>
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
