/**
 * Reach International Mobile — Login Screen
 * Exact replication of the Web Mobile Viewport Login UI/UX.
 * Production-ready with native keyboard management, safe areas, theme adaptation,
 * haptic feedback, validation, and full Supabase authentication lifecycle parity.
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
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Mail, Lock, Check, Moon, Sun } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Input, Alert, useTheme } from '../../components/ui';
import { ReachInternationalLogo } from '../../components/branding/ReachInternationalLogo';

export default function LoginScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const triggerHapticFeedback = () => {
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(12);
      } catch {
        // Safe fallback if vibration is unavailable
      }
    }
  };

  const handleLogin = async () => {
    if (isSubmittingRef.current || isLoading) return;

    triggerHapticFeedback();
    setErrorMessage('');

    // Field-level validation matching Web client
    const newFieldErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newFieldErrors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail.toLowerCase())) {
        newFieldErrors.email = 'Please enter a valid email address.';
      }
    }

    if (!password) {
      newFieldErrors.password = 'Password is required.';
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        const errorLower = error.message.toLowerCase();
        if (errorLower.includes('email not confirmed')) {
          setErrorMessage(
            'Your email is not confirmed yet. Please wait for an administrator to approve your account.'
          );
        } else if (
          errorLower.includes('invalid login credentials') ||
          errorLower.includes('invalid_grant') ||
          errorLower.includes('invalid credentials')
        ) {
          setErrorMessage('Invalid email or password.');
          setFieldErrors({
            email: 'Invalid email or password.',
            password: 'Invalid email or password.',
          });
        } else if (errorLower.includes('network') || errorLower.includes('fetch')) {
          setErrorMessage('Network connection error. Please check your internet connection.');
        } else {
          setErrorMessage(error.message || 'An error occurred while signing in.');
        }
        isSubmittingRef.current = false;
        setIsLoading(false);
        return;
      }

      if (data?.session && data.user) {
        // Check user profile from database matching Web auth.ts logic
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role, status, complete_profile')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          setErrorMessage('User profile not found. Contact your administrator.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        if (profile.status === 'inactive') {
          await supabase.auth.signOut();
          setErrorMessage('Your account has been deactivated. Contact your administrator.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        if (profile.status === 'pending') {
          await supabase.auth.signOut();
          setErrorMessage(
            'Your account is pending approval. Please wait for an administrator to approve your account.'
          );
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        // Routing based on onboarding and role
        if (profile.complete_profile !== 'yes') {
          router.replace('/(auth)/onboarding');
        } else if (profile.role === 'operator') {
          router.replace('/(app)/operations');
        } else {
          router.replace('/(app)/machines');
        }
      }
    } catch (err: unknown) {
      setErrorMessage('An unexpected error occurred during login. Please try again.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const primarySkyBlue = '#0ea5e9';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: canvasBackground }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Content Area */}
          <View style={styles.centerContainer}>
            {/* Centered Floating Authentication Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              {/* Brand Logo Centered */}
              <View style={styles.logoContainer}>
                <ReachInternationalLogo size={28} />
              </View>

              {/* Card Title */}
              <Text style={[styles.title, { color: theme.colors.ink }]}>
                Welcome back
              </Text>

              {/* Global Error Banner */}
              {errorMessage && Object.keys(fieldErrors).length === 0 ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="error">{errorMessage}</Alert>
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
                  error={fieldErrors.email}
                  leftIcon={<Mail size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                {/* Password Field */}
                <Input
                  label="Password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChangeText={handlePasswordChange}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="current-password"
                  error={fieldErrors.password}
                  leftIcon={<Lock size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                {/* Remember Me & Forgot Password Row */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isDark ? '#3a3e42' : '#cbd5e1',
                          backgroundColor: rememberMe
                            ? primarySkyBlue
                            : isDark
                            ? '#121212'
                            : '#ffffff',
                        },
                      ]}
                    >
                      {rememberMe && <Check size={12} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text style={[styles.rememberMeText, { color: theme.colors.mute }]}>
                      Remember me
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/forgot-password')}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Text style={[styles.forgotPasswordText, { color: primarySkyBlue }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.signInButton,
                    { backgroundColor: primarySkyBlue },
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.signInButtonText}>Sign in</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Card Footer: Request Access */}
              <View style={[styles.cardFooter, { borderTopColor: cardBorder }]}>
                <Text style={[styles.cardFooterText, { color: theme.colors.mute }]}>
                  Don&apos;t have access?
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/signup')}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Text style={[styles.requestAccessText, { color: primarySkyBlue }]}>
                    Request access
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bottom Screen Footer & Theme Toggle */}
          <View style={styles.screenFooter}>
            <View style={styles.footerInner}>
              <Text
                style={[
                  styles.copyrightText,
                  { color: isDark ? '#737373' : '#8f8f8f' },
                ]}
              >
                &copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.
              </Text>

              {/* Quick Floating Theme Switcher */}
              <TouchableOpacity
                style={[
                  styles.themeToggleBtn,
                  {
                    backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0',
                    borderColor: cardBorder,
                  },
                ]}
                onPress={() => setMode(isDark ? 'light' : 'dark')}
                activeOpacity={0.7}
                accessibilityLabel="Toggle Theme"
                hitSlop={8}
              >
                {isDark ? (
                  <Sun size={15} color="#e0e0e0" />
                ) : (
                  <Moon size={15} color="#333333" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  bannerContainer: {
    marginBottom: 16,
  },
  form: {
    width: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signInButton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardFooter: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardFooterText: {
    fontSize: 13,
  },
  requestAccessText: {
    fontSize: 13,
    fontWeight: '700',
  },
  screenFooter: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  copyrightText: {
    flex: 1,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
