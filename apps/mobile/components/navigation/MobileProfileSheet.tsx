/**
 * ReachInternational Mobile — Mobile Profile Slide-Up Sheet
 * Refined Inset Grouped UI for Profile & Operational Details.
 * Displays user identity, operational shift timing, contact info, KYC credentials,
 * Edit Profile trigger, Change Password modal, and secure Sign Out.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EditProfileModal } from '../profile/EditProfileModal';
import { ReachInternationalLogo } from '../branding';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  X,
  Sun,
  Moon,
  Clock,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  FileText,
  Edit,
  LogOut,
  Building,
  KeyRound,
  Lock,
} from 'lucide-react-native';

export interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  service_manager: 'Service Manager',
  engineer: 'Service Engineer',
  service_engineer: 'Service Engineer',
  supervisor: 'Supervisor',
  store_manager: 'Store Manager',
  operator: 'Operator',
  mechanic: 'Mechanic',
  hr_manager: 'HR Manager',
};

export const MobileProfileSheet: React.FC<MobileProfileSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme, isDark, setMode } = useTheme();
  const { user, userProfile, role, signOut, refreshSession } = useAuth();
  const router = useRouter();

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Password Change Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

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
        Alert.alert('Password Updated', 'Your account password has been changed successfully.');
        setPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Reach International?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const fullName =
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'User');

  const email = user?.email || 'user@reachinternational.com';
  const roleDisplay = ROLE_LABELS[role || ''] || (role ? role.replace(/_/g, ' ').toUpperCase() : 'Operator');

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

  const baseLocation =
    [userProfile?.city, userProfile?.state].filter(Boolean).join(', ') ||
    'Corporate HQ / Base Yard';

  if (!isOpen) return null;

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderTopColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Grab Handle Bar */}
            <View style={[styles.handleBar, { backgroundColor: theme.colors.mute }]} />

            {/* Sheet Header with User Avatar, Name, Role & Controls */}
            <View
              style={[
                styles.headerRow,
                { borderBottomColor: theme.colors.hairline },
              ]}
            >
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: theme.colors.ink,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: theme.colors.canvas },
                    ]}
                  >
                    {fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.headerTextCol}>
                  <Text
                    style={[
                      styles.userName,
                      { color: theme.colors.ink },
                    ]}
                    numberOfLines={1}
                  >
                    {fullName}
                  </Text>
                  <Text
                    style={[
                      styles.userEmail,
                      { color: theme.colors.mute },
                    ]}
                    numberOfLines={1}
                  >
                    {email}
                  </Text>
                  <View style={styles.roleBadgeWrapper}>
                    <Badge status="active" customLabel={roleDisplay} />
                  </View>
                </View>
              </View>

              <View style={styles.headerRight}>
                {/* Theme Toggle Button */}
                <TouchableOpacity
                  onPress={toggleTheme}
                  style={[
                    styles.iconActionBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityLabel="Toggle Theme"
                >
                  {isDark ? (
                    <Sun size={16} color={theme.colors.warning} />
                  ) : (
                    <Moon size={16} color={theme.colors.ink} />
                  )}
                </TouchableOpacity>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.iconActionBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityLabel="Close Drawer"
                >
                  <X size={16} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Details Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              {/* SECTION 1: OPERATIONAL & SHIFT */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeaderLabel, { color: theme.colors.mute }]}>
                  OPERATIONAL & SHIFT
                </Text>

                <View
                  style={[
                    styles.groupedCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* Shift Timing Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' },
                      ]}
                    >
                      <Clock size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        SHIFT SCHEDULE
                      </Text>
                      <Text
                        style={[styles.rowValue, { color: theme.colors.ink }]}
                        numberOfLines={1}
                      >
                        {userProfile?.shift_time || 'General Shift (08:00 AM - 08:00 PM)'}
                      </Text>
                    </View>
                    <Badge status="active" customLabel="ACTIVE" />
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.colors.hairline }]} />

                  {/* Assigned Location Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' },
                      ]}
                    >
                      <Building size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        BASE YARD / LOCATION
                      </Text>
                      <Text
                        style={[styles.rowValue, { color: theme.colors.ink }]}
                        numberOfLines={1}
                      >
                        {baseLocation}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SECTION 2: CONTACT & RESIDENCE */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeaderLabel, { color: theme.colors.mute }]}>
                  CONTACT & RESIDENCE
                </Text>

                <View
                  style={[
                    styles.groupedCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* Phone Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' },
                      ]}
                    >
                      <Phone size={16} color={isDark ? '#34d399' : '#059669'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        MOBILE PHONE
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          styles.monoValue,
                          { color: theme.colors.ink },
                        ]}
                        numberOfLines={1}
                      >
                        {userProfile?.phone || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.colors.hairline }]} />

                  {/* Email Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe' },
                      ]}
                    >
                      <Mail size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        OFFICIAL EMAIL
                      </Text>
                      <Text
                        style={[styles.rowValue, { color: theme.colors.ink }]}
                        numberOfLines={1}
                      >
                        {email}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.cardDivider, { backgroundColor: theme.colors.hairline }]} />

                  {/* Address Row */}
                  <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
                    <View
                      style={[
                        styles.rowIconPill,
                        {
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                          marginTop: 2,
                        },
                      ]}
                    >
                      <MapPin size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        REGISTERED ADDRESS
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          styles.addressValue,
                          { color: theme.colors.ink },
                        ]}
                      >
                        {formattedAddress || 'No address registered'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* SECTION 3: GOVERNMENT KYC & CREDENTIALS */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeaderLabel, { color: theme.colors.mute }]}>
                  GOVERNMENT KYC & CREDENTIALS
                </Text>

                <View
                  style={[
                    styles.groupedCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* Aadhaar Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' },
                      ]}
                    >
                      <ShieldCheck size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        AADHAAR CARD (KYC)
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          styles.monoValue,
                          { color: theme.colors.ink },
                        ]}
                        numberOfLines={1}
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

                  <View style={[styles.cardDivider, { backgroundColor: theme.colors.hairline }]} />

                  {/* Licence Row */}
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.rowIconPill,
                        { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff' },
                      ]}
                    >
                      <FileText size={16} color={isDark ? '#c084fc' : '#9333ea'} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={[styles.rowLabel, { color: theme.colors.mute }]}>
                        DRIVING LICENCE
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          styles.monoValue,
                          { color: theme.colors.ink },
                        ]}
                        numberOfLines={1}
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
                </View>
              </View>

              {/* ACTION BUTTONS GROUP */}
              <View style={styles.actionsContainer}>
                {/* Primary: Edit Profile */}
                <Button
                  label="Edit Profile & Shift Details"
                  onPress={() => setEditProfileOpen(true)}
                  variant="primary"
                  size="md"
                  icon={<Edit size={15} color="#ffffff" />}
                  fullWidth
                />

                {/* Secondary: Change Password */}
                <Button
                  label="Change Account Password"
                  onPress={() => setPasswordModalOpen(true)}
                  variant="outline"
                  size="md"
                  icon={<KeyRound size={15} color={theme.colors.ink} />}
                  fullWidth
                />

                {/* Danger: Sign Out */}
                <Button
                  label="Sign out of account"
                  onPress={handleSignOut}
                  variant="danger"
                  size="md"
                  shape="pill"
                  icon={<LogOut size={15} color="#ffffff" />}
                  fullWidth
                  style={{ marginTop: 4 }}
                />
              </View>

              {/* Brand Footer */}
              <View style={styles.brandFooter}>
                <ReachInternationalLogo size={18} showTagline={false} />
                <Text style={[styles.brandFooterText, { color: theme.colors.mute }]}>
                  Reach International v1.0.0 • www.reachinternational.co.in
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal Dialog */}
      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        currentUser={userProfile}
        onSuccess={() => {
          setEditProfileOpen(false);
          if (refreshSession) refreshSession();
        }}
      />

      {/* Change Password Modal Dialog */}
      <Modal
        visible={passwordModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.passwordModalBox,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lock size={18} color={theme.colors.link} />
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                  Change Password
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPasswordModalOpen(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
              Enter a new secure password (minimum 6 characters) for your account.
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
                  setPasswordModalOpen(false);
                  setPasswordError(null);
                }}
                variant="outline"
                size="sm"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                label={isChangingPassword ? 'Saving...' : 'Update Password'}
                onPress={handleChangePassword}
                variant="primary"
                size="sm"
                disabled={isChangingPassword}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  handleBar: {
    width: 46,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
    opacity: 0.4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '800',
  },
  headerTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 11.5,
    marginTop: 1,
  },
  roleBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.md,
    paddingBottom: 36,
    gap: spacingNumeric.md,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  groupedCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIconPill: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  monoValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  addressValue: {
    lineHeight: 18,
    fontWeight: '500',
    fontSize: 12.5,
  },
  cardDivider: {
    height: 1,
    marginLeft: 58,
  },
  actionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  brandFooterText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  passwordModalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacingNumeric.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11.5,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacingNumeric.md,
  },
});
