/**
 * ReachInternational Mobile — Account & Security Settings Sub-Page
 * Route: /settings/account & /setting/account
 * Provides profile overview, secure password update, session security telemetry,
 * and DPDP Act 2023 compliant account deletion dispatch.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Card,
  Badge,
  Button,
  Input,
  useTheme,
  MobileHeader,
} from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  User,
  KeyRound,
  Shield,
  ShieldCheck,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Lock,
} from 'lucide-react-native';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, role, userProfile, refreshSession } = useAuth();
  const { theme, isDark } = useTheme();

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>\-_+=\[\]]/.test(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const strengthScore = (() => {
    if (!newPassword) return 0;
    if (newPassword.length < 8) return 1;
    let count = 0;
    if (hasUpper) count++;
    if (hasLower) count++;
    if (hasDigit) count++;
    if (hasSymbol) count++;

    if (count >= 4) return 3;
    if (count >= 2 && hasUpper && hasLower && hasDigit) return 2;
    return 1;
  })();

  const strengthMeta = {
    0: { label: '', color: '#94a3b8' },
    1: { label: 'Weak', color: '#e11d48' },
    2: { label: 'Medium', color: '#d97706' },
    3: { label: 'Strong', color: '#059669' },
  }[strengthScore];

  const isFormValid =
    Boolean(currentPassword) &&
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasDigit &&
    passwordsMatch;

  const displayName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayEmail = userProfile?.email || user?.email || '';
  const displayPhone = userProfile?.phone || 'Not configured';
  const displayCity = userProfile?.city ? `${userProfile.city}, ${userProfile?.state || ''}` : 'India';
  const roleLabel = (role || userProfile?.role || 'OPERATOR').toUpperCase().replace(/_/g, ' ');

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!hasMinLength) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (!hasUpper || !hasLower || !hasDigit) {
      setPasswordError('New password must contain an uppercase letter, a lowercase letter, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify.');
      return;
    }

    setIsChangingPassword(true);
    try {
      Haptics.selectionAsync().catch(() => {});
      const email = user?.email || userProfile?.email;
      if (email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (signInError) {
          setPasswordError('Current password is incorrect. Please check and try again.');
          setIsChangingPassword(false);
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPasswordSuccess('Your password has been changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (refreshSession) await refreshSession();
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Edge-to-edge Top Header */}
      <MobileHeader
        title="Account"
        showBack={true}
        onPressBack={() => router.push('/(app)/settings' as any)}
        showQuickAccess={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* CARD 1: PROFILE SUMMARY & IDENTITY */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.profileHeaderRow}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: theme.colors.ink,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.colors.canvas }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.profileName, { color: theme.colors.ink }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Badge status="active" customLabel={roleLabel} />
              </View>
              <Text style={[styles.profileEmail, { color: theme.colors.mute }]} numberOfLines={1}>
                {displayEmail}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.infoGrid}>
            <View style={styles.infoLine}>
              <Phone size={14} color={theme.colors.mute} />
              <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: theme.colors.ink }]}>{displayPhone}</Text>
            </View>

            <View style={styles.infoLine}>
              <MapPin size={14} color={theme.colors.mute} />
              <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Location</Text>
              <Text style={[styles.infoValue, { color: theme.colors.ink }]}>{displayCity}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.profileEditAction,
              {
                borderColor: theme.colors.hairline,
                backgroundColor: theme.colors.canvas,
              },
            ]}
            onPress={() => router.push('/(app)/profile' as any)}
            activeOpacity={0.8}
          >
            <User size={14} color={theme.colors.link} />
            <Text style={[styles.profileEditText, { color: theme.colors.link }]}>
              View & Edit Full Personnel Profile
            </Text>
            <ChevronRight size={14} color={theme.colors.link} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 2: CHANGE PASSWORD */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' }]}>
              <KeyRound size={17} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>CHANGE PASSWORD</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Ensure your account is protected with a secure password
              </Text>
            </View>
          </View>

          {passwordSuccess && (
            <View style={[styles.feedbackBanner, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5', borderColor: '#059669' }]}>
              <CheckCircle2 size={16} color="#059669" />
              <Text style={[styles.feedbackText, { color: isDark ? '#34d399' : '#047857' }]}>
                {passwordSuccess}
              </Text>
            </View>
          )}

          {passwordError && (
            <View style={[styles.feedbackBanner, { backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : '#fff1f2', borderColor: '#e11d48' }]}>
              <AlertCircle size={16} color="#e11d48" />
              <Text style={[styles.feedbackText, { color: isDark ? '#fb7185' : '#be123c' }]}>
                {passwordError}
              </Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Current Password</Text>
            <View style={styles.passwordInputContainer}>
              <Input
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  setPasswordError(null);
                }}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showCurrentPassword ? (
                  <EyeOff size={18} color={theme.colors.mute} />
                ) : (
                  <Eye size={18} color={theme.colors.mute} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>New Password</Text>
            <View style={styles.passwordInputContainer}>
              <Input
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  setPasswordError(null);
                }}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowNewPassword(!showNewPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showNewPassword ? (
                  <EyeOff size={18} color={theme.colors.mute} />
                ) : (
                  <Eye size={18} color={theme.colors.mute} />
                )}
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            strengthScore >= level
                              ? strengthMeta.color
                              : theme.colors.hairline,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthMeta.color }]}>
                  {strengthMeta.label}
                </Text>
              </View>
            )}

            {/* Criteria Checklist */}
            <View style={styles.checklistGrid}>
              <View style={styles.checkItem}>
                <CheckCircle2
                  size={12}
                  color={hasMinLength ? '#059669' : theme.colors.mute}
                />
                <Text
                  style={[
                    styles.checkText,
                    { color: hasMinLength ? theme.colors.ink : theme.colors.mute },
                  ]}
                >
                  8+ characters
                </Text>
              </View>
              <View style={styles.checkItem}>
                <CheckCircle2
                  size={12}
                  color={hasUpper && hasLower ? '#059669' : theme.colors.mute}
                />
                <Text
                  style={[
                    styles.checkText,
                    { color: hasUpper && hasLower ? theme.colors.ink : theme.colors.mute },
                  ]}
                >
                  Upper & lower case
                </Text>
              </View>
              <View style={styles.checkItem}>
                <CheckCircle2
                  size={12}
                  color={hasDigit ? '#059669' : theme.colors.mute}
                />
                <Text
                  style={[
                    styles.checkText,
                    { color: hasDigit ? theme.colors.ink : theme.colors.mute },
                  ]}
                >
                  At least 1 number
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Confirm New Password</Text>
            <View style={styles.passwordInputContainer}>
              <Input
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setPasswordError(null);
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} color={theme.colors.mute} />
                ) : (
                  <Eye size={18} color={theme.colors.mute} />
                )}
              </TouchableOpacity>
            </View>

            {confirmPassword.length > 0 && (
              <Text
                style={[
                  styles.matchText,
                  { color: passwordsMatch ? '#059669' : '#e11d48' },
                ]}
              >
                {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </Text>
            )}
          </View>

          <Button
            label={isChangingPassword ? 'Updating Password...' : 'Update Password'}
            onPress={handleUpdatePassword}
            disabled={!isFormValid || isChangingPassword}
            variant="primary"
            shape="pill"
            icon={isChangingPassword ? <ActivityIndicator size="small" color="#ffffff" /> : <Lock size={15} color="#ffffff" />}
            fullWidth
            style={{ marginTop: spacingNumeric.sm }}
          />
        </Card>

        {/* ========================================================================= */}
        {/* CARD 3: SECURITY & SESSION TELEMETRY */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5' }]}>
              <ShieldCheck size={17} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>SESSION SECURITY</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Hardware security and cryptographic protocols
              </Text>
            </View>
          </View>

          <View style={styles.securityRow}>
            <Text style={[styles.securityLabel, { color: theme.colors.mute }]}>Auth Protocol</Text>
            <Text style={[styles.securityValue, { color: theme.colors.ink }]}>Supabase JWT (HS256 / Ed25519)</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.securityRow}>
            <Text style={[styles.securityLabel, { color: theme.colors.mute }]}>Transport Encryption</Text>
            <Text style={[styles.securityValue, { color: theme.colors.ink }]}>TLS 1.3 Strict End-to-End</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.securityRow}>
            <Text style={[styles.securityLabel, { color: theme.colors.mute }]}>Data at Rest</Text>
            <Text style={[styles.securityValue, { color: theme.colors.ink }]}>AES-256 Cloud Infrastructure</Text>
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 4: DANGER ZONE & ACCOUNT DELETION */}
        {/* ========================================================================= */}
        <Card
          variant="elevated"
          style={[
            styles.card,
            styles.dangerCard,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.06)' : '#fef2f2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fecaca',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(225, 29, 72, 0.2)' : '#fee2e2' }]}>
              <Trash2 size={17} color="#e11d48" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: '#b91c1c' }]}>DANGER ZONE</Text>
              <Text style={[styles.sectionSubtitle, { color: isDark ? '#f87171' : '#991b1b' }]}>
                Permanent erasure of account and telemetry logs
              </Text>
            </View>
          </View>

          <Text style={[styles.dangerDesc, { color: isDark ? '#fca5a5' : '#7f1d1d' }]}>
            Under the Digital Personal Data Protection (DPDP) Act 2023, you can initiate a verified request to permanently erase your profile, device identifiers, and credentials.
          </Text>

          <Button
            label="Request Account Deletion"
            onPress={() => router.push('/(app)/account-deletion' as any)}
            variant="danger"
            shape="pill"
            icon={<Trash2 size={14} color="#ffffff" />}
            fullWidth
            style={{ marginTop: spacingNumeric.sm }}
          />
        </Card>
      </ScrollView>
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
  card: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  infoGrid: {
    gap: 10,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12.5,
    width: 70,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  profileEditAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: 4,
  },
  profileEditText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
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
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  passwordInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  strengthBarsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: 4,
  },
  strengthBar: {
    flex: 1,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkText: {
    fontSize: 11,
    fontWeight: '500',
  },
  matchText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  securityLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  securityValue: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  dangerCard: {
    borderWidth: 1,
  },
  dangerDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
});
