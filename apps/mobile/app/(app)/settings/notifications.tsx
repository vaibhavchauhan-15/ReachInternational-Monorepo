/**
 * ReachInternational Mobile — Notification Settings Screen
 * Route: /settings/notifications
 * 
 * Manages push notification delivery, system permissions synchronization,
 * and granular operational alert channels backed by public.user_notification_preferences.
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
  ShieldCheck,
  ShieldAlert,
  Settings,
  Banknote,
  Moon,
  Info,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  useNotificationPreferences,
  type NotificationPreferences,
} from '../../../lib/preferences';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  type PermissionStatus,
} from '../../../lib/permissions/notificationPermissions';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
  isExpoGo,
} from '../../../lib/notifications/registerPush';

// Note: overtimeAlerts toggle removed per push notification specification (§11)
// and replaced with server-synced payrollAlerts and adminAlerts channels.

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
  const { user, role } = useAuth();
  const { prefs, setPreferences, toggleChannel } = useNotificationPreferences(user?.id);
  const { toast } = useToast();

  const [systemPermission, setSystemPermission] = useState<PermissionStatus>('undetermined');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const isAdminRole = role === 'admin' || role === 'hr' || role === 'super_admin';

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
          await registerForPushNotifications();
          haptics.confirm();
          if (isExpoGo()) {
            toast('info', 'Expo Go Environment', 'Preferences saved. Remote push requires a development build.');
          } else {
            toast('success', 'Push Notifications Enabled', 'You will receive critical fleet and shift alerts.');
          }
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
      await registerForPushNotifications();
      haptics.confirm();
      if (isExpoGo()) {
        toast('info', 'Expo Go Environment', 'Preferences saved. Remote push requires a development build.');
      } else {
        toast('success', 'Push Notifications Enabled');
      }
    } else {
      await unregisterPushNotifications();
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

      {/* Expo Go Push Limitation Notice */}
      {isExpoGo() && (
        <Card
          variant="elevated"
          style={[
            styles.permissionBanner,
            {
              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
              borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : '#bae6fd',
            },
          ]}
        >
          <View style={styles.bannerRow}>
            <Info size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                variant="caption"
                weight="semibold"
                style={{ color: isDark ? '#38bdf8' : '#0369a1' }}
              >
                Expo Go Development Mode
              </Text>
              <Text
                variant="caption"
                style={{ color: isDark ? '#bae6fd' : '#0284c7' }}
                numberOfLines={2}
              >
                Remote push notifications require a development build. Local operational alerts remain active.
              </Text>
            </View>
          </View>
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
          Configure real-time push alerts for shift reminders, breakdown flags, and assignments.
        </Text>
      </View>

      {/* 2. Shift Reminders */}
      <NotificationToggleCard
        icon={<Clock size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Shift & Meter Reminders"
        subtitle="Alerts when shifts end, daily pending slot digests, and lock-out warnings"
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

      {/* 5. Admin Alerts (visible only to Admin, HR, Super Admin) */}
      {isAdminRole && (
        <NotificationToggleCard
          icon={<ShieldCheck size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
          iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
          title="Administrative & Registration Alerts"
          subtitle="Notifications for pending user registrations and equipment inquiries"
          value={Boolean(prefs.adminAlerts)}
          disabled={!prefs.push}
          onToggle={() => handleChannelToggle('adminAlerts', 'Administrative Alerts')}
          accessibilityLabel="Toggle Administrative Alerts"
        />
      )}

      {/* 6. Payroll Alerts */}
      <NotificationToggleCard
        icon={<Banknote size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Payroll & Salary Dispatches"
        subtitle="Monthly salary slip generation notices and payout confirmations"
        value={Boolean(prefs.payrollAlerts)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('payrollAlerts', 'Payroll Alerts')}
        accessibilityLabel="Toggle Payroll Alerts"
      />

      {/* 7. Quiet Hours */}
      <View style={styles.sectionHeader}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.sectionTitle, { color: theme.colors.mute }]}
        >
          QUIET HOURS & DOWNTIME
        </Text>
      </View>

      <NotificationToggleCard
        icon={<Moon size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(79, 70, 229, 0.15)' : '#e0e7ff'}
        title="Quiet Hours (22:00 – 06:00 IST)"
        subtitle="Defers non-critical notifications until morning. Critical breakdown alerts always sound."
        value={Boolean(prefs.quietHoursEnabled)}
        disabled={!prefs.push}
        onToggle={() => handleChannelToggle('quietHoursEnabled', 'Quiet Hours')}
        accessibilityLabel="Toggle Quiet Hours"
      />

      {/* 8. Mandatory Security Alerts (Always On) */}
      <Card
        variant="elevated"
        style={[
          styles.securityCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.masterHeaderRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
              },
            ]}
          >
            <ShieldCheck size={20} color={isDark ? '#34d399' : '#059669'} />
          </View>
          <View style={styles.textColumn}>
            <Text
              variant="subheading"
              weight="semibold"
              style={[styles.cardTitle, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              Security Alerts
            </Text>
            <Text
              variant="caption"
              style={[styles.cardSubtitle, { color: theme.colors.mute }]}
              numberOfLines={2}
            >
              Password changes, session revocations, and new device logins are always active.
            </Text>
          </View>
          <View style={styles.alwaysOnBadge}>
            <Text
              variant="caption"
              weight="semibold"
              style={{ color: isDark ? '#34d399' : '#059669' }}
            >
              ALWAYS ON
            </Text>
          </View>
        </View>
      </Card>
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
  securityCard: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    opacity: 0.9,
  },
  alwaysOnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
