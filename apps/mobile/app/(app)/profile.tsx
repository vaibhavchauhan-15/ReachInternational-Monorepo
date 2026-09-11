import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme, MobileHeader, ReachInternationalLogo, HeaderActionItem } from '../../components/ui';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { supabase } from '../../lib/supabase';
import {
  LogOut,
  Sun,
  Moon,
  Shield,
  ShieldCheck,
  Building,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  FileText,
  Edit,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  Wifi,
  Bell,
  CheckCircle2,
  Settings,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import {
  getNotificationPermissionStatus,
  type PermissionStatus,
} from '../../lib/permissions';
import { NotificationPermissionModal } from '../../components/permissions';
import { notifyProfileRequestCancelled, notifyThemeToggled } from '../../lib/notifications';
import { PostNotificationFeedModal } from '../../components/notifications';

export default function ProfileScreen() {
  const { user, role, signOut, refreshSession, userProfile: authProfile } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [dbUser, setDbUser] = useState<any>(authProfile || null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('undetermined');
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [feedModalVisible, setFeedModalVisible] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [userRes, reqRes, notifRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, phone, role, status, complete_profile, shift_time, city, district, state, state_id, address, aadhaar_number, license_number, email')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('profile_change_requests')
          .select('id, user_id, requester_role, current_data, requested_data, target_approver_role, status, created_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .maybeSingle(),
        getNotificationPermissionStatus(),
      ]);

      if (userRes.data) {
        setDbUser(userRes.data);
      }
      setPendingRequest(reqRes.data || null);
      setNotificationStatus(notifRes);
    } catch (err) {
      console.warn('[ProfileScreen] Error fetching profile record:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshSession) {
        await refreshSession();
      }
      await fetchProfileData();
      const notifState = await getNotificationPermissionStatus();
      setNotificationStatus(notifState);
    } catch (e) {
      console.error('[ProfileScreen] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, fetchProfileData]);

  const handleCancelPendingRequest = () => {
    if (!pendingRequest?.id) return;

    Alert.alert(
      'Cancel Change Request',
      'Are you sure you want to withdraw your pending profile update request?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Withdraw Request',
          style: 'destructive',
          onPress: async () => {
            setIsCancellingRequest(true);
            try {
              const { error } = await supabase
                .from('profile_change_requests')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', pendingRequest.id);

              if (error) throw error;
              notifyProfileRequestCancelled();
              Alert.alert('Request Withdrawn', 'Your profile change request has been cancelled.');
              await fetchProfileData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel the change request.');
            } finally {
              setIsCancellingRequest(false);
            }
          },
        },
      ]
    );
  };

  // Authoritative data resolution: DB row -> Auth Context -> Auth user metadata
  const profile = dbUser || authProfile || {};
  const metadata = user?.user_metadata || {};

  const fullName = profile.full_name || metadata.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const userPhone = profile.phone || metadata.phone || '—';
  const shiftSchedule = profile.shift_time || metadata.shift_time || 'General / Day Shift (08:00 AM - 08:00 PM)';
  
  const city = profile.city || metadata.city;
  const district = profile.district || metadata.district;
  const state = profile.state || metadata.state;
  const locationParts = [city, district, state].filter(Boolean);
  const locationString = locationParts.length > 0 ? locationParts.join(', ') : '—';
  
  const rawAddress = profile.address || metadata.address;
  const fullAddress = rawAddress
    ? `${rawAddress}${locationString !== '—' ? `, ${locationString}` : ''}`
    : locationString;

  const rawAadhaar = profile.aadhaar_number || metadata.aadhaar_number;
  const aadhaarDisplay = rawAadhaar
    ? rawAadhaar.length >= 12
      ? `XXXX-XXXX-${rawAadhaar.slice(-4)}`
      : rawAadhaar
    : 'Not Provided';

  const licenceDisplay = profile.license_number || metadata.license_number || 'Not Provided';
  const currentRole = (profile.role || role || metadata.role || 'operator').replace(/_/g, ' ').toUpperCase();

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    list.push({
      id: 'edit-profile',
      label: 'Edit Profile & Shift Details',
      icon: <Edit size={16} color={theme.colors.ink} />,
      onPress: () => setEditModalVisible(true),
    });

    list.push({
      id: 'refresh-profile',
      label: 'Refresh Profile Data',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => onRefresh(),
    });

    list.push({
      id: 'settings',
      label: 'Settings & Preferences',
      icon: <Settings size={16} color={theme.colors.ink} />,
      onPress: () => router.push('/(app)/settings' as any),
    });

    list.push({
      id: 'theme-toggle',
      label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: isDark ? <Sun size={16} color={theme.colors.ink} /> : <Moon size={16} color={theme.colors.ink} />,
      onPress: () => setMode(isDark ? 'light' : 'dark'),
    });

    list.push({
      id: 'sign-out',
      label: 'Sign Out of Account',
      icon: <LogOut size={16} color="#ef4444" />,
      destructive: true,
      onPress: () => handleLogout(),
    });

    return list;
  }, [theme.colors.ink, isDark, setMode, onRefresh, handleLogout]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [Search] + [3-Dot Actions] */}
      <MobileHeader
        title="Profile"
        showBack={true}
        searchPlaceholder="Search profile details..."
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* Pending Change Request Banner */}
        {pendingRequest && (
          <View
            style={[
              styles.pendingBanner,
              {
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
              },
            ]}
          >
            <View style={styles.pendingHeader}>
              <View style={styles.pendingTitleGroup}>
                <AlertTriangle size={16} color="#d97706" />
                <Text style={styles.pendingTitle}>Pending Profile Review</Text>
              </View>
              <Badge status="pending" customLabel="PENDING" />
            </View>
            <Text style={[styles.pendingDescription, { color: theme.colors.mute }]}>
              A profile change request submitted on{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                {formatDate(pendingRequest.created_at)}
              </Text>{' '}
              is currently under review by{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                {pendingRequest.target_approver_role === 'super_admin'
                  ? 'Super Administrator'
                  : 'Administrator / Manager'}
              </Text>
              . New edits will overwrite this pending submission.
            </Text>
            <TouchableOpacity
              style={styles.cancelRequestBtn}
              onPress={handleCancelPendingRequest}
              disabled={isCancellingRequest}
            >
              <XCircle size={14} color="#dc2626" />
              <Text style={styles.cancelRequestText}>
                {isCancellingRequest ? 'Cancelling...' : 'Withdraw Request'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* User Identity & Operations Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                {fullName[0]?.toUpperCase() || 'R'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: theme.colors.ink }]}>{fullName}</Text>
              <Text style={[styles.profileEmail, { color: theme.colors.mute }]}>{user?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Role */}
          <View style={styles.infoRow}>
            <Shield size={14} color={theme.colors.link} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>System Role:</Text>
            <Badge status="active" customLabel={currentRole} />
          </View>

          <View style={styles.divider} />

          {/* Shift Schedule */}
          <View style={styles.infoRow}>
            <Clock size={14} color={theme.colors.link} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Shift Timing:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]} numberOfLines={1}>
              {shiftSchedule}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Phone */}
          <View style={styles.infoRow}>
            <Phone size={14} color={theme.colors.mute} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Mobile Phone:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]}>{userPhone}</Text>
          </View>

          <View style={styles.divider} />

          {/* Address */}
          <View style={styles.infoRow}>
            <MapPin size={14} color={theme.colors.success} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Address:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]} numberOfLines={2}>
              {fullAddress}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Aadhaar Number */}
          <View style={styles.infoRow}>
            <ShieldCheck size={14} color="#6366f1" />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Aadhaar Card:</Text>
            <Text style={[styles.value, { color: theme.colors.ink, fontFamily: 'monospace' }]} numberOfLines={1}>
              {aadhaarDisplay}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Driving Licence */}
          <View style={styles.infoRow}>
            <FileText size={14} color="#8b5cf6" />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Driving Licence:</Text>
            <Text style={[styles.value, { color: theme.colors.ink, fontFamily: 'monospace' }]} numberOfLines={1}>
              {licenceDisplay}
            </Text>
          </View>

          {/* Edit Profile CTA */}
          <Button
            label="Edit Profile"
            onPress={() => setEditModalVisible(true)}
            variant="outline"
            size="sm"
            icon={<Edit size={14} color={theme.colors.link} />}
            fullWidth
            style={{ marginTop: spacingNumeric.sm + 4 }}
          />
        </Card>

        {/* App Permissions & System Telemetry Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>APP PERMISSIONS & TELEMETRY</Text>
          
          {/* INTERNET */}
          <View style={styles.permissionItemRow}>
            <View style={[styles.permIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
              <Globe size={16} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.permHeaderLine}>
                <Text style={[styles.permName, { color: theme.colors.ink }]}>INTERNET</Text>
                <Badge status="active" customLabel="ACTIVE" />
              </View>
              <Text style={[styles.permSub, { color: theme.colors.mute }]}>
                Supabase database sync & API communication
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ACCESS_NETWORK_STATE */}
          <View style={styles.permissionItemRow}>
            <View style={[styles.permIconBox, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' }]}>
              <Wifi size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.permHeaderLine}>
                <Text style={[styles.permName, { color: theme.colors.ink }]}>ACCESS_NETWORK_STATE</Text>
                <Badge status="active" customLabel="ACTIVE" />
              </View>
              <Text style={[styles.permSub, { color: theme.colors.mute }]}>
                Real-time online/offline reachability detection
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* POST_NOTIFICATIONS */}
          <View style={styles.permissionItemRow}>
            <View
              style={[
                styles.permIconBox,
                {
                  backgroundColor:
                    notificationStatus === 'granted'
                      ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'
                      : isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                },
              ]}
            >
              <Bell
                size={16}
                color={
                  notificationStatus === 'granted'
                    ? isDark ? '#34d399' : '#059669'
                    : isDark ? '#fbbf24' : '#d97706'
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.permHeaderLine}>
                <Text style={[styles.permName, { color: theme.colors.ink }]}>POST_NOTIFICATIONS</Text>
                {notificationStatus === 'granted' ? (
                  <Badge status="active" customLabel="ENABLED" />
                ) : (
                  <Badge status="pending" customLabel="NOT ENABLED" />
                )}
              </View>
              <Text style={[styles.permSub, { color: theme.colors.mute }]}>
                Shift conflict warnings & urgent fleet dispatch
              </Text>
            </View>
          </View>

          {notificationStatus !== 'granted' ? (
            <Button
              label="Enable Notifications"
              onPress={() => setPermissionModalVisible(true)}
              variant="outline"
              size="sm"
              icon={<Bell size={14} color={theme.colors.link} />}
              fullWidth
              style={{ marginTop: spacingNumeric.sm }}
            />
          ) : null}

          <Button
            label="Recent Notifications Feed"
            onPress={() => setFeedModalVisible(true)}
            variant="outline"
            size="sm"
            icon={<Bell size={14} color={theme.colors.ink} />}
            fullWidth
            style={{ marginTop: spacingNumeric.sm }}
          />
        </Card>

        {/* System Preferences Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>SYSTEM PREFERENCES</Text>
          <Text style={[styles.label, { color: theme.colors.mute }]}>Color Appearance</Text>

          <Button
            label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            onPress={() => {
              const nextMode = isDark ? 'light' : 'dark';
              setMode(nextMode);
              notifyThemeToggled(nextMode === 'dark');
            }}
            variant="outline"
            size="sm"
            icon={isDark ? <Sun size={14} color={theme.colors.warning} /> : <Moon size={14} color={theme.colors.ink} />}
            style={{ marginTop: spacingNumeric.xs }}
          />
        </Card>

        {/* Account Deletion Entry Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>ACCOUNT MANAGEMENT</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
            onPress={() => router.push('/(app)/account-deletion' as any)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(220, 38, 38, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.ink }}>
                  Request Account Deletion
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                  Permanent de-provisioning & personal data erasure
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={theme.colors.mute} />
          </TouchableOpacity>
        </Card>

        {/* Sign Out Button */}
        <Button
          label="Sign Out of Session"
          onPress={handleLogout}
          variant="danger"
          shape="pill"
          icon={<LogOut size={16} color="#ffffff" />}
          fullWidth
          style={{ marginTop: spacingNumeric.md }}
        />

        {/* Brand Footer with Light/Dark Theme Polarity */}
        <View style={styles.brandFooter}>
          <ReachInternationalLogo size={18} showTagline={false} />
          <Text style={[styles.brandFooterText, { color: theme.colors.mute }]}>
            Reach International v1.0.0 • Reaching All Heights
          </Text>
        </View>
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        currentUser={dbUser || authProfile}
        onClose={() => setEditModalVisible(false)}
        onSuccess={() => {
          fetchProfileData();
          if (refreshSession) refreshSession();
        }}
      />

      <NotificationPermissionModal
        visible={permissionModalVisible}
        onClose={() => setPermissionModalVisible(false)}
        onResolved={(status) => setNotificationStatus(status)}
      />

      <PostNotificationFeedModal
        visible={feedModalVisible}
        onClose={() => setFeedModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingNumeric.md, paddingBottom: spacingNumeric.xl },
  card: { marginVertical: spacingNumeric.xs, padding: spacingNumeric.md },
  pendingBanner: {
    padding: spacingNumeric.sm + 4,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pendingTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
  },
  pendingDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  cancelRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  cancelRequestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 13, fontWeight: '700', flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: spacingNumeric.xs + 2 },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.lg,
    gap: 6,
  },
  brandFooterText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  permissionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  permIconBox: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  permName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  permSub: {
    fontSize: 11,
    lineHeight: 14,
  },
});
