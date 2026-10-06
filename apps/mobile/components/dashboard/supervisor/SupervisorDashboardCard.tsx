import { Text } from '../../ui/Text';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
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
} from 'lucide-react-native';

export interface SupervisorDashboardCardProps {
  data: SupervisorDashboardDTO | null;
}

export const SupervisorDashboardCard: React.FC<SupervisorDashboardCardProps> = ({
  data,
}) => {
  const { theme } = useTheme();

  const submitted = data?.todayLogs?.submitted ?? 0;
  const pending = data?.todayLogs?.pending ?? 0;
  const assignedMachines = data?.assignedMachines ?? 0;
  const assignedOperators = data?.assignedOperators ?? 0;
  const breakdowns = data?.breakdowns ?? 0;
  const overtimeEntries = data?.overtimeEntries ?? 0;

  return (
    <View style={styles.container}>
      {/* Team Scope & Shift Submissions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          MY SUPERVISED FLEET & TEAM
        </Text>
        <KPIGrid columns={4}>
          <KPICard
            label="Machines"
            value={assignedMachines}
            icon={Wrench}
            href="/machines"
            variant="default"
          />
          <KPICard
            label="Field Operators"
            value={assignedOperators}
            icon={Users}
            href="/operations"
            variant="info"
          />
          <KPICard
            label="Logs Submitted"
            value={submitted}
            icon={CheckCircle2}
            href="/operations"
            variant="success"
          />
          <KPICard
            label="Logs Pending"
            value={pending}
            icon={Clock}
            href="/operations"
            variant={pending > 0 ? 'warning' : 'default'}
          />
        </KPIGrid>
      </View>

      {/* Daily Field Exceptions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          FIELD EXCEPTIONS & SHIFT METRICS
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
            href="/operations"
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
            href="/operations"
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
    marginBottom: spacingNumeric.xs + 2,
  },
});
