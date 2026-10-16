/**
 * ReachInternational Mobile — In-App Forgot Password Screen
 * Route: /settings/account/forgot-password
 * 
 * Allows authenticated personnel to trigger password recovery for their account.
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
} from '../../../../components/ui';
import {
  SettingsScreenContainer,
  SettingsSection,
} from '../../../../components/settings';
import { supabase } from '../../../../lib/supabase';
import { getAppUrl } from '../../../../lib/env';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from '../../../../components/ui/icon';
import { haptics } from '../../../../lib/haptics';

export default function AccountForgotPasswordScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const userEmail = user?.email || userProfile?.email || '';
  const [email, setEmail] = useState(userEmail);
  const [fieldError, setFieldError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handleBack = () => {
    router.replace('/settings/account');
  };

  const handleSendReset = async () => {
    if (isSubmittingRef.current || isLoading) return;

    setFieldError('');
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      haptics.reject();
      setFieldError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      haptics.reject();
      setFieldError('Please enter a valid email address.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      haptics.select();
      // Try backend endpoint first
      const response = await fetch(`${getAppUrl()}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json().catch(() => ({}));
        haptics.confirm();
        setSuccessMessage(data.message || 'Password reset instructions have been sent to your email.');
        toast('success', 'Reset Link Sent', 'Password reset instructions have been sent.');
      } else {
        // Fallback directly to Supabase Auth
        const { error: sbError } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
        if (sbError) {
          haptics.reject();
          setFieldError(sbError.message || 'Unable to send reset instructions.');
          toast('error', 'Reset Failed', sbError.message || 'Unable to send reset email.');
        } else {
          haptics.confirm();
          setSuccessMessage('Password reset instructions have been sent to your email.');
          toast('success', 'Reset Link Sent', 'Password reset instructions have been sent.');
        }
      }
    } catch (err: any) {
      haptics.reject();
      setFieldError(err?.message || 'Failed to send reset instructions. Check connection.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <SettingsScreenContainer
      title="Forgot Password"
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

      {fieldError ? (
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
            {fieldError}
          </Text>
        </View>
      ) : null}

      {/* Form Card */}
      <SettingsSection
        title="Password Recovery"
        description="Enter your registered work email to receive a secure password reset link."
      >
        <View style={styles.formPadding}>
          <View style={styles.fieldGroup}>
            <Text variant="label" style={{ color: theme.colors.ink }}>
              Account Email
            </Text>
            <Input
              placeholder="user@reachinternational.co.in"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setFieldError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={fieldError}
              leftIcon={<Mail size={16} color={theme.colors.mute} />}
            />
          </View>

          <Button
            label={isLoading ? 'Sending Reset Instructions...' : 'Send Reset Link'}
            onPress={handleSendReset}
            disabled={isLoading || !email.trim()}
            variant="primary"
            shape="pill"
            icon={
              isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <KeyRound size={16} color="#ffffff" />
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
  formPadding: {
    padding: 14,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
});
