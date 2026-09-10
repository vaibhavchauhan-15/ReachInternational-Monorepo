import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import {
  Bell,
  AlertCircle,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  RefreshCw,
  X,
  Eye,
  RotateCcw,
  Wrench,
  User,
} from 'lucide-react-native';

export type NotifStatusFilter = 'all' | 'sent' | 'pending' | 'failed';

export interface DatabaseNotification {
  id: string;
  alert_type: string;
  alert_date?: string | null;
  channel?: string | null;
  status: string;
  sent_at?: string | null;
  created_at: string;
  error_message?: string | null;
  payload?: any;
  machine?: any;
  recipient?: any;
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { user, role } = useAuth();

  const [notifications, setNotifications] = useState<DatabaseNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<NotifStatusFilter>('all');
  const [previewItem, setPreviewItem] = useState<DatabaseNotification | null>(null);
  const [isResending, setIsResending] = useState(false);

  const isAdminOrManager =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'manager' ||
    role === 'service_manager';

  const fetchNotifications = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .select(`
          id,
          alert_type,
          alert_date,
          channel,
          status,
          sent_at,
          created_at,
          error_message,
          payload,
          machine:machines(id, model, serial_number),
          recipient:users!notifications_recipient_id_fkey(id, full_name, phone, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (role === 'engineer' || role === 'service_engineer' || role === 'mechanic' || role === 'operator') {
        if (user?.id) {
          query = query.eq('recipient_id', user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications((data as any) || []);
    } catch (err: any) {
      console.warn('[NotificationsScreen] Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, role]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const stats = useMemo(() => {
    let sent = 0;
    let pending = 0;
    let failed = 0;

    notifications.forEach((n) => {
      const s = (n.status || '').toLowerCase();
      if (s === 'sent') sent++;
      else if (s === 'pending') pending++;
      else if (s === 'failed') failed++;
    });

    return {
      total: notifications.length,
      sent,
      pending,
      failed,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (statusFilter === 'all') return notifications;
    return notifications.filter((n) => (n.status || '').toLowerCase() === statusFilter);
  }, [notifications, statusFilter]);

  const getChannelIcon = (channel?: string | null) => {
    const ch = (channel || '').toLowerCase();
    if (ch.includes('whatsapp')) return <MessageSquare size={16} color="#25D366" />;
    if (ch.includes('sms')) return <Phone size={16} color="#6366f1" />;
    return <Mail size={16} color={theme.colors.link} />;
  };

  const formatAlertTitle = (alertType?: string) => {
    switch (alertType) {
      case 'daily_summary':
        return 'Daily Operations Summary';
      case 'engineer_summary':
        return 'Engineer Daily Schedule';
      case 'today':
      case 'service_today':
        return 'Service Due Today';
      case 'tomorrow':
      case 'service_tomorrow':
        return 'Service Due Tomorrow';
      case 'breakdown':
        return 'Breakdown Incident Alert';
      case 'overdue':
        return 'Service Overdue Warning';
      default:
        return alertType ? alertType.replace(/_/g, ' ').toUpperCase() : 'System Dispatch';
    }
  };

  const handleResend = async (notif: DatabaseNotification) => {
    setIsResending(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          status: 'pending',
          error_message: null,
          sent_at: null,
        })
        .eq('id', notif.id);

      if (error) throw error;
      Alert.alert('Notification Queued', 'The message has been re-queued for delivery.');
      await fetchNotifications();
      setPreviewItem(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to re-queue notification.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="AUTOMATED DISPATCHES"
        title="Notification Center"
        subtitle="Telemetry alerts, PM service schedules & delivery dispatches"
        rightAction={
          <TouchableOpacity onPress={onRefresh} style={styles.headerBtn}>
            <RefreshCw size={16} color={theme.colors.mute} />
          </TouchableOpacity>
        }
      />

      <View style={styles.statsStrip}>
        <View style={[styles.statBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.statLabel, { color: theme.colors.mute }]}>TOTAL</Text>
          <Text style={[styles.statValue, { color: theme.colors.ink }]}>{stats.total}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.statLabel, { color: theme.colors.mute }]}>SENT</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.sent}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.statLabel, { color: theme.colors.mute }]}>PENDING</Text>
          <Text style={[styles.statValue, { color: '#d97706' }]}>{stats.pending}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Text style={[styles.statLabel, { color: theme.colors.mute }]}>FAILED</Text>
          <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.failed}</Text>
        </View>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: theme.colors.hairline }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'sent', label: `Sent (${stats.sent})` },
            { id: 'pending', label: `Pending (${stats.pending})` },
            { id: 'failed', label: `Failed (${stats.failed})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setStatusFilter(tab.id as NotifStatusFilter)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.ink : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.ink : theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? theme.colors.canvas : theme.colors.ink },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading dispatches...</Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Bell size={32} color={theme.colors.mute} style={{ opacity: 0.5, marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No Notifications Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
              {statusFilter === 'all'
                ? 'Automated machine alerts and daily digests will appear here.'
                : `No notifications currently matching status "${statusFilter}".`}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const isSent = item.status === 'sent';
            const isFailed = item.status === 'failed';

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setPreviewItem(item)}
                activeOpacity={0.8}
              >
                <Card
                  variant="elevated"
                  style={[
                    styles.card,
                    {
                      borderLeftWidth: 3,
                      borderLeftColor: isSent ? '#16a34a' : isFailed ? '#dc2626' : '#d97706',
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      {getChannelIcon(item.channel)}
                      <Text style={[styles.cardTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                        {formatAlertTitle(item.alert_type)}
                      </Text>
                    </View>
                    <Badge
                      status={isSent ? 'active' : isFailed ? 'breakdown' : 'pending'}
                      customLabel={(item.status || 'PENDING').toUpperCase()}
                    />
                  </View>

                  <View style={styles.metaRows}>
                    {item.recipient && (
                      <View style={styles.metaRow}>
                        <User size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]} numberOfLines={1}>
                          {item.recipient.full_name || 'Staff'}{' '}
                          {item.recipient.phone ? `(${item.recipient.phone})` : ''}
                        </Text>
                      </View>
                    )}

                    {item.machine && (
                      <View style={styles.metaRow}>
                        <Wrench size={12} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.mute }]} numberOfLines={1}>
                          Machine: {item.machine.model || 'Equipment'} ({item.machine.serial_number || '—'})
                        </Text>
                      </View>
                    )}
                  </View>

                  {isFailed && item.error_message ? (
                    <View style={styles.errorBox}>
                      <AlertCircle size={12} color="#dc2626" />
                      <Text style={styles.errorText} numberOfLines={2}>
                        {item.error_message}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
                    <View style={styles.footerTime}>
                      <Clock size={11} color={theme.colors.mute} />
                      <Text style={[styles.timeText, { color: theme.colors.mute }]}>
                        {formatDate(item.created_at)}
                      </Text>
                    </View>
                    <View style={styles.viewDetailLink}>
                      <Eye size={12} color={theme.colors.link} />
                      <Text style={[styles.viewDetailText, { color: theme.colors.link }]}>
                        View Payload
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={Boolean(previewItem)} animationType="slide" transparent onRequestClose={() => setPreviewItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.previewSheet, { backgroundColor: theme.colors.canvas }]}>
            {previewItem && (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                  <View style={styles.modalHeaderLeft}>
                    {getChannelIcon(previewItem.channel)}
                    <View>
                      <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                        {formatAlertTitle(previewItem.alert_type)}
                      </Text>
                      <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                        Channel: {(previewItem.channel || 'Email / Push').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setPreviewItem(null)} style={styles.closeBtn}>
                    <X size={20} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View
                    style={[
                      styles.previewStatusBanner,
                      {
                        backgroundColor:
                          previewItem.status === 'sent'
                            ? 'rgba(22, 163, 74, 0.08)'
                            : previewItem.status === 'failed'
                            ? 'rgba(220, 38, 38, 0.08)'
                            : 'rgba(217, 119, 6, 0.08)',
                        borderColor:
                          previewItem.status === 'sent'
                            ? 'rgba(22, 163, 74, 0.3)'
                            : previewItem.status === 'failed'
                            ? 'rgba(220, 38, 38, 0.3)'
                            : 'rgba(217, 119, 6, 0.3)',
                      },
                    ]}
                  >
                    <View style={styles.previewStatusRow}>
                      <Text
                        style={[
                          styles.previewStatusText,
                          {
                            color:
                              previewItem.status === 'sent'
                                ? '#16a34a'
                                : previewItem.status === 'failed'
                                ? '#dc2626'
                                : '#d97706',
                          },
                        ]}
                      >
                        Status: {(previewItem.status || 'PENDING').toUpperCase()}
                      </Text>
                      <Text style={[styles.previewTimeText, { color: theme.colors.mute }]}>
                        {formatDate(previewItem.created_at)}
                      </Text>
                    </View>
                    {previewItem.sent_at && (
                      <Text style={[styles.sentAtText, { color: theme.colors.mute }]}>
                        Delivered: {formatDate(previewItem.sent_at)}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.sectionLabel, { color: theme.colors.mute }]}>Recipient</Text>
                  <View style={[styles.detailBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.detailValue, { color: theme.colors.ink, fontWeight: '700' }]}>
                      {previewItem.recipient?.full_name || 'Operational Personnel'}
                    </Text>
                    {previewItem.recipient?.phone && (
                      <Text style={[styles.detailSub, { color: theme.colors.mute }]}>
                        Phone: {previewItem.recipient.phone}
                      </Text>
                    )}
                    {previewItem.recipient?.email && (
                      <Text style={[styles.detailSub, { color: theme.colors.mute }]}>
                        Email: {previewItem.recipient.email}
                      </Text>
                    )}
                  </View>

                  {previewItem.machine && (
                    <>
                      <Text style={[styles.sectionLabel, { color: theme.colors.mute, marginTop: 12 }]}>
                        Target Machine
                      </Text>
                      <View style={[styles.detailBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                        <Text style={[styles.detailValue, { color: theme.colors.ink, fontWeight: '700' }]}>
                          {previewItem.machine.model || 'Equipment Fleet'}
                        </Text>
                        <Text style={[styles.detailSub, { color: theme.colors.mute }]}>
                          Serial: {previewItem.machine.serial_number || '—'}
                        </Text>
                      </View>
                    </>
                  )}

                  {previewItem.error_message && (
                    <>
                      <Text style={[styles.sectionLabel, { color: '#dc2626', marginTop: 12 }]}>
                        Delivery Failure Reason
                      </Text>
                      <View style={[styles.errorDetailBox]}>
                        <Text style={styles.errorDetailText}>{previewItem.error_message}</Text>
                      </View>
                    </>
                  )}

                  {previewItem.payload && (
                    <>
                      <Text style={[styles.sectionLabel, { color: theme.colors.mute, marginTop: 12 }]}>
                        Payload Content
                      </Text>
                      <View style={[styles.payloadBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                        <Text style={[styles.payloadText, { color: theme.colors.ink }]}>
                          {typeof previewItem.payload === 'string'
                            ? previewItem.payload
                            : JSON.stringify(previewItem.payload, null, 2)}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={{ height: 24 }} />
                </ScrollView>

                {isAdminOrManager && previewItem.status === 'failed' && (
                  <View style={[styles.modalFooter, { borderTopColor: theme.colors.hairline }]}>
                    <Button
                      label={isResending ? 'Re-queueing...' : 'Re-queue Delivery'}
                      onPress={() => handleResend(previewItem)}
                      variant="primary"
                      size="md"
                      icon={<RotateCcw size={14} color="#ffffff" />}
                      disabled={isResending}
                      fullWidth
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 20,
  },
  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    gap: 8,
  },
  statBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  filterBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: spacingNumeric.md,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyCard: {
    padding: 32,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  card: {
    marginBottom: spacingNumeric.sm,
    padding: spacingNumeric.sm + 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  metaRows: {
    gap: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 11,
    color: '#dc2626',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  viewDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  previewSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  modalBody: {
    padding: spacingNumeric.md,
  },
  previewStatusBanner: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  previewTimeText: {
    fontSize: 11,
  },
  sentAtText: {
    fontSize: 11,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 13,
  },
  detailSub: {
    fontSize: 11,
    marginTop: 2,
  },
  errorDetailBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    marginBottom: 8,
  },
  errorDetailText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 16,
  },
  payloadBox: {
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  payloadText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  modalFooter: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
});
