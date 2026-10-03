/**
 * ReachInternational Mobile — Notification Settings Sub-Page
 * Route: /settings/notification & /setting/notification
 * Fully functional notification preferences with instant animated toast feedback
 * for every toggle, system permission telemetry, and AsyncStorage persistence.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Card,
  Badge,
  Button,
  useTheme,
  MobileHeader,
} from '../../../components/ui';
import { NotificationPermissionModal } from '../../../components/permissions';
import { getNotificationPermissionStatus, type PermissionStatus } from '../../../lib/permissions';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Bell,
  ShieldCheck,
  Clock,
  Wrench,
  UserCheck,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';

const NOTIF_PREFS_KEY = '@reach:notification_preferences';

interface NotificationPreferences {
  push: boolean;
  shiftReminders: boolean;
  breakdownAlerts: boolean;
  assignmentAlerts: boolean;
  overtimeAlerts: boolean;
  logSubmissions: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  push: true,
  shiftReminders: true,
  breakdownAlerts: true,
  assignmentAlerts: true,
  overtimeAlerts: true,
  logSubmissions: true,
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);

  // Live Toast Feedback State
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'on' | 'off'>('on');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'on' | 'off') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setFeedbackMessage(message);
    setFeedbackType(type);

    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 90,
      friction: 8,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setFeedbackMessage(null);
      });
    }, 2400);
  };

  // Load preferences from AsyncStorage and fetch permission status
  const loadPreferences = useCallback(async () => {
    try {
      const [stored, status] = await Promise.all([
        AsyncStorage.getItem(NOTIF_PREFS_KEY),
        getNotificationPermissionStatus(),
      ]);
      if (stored) {
        setPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) });
      }
      setPermissionStatus(status);
    } catch (e) {
      console.warn('[NotificationSettings] Failed to load preferences:', e);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Handle Toggle with Feedback
  const handleToggle = async (key: keyof NotificationPreferences, label: string) => {
    Haptics.selectionAsync().catch(() => {});
    const updatedValue = !prefs[key];
    const updatedPrefs = { ...prefs, [key]: updatedValue };
    setPrefs(updatedPrefs);

    try {
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updatedPrefs));
    } catch (e) {
      console.warn('[NotificationSettings] Failed to save preference:', e);
    }

    const stateWord = updatedValue ? 'enabled' : 'disabled';
    showToast(`${label} ${stateWord}`, updatedValue ? 'on' : 'off');
  };

  const activeCount = Object.entries(prefs).filter(([k, v]) => k !== 'push' && v).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Edge-to-edge Top Header */}
      <MobileHeader
        title="Notifications"
        showBack={true}
        onPressBack={() => router.push('/(app)/settings' as any)}
        showQuickAccess={false}
      />

      {/* Floating Animated Feedback Toast */}
      {feedbackMessage && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              backgroundColor: isDark
                ? feedbackType === 'on' ? '#064e3b' : '#3f3f46'
                : feedbackType === 'on' ? '#ecfdf5' : '#f4f4f5',
              borderColor: feedbackType === 'on' ? '#059669' : theme.colors.hairline,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {feedbackType === 'on' ? (
            <Volume2 size={16} color="#059669" />
          ) : (
            <VolumeX size={16} color={theme.colors.mute} />
          )}
          <Text
            style={[
              styles.toastText,
              {
                color: feedbackType === 'on'
                  ? (isDark ? '#34d399' : '#065f46')
                  : theme.colors.ink,
              },
            ]}
          >
            {feedbackMessage}
          </Text>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* CARD 1: SYSTEM PUSH PERMISSIONS */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5' }]}>
              <ShieldCheck size={18} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTitleBadgeRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>DEVICE PERMISSION</Text>
                {permissionStatus === 'granted' ? (
                  <Badge status="active" customLabel="GRANTED" />
                ) : (
                  <Badge status="pending" customLabel="NOT ENABLED" />
                )}
              </View>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Hardware authorization required for push banners
              </Text>
            </View>
          </View>

          <Text style={[styles.cardDescription, { color: theme.colors.mute }]}>
            {permissionStatus === 'granted'
              ? 'Your mobile device is authorized to receive urgent shift warnings, equipment breakdowns, and dispatch changes in the background.'
              : 'Push notifications are currently blocked or not yet granted by your operating system. Tap below to enable permissions.'}
          </Text>

          {permissionStatus !== 'granted' && (
            <Button
              label="Enable Device Notifications"
              onPress={() => setShowPermissionModal(true)}
              variant="outline"
              size="sm"
              icon={<Bell size={14} color={theme.colors.link} />}
              fullWidth
              style={{ marginTop: 4 }}
            />
          )}
        </Card>

        {/* ========================================================================= */}
        {/* CARD 2: MASTER NOTIFICATION TOGGLE */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe' }]}>
              <Bell size={18} color={isDark ? '#a78bfa' : '#7c3aed'} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: theme.colors.ink }]}>
                Allow Notifications
              </Text>
              <Text style={[styles.toggleSubtitle, { color: theme.colors.mute }]}>
                {prefs.push ? `All ${activeCount} active alerts enabled` : 'All app notifications muted'}
              </Text>
            </View>

            <Switch
              value={prefs.push}
              onValueChange={() => handleToggle('push', 'Push Notifications')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 3: INDIVIDUAL OPERATIONAL CHANNELS */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={[styles.card, !prefs.push && { opacity: 0.5 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe' }]}>
              <Clock size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>NOTIFICATION CHANNELS</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Customize individual alerts and reminders
              </Text>
            </View>
          </View>

          {/* Channel 1: Shift Reminders */}
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.channelTitle, { color: theme.colors.ink }]}>
                Shift Reminders
              </Text>
              <Text style={[styles.channelDesc, { color: theme.colors.mute }]}>
                Advance notice 30 mins before scheduled operator shifts
              </Text>
            </View>
            <Switch
              disabled={!prefs.push}
              value={prefs.shiftReminders}
              onValueChange={() => handleToggle('shiftReminders', 'Shift Reminders')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Channel 2: Breakdown Alerts */}
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.channelTitle, { color: theme.colors.ink }]}>
                  Breakdown & Incident Alerts
                </Text>
                <Badge status="error" customLabel="HIGH PRIORITY" />
              </View>
              <Text style={[styles.channelDesc, { color: theme.colors.mute }]}>
                Instant notifications when an operator reports equipment failure
              </Text>
            </View>
            <Switch
              disabled={!prefs.push}
              value={prefs.breakdownAlerts}
              onValueChange={() => handleToggle('breakdownAlerts', 'Breakdown Alerts')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Channel 3: Assignment & Schedule Changes */}
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.channelTitle, { color: theme.colors.ink }]}>
                Assignment Updates
              </Text>
              <Text style={[styles.channelDesc, { color: theme.colors.mute }]}>
                Alerts when a supervisor modifies your machine or site allocation
              </Text>
            </View>
            <Switch
              disabled={!prefs.push}
              value={prefs.assignmentAlerts}
              onValueChange={() => handleToggle('assignmentAlerts', 'Assignment Updates')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Channel 4: Overtime & Approval Alerts */}
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.channelTitle, { color: theme.colors.ink }]}>
                Overtime & Approval Alerts
              </Text>
              <Text style={[styles.channelDesc, { color: theme.colors.mute }]}>
                Notifications for overtime hour submissions and manager approvals
              </Text>
            </View>
            <Switch
              disabled={!prefs.push}
              value={prefs.overtimeAlerts}
              onValueChange={() => handleToggle('overtimeAlerts', 'Overtime Alerts')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Channel 5: Shift Log Submission Reminders */}
          <View style={styles.channelRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.channelTitle, { color: theme.colors.ink }]}>
                Shift Log Submission Reminders
              </Text>
              <Text style={[styles.channelDesc, { color: theme.colors.mute }]}>
                Reminders at shift end to record hour meter (HMR) readings
              </Text>
            </View>
            <Switch
              disabled={!prefs.push}
              value={prefs.logSubmissions}
              onValueChange={() => handleToggle('logSubmissions', 'Log Submission Reminders')}
              trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
              thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Permission primer modal */}
      <NotificationPermissionModal
        visible={showPermissionModal}
        onClose={() => {
          setShowPermissionModal(false);
          loadPreferences();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 80,
  },
  floatingToast: {
    position: 'absolute',
    top: 54,
    left: spacingNumeric.md,
    right: spacingNumeric.md,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  card: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  channelDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: '100%',
  },
});
