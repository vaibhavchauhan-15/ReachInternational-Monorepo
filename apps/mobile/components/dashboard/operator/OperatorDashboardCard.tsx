import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
import { spacingNumeric } from '@reachinternational/design-tokens';
import type { OperatorDashboardDTO } from '@reachinternational/types';
import {
  KPIGrid,
  StatusCard,
  PrimaryAction,
} from '../shared';
import {
  Wrench,
  FileSpreadsheet,
} from 'lucide-react-native';

export interface OperatorDashboardCardProps {
  data: OperatorDashboardDTO | null;
}

export const OperatorDashboardCard: React.FC<OperatorDashboardCardProps> = ({
  data,
}) => {
  const { theme } = useTheme();

  const isSubmitted = data?.today?.entryStatus === 'submitted';
  const isPartial = data?.today?.entryStatus === 'partial';
  const submittedCount = data?.today?.submittedCount ?? 0;
  const totalAssignedCount =
    data?.today?.totalAssignedCount ?? (data?.assigned_shifts?.length || 1);
  const totalRunningHoursToday = data?.today?.totalRunningHoursToday ?? 0;

  const machineName =
    data?.machine?.name ||
    data?.machine?.model ||
    'Assigned Equipment';
  const siteName =
    data?.client?.site ||
    data?.client?.name ||
    'Operational Site';

  return (
    <View style={styles.container}>
      {/* Today's Shift Status */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          TODAY'S SHIFT STATUS
        </Text>
        <KPIGrid columns={2}>
          <StatusCard
            title="Submission Status"
            status={isSubmitted ? 'success' : isPartial ? 'warning' : 'pending'}
            label={
              isSubmitted
                ? totalAssignedCount > 1
                  ? `All ${totalAssignedCount} Shifts Done`
                  : 'Submitted Today'
                : isPartial
                ? `${submittedCount}/${totalAssignedCount} Shifts Logged`
                : 'Pending Submission'
            }
            description={
              isSubmitted
                ? `${totalRunningHoursToday}h recorded for today.`
                : isPartial
                ? `${submittedCount} of ${totalAssignedCount} shifts recorded (${totalRunningHoursToday}h).`
                : 'Daily running hours not submitted yet.'
            }
            href={isSubmitted ? '/operations?tab=history' : '/operations'}
          />

          <StatusCard
            title="Equipment & Site"
            status="pending"
            label={machineName}
            description={siteName}
            href="/machines"
          />
        </KPIGrid>
      </View>

      {/* Quick Shift Actions */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          QUICK ACTIONS
        </Text>
        <PrimaryAction
          title={isSubmitted ? 'View Shift Logs & History' : 'Record Shift Running Hours'}
          description={
            isSubmitted
              ? "Review today's submitted hours and past machine logs"
              : 'Submit opening/closing HMR, fuel, and site operation notes'
          }
          href={isSubmitted ? '/operations?tab=history' : '/operations'}
          icon={FileSpreadsheet}
          variant={isSubmitted ? 'secondary' : 'primary'}
        />
        <PrimaryAction
          title="Assigned Machinery Details"
          description="View machine specifications, current meter reading, and equipment status"
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
