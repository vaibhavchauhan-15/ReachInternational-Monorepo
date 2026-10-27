/**
 * ReachInternational Mobile — Notification Settings Screen
 * Route: /settings/notifications
 * 
 * Manages push notification delivery, system permissions synchronization,
 * and granular operational alert channels.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTheme,
  Text,
  Switch,
  useToast,
  Card,
  Button,
  Pressable,
} from '../../../components/ui';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Bell,
  Clock,
  Wrench,
  UserCheck,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  Settings,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';
import {
  useNotificationPreferences,
  type NotificationPreferences,
} from '../../../lib/preferences';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  type PermissionStatus,
} from '../../../lib/permissions/notificationPermissions';

interface NotificationToggleCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (nextVal: boolean) => void;
  accessibilityLabel: string;
}

function NotificationToggleCard({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  disabled = false,
  onToggle,
  accessibilityLabel,
}: NotificationToggleCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      variant="listRow"
      haptic={false}
      onPress={() => {
        if (!disabled) onToggle(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.toggleCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          opacity: disabled ? 0.5 : 1,
        },
        Platform.OS === 'web' && ({ cursor: disabled ? 'not-allowed' : 'pointer', outlineStyle: 'none' } as any),
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          weight="semibold"
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
          disabled={disabled}
          haptic={false}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </Pressable>
  );
}

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { prefs, setPreferences, toggleChannel } = useNotificationPreferences();
  const { toast } = useToast();

  const [systemPermission, setSystemPermission] = useState<PermissionStatus>('undetermined');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Check system notification permission on mount
  useEffect(() => {
    let isMounted = true;
    getNotificationPermissionStatus().then((status) => {
      if (isMounted) setSystemPermission(status);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBack = () => {
    router.replace('/settings');
  };

  const handleMasterPushToggle = async (nextVal: boolean) => {
    haptics.select();

    if (nextVal && systemPermission !== 'granted') {
      setIsRequestingPermission(true);
      try {
        const result = await requestNotificationPermission();
        setSystemPermission(result);
        if (result === 'granted') {
          await setPreferences({ push: true });
          haptics.confirm();
          toast('success', 'Push Notifications Enabled', 'You will receive critical fleet and shift alerts.');
        } else {
          haptics.reject();
          toast('warning', 'Permission Required', 'System notification permission was not granted.');
        }
      } catch {
        haptics.reject();
      } finally {
        setIsRequestingPermission(false);
      }
      return;
    }

    await setPreferences({ push: nextVal });
    if (nextVal) {
      haptics.confirm();
      toast('success', 'Push Notifications Enabled');
    } else {
      toast('info', 'Push Notifications Paused');
    }
  };

  const handleChannelToggle = async (key: keyof NotificationPreferences, label: string) => {
    haptics.select();
    const updatedValue = await toggleChannel(key);
    toast(updatedValue ? 'success' : 'info', `${label} ${updatedValue ? 'enabled' : 'disabled'}`);
  };

  const isMasterPushOn = Boolean(prefs.push) && systemPermission === 'granted';

  return (
    <SettingsScreenContainer
      title="Notifications"
      showBack={true}
      backRoute="/settings"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Global Master Push Notification Card */}
      <Card
        variant="elevated"
        style={[
          styles.masterCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: isMasterPushOn ? theme.colors.link : theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.masterHeaderRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isMasterPushOn
                  ? isDark
                    ? 'rgba(2, 132, 199, 0.2)'
                    : '#e0f2fe'
                  : isDark
                  ? 'rgba(115, 115, 115, 0.15)'
                  : '#f4f4f5',
              },
            ]}
          >
            <Bell
              size={22}
              color={isMasterPushOn ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.mute}
            />
          </View>
          <View style={styles.textColumn}>
            <Text
              variant="subheading"
              weight="semibold"
              style={[styles.cardTitle, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              Allow Push Notifications
            </Text>
            <Text
              variant="caption"
              style={[styles.cardSubtitle, { color: theme.colors.mute }]}
              numberOfLines={2}
            >
              Master switch for all mobile device alerts, shift reminders, and fleet notices.
            </Text>
          </View>
          <View style={styles.switchWrapper}>
            <Switch
              value={Boolean(prefs.push)}
              disabled={isRequestingPermission}
              onValueChange={handleMasterPushToggle}
              accessibilityLabel="Toggle All Push Notifications"
            />
          </View>
        </View>
      </Card>

      {/* System Permission Warning Banner (if denied) */}
      {systemPermission === 'denied' && (
        <Card
          variant="elevated"
          style={[
            styles.permissionBanner,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
            },
          ]}
        >
          <View style={styles.bannerRow}>
            <ShieldAlert size={20} color="#dc2626" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="caption"
                weight="semibold"
                style={{ color: isDark ? '#f87171' : '#b91c1c' }}
              >
                System Notifications Blocked
              </Text>
              <Text
                variant="caption"
                style={{ color: isDark ? '#fca5a5' : '#991b1b' }}
                numberOfLines={2}
              >
                Notification permissions are blocked at the device operating system level.
              </Text>
            </View>
          </View>
          {Platform.OS !== 'web' && (
            <Button
              label="Open Device Settings"
              onPress={() => Linking.openSettings()}
              variant="outline"
              size="sm"
              icon={<Settings size={14} color="#dc2626" />}
              style={{ marginTop: 8 }}
            />
          )}
        </Card>
      )}

      {/* Section Header: Alert Channels */}
      <View style={styles.sectionHeader}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.sectionTitle, { color: theme.colors.mute }]}
        >
          OPERATIONAL ALERT CHANNELS
        </Text>
        <Text
          variant="caption"
          style={[styles.sectionSubtitle, { color: theme.colors.mute }]}
        >
          Configure real-time push alerts for shift reminders, breakdown flags, and log submission approvals.
        </Text>
      </View>

      {/* 2. Shift Reminders */}
      <NotificationToggleCard
        icon={<Clock size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Shift & Attendance Reminders"
        subtitle="Alerts for shift roster start, clock-in, and log submission deadlines"
        value={Boolean(prefs.shiftReminders)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('shiftReminders', 'Shift Reminders')}
        accessibilityLabel="Toggle Shift Reminders"
      />

      {/* 3. Machinery Breakdown Alerts */}
      <NotificationToggleCard
        icon={<Wrench size={20} color={isDark ? '#f87171' : '#dc2626'} />}
        iconBg={isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'}
        title="Breakdown & Maintenance Alerts"
        subtitle="Instant notifications when assigned equipment flags an urgent breakdown"
        value={Boolean(prefs.breakdownAlerts)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('breakdownAlerts', 'Machinery Breakdown Alerts')}
        accessibilityLabel="Toggle Machinery Breakdown Alerts"
      />

      {/* 4. Machine Assignments */}
      <NotificationToggleCard
        icon={<UserCheck size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5'}
        title="Equipment Fleet Assignments"
        subtitle="Notifications when machines or operators are updated in your roster"
        value={Boolean(prefs.assignmentAlerts)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('assignmentAlerts', 'Machine Assignments')}
        accessibilityLabel="Toggle Machine Assignments"
      />

      {/* 5. Overtime Authorization Alerts */}
      <NotificationToggleCard
        icon={<AlertTriangle size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Overtime Authorization Alerts"
        subtitle="Instant alerts for overtime authorizations and approval deadlines"
        value={Boolean(prefs.overtimeAlerts)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('overtimeAlerts', 'Overtime Authorization Alerts')}
        accessibilityLabel="Toggle Overtime Authorization Alerts"
      />

      {/* 6. Daily Running Log Submissions */}
      <NotificationToggleCard
        icon={<FileCheck size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Daily Log Confirmations"
        subtitle="Confirmations for verified HMR submissions and supervisor approvals"
        value={Boolean(prefs.logSubmissions)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('logSubmissions', 'Daily Running Log Submissions')}
        accessibilityLabel="Toggle Daily Running Log Submissions"
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  masterCard: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  masterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  permissionBanner: {
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 6,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 2,
    paddingHorizontal: 4,
    gap: 2,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    marginTop: 1,
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
