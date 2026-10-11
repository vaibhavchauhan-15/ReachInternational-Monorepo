/**
 * ReachInternational Mobile — Notification Settings
 * Route: /settings/notification
 * 
 * Displays strictly 5 clean cards with toggle switches:
 * 1. Shift Reminders
 * 2. Machinery Breakdown Alerts
 * 3. Machine Assignments
 * 4. Overtime Authorization Alerts
 * 5. Daily Running Log Submissions
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text, Switch, useToast } from '../../../components/ui';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Clock,
  Wrench,
  UserCheck,
  AlertTriangle,
  FileCheck,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';
import {
  useNotificationPreferences,
  type NotificationPreferences,
} from '../../../lib/preferences';

interface NotificationToggleCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: boolean;
  onToggle: (nextVal: boolean) => void;
  accessibilityLabel: string;
}

function NotificationToggleCard({
  icon,
  iconBg,
  title,
  value,
  onToggle,
  accessibilityLabel,
}: NotificationToggleCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.toggleCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text
        variant="subheading"
        style={[styles.cardTitle, { color: theme.colors.ink }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { prefs, toggleChannel } = useNotificationPreferences();
  const { toast } = useToast();

  const handleToggle = async (key: keyof NotificationPreferences, label: string) => {
    haptics.select();
    const updatedValue = await toggleChannel(key);
    toast(updatedValue ? 'success' : 'info', `${label} ${updatedValue ? 'enabled' : 'disabled'}`);
  };

  return (
    <SettingsScreenContainer
      title="Notifications"
      showBack={true}
      onPressBack={() => router.push('/settings' as any)}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Shift Reminders */}
      <NotificationToggleCard
        icon={<Clock size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Shift Reminders"
        value={Boolean(prefs.shiftReminders)}
        onToggle={() => handleToggle('shiftReminders', 'Shift Reminders')}
        accessibilityLabel="Toggle Shift Reminders"
      />

      {/* 2. Machinery Breakdown Alerts */}
      <NotificationToggleCard
        icon={<Wrench size={20} color={isDark ? '#f87171' : '#dc2626'} />}
        iconBg={isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'}
        title="Machinery Breakdown Alerts"
        value={Boolean(prefs.breakdownAlerts)}
        onToggle={() => handleToggle('breakdownAlerts', 'Machinery Breakdown Alerts')}
        accessibilityLabel="Toggle Machinery Breakdown Alerts"
      />

      {/* 3. Machine Assignments */}
      <NotificationToggleCard
        icon={<UserCheck size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5'}
        title="Machine Assignments"
        value={Boolean(prefs.assignmentAlerts)}
        onToggle={() => handleToggle('assignmentAlerts', 'Machine Assignments')}
        accessibilityLabel="Toggle Machine Assignments"
      />

      {/* 4. Overtime Authorization Alerts */}
      <NotificationToggleCard
        icon={<AlertTriangle size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Overtime Authorization Alerts"
        value={Boolean(prefs.overtimeAlerts)}
        onToggle={() => handleToggle('overtimeAlerts', 'Overtime Authorization Alerts')}
        accessibilityLabel="Toggle Overtime Authorization Alerts"
      />

      {/* 5. Daily Running Log Submissions */}
      <NotificationToggleCard
        icon={<FileCheck size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Daily Running Log Submissions"
        value={Boolean(prefs.logSubmissions)}
        onToggle={() => handleToggle('logSubmissions', 'Daily Running Log Submissions')}
        accessibilityLabel="Toggle Daily Running Log Submissions"
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  toggleCard: {
    minHeight: 56,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
  },
});
