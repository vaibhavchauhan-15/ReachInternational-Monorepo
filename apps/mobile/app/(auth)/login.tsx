/**
 * Reach International Mobile — Login Screen
 * Full Three-Tier Viewport Responsiveness:
 * - Mobile (<=640px): Touch-optimized single-column card, min 44px touch targets, compact height adaptation
 * - Tablet (641px-1023px): Centered elevated card with generous touch padding and balanced spacing
 * - Desktop (>=1024px, e.g. 1536x695): Split two-column layout with industrial fleet showcase stage,
 *   brand machinery asset pedestal, and dedicated authentication workspace matching Web app 100%.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  useWindowDimensions} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mail, Lock, Check } from '../../components/ui/icon';
import { supabase } from '../../lib/supabase';
import { Input, Alert, useTheme , Text } from '../../components/ui';
import { Pressable } from '../../components/ui/touch/Pressable';
import { ReachInternationalLogo } from '../../components/branding/ReachInternationalLogo';
import { useAuth } from '../../lib/auth/useAuth';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { haptics } from '../../lib/haptics';

const loginPageImage = require('../../assets/loginpageimage.png');

export default function LoginScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ message?: string }>();
  const { theme, isDark } = useTheme();
  const { session, isLoading: authLoading, isProfileComplete, role } = useAuth();
  const { width, height } = useWindowDimensions();

  // Responsive Breakpoints: Mobile (<=640px), Tablet (641px–1023px), Desktop (>=1024px)
  const isDesktop = width >= 1024;
  const isTablet = width >= 641 && width < 1024;
  const isMobile = width <= 640;
  const isShortScreen = height < 740;
  const isTinyScreen = width < 360;

  // Responsive width for Desktop Left Showcase Panel (clamped between 380px and 540px)
  const showcaseWidth = isDesktop
    ? Math.min(540, Math.max(380, Math.round(width * 0.38)))
    : 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [successMessage, setSuccessMessage] = useState(localParams.message || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (localParams.message) {
      setSuccessMessage(localParams.message);
    }
  }, [localParams.message]);

  // Redirect authenticated user away from login to role Home or onboarding
  useEffect(() => {
    if (!authLoading && session) {
      if (!isProfileComplete) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace(getMobileRoleHomeRoute(role) as any);
      }
    }
  }, [authLoading, session, isProfileComplete, role, router]);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (errorMessage) {
      setErrorMessage('');
    }
    if (successMessage) {
      setSuccessMessage('');
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
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleToggleRememberMe = () => {
    haptics.light();
    setRememberMe((prev) => !prev);
  };

  const handleNavigateForgotPassword = () => {
    haptics.select();
    router.push('/(auth)/forgot-password');
  };

  const handleNavigateSignup = () => {
    haptics.select();
    router.push('/(auth)/signup');
  };


  const handleLogin = async () => {
    if (isSubmittingRef.current || isLoading) return;

    haptics.light();
    setErrorMessage('');
    setSuccessMessage('');

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
      haptics.reject();
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
        haptics.reject();
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
          haptics.reject();
          await supabase.auth.signOut();
          setErrorMessage('User profile not found. Contact your administrator.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        if (profile.status === 'inactive') {
          haptics.reject();
          await supabase.auth.signOut();
          setErrorMessage('Your account has been deactivated. Contact your administrator.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        if (profile.status === 'pending') {
          haptics.reject();
          await supabase.auth.signOut();
          setErrorMessage(
            'Your account is pending approval. Please wait for an administrator to approve your account.'
          );
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }

        haptics.confirm();

        // Routing based on onboarding and role
        const isProfileComplete = profile.complete_profile === true || profile.complete_profile === 'yes';
        if (!isProfileComplete) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace(getMobileRoleHomeRoute(profile.role) as any);
        }
      }

    } catch (err: unknown) {
      haptics.reject();
      setErrorMessage('An unexpected error occurred during login. Please try again.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';
  const showcaseBg = isDark ? '#111111' : '#ffffff';

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: canvasBackground,
          flexDirection: isDesktop ? 'row' : 'column',
        },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only >= 1024px)
          Exact parity with Web app login page
          ============================================================ */}
      {isDesktop && (
        <View
          style={[
            styles.desktopShowcasePanel,
            {
              width: showcaseWidth,
              backgroundColor: showcaseBg,
              borderRightColor: cardBorder,
            },
          ]}
        >
          {/* Atmospheric Brand Glow */}
          <View
            style={[
              styles.showcaseGlow,
              {
                backgroundColor: isDark
                  ? 'rgba(14, 165, 233, 0.12)'
                  : 'rgba(2, 132, 199, 0.08)',
              },
            ]}
          />

          {/* Top Brand Logo */}
          <View style={styles.showcaseLogoContainer}>
            <ReachInternationalLogo variant="full" size={28} iconType="scissor" />
          </View>

          {/* Central Hero Stage: Title + Machinery Asset */}
          <View style={styles.showcaseHeroContent}>
            <View style={styles.showcaseHeadingBlock}>
              <Text
                style={[
                  styles.showcaseTitle,
                  { color: isDark ? '#ffffff' : '#0f172a' },
                ]}
              >
                Manage your fleet.
              </Text>
              <Text style={[styles.showcaseSubtitle, { color: primarySkyBlue }]}>
                Track every hour.
              </Text>
            </View>

            {/* Industrial Machinery Stage with Ground Pedestal */}
            <View style={styles.machineStageContainer}>
              <View
                style={[
                  styles.machinePedestalShadow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 0, 0, 0.85)'
                      : 'rgba(0, 0, 0, 0.16)',
                  },
                ]}
              />
              <Image
                source={loginPageImage}
                style={[
                  styles.machineImage,
                  {
                    maxHeight: Math.min(260, Math.max(160, height * 0.32)),
                  },
                ]}
                resizeMode="contain"
                accessible={true}
                accessibilityLabel="Reach International Aerial Boom Lift Fleet Equipment"
              />
            </View>
          </View>

          {/* Bottom subtle anchor spacer */}
          <View style={styles.showcaseBottomSpacer} />
        </View>
      )}

      {/* ============================================================
          Right: Dedicated Authentication Workspace (Responsive Mobile / Tablet / Desktop)
          ============================================================ */}
      <View style={[styles.mainWorkspace, { backgroundColor: canvasBackground }]}>
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
            {/* Top Spacer for vertical balance */}
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
                {/* Brand Logo Centered (Rendered on Mobile & Tablet; hidden on Desktop since left showcase panel displays it) */}
                {!isDesktop && (
                  <View style={styles.logoContainer}>
                    <ReachInternationalLogo
                      variant="full"
                      size={isTablet ? 28 : 26}
                      iconType="scissor"
                    />
                  </View>
                )}

                {/* Card Title */}
                <Text
                  style={[
                    styles.title,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      marginBottom: isShortScreen ? 12 : 18,
                    },
                  ]}
                >
                  Welcome back
                </Text>

                {/* Global Error Banner */}
                {errorMessage && Object.keys(fieldErrors).length === 0 ? (
                  <View style={styles.bannerContainer}>
                    <Alert variant="error">{errorMessage}</Alert>
                  </View>
                ) : null}

                {/* Global Success Banner */}
                {successMessage && !errorMessage ? (
                  <View style={styles.bannerContainer}>
                    <Alert variant="success">{successMessage}</Alert>
                  </View>
                ) : null}

                {/* Form Controls */}
                <View style={[styles.form, { gap: isShortScreen ? 10 : 14 }]}>
                  {/* Email Address Field */}
                  <Input
                    label="Email address"
                    required
                    placeholder="superadmin@reachinternational.co.in"
                    value={email}
                    onChangeText={handleEmailChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="off"
                    importantForAutofill="no"
                    error={fieldErrors.email}
                    leftIcon={<Mail size={16} color={isDark ? '#9ca3af' : '#626970'} />}
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
                    autoComplete="off"
                    importantForAutofill="no"
                    error={fieldErrors.password}
                    leftIcon={<Lock size={16} color={isDark ? '#9ca3af' : '#626970'} />}
                  />

                  {/* Remember Me & Forgot Password Row */}
                  <View
                    style={[
                      styles.optionsRow,
                      { marginBottom: isShortScreen ? 12 : 18 },
                    ]}
                  >
                    <Pressable
                      variant="toggle"
                      haptic="toggle"
                      style={styles.rememberMeContainer}
                      onPress={handleToggleRememberMe}
                      hitSlopToMin48={true}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: rememberMe
                              ? primarySkyBlue
                              : isDark
                              ? '#3f3f46'
                              : '#cbd5e1',
                            backgroundColor: rememberMe
                              ? primarySkyBlue
                              : isDark
                              ? '#141414'
                              : '#ffffff',
                          },
                        ]}
                      >
                        {rememberMe && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </View>
                      <Text
                        style={[
                          styles.rememberMeText,
                          { color: isDark ? '#a1a1aa' : '#64748b' },
                        ]}
                      >
                        Remember me
                      </Text>
                    </Pressable>

                    <Pressable
                      variant="plain"
                      haptic="select"
                      hitSlopToMin48={true}
                      onPress={handleNavigateForgotPassword}
                    >
                      <Text style={[styles.forgotPasswordText, { color: primarySkyBlue }]}>
                        Forgot password?
                      </Text>
                    </Pressable>
                  </View>

                  {/* Sign In CTA Button */}
                  <Pressable
                    variant="buttonPrimary"
                    haptic={false}
                    style={[
                      styles.signInButton,
                      { backgroundColor: primarySkyBlue },
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.signInButtonText}>Sign in</Text>
                    )}
                  </Pressable>
                </View>

                {/* Card Footer: Request Access */}
                <View
                  style={[
                    styles.cardFooter,
                    {
                      borderTopColor: isDark ? '#262626' : '#f1f5f9',
                      marginTop: isShortScreen ? 16 : 22,
                      paddingTop: isShortScreen ? 14 : 18,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cardFooterText,
                      { color: isDark ? '#a1a1aa' : '#64748b' },
                    ]}
                  >
                    Don&apos;t have access?
                  </Text>
                  <Pressable
                    variant="plain"
                    haptic="select"
                    hitSlopToMin48={true}
                    onPress={handleNavigateSignup}
                  >
                    <Text style={[styles.requestAccessText, { color: primarySkyBlue }]}>
                      Request access
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

        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  // Desktop Left Showcase Panel
  desktopShowcasePanel: {
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  showcaseGlow: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.8,
    ...Platform.select({
      web: {
        filter: 'blur(50px)',
      },
      default: {},
    }),
  },
  showcaseLogoContainer: {
    alignItems: 'flex-start',
    zIndex: 2,
  },
  showcaseHeroContent: {
    marginVertical: 'auto',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 22,
    zIndex: 2,
    paddingVertical: 12,
  },
  showcaseHeadingBlock: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 2,
  },
  showcaseTitle: {
  },
  showcaseSubtitle: {
  },
  machineStageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
  },
  machinePedestalShadow: {
    position: 'absolute',
    bottom: 6,
    width: '85%',
    maxWidth: 320,
    height: 12,
    borderRadius: 9999,
    ...Platform.select({
      web: {
        filter: 'blur(4px)',
      },
      default: {
        opacity: 0.5,
      },
    }),
  },
  machineImage: {
    width: '100%',
    maxWidth: 340,
  },
  showcaseBottomSpacer: {
    height: 12,
  },
  // Main Workspace
  mainWorkspace: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  keyboardContainer: {
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: '100%',
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
    borderRadius: 22,
    borderWidth: 1,
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
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'left',
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
    marginTop: 2,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
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
  },
  forgotPasswordText: {
  },
  signInButton: {
    height: 48,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  signInButtonText: {
    color: '#ffffff',
  },
  cardFooter: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardFooterText: {
  },
  requestAccessText: {
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

});
