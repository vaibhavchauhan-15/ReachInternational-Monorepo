import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
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
} from 'lucide-react-native';

export interface HRDashboardCardProps {
  data: HRDashboardDTO | null;
}

export const HRDashboardCard: React.FC<HRDashboardCardProps> = ({ data }) => {
  const { theme } = useTheme();

  const totalEmployees = data?.totalEmployees ?? 0;
  const activeOperators = data?.activeOperators ?? 0;
  const pendingProfileChanges = data?.pendingProfileChanges ?? 0;
  const todayLogsCount = data?.todayLogsCount ?? 0;

  return (
    <View style={styles.container}>
      {/* Personnel Overview */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          PERSONNEL & OPERATIONS ROSTER
        </Text>
        <KPIGrid columns={4}>
          <KPICard
            label="Total Staff"
            value={totalEmployees}
            icon={Users}
            href="/users"
            variant="default"
          />
          <KPICard
            label="Active Operators"
            value={activeOperators}
            icon={UserCheck}
            href="/users"
            variant="info"
          />
          <KPICard
            label="Profile Requests"
            value={pendingProfileChanges}
            icon={FileEdit}
            href="/users"
            variant={pendingProfileChanges > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Logs Today"
            value={todayLogsCount}
            icon={Clock}
            href="/operations"
            variant={todayLogsCount > 0 ? 'success' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* HR Actions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          PERSONNEL ACTIONS
        </Text>
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
