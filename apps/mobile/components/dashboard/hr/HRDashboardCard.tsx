import { Text } from '../../ui/Text';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { EmptyState } from '../../ui/EmptyState';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { HRDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  KPICard,
  PrimaryAction,
} from '../shared';
import {
  Users,
  UserCheck,
  FileEdit,
  Clock,
  UserPlus,
} from '../../ui/icon';

export interface HRDashboardCardProps {
  data: HRDashboardDTO | null;
}

export const HRDashboardCard: React.FC<HRDashboardCardProps> = ({ data }) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const totalEmployees = data?.totalEmployees ?? 0;
  const activeOperators = data?.activeOperators ?? 0;
  const pendingProfileChanges = data?.pendingProfileChanges ?? 0;
  const todayLogsCount = data?.todayLogsCount ?? 0;

  const hasNoStaffData = totalEmployees === 0 && activeOperators === 0;

  return (
    <View style={styles.container}>
      {/* Empty State when HR staff directory is empty */}
      {hasNoStaffData && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="No Staff Records"
            description="No employee directory records found. Add employees or wait for team members to register."
            actionLabel="Manage Personnel"
            onAction={() => router.push('/users')}
            compact
          />
        </View>
      )}

      {/* Personnel Overview */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          PERSONNEL & OPERATIONS ROSTER
        </Text>
        <KPIGrid columns={4}>
          <KPICard
            label="Total Staff"
            value={totalEmployees}
            icon={Users}
            variant="default"
          />
          <KPICard
            label="Active Operators"
            value={activeOperators}
            icon={UserCheck}
            variant="info"
          />
          <KPICard
            label="Profile Requests"
            value={pendingProfileChanges}
            icon={FileEdit}
            variant={pendingProfileChanges > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Logs Today"
            value={todayLogsCount}
            icon={Clock}
            variant={todayLogsCount > 0 ? 'success' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* HR Actions */}
      <View style={styles.section}>
        <Text
          variant="caption"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          PERSONNEL ACTIONS
        </Text>
        <View style={styles.actionList}>
          <PrimaryAction
            title="Profile Change Requests"
            description="Review and approve operator contact details, banking info, and document updates"
            href="/users"
            icon={FileEdit}
            variant={pendingProfileChanges > 0 ? 'warning' : 'primary'}
            badgeText={pendingProfileChanges > 0 ? `${pendingProfileChanges} Pending` : undefined}
          />
          <PrimaryAction
            title="Employee Access Directory"
            description="Manage user credentials, role assignments, supervisor hierarchy, and HR records"
            href="/users"
            icon={UserPlus}
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
