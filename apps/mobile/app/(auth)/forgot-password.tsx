/**
 * Reach International Mobile — Forgot Password Screen
 * Exact 100% replication of the Web Mobile Viewport Reset Password UI/UX.
 * Complete touch optimization (min 44px touch targets, active state opacity,
 * tactile haptic feedback via expo-haptics) and full Supabase password recovery lifecycle parity.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, ArrowRight, KeyRound, Moon, Sun } from '../../components/ui/icon';
import { getAppUrl } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { Input, useTheme, Text, useToast } from '../../components/ui';
import { Pressable } from '../../components/ui/touch/Pressable';
import { haptics } from '../../lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();
  const { toast } = useToast();
  const { width, height } = useWindowDimensions();

  // Responsive Breakpoints: Mobile (<=640px), Tablet (641px–1023px), Desktop (>=1024px)
  const isDesktop = width >= 1024;
  const isTablet = width >= 641 && width < 1024;
  const isShortScreen = height < 740;
  const isTinyScreen = width < 360;

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldError) setFieldError('');
  };

  const handleNavigateBack = () => {
    haptics.select();
    router.replace('/(auth)/login');
  };

  const handleToggleTheme = () => {
    haptics.light();
    setMode(isDark ? 'light' : 'dark');
  };

  const handleReset = async () => {
    if (isSubmittingRef.current || isLoading) return;

    haptics.light();
    setFieldError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      haptics.reject();
      setFieldError('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail.toLowerCase())) {
      haptics.reject();
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
            haptics.reject();
            toast('error', 'Reset Failed', sbError.message || 'No account found with this email address.');
            return;
          }
          haptics.confirm();
          toast('success', 'Reset Link Sent', 'Password reset instructions have been sent to your email.');
          return;
        }

        haptics.reject();
        toast('error', 'Reset Failed', data.error || 'No account found with this email address.');
        if (data.fieldErrors?.email) {
          setFieldError(data.fieldErrors.email);
        }
      } else {
        haptics.confirm();
        toast('success', 'Reset Link Sent', data.message || 'Password reset instructions have been sent to your email.');
      }
    } catch (err: unknown) {
      // Offline / Network fallback
      try {
        const { error: sbError } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
        if (sbError) {
          haptics.reject();
          toast('error', 'Reset Failed', 'Failed to send reset email. Please check your internet connection.');
        } else {
          haptics.confirm();
          toast('success', 'Reset Link Sent', 'Password reset instructions have been sent to your email.');
        }
      } catch {
        haptics.reject();
        toast('error', 'Reset Failed', 'Failed to send reset email. Please check your connection and try again.');
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
              <Pressable
                variant="plain"
                haptic="select"
                hitSlopToMin48={true}
                onPress={handleNavigateBack}
                style={styles.backRow}
              >
                <ArrowLeft size={14} color={isDark ? '#a1a1aa' : '#64748b'} />
                <Text style={[styles.backText, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  Back to sign in
                </Text>
              </Pressable>

              {/* Key Icon Badge */}
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe',
                    borderColor: isDark ? '#0284c7' : '#bae6fd',
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
                <Pressable
                  variant="buttonPrimary"
                  haptic={false}
                  style={[
                    styles.submitButton,
                    { backgroundColor: primarySkyBlue },
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleReset}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.submitButtonText}>Send Reset Link</Text>
                      <ArrowRight size={16} color="#ffffff" />
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Card Footer: Return to Login */}
              <View style={[styles.cardFooter, { borderTopColor: isDark ? '#262626' : '#f1f5f9' }]}>
                <Text style={[styles.cardFooterText, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  Remember your password?
                </Text>
                <Pressable
                  variant="plain"
                  haptic="select"
                  hitSlopToMin48={true}
                  onPress={handleNavigateBack}
                >
                  <Text style={[styles.loginLinkText, { color: primarySkyBlue }]}>
                    Sign in
                  </Text>
                </Pressable>
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
        <Pressable
          variant="iconButton"
          haptic="tap"
          hitSlopToMin48={true}
          style={[
            styles.floatingThemeBtn,
            {
              backgroundColor: isDark ? '#27272a' : '#18181b',
              borderColor: isDark ? '#3f3f46' : '#27272a',
            },
          ]}
          onPress={handleToggleTheme}
          accessibilityLabel="Toggle Theme"
        >
          {isDark ? (
            <Sun size={17} color="#fbbf24" strokeWidth={2.2} />
          ) : (
            <Moon size={17} color="#f4f4f5" strokeWidth={2.2} />
          )}
        </Pressable>
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
    marginBottom: 6,
    textAlign: 'left',
  },
  subtitle: {
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
  },
  loginLinkText: {
  },
  screenFooter: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyrightText: {
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
