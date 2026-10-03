/**
 * Reach International Mobile — Forgot Password Screen
 * Exact 100% replication of the Web Mobile Viewport Reset Password UI/UX.
 * Complete touch optimization (min 44px touch targets, active state opacity,
 * tactile haptic feedback via expo-haptics) and full Supabase password recovery lifecycle parity.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, ArrowRight, KeyRound, Moon, Sun } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getAppUrl } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { Input, Alert, useTheme } from '../../components/ui';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();
  const { width, height } = useWindowDimensions();

  // Responsive Breakpoints: Mobile (<=640px), Tablet (641px–1023px), Desktop (>=1024px)
  const isDesktop = width >= 1024;
  const isTablet = width >= 641 && width < 1024;
  const isShortScreen = height < 740;
  const isTinyScreen = width < 360;

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldError) setFieldError('');
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const handleNavigateBack = () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace('/(auth)/login');
  };

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode(isDark ? 'light' : 'dark');
  };

  const handleReset = async () => {
    if (isSubmittingRef.current || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setErrorMessage('');
    setSuccessMessage('');
    setFieldError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFieldError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail.toLowerCase())) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFieldError('Please enter a valid email address.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      // 1. Try unified backend endpoint which verifies approval and active status
      const response = await fetch(`${getAppUrl()}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        // Fallback directly to Supabase Auth if endpoint failed due to network / local proxy
        if (!response.ok && response.status >= 500) {
          const { error: sbError } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
          if (sbError) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setErrorMessage(sbError.message || 'No account found with this email address.');
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setSuccessMessage('Password reset instructions have been sent to your email.');
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMessage(data.error || 'No account found with this email address.');
        if (data.fieldErrors?.email) {
          setFieldError(data.fieldErrors.email);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setSuccessMessage(data.message || 'Password reset instructions have been sent to your email.');
      }
    } catch (err: unknown) {
      // Offline / Network fallback
      try {
        const { error: sbError } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
        if (sbError) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setErrorMessage('Failed to send reset email. Please check your internet connection.');
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setSuccessMessage('Password reset instructions have been sent to your email.');
        }
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMessage('Failed to send reset email. Please check your connection and try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: canvasBackground }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior="padding"
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: isDesktop
                ? 32
                : isTablet
                ? 32
                : isTinyScreen
                ? 12
                : 16,
              paddingVertical: isShortScreen ? 14 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Spacer for balanced vertical distribution */}
          <View
            style={[
              styles.topSpacer,
              { height: isShortScreen ? 4 : isDesktop ? 16 : 12 },
            ]}
          />

          {/* Centered Floating Authentication Card */}
          <View style={styles.centerContainer}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                  maxWidth: isDesktop ? 460 : isTablet ? 480 : 420,
                  paddingHorizontal: isDesktop
                    ? 28
                    : isTablet
                    ? 32
                    : isTinyScreen
                    ? 16
                    : 22,
                  paddingTop: isShortScreen ? 20 : 28,
                  paddingBottom: isShortScreen ? 18 : 24,
                },
              ]}
            >
              {/* Back to Sign In Link */}
              <TouchableOpacity
                onPress={handleNavigateBack}
                style={styles.backRow}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={14} color={isDark ? '#a1a1aa' : '#64748b'} />
                <Text style={[styles.backText, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  Back to sign in
                </Text>
              </TouchableOpacity>

              {/* Key Icon Badge */}
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(2, 132, 199, 0.10)',
                    borderColor: isDark ? 'rgba(14, 165, 233, 0.25)' : 'rgba(2, 132, 199, 0.20)',
                  },
                ]}
              >
                <KeyRound size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
              </View>

              {/* Title & Subtitle */}
              <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                Reset password
              </Text>
              <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                Enter your work email address and we&rsquo;ll send you a password reset link.
              </Text>

              {/* Global Error Banner */}
              {errorMessage && !fieldError ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="error">{errorMessage}</Alert>
                </View>
              ) : null}

              {/* Global Success Banner */}
              {successMessage ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="success">{successMessage}</Alert>
                </View>
              ) : null}

              {/* Form Controls */}
              <View style={styles.form}>
                {/* Email Address Field */}
                <Input
                  label="Email address"
                  required
                  placeholder="user@reachinternational.co.in"
                  value={email}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  error={fieldError}
                  leftIcon={<Mail size={16} color={isDark ? '#9ca3af' : '#626970'} />}
                />

                {/* Send Reset Link CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { backgroundColor: primarySkyBlue },
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleReset}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.submitButtonText}>Send Reset Link</Text>
                      <ArrowRight size={16} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Card Footer: Return to Login */}
              <View style={[styles.cardFooter, { borderTopColor: isDark ? '#262626' : '#f1f5f9' }]}>
                <Text style={[styles.cardFooterText, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  Remember your password?
                </Text>
                <TouchableOpacity
                  onPress={handleNavigateBack}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.loginLinkText, { color: primarySkyBlue }]}>
                    Sign in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bottom Screen Copyright Footer */}
          <View style={styles.screenFooter}>
            <Text
              style={[
                styles.copyrightText,
                { color: isDark ? '#737373' : '#888888' },
              ]}
            >
              &copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.
            </Text>
          </View>
        </ScrollView>

        {/* Floating Theme Switcher Widget in Bottom-Right matching Web mobile viewport */}
        <TouchableOpacity
          style={[
            styles.floatingThemeBtn,
            {
              backgroundColor: isDark ? '#27272a' : '#18181b',
              borderColor: isDark ? '#3f3f46' : '#27272a',
            },
          ]}
          onPress={handleToggleTheme}
          activeOpacity={0.8}
          accessibilityLabel="Toggle Theme"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isDark ? (
            <Sun size={17} color="#fbbf24" strokeWidth={2.2} />
          ) : (
            <Moon size={17} color="#f4f4f5" strokeWidth={2.2} />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  topSpacer: {
    height: 12,
  },
  centerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    minHeight: 32,
  },
  backText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 6,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
    textAlign: 'left',
  },
  bannerContainer: {
    marginBottom: 16,
  },
  form: {
    width: '100%',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 6,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardFooter: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardFooterText: {
    fontSize: 13,
  },
  loginLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  screenFooter: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyrightText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  floatingThemeBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
