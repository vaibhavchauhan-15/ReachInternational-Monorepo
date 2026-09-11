/**
 * ReachInternational Mobile — Field Settings Screen
 * Streamlined, minimalist, fast settings hub with modular modals for account & notifications.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../lib/auth/useAuth';
import {
  Card,
  Badge,
  Button,
  Input,
  useTheme,
  MobileHeader,
  ReachInternationalLogo,
} from '../../components/ui';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { NotificationPermissionModal } from '../../components/permissions';
import { getNotificationPermissionStatus, type PermissionStatus } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from '../../lib/brand';
import {
  User,
  KeyRound,
  Clock,
  MapPin,
  Bell,
  Sun,
  Moon,
  Monitor,
  Shield,
  ShieldCheck,
  Info,
  LogOut,
  ChevronRight,
  CheckCircle2,
  Lock,
  X,
  ExternalLink,
  Edit,
  Phone,
  Mail,
  FileText,
  Building,
  Trash2,
} from 'lucide-react-native';

const NOTIF_PREFS_KEY = '@reach:notification_preferences';

interface NotificationPreferences {
  push: boolean;
  shiftReminders: boolean;
  breakdownAlerts: boolean;
  assignmentAlerts: boolean;
  overtimeAlerts: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  push: true,
  shiftReminders: true,
  breakdownAlerts: true,
  assignmentAlerts: true,
  overtimeAlerts: true,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, role, signOut, refreshSession, userProfile } = useAuth();
  const { theme, isDark, setMode, mode } = useTheme();

  // Screen State
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // Notification Status & Preferences
  const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('undetermined');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);

  // Password Change Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load preferences from AsyncStorage
  const loadPreferences = useCallback(async () => {
    try {
      const [storedNotifs, notifState] = await Promise.all([
        AsyncStorage.getItem(NOTIF_PREFS_KEY),
        getNotificationPermissionStatus(),
      ]);

      if (storedNotifs) {
        setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(storedNotifs) });
      }
      setNotificationStatus(notifState);
    } catch (e) {
      console.warn('[SettingsScreen] Failed to load preferences:', e);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Save notification toggle
  const handleToggleNotif = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  };

  // Manual Refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshSession) await refreshSession();
      await loadPreferences();
    } catch (e) {
      console.warn('[SettingsScreen] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, loadPreferences]);

  // Handle Password Change
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please verify.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
      } else {
        Alert.alert('Success', 'Your password has been changed successfully.');
        setPasswordModalVisible(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Sign Out
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Reach International on this mobile device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const shiftDisplay = userProfile?.shift_time || 'General Shift (08:00 AM - 08:00 PM)';
  const locationDisplay = [userProfile?.city, userProfile?.state].filter(Boolean).join(', ') || 'Corporate HQ / Base Yard';
  const roleLabel = (role || userProfile?.role || 'operator').replace(/_/g, ' ').toUpperCase();

  const formattedAddress = [
    userProfile?.address,
    userProfile?.city,
    userProfile?.district,
    userProfile?.state,
  ]
    .filter(Boolean)
    .join(', ');

  const maskedAadhaar = userProfile?.aadhaar_number
    ? userProfile.aadhaar_number.length >= 12
      ? `XXXX-XXXX-${userProfile.aadhaar_number.slice(-4)}`
      : userProfile.aadhaar_number
    : null;

  // Active notification count for badge
  const activeNotifsCount = [
    notifPrefs.shiftReminders,
    notifPrefs.breakdownAlerts,
    notifPrefs.assignmentAlerts,
    notifPrefs.overtimeAlerts,
  ].filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Title only Settings */}
      <MobileHeader
        title="Settings"
        searchPlaceholder="Search settings..."
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      >

        {/* ========================================================================= */}
        {/* CARD 1: MY ACCOUNT (COMPACT TOUCH CARD) */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => setAccountModalVisible(true)}
          style={[styles.card, styles.touchCard]}
        >
          <View style={styles.cardTouchRow}>
            <View style={[styles.avatarBox, { backgroundColor: theme.colors.link }]}>
              <Text style={styles.avatarText}>
                {(userProfile?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.userName, { color: theme.colors.ink }]} numberOfLines={1}>
                  {userProfile?.full_name || 'Field Personnel'}
                </Text>
                <Badge status="active" customLabel={roleLabel} />
              </View>
              <Text style={[styles.userSubtext, { color: theme.colors.mute }]} numberOfLines={1}>
                {user?.email || userProfile?.email || 'No email registered'}
              </Text>
              <Text style={[styles.cardActionHint, { color: theme.colors.link }]}>
                View profile, shift & password
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 2: NOTIFICATIONS (COMPACT TOUCH CARD) */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => setNotifModalVisible(true)}
          style={[styles.card, styles.touchCard]}
        >
          <View style={styles.cardTouchRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe' }]}>
              <Bell size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Notifications</Text>
                {notifPrefs.push ? (
                  <Badge status="active" customLabel={`${activeNotifsCount} ACTIVE`} />
                ) : (
                  <Badge status="error" customLabel="MUTED" />
                )}
              </View>
              <Text style={[styles.cardSubtitle, { color: theme.colors.mute }]}>
                Push alerts, shift reminders & breakdown notices
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 3: APP APPEARANCE (ONLY COLOR APPEARANCE) */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Sun size={16} color="#f59e0b" />
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>APP THEME</Text>
          </View>

          <Text style={[styles.prefSubheading, { color: theme.colors.mute }]}>
            Select your preferred color appearance:
          </Text>

          <View style={styles.themeSelectorGroup}>
            {/* Light */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: mode === 'light' ? theme.colors.link : theme.colors.canvas,
                  borderColor: mode === 'light' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
              onPress={() => setMode('light')}
            >
              <Sun size={15} color={mode === 'light' ? '#ffffff' : theme.colors.ink} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === 'light' ? '#ffffff' : theme.colors.ink },
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            {/* Dark */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: mode === 'dark' ? theme.colors.link : theme.colors.canvas,
                  borderColor: mode === 'dark' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
              onPress={() => setMode('dark')}
            >
              <Moon size={15} color={mode === 'dark' ? '#ffffff' : theme.colors.ink} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === 'dark' ? '#ffffff' : theme.colors.ink },
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>

            {/* System */}
            <TouchableOpacity
              style={[
                styles.themeOptionBtn,
                {
                  backgroundColor: mode === 'system' ? theme.colors.link : theme.colors.canvas,
                  borderColor: mode === 'system' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
              onPress={() => setMode('system')}
            >
              <Monitor size={15} color={mode === 'system' ? '#ffffff' : theme.colors.ink} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === 'system' ? '#ffffff' : theme.colors.ink },
                ]}
              >
                System
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 4: APP PERMISSIONS */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <ShieldCheck size={16} color="#059669" />
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>APP PERMISSIONS</Text>
          </View>

          <View style={styles.permissionItemRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.permNameRow}>
                <Text style={[styles.permName, { color: theme.colors.ink }]}>Push Notifications</Text>
                {notificationStatus === 'granted' ? (
                  <Badge status="active" customLabel="GRANTED" />
                ) : (
                  <Badge status="pending" customLabel="NOT ENABLED" />
                )}
              </View>
              <Text style={[styles.permDesc, { color: theme.colors.mute }]}>
                Required for shift conflict warnings & equipment dispatch
              </Text>
            </View>
          </View>

          {notificationStatus !== 'granted' && (
            <Button
              label="Enable Notifications"
              onPress={() => setPermissionModalVisible(true)}
              variant="outline"
              size="sm"
              icon={<Bell size={14} color={theme.colors.link} />}
              fullWidth
              style={{ marginTop: spacingNumeric.sm }}
            />
          )}
        </Card>

        {/* ========================================================================= */}
        {/* CARD 5: ABOUT & LEGAL */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Info size={16} color={theme.colors.ink} />
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>ABOUT REACH INTERNATIONAL</Text>
          </View>

          <View style={styles.aboutInfoLine}>
            <Text style={[styles.aboutLabel, { color: theme.colors.mute }]}>Application Version</Text>
            <Text style={[styles.aboutValue, { color: theme.colors.ink }]}>v1.0.0 (Build 42)</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.aboutInfoLine}>
            <Text style={[styles.aboutLabel, { color: theme.colors.mute }]}>Platform Runtime</Text>
            <Text style={[styles.aboutValue, { color: theme.colors.ink }]}>Expo SDK 57 • React Native</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <TouchableOpacity
            style={styles.aboutInfoLine}
            onPress={() => Linking.openURL(BRAND_WEBSITE)}
          >
            <Text style={[styles.aboutLabel, { color: theme.colors.mute }]}>Official Website</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.aboutValue, { color: theme.colors.link }]}>{BRAND_WEBSITE_DISPLAY}</Text>
              <ExternalLink size={12} color={theme.colors.link} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <TouchableOpacity
            style={styles.aboutInfoLine}
            onPress={() => Linking.openURL(`mailto:${BRAND_EMAIL}`)}
          >
            <Text style={[styles.aboutLabel, { color: theme.colors.mute }]}>Official Email</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.aboutValue, { color: theme.colors.link }]}>{BRAND_EMAIL}</Text>
              <Mail size={12} color={theme.colors.link} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/privacy' as any)}
          >
            <Text style={[styles.legalNavText, { color: theme.colors.ink }]}>Privacy Policy</Text>
            <ChevronRight size={16} color={theme.colors.mute} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/terms' as any)}
          >
            <Text style={[styles.legalNavText, { color: theme.colors.ink }]}>Terms of Service</Text>
            <ChevronRight size={16} color={theme.colors.mute} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/account-deletion' as any)}
          >
            <Text style={[styles.legalNavText, { color: theme.colors.ink }]}>Account & Data Deletion</Text>
            <ChevronRight size={16} color={theme.colors.mute} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================================= */}
        {/* SIGN OUT BUTTON */}
        {/* ========================================================================= */}
        <Button
          label="Sign Out of Session"
          onPress={handleSignOut}
          variant="danger"
          shape="pill"
          icon={<LogOut size={16} color="#ffffff" />}
          fullWidth
          style={{ marginTop: spacingNumeric.md }}
        />

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <ReachInternationalLogo size={18} showTagline={false} />
          <Text style={[styles.brandFooterText, { color: theme.colors.mute }]}>
            {BRAND_NAME} • {BRAND_TAGLINE}
          </Text>
          <Text style={[styles.brandFooterText, { color: theme.colors.mute, fontSize: 11, marginTop: 2 }]}>
            {BRAND_WEBSITE_DISPLAY} • {BRAND_EMAIL}
          </Text>
        </View>

      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: MY ACCOUNT SETTINGS MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={accountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <User size={18} color={theme.colors.link} />
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Account Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Profile Card Header */}
              <View style={styles.modalProfileHeader}>
                <View style={[styles.modalAvatarBox, { backgroundColor: theme.colors.link }]}>
                  <Text style={styles.modalAvatarText}>
                    {(userProfile?.full_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.userName, { color: theme.colors.ink }]}>
                    {userProfile?.full_name || 'Field Personnel'}
                  </Text>
                  <Text style={[styles.userSubtext, { color: theme.colors.mute }]}>
                    {user?.email || userProfile?.email || 'No email registered'}
                  </Text>
                  {userProfile?.phone && (
                    <Text style={[styles.userPhone, { color: theme.colors.mute }]}>
                      +{userProfile.phone}
                    </Text>
                  )}
                </View>
              </View>

              {/* Shift Schedule */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <Clock size={16} color="#0284c7" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>SHIFT SCHEDULE</Text>
                  <Text style={[styles.fieldValue, { color: theme.colors.ink }]}>{shiftDisplay}</Text>
                </View>
                <Badge status="active" customLabel="ACTIVE" />
              </View>

              {/* Location */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <Building size={16} color="#d97706" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>BASE YARD / LOCATION</Text>
                  <Text style={[styles.fieldValue, { color: theme.colors.ink }]}>{locationDisplay}</Text>
                </View>
              </View>

              {/* Mobile Phone */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <Phone size={16} color="#059669" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>MOBILE PHONE</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: theme.colors.ink, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
                    ]}
                  >
                    {userProfile?.phone ? (userProfile.phone.startsWith('+') ? userProfile.phone : '+91 ' + userProfile.phone) : '—'}
                  </Text>
                </View>
              </View>

              {/* Address */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <MapPin size={16} color="#f59e0b" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>REGISTERED ADDRESS</Text>
                  <Text style={[styles.fieldValue, { color: theme.colors.ink, lineHeight: 18 }]}>
                    {formattedAddress || 'No address registered'}
                  </Text>
                </View>
              </View>

              {/* Aadhaar Card */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <ShieldCheck size={16} color="#6366f1" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>AADHAAR CARD (KYC)</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: theme.colors.ink, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
                    ]}
                  >
                    {maskedAadhaar || 'Not Provided'}
                  </Text>
                </View>
                {userProfile?.aadhaar_number ? (
                  <Badge status="active" customLabel="VERIFIED" />
                ) : (
                  <Badge status="pending" customLabel="NOT SUBMITTED" />
                )}
              </View>

              {/* Driving Licence */}
              <View style={[styles.modalInfoRow, { borderColor: theme.colors.hairline }]}>
                <FileText size={16} color="#a855f7" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>DRIVING LICENCE</Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      { color: theme.colors.ink, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
                    ]}
                  >
                    {userProfile?.license_number || 'Not Provided'}
                  </Text>
                </View>
                {userProfile?.license_number ? (
                  <Badge status="active" customLabel="VALID" />
                ) : (
                  <Badge status="neutral" customLabel="OPTIONAL" />
                )}
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 8, marginTop: spacingNumeric.md }}>
                <Button
                  label="Edit Profile & Shift Details"
                  onPress={() => {
                    setAccountModalVisible(false);
                    setEditProfileVisible(true);
                  }}
                  variant="primary"
                  size="sm"
                  icon={<Edit size={14} color="#ffffff" />}
                  fullWidth
                />

                <Button
                  label="Change Account Password"
                  onPress={() => {
                    setAccountModalVisible(false);
                    setPasswordModalVisible(true);
                  }}
                  variant="outline"
                  size="sm"
                  icon={<KeyRound size={14} color={theme.colors.ink} />}
                  fullWidth
                />

                <Button
                  label="View Full Profile Screen"
                  onPress={() => {
                    setAccountModalVisible(false);
                    router.push('/(app)/profile');
                  }}
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={14} color={theme.colors.link} />}
                  fullWidth
                />

                <View style={[styles.divider, { backgroundColor: theme.colors.hairline, marginVertical: 4 }]} />

                <Button
                  label="Request Account Deletion"
                  onPress={() => {
                    setAccountModalVisible(false);
                    router.push('/(app)/account-deletion' as any);
                  }}
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} color="#dc2626" />}
                  fullWidth
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: NOTIFICATIONS SETTINGS MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={notifModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="#8b5cf6" />
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Notification Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Master Push Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Push Notifications</Text>
                  <Text style={[styles.toggleDescription, { color: theme.colors.mute }]}>
                    Master switch for all device alerts
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.push}
                  onValueChange={(val) => handleToggleNotif('push', val)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Shift Reminders */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Shift Reminders</Text>
                  <Text style={[styles.toggleDescription, { color: theme.colors.mute }]}>
                    Alert 15 minutes before shift starts
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.shiftReminders}
                  onValueChange={(val) => handleToggleNotif('shiftReminders', val)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
                  thumbColor="#ffffff"
                  disabled={!notifPrefs.push}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Breakdown Alerts */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Breakdown Alerts</Text>
                  <Text style={[styles.toggleDescription, { color: theme.colors.mute }]}>
                    Urgent equipment breakdown notices
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.breakdownAlerts}
                  onValueChange={(val) => handleToggleNotif('breakdownAlerts', val)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
                  thumbColor="#ffffff"
                  disabled={!notifPrefs.push}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Assignment Alerts */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Assignment Alerts</Text>
                  <Text style={[styles.toggleDescription, { color: theme.colors.mute }]}>
                    When supervisor allocates a new machine
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.assignmentAlerts}
                  onValueChange={(val) => handleToggleNotif('assignmentAlerts', val)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
                  thumbColor="#ffffff"
                  disabled={!notifPrefs.push}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Overtime Alerts */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Overtime Alerts</Text>
                  <Text style={[styles.toggleDescription, { color: theme.colors.mute }]}>
                    Overtime log verification & dispute notices
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.overtimeAlerts}
                  onValueChange={(val) => handleToggleNotif('overtimeAlerts', val)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.link }}
                  thumbColor="#ffffff"
                  disabled={!notifPrefs.push}
                />
              </View>
            </ScrollView>

            <Button
              label="Done"
              onPress={() => setNotifModalVisible(false)}
              variant="primary"
              size="sm"
              fullWidth
              style={{ marginTop: spacingNumeric.md }}
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT PROFILE MODAL */}
      {/* ========================================================================= */}
      <EditProfileModal
        visible={editProfileVisible}
        currentUser={userProfile}
        onClose={() => setEditProfileVisible(false)}
        onSuccess={() => {
          setEditProfileVisible(false);
          if (refreshSession) refreshSession();
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 4: CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Lock size={18} color={theme.colors.link} />
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Change Password</Text>
              </View>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
              Enter a new secure password (minimum 6 characters) for your field account.
            </Text>

            {passwordError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            )}

            <Input
              label="New Password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              isPassword
              containerStyle={{ marginVertical: 6 }}
            />

            <Input
              label="Confirm New Password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              containerStyle={{ marginVertical: 6 }}
            />

            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                onPress={() => {
                  setPasswordModalVisible(false);
                  setPasswordError(null);
                }}
                variant="ghost"
                size="sm"
                style={{ flex: 1 }}
              />
              <Button
                label="Save Password"
                onPress={handleChangePassword}
                variant="primary"
                size="sm"
                isLoading={isChangingPassword}
                disabled={isChangingPassword || !newPassword}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: NOTIFICATION PERMISSION PRIMER */}
      {/* ========================================================================= */}
      <NotificationPermissionModal
        visible={permissionModalVisible}
        onClose={() => setPermissionModalVisible(false)}
        onResolved={(status) => setNotificationStatus(status)}
      />

      {/* ========================================================================= */}
      {/* MODAL 5: ACCOUNT & DATA DELETION REQUEST (GOOGLE PLAY COMPLIANT) */}
      {/* ========================================================================= */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} color="#dc2626" />
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Account Deletion</Text>
              </View>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              <View style={{ marginBottom: spacingNumeric.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge status="pending" customLabel="DATA SUBJECT RIGHT" />
                <Text style={{ fontSize: 11, color: theme.colors.mute, fontWeight: '500' }}>
                  Google Play Policy
                </Text>
              </View>

              <Text style={{ fontSize: 12, color: theme.colors.mute, lineHeight: 18, marginBottom: spacingNumeric.sm }}>
                Under Google Play policies and statutory data privacy regulations, you have the right to request permanent account de-provisioning and personal data erasure.
              </Text>

              {/* Data Purged */}
              <View style={[styles.deletionInfoCard, { borderColor: 'rgba(220, 38, 38, 0.25)', backgroundColor: 'rgba(220, 38, 38, 0.04)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Data Permanently Purged
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.ink, lineHeight: 16 }}>
                  • Legal name, official email, and contact phone{'\n'}
                  • Authentication credentials and active sessions{'\n'}
                  • Masked Aadhaar and Driving Licence records{'\n'}
                  • Device push notification tokens{'\n'}
                  • Personal shift preferences and profile data
                </Text>
              </View>

              {/* Statutory Records Retained */}
              <View style={[styles.deletionInfoCard, { borderColor: 'rgba(217, 119, 6, 0.25)', backgroundColor: 'rgba(217, 119, 6, 0.04)', marginTop: 8 }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#d97706', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Statutory Records Retained
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.ink, lineHeight: 16 }}>
                  Under equipment safety statutes, historical machine hour meter logs (HMR), pre-shift safety checklists, and breakdown tickets are preserved in an anonymized format for auditing and regulatory insurance purposes.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 8, marginTop: spacingNumeric.md }}>
                <Button
                  label="Email Deletion Request"
                  onPress={() => {
                    const userEmail = user?.email || userProfile?.email || '';
                    const subject = encodeURIComponent(`Account Deletion Request — ${userEmail}`);
                    const body = encodeURIComponent(
                      `Please delete my Reach International user account and associated personal KYC records registered under this email address: ${userEmail}`
                    );
                    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=${subject}&body=${body}`);
                    setDeleteModalVisible(false);
                  }}
                  variant="primary"
                  size="sm"
                  icon={<Mail size={14} color="#ffffff" />}
                  fullWidth
                />

                <Button
                  label="Open Web Deletion Portal"
                  onPress={() => {
                    Linking.openURL('https://www.reachinternational.co.in/account-deletion');
                    setDeleteModalVisible(false);
                  }}
                  variant="outline"
                  size="sm"
                  icon={<ExternalLink size={14} color={theme.colors.ink} />}
                  fullWidth
                />

                <Button
                  label="Cancel"
                  onPress={() => setDeleteModalVisible(false)}
                  variant="ghost"
                  size="sm"
                  fullWidth
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingNumeric.md, paddingBottom: spacingNumeric['2xl'] },
  card: { marginVertical: spacingNumeric.xs, padding: spacingNumeric.md },
  touchCard: {
    paddingVertical: spacingNumeric.md,
  },
  cardTouchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  cardActionHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacingNumeric.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  prefSubheading: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  themeSelectorGroup: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  permissionItemRow: {
    paddingVertical: 6,
  },
  permNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  permName: {
    fontSize: 13,
    fontWeight: '600',
  },
  permDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  aboutInfoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  aboutLabel: {
    fontSize: 12,
  },
  aboutValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  legalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  legalNavText: {
    fontSize: 13,
    fontWeight: '600',
  },
  brandFooter: {
    alignItems: 'center',
    gap: 4,
    marginTop: spacingNumeric.xl,
    paddingVertical: spacingNumeric.md,
  },
  brandFooterText: {
    fontSize: 11,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 11,
    marginTop: 2,
    paddingRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingNumeric.md,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  modalProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 12,
  },
  modalAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacingNumeric.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: radiusNumeric.sm,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  legalBodyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  deletionInfoCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
});
