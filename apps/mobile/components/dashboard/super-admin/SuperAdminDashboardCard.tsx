import { Text } from '../../ui/Text';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { EmptyState } from '../../ui/EmptyState';
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
} from '../../ui/icon';

export interface SuperAdminDashboardCardProps {
  data: SuperAdminDashboardDTO | null;
}

export const SuperAdminDashboardCard: React.FC<SuperAdminDashboardCardProps> = ({
  data,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const totalUsers = data?.totalUsers ?? 0;
  const activeMachines = data?.activeMachines ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const activeAssignments = data?.activeAssignments ?? 0;
  const todayLogs = data?.todayLogs ?? 0;
  const recentAuditActions = data?.recentAuditActions ?? 0;

  const hasNoPlatformData = totalUsers === 0 && activeMachines === 0 && totalClients === 0;

  return (
    <View style={styles.container}>
      {/* Empty State when platform directory is empty */}
      {hasNoPlatformData && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="Platform Fleet & Directory Empty"
            description="No system records discovered. Initialize users and fleet assets to view global telemetry."
            actionLabel="Users Directory"
            onAction={() => router.push('/users')}
            compact
          />
        </View>
      )}

      {/* Primary KPI Grid (6 metrics in 2-column cards matching web mobile portview) */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          PLATFORM FLEET & IDENTITY METRICS
        </Text>
        <KPIGrid columns={6}>
          <KPICard
            label="Total Staff"
            value={totalUsers}
            icon={Users}
            variant="default"
            href="/users"
          />
          <KPICard
            label="Active Fleet"
            value={activeMachines}
            icon={Wrench}
            variant="info"
            href="/machines"
          />
          <KPICard
            label="Active Clients"
            value={totalClients}
            icon={Building2}
            variant="default"
            href="/clients"
          />
          <KPICard
            label="Active Shifts"
            value={activeAssignments}
            icon={CalendarCheck}
            variant="warning"
            href="/operations"
          />
          <KPICard
            label="Logs Today"
            value={todayLogs}
            icon={Clock}
            variant={todayLogs > 0 ? 'success' : 'default'}
            href="/running-logs"
          />
          <KPICard
            label="Audit Events"
            value={recentAuditActions}
            icon={ShieldCheck}
            variant="default"
            href="/audit"
          />
        </KPIGrid>
      </View>

      {/* Governance & System Controls */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          GOVERNANCE & SYSTEM CONTROLS
        </Text>
        <View style={styles.actionList}>
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
