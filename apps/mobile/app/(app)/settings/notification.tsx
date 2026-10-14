/**
 * ReachInternational Mobile — Notification Settings
 * Route: /settings/notification
 * 
 * Displays strictly 5 clean cards with toggle switches:
 * 1. Shift & Attendance Reminders
 * 2. Breakdown & Maintenance Alerts
 * 3. Equipment Fleet Assignments
 * 4. Overtime Authorization Alerts
 * 5. Daily Log Confirmations
 */

import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
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
  subtitle: string;
  value: boolean;
  onToggle: (nextVal: boolean) => void;
  accessibilityLabel: string;
}

function NotificationToggleCard({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  onToggle,
  accessibilityLabel,
}: NotificationToggleCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => onToggle(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.toggleCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          opacity: pressed ? 0.94 : 1,
        },
        Platform.OS === 'web' && ({ cursor: 'pointer', outlineStyle: 'none' } as any),
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          style={[styles.cardTitle, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          style={[styles.cardSubtitle, { color: theme.colors.mute }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <View pointerEvents="none" style={styles.switchWrapper}>
        <Switch
          value={value}
          haptic={false}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </Pressable>
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
      onPressBack={() => router.back()}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Shift Reminders */}
      <NotificationToggleCard
        icon={<Clock size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Shift & Attendance Reminders"
        subtitle="Alerts for shift start, clock-in, and log submission deadlines"
        value={Boolean(prefs.shiftReminders)}
        onToggle={() => handleToggle('shiftReminders', 'Shift Reminders')}
        accessibilityLabel="Toggle Shift Reminders"
      />

      {/* 2. Machinery Breakdown Alerts */}
      <NotificationToggleCard
        icon={<Wrench size={20} color={isDark ? '#f87171' : '#dc2626'} />}
        iconBg={isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'}
        title="Breakdown & Maintenance Alerts"
        subtitle="Instant notifications when assigned equipment flags a breakdown"
        value={Boolean(prefs.breakdownAlerts)}
        onToggle={() => handleToggle('breakdownAlerts', 'Machinery Breakdown Alerts')}
        accessibilityLabel="Toggle Machinery Breakdown Alerts"
      />

      {/* 3. Machine Assignments */}
      <NotificationToggleCard
        icon={<UserCheck size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5'}
        title="Equipment Fleet Assignments"
        subtitle="Notifications when machines or operators are updated in your roster"
        value={Boolean(prefs.assignmentAlerts)}
        onToggle={() => handleToggle('assignmentAlerts', 'Machine Assignments')}
        accessibilityLabel="Toggle Machine Assignments"
      />

      {/* 4. Overtime Authorization Alerts */}
      <NotificationToggleCard
        icon={<AlertTriangle size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Overtime Authorization Alerts"
        subtitle="Instant alerts for overtime authorizations and approval deadlines"
        value={Boolean(prefs.overtimeAlerts)}
        onToggle={() => handleToggle('overtimeAlerts', 'Overtime Authorization Alerts')}
        accessibilityLabel="Toggle Overtime Authorization Alerts"
      />

      {/* 5. Daily Running Log Submissions */}
      <NotificationToggleCard
        icon={<FileCheck size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Daily Log Confirmations"
        subtitle="Confirmations for verified HMR submissions and approvals"
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
    minHeight: 64,
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
  textColumn: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    flexShrink: 1,
  },
  cardSubtitle: {
    marginTop: 1,
  },
  switchWrapper: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
