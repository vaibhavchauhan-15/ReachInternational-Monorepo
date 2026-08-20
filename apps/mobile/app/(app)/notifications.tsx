import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Switch } from 'react-native';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate } from '@servicecentric/utils';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { Bell, CheckCheck, ShieldAlert, Wrench, Settings, ArrowRight } from 'lucide-react-native';

export type NotifFilter = 'all' | 'unread' | 'breakdowns' | 'system';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'breakdown' | 'service' | 'fsr' | 'meter' | 'system';
  targetRoute: string;
  read: boolean;
  created_at: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'ntf-001',
    title: 'New Breakdown Complaint Assigned',
    body: 'Toyota 8FG (MCH-004) reported hydraulic pressure drop at Delhi Site.',
    category: 'breakdown',
    targetRoute: '/(app)/my-work',
    read: false,
    created_at: '2026-08-19T10:30:00Z',
  },
  {
    id: 'ntf-002',
    title: 'FSR Approval Requested',
    body: 'Technician Rahul Sharma submitted FSR-032 for manager review.',
    category: 'fsr',
    targetRoute: '/(app)/fsr',
    read: false,
    created_at: '2026-08-19T08:15:00Z',
  },
  {
    id: 'ntf-003',
    title: 'Part Requisition Approved',
    body: 'Requisition REQ-014 for Hydraulic Seal Kit (HSK-8812) has been approved by store manager.',
    category: 'service',
    targetRoute: '/(app)/inventory',
    read: true,
    created_at: '2026-08-18T14:20:00Z',
  },
  {
    id: 'ntf-004',
    title: 'Daily Hour Meter Reminder',
    body: 'Remember to submit end-of-shift hour meter log for MCH-012.',
    category: 'meter',
    targetRoute: '/(app)/my-work',
    read: true,
    created_at: '2026-08-18T17:00:00Z',
  },
];

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useGlobalSearchParams();

  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  
  const tabParam = (searchParams?.tab as NotifFilter) || 'all';
  const activeFilter = ['all', 'unread', 'breakdowns', 'system'].includes(tabParam) ? tabParam : 'all';

  const setActiveFilter = (filter: NotifFilter) => {
    router.setParams({ tab: filter });
  };

  const [refreshing, setRefreshing] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Preference Toggles
  const [breakdownAlerts, setBreakdownAlerts] = useState(true);
  const [fsrAlerts, setFsrAlerts] = useState(true);
  const [meterReminders, setMeterReminders] = useState(true);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleTapNotification = (item: NotificationItem) => {
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    if (item.targetRoute) {
      router.push(item.targetRoute as any);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'breakdowns') return n.category === 'breakdown';
    if (activeFilter === 'system') return n.category === 'system' || n.category === 'meter';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Mobile Header */}
      <MobileHeader
        eyebrow="ALERT SYSTEM"
        title={`Notifications (${unreadCount})`}
        subtitle="Realtime breakdown alerts & system dispatch notifications"
        rightAction={
          <TouchableOpacity onPress={() => setShowPreferences(!showPreferences)} style={styles.iconBtn}>
            <Settings size={18} color={theme.colors.mute} />
          </TouchableOpacity>
        }
      />

      {/* Preferences Drawer */}
      {showPreferences && (
        <View style={[styles.prefBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.prefTitle, { color: theme.colors.ink }]}>Notification Preferences</Text>
          <View style={styles.prefRow}>
            <Text style={[styles.prefLabel, { color: theme.colors.body }]}>Breakdown Alerts</Text>
            <Switch value={breakdownAlerts} onValueChange={setBreakdownAlerts} trackColor={{ false: theme.colors.hairline, true: theme.colors.link }} />
          </View>
          <View style={styles.prefRow}>
            <Text style={[styles.prefLabel, { color: theme.colors.body }]}>FSR Approval Updates</Text>
            <Switch value={fsrAlerts} onValueChange={setFsrAlerts} trackColor={{ false: theme.colors.hairline, true: theme.colors.link }} />
          </View>
          <View style={styles.prefRow}>
            <Text style={[styles.prefLabel, { color: theme.colors.body }]}>Daily Meter Reminders</Text>
            <Switch value={meterReminders} onValueChange={setMeterReminders} trackColor={{ false: theme.colors.hairline, true: theme.colors.link }} />
          </View>
        </View>
      )}

      {/* Filter Pills Bar */}
      <View style={[styles.filterBar, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Alerts' },
            { key: 'unread', label: `Unread (${unreadCount})` },
            { key: 'breakdowns', label: 'Breakdowns' },
            { key: 'system', label: 'System' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as NotifFilter)}
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: isActive ? theme.colors.onPrimary : theme.colors.body }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredNotifications.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => handleTapNotification(item)} activeOpacity={0.8}>
            <Card
              style={[
                styles.card,
                {
                  borderColor: item.read ? theme.colors.hairline : theme.colors.link,
                  backgroundColor: item.read ? theme.colors.canvasElevated : theme.colors.hairlineSoft,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.colors.link }]} />}
                  <Badge status={item.category} customLabel={item.category.toUpperCase()} />
                </View>
                <Text style={[styles.timeText, { color: theme.colors.faint }]}>
                  {formatDate(item.created_at)}
                </Text>
              </View>

              <Text style={[styles.notifTitle, { color: theme.colors.ink, fontWeight: item.read ? '600' : '800' }]}>
                {item.title}
              </Text>
              <Text style={[styles.notifBody, { color: theme.colors.body }]}>{item.body}</Text>

              <View style={styles.tapRow}>
                <Text style={[styles.tapText, { color: theme.colors.link }]}>Tap to open details</Text>
                <ArrowRight size={14} color={theme.colors.link} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 50,
    paddingBottom: spacingNumeric.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  iconBtn: {
    padding: 6,
  },
  prefBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginVertical: spacingNumeric.xs,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacingNumeric.xs,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  prefLabel: {
    fontSize: 12,
  },
  filterBar: {
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: spacingNumeric.md,
    flexDirection: 'row',
    gap: spacingNumeric.xs,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    marginRight: spacingNumeric.xxs,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 40,
  },
  card: {
    marginVertical: spacingNumeric.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 11,
  },
  notifTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  notifBody: {
    fontSize: 13,
    marginBottom: spacingNumeric.xs,
  },
  tapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  tapText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
