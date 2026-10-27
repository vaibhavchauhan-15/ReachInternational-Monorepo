import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { EmptyState } from '../../ui/EmptyState';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { SupervisorDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  KPICard,
  StatusCard,
} from '../shared';
import {
  Wrench,
  Users,
  CheckCircle2,
  Clock,
} from '../../ui/icon';

export interface SupervisorDashboardCardProps {
  data: SupervisorDashboardDTO | null;
}

export const SupervisorDashboardCard: React.FC<SupervisorDashboardCardProps> = ({
  data,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const submitted = data?.todayLogs?.submitted ?? 0;
  const pending = data?.todayLogs?.pending ?? 0;
  const assignedMachines = data?.assignedMachines ?? 0;
  const assignedOperators = data?.assignedOperators ?? 0;
  const breakdowns = data?.breakdowns ?? 0;
  const overtimeEntries = data?.overtimeEntries ?? 0;

  const hasNoSupervisedFleet = assignedMachines === 0 && assignedOperators === 0;

  return (
    <View style={styles.container}>
      {/* Empty State when supervisor has no assigned fleet or operators */}
      {hasNoSupervisedFleet && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="No Supervised Fleet or Team Assigned"
            description="You have not been assigned any machinery or field operators yet. Please contact your operations manager to configure your site fleet."
            actionLabel="View Fleet"
            onAction={() => router.push('/machines')}
            compact
          />
        </View>
      )}

      {/* Team Scope & Shift Submissions */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          My Supervised Fleet & Team
        </Text>
        <KPIGrid columns={4}>
          <KPICard
            label="Machines"
            value={assignedMachines}
            icon={Wrench}
            variant="default"
            href="/machines"
          />
          <KPICard
            label="Field Operators"
            value={assignedOperators}
            icon={Users}
            variant="info"
            href="/users"
          />
          <KPICard
            label="Logs Submitted"
            value={submitted}
            icon={CheckCircle2}
            variant="success"
            href="/running-logs"
          />
          <KPICard
            label="Logs Pending"
            value={pending}
            icon={Clock}
            variant={pending > 0 ? 'warning' : 'default'}
            href="/running-logs"
          />
        </KPIGrid>
      </View>

      {/* Daily Field Exceptions */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Field Exceptions & Shift Metrics
        </Text>
        <KPIGrid columns={2}>
          <StatusCard
            title="Breakdown Incidents"
            status={breakdowns > 0 ? 'warning' : 'success'}
            label={breakdowns > 0 ? `${breakdowns} Breakdown Reported` : 'Zero Breakdowns'}
            description={
              breakdowns > 0
                ? 'Machinery downtime reported on site today. Review logs.'
                : 'All supervised machinery operating normally.'
            }
          />
          <StatusCard
            title="Overtime Shifts"
            status={overtimeEntries > 0 ? 'pending' : 'success'}
            label={
              overtimeEntries > 0
                ? `${overtimeEntries} Overtime Entries`
                : 'Standard Shift Hours'
            }
            description={
              overtimeEntries > 0
                ? 'Operators working beyond configured shift parameters.'
                : 'All shifts operating within normal hours.'
            }
          />
        </KPIGrid>
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
});
