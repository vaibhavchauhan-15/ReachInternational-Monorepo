import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { SuperAdminDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  KPICard,
  PrimaryAction,
} from '../shared';
import {
  Users,
  Wrench,
  Building2,
  CalendarCheck,
  Clock,
  ShieldCheck,
  Shield,
  SlidersHorizontal,
} from 'lucide-react-native';

export interface SuperAdminDashboardCardProps {
  data: SuperAdminDashboardDTO | null;
}

export const SuperAdminDashboardCard: React.FC<SuperAdminDashboardCardProps> = ({
  data,
}) => {
  const { theme, isDark } = useTheme();

  const totalUsers = data?.totalUsers ?? 0;
  const activeMachines = data?.activeMachines ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const recentAuditActions = data?.recentAuditActions ?? 0;

  return (
    <View style={styles.container}>
      {/* Primary KPI Grid (6 metrics in 2-column creative gradient cards) */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
          PLATFORM FLEET & IDENTITY METRICS
        </Text>
        <KPIGrid columns={6}>
          <KPICard
            label="Total Staff"
            value={totalUsers}
            icon={Users}
            href="/users"
            variant="purple"
          />
          <KPICard
            label="Active Fleet"
            value={activeMachines}
            icon={Wrench}
            href="/machines"
            variant="info"
          />
          <KPICard
            label="Active Clients"
            value={totalClients}
            icon={Building2}
            href="/clients"
            variant="indigo"
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
            variant="success"
          />
          <KPICard
            label="Audit Events"
            value={recentAuditActions}
            icon={ShieldCheck}
            href="/audit"
            variant="error"
          />
        </KPIGrid>
      </View>

      {/* Governance & System Controls */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
          GOVERNANCE & SYSTEM CONTROLS
        </Text>
        <PrimaryAction
          title="System Audit Trail"
          description="Inspect recent administrative mutations and security events"
          href="/audit"
          icon={Shield}
          variant="primary"
        />
        <PrimaryAction
          title="User & Access Directory"
          description="Manage administrative roles, supervisor scopes, and operators"
          href="/users"
          icon={Users}
          variant="secondary"
        />
        <PrimaryAction
          title="Machinery Fleet Registry"
          description="Global view of all equipment, client sites, and telemetry"
          href="/machines"
          icon={SlidersHorizontal}
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
    marginBottom: spacingNumeric.xs + 4,
  },
});
