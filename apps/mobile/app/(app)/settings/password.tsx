/**
 * ReachInternational Mobile — Dedicated Change Password Sub-Page
 * Route: /settings/password
 * 
 * Secure credential update interface with real-time complexity evaluation,
 * reauthentication verification via Supabase Auth, and immediate feedback.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Button,
  Input,
  useTheme,
  Text,
} from '../../../components/ui';
import {
  SettingsScreenContainer,
  SettingsSection,
} from '../../../components/settings';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { supabase } from '../../../lib/supabase';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, userProfile, refreshSession } = useAuth();
  const { theme, isDark } = useTheme();

  // Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Real-time Complexity Criteria
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

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      haptics.reject();
      return;
    }
    if (!hasMinLength) {
      setPasswordError('New password must be at least 8 characters long.');
      haptics.reject();
      return;
    }
    if (!hasUpper || !hasLower || !hasDigit) {
      setPasswordError('New password must contain an uppercase letter, a lowercase letter, and a number.');
      haptics.reject();
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify.');
      haptics.reject();
      return;
    }

    setIsUpdating(true);
    try {
      haptics.select();
      const email = user?.email || userProfile?.email;
      if (email) {
        // Reauthenticate with current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (signInError) {
          setPasswordError('Current password is incorrect. Please verify and try again.');
          haptics.reject();
          setIsUpdating(false);
          return;
        }
      }

      // Update password via Supabase Auth
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
        haptics.reject();
      } else {
        haptics.confirm();
        setPasswordSuccess('Your password has been changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (refreshSession) await refreshSession();
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred.');
      haptics.reject();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SettingsScreenContainer
      title="Change Password"
      showBack={true}
      onPressBack={() => router.back()}
    >
      {/* Banner Feedback */}
      {passwordSuccess ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : '#ecfdf5',
              borderColor: '#059669',
            },
          ]}
        >
          <CheckCircle2 size={18} color="#059669" />
          <Text
            variant="label"
            style={{ color: isDark ? '#34d399' : '#047857', flex: 1 }}
          >
            {passwordSuccess}
          </Text>
        </View>
      ) : null}

      {passwordError ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : '#fff1f2',
              borderColor: '#e11d48',
            },
          ]}
        >
          <AlertCircle size={18} color="#e11d48" />
          <Text
            variant="label"
            style={{ color: isDark ? '#fb7185' : '#be123c', flex: 1 }}
          >
            {passwordError}
          </Text>
        </View>
      ) : null}

      {/* Main Password Form Card */}
      <SettingsSection>
        <View style={styles.formPadding}>
          {/* Current Password Field */}
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              Current Password
            </Text>
            <Input
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setPasswordError(null);
              }}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
              rightIcon={
                <Pressable
                  variant="iconButton"
                  hitSlopToMin48
                  style={styles.eyeBtn}
                  onPress={() => {
                    haptics.select();
                    setShowCurrentPassword(!showCurrentPassword);
                  }}
                  accessibilityLabel="Toggle current password visibility"
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} color={theme.colors.mute} />
                  ) : (
                    <Eye size={18} color={theme.colors.mute} />
                  )}
                </Pressable>
              }
            />
          </View>

          {/* New Password Field */}
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              New Password
            </Text>
            <Input
              placeholder="At least 8 characters"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError(null);
              }}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              rightIcon={
                <Pressable
                  variant="iconButton"
                  hitSlopToMin48
                  style={styles.eyeBtn}
                  onPress={() => {
                    haptics.select();
                    setShowNewPassword(!showNewPassword);
                  }}
                  accessibilityLabel="Toggle new password visibility"
                >
                  {showNewPassword ? (
                    <EyeOff size={18} color={theme.colors.mute} />
                  ) : (
                    <Eye size={18} color={theme.colors.mute} />
                  )}
                </Pressable>
              }
            />

            {/* Complexity Strength Bar Indicator */}
            {newPassword.length > 0 ? (
              <View style={styles.strengthBox}>
                <View style={styles.strengthBarsRow}>
                  {[1, 2, 3].map((lvl) => (
                    <View
                      key={lvl}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            strengthScore >= lvl
                              ? strengthMeta.color
                              : theme.colors.hairline,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text variant="caption" style={{ color: strengthMeta.color }}>
                  Strength: {strengthMeta.label}
                </Text>
              </View>
            ) : null}

            {/* Requirements Checklist */}
            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <CheckCircle2
                  size={14}
                  color={hasMinLength ? '#059669' : theme.colors.mute}
                />
                <Text
                  variant="caption"
                  style={{ color: hasMinLength ? theme.colors.ink : theme.colors.mute }}
                >
                  8+ characters
                </Text>
              </View>

              <View style={styles.checkItem}>
                <CheckCircle2
                  size={14}
                  color={hasUpper && hasLower ? '#059669' : theme.colors.mute}
                />
                <Text
                  variant="caption"
                  style={{ color: hasUpper && hasLower ? theme.colors.ink : theme.colors.mute }}
                >
                  Upper & lowercase letters
                </Text>
              </View>

              <View style={styles.checkItem}>
                <CheckCircle2
                  size={14}
                  color={hasDigit ? '#059669' : theme.colors.mute}
                />
                <Text
                  variant="caption"
                  style={{ color: hasDigit ? theme.colors.ink : theme.colors.mute }}
                >
                  At least 1 number
                </Text>
              </View>

              <View style={styles.checkItem}>
                <CheckCircle2
                  size={14}
                  color={hasSymbol ? '#059669' : theme.colors.mute}
                />
                <Text
                  variant="caption"
                  style={{ color: hasSymbol ? theme.colors.ink : theme.colors.mute }}
                >
                  Special character (!@#$)
                </Text>
              </View>
            </View>
          </View>

          {/* Confirm Password Field */}
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              Confirm New Password
            </Text>
            <Input
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setPasswordError(null);
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              rightIcon={
                <Pressable
                  variant="iconButton"
                  hitSlopToMin48
                  style={styles.eyeBtn}
                  onPress={() => {
                    haptics.select();
                    setShowConfirmPassword(!showConfirmPassword);
                  }}
                  accessibilityLabel="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={theme.colors.mute} />
                  ) : (
                    <Eye size={18} color={theme.colors.mute} />
                  )}
                </Pressable>
              }
            />

            {confirmPassword.length > 0 ? (
              <Text
                variant="caption"
                style={{ color: passwordsMatch ? '#059669' : '#e11d48' }}
              >
                {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </Text>
            ) : null}
          </View>

          {/* Submit Action */}
          <Button
            label={isUpdating ? 'Updating Credentials...' : 'Update Password'}
            onPress={handleUpdatePassword}
            disabled={!isFormValid || isUpdating}
            variant="primary"
            shape="pill"
            icon={
              isUpdating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Lock size={15} color="#ffffff" />
              )
            }
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      </SettingsSection>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  formPadding: {
    padding: 14,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 4,
    width: 120,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  checklist: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '45%',
  },
});
