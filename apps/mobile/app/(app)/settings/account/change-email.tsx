/**
 * ReachInternational Mobile — Change Email Screen
 * Route: /settings/account/change-email
 * 
 * Allows authenticated personnel to request an email update with
 * password reauthentication and Supabase email verification.
 */

import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../lib/auth/useAuth';
import {
  Button,
  Input,
  useTheme,
  Text,
  useToast,
  Badge,
} from '../../../../components/ui';
import {
  SettingsScreenContainer,
  SettingsSection,
} from '../../../../components/settings';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { supabase } from '../../../../lib/supabase';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from '../../../../components/ui/icon';
import { haptics } from '../../../../lib/haptics';

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user, userProfile, refreshSession } = useAuth();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const currentEmail = user?.email || userProfile?.email || '';

  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handleBack = () => {
    router.replace('/settings/account');
  };

  const handleUpdateEmail = async () => {
    if (isSubmittingRef.current || isLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedNew = newEmail.trim().toLowerCase();
    if (!trimmedNew) {
      haptics.reject();
      setErrorMessage('New email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedNew)) {
      haptics.reject();
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (trimmedNew === currentEmail.toLowerCase()) {
      haptics.reject();
      setErrorMessage('New email address must be different from your current email.');
      return;
    }

    if (!password) {
      haptics.reject();
      setErrorMessage('Please enter your current password to authorize this change.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      haptics.select();

      // 1. Reauthenticate current password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });

      if (authError) {
        haptics.reject();
        setErrorMessage('Current password is incorrect. Please verify and try again.');
        setIsLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      // 2. Request email update via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmedNew,
      });

      if (updateError) {
        haptics.reject();
        setErrorMessage(updateError.message || 'Failed to update email address.');
        toast('error', 'Update Failed', updateError.message || 'Failed to update email.');
      } else {
        haptics.confirm();
        setSuccessMessage(
          `Confirmation email dispatched to ${trimmedNew}. Please check your inbox and verify the link to activate your new address.`
        );
        toast('success', 'Confirmation Sent', 'Please check your new email to confirm.');
        setNewEmail('');
        setPassword('');
        if (refreshSession) await refreshSession();
      }
    } catch (err: any) {
      haptics.reject();
      setErrorMessage(err?.message || 'An unexpected error occurred while updating email.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <SettingsScreenContainer
      title="Change Email"
      showBack={true}
      backRoute="/settings/account"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* Banner Feedback */}
      {successMessage ? (
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
            {successMessage}
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
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
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Current Email Status Card */}
      <View
        style={[
          styles.currentEmailCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.currentEmailRow}>
          <ShieldCheck size={20} color="#059669" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Current Verified Email
            </Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }} numberOfLines={1}>
              {currentEmail || 'Not Available'}
            </Text>
          </View>
          <Badge status="active" customLabel="ACTIVE" />
        </View>
      </View>

      {/* Email Update Form */}
      <SettingsSection
        title="New Email Credentials"
        description="Enter your new work email and authenticate with your current password."
      >
        <View style={styles.formPadding}>
          {/* New Email Input */}
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              New Email Address
            </Text>
            <Input
              placeholder="new.email@reachinternational.co.in"
              value={newEmail}
              onChangeText={(text) => {
                setNewEmail(text);
                setErrorMessage(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              leftIcon={<Mail size={16} color={theme.colors.mute} />}
            />
          </View>

          {/* Current Password Input */}
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              Current Password
            </Text>
            <Input
              placeholder="Enter current password to authorize"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrorMessage(null);
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              rightIcon={
                <Pressable
                  variant="iconButton"
                  hitSlopToMin48
                  style={styles.eyeBtn}
                  onPress={() => {
                    haptics.select();
                    setShowPassword(!showPassword);
                  }}
                  accessibilityLabel="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff size={18} color={theme.colors.mute} />
                  ) : (
                    <Eye size={18} color={theme.colors.mute} />
                  )}
                </Pressable>
              }
            />
          </View>

          <Button
            label={isLoading ? 'Requesting Email Change...' : 'Update Email Address'}
            onPress={handleUpdateEmail}
            disabled={isLoading || !newEmail.trim() || !password}
            variant="primary"
            shape="pill"
            icon={
              isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Mail size={16} color="#ffffff" />
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
  containerContent: {
    gap: 12,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  currentEmailCard: {
    padding: 14,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  currentEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
});
