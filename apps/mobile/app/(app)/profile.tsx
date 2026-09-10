import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
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
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, role, signOut, refreshSession, userProfile: authProfile } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [dbUser, setDbUser] = useState<any>(authProfile || null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [userRes, reqRes] = await Promise.all([
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
      ]);

      if (userRes.data) {
        setDbUser(userRes.data);
      }
      setPendingRequest(reqRes.data || null);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="USER ACCOUNT"
        title="Field Staff Profile"
        subtitle="Account credentials, field operational scope & system preferences"
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

        {/* System Preferences Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>SYSTEM PREFERENCES</Text>
          <Text style={[styles.label, { color: theme.colors.mute }]}>Color Appearance</Text>

          <Button
            label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            variant="outline"
            size="sm"
            icon={isDark ? <Sun size={14} color={theme.colors.warning} /> : <Moon size={14} color={theme.colors.ink} />}
            style={{ marginTop: spacingNumeric.xs }}
          />
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
});
