/**
 * Reach International Mobile — Login Screen
 * Full Three-Tier Viewport Responsiveness:
 * - Mobile (<=640px): Touch-optimized single-column card, min 44px touch targets, compact height adaptation
 * - Tablet (641px-1023px): Centered elevated card with generous touch padding and balanced spacing
 * - Desktop (>=1024px, e.g. 1536x695): Split two-column layout with industrial fleet showcase stage,
 *   brand machinery asset pedestal, and dedicated authentication workspace matching Web app 100%.
 *
 * ENTERPRISE-GRADE AUTHENTICATION & SECURITY:
 * - Atomic signIn lifecycle with in-flight deduplication and profile caching
 * - Non-sensitive email suggestions for fast autofill; NEVER exposes or stores passwords
 * - Android Autofill / iOS Keychain integration for secure credentials
 * - Generic error messaging preventing account enumeration attacks
 * - Resilient persistent session restoration with zero UI flicker
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mail, Lock, Check, X } from '../../components/ui/icon';
import { Input, useTheme, Text, useToast } from '../../components/ui';
import { Pressable } from '../../components/ui/touch/Pressable';
import { ReachLongLogo } from '../../components/branding/ReachLongLogo';
import { useAuth } from '../../lib/auth/useAuth';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { haptics } from '../../lib/haptics';
import {
  getSavedEmails,
  getRememberedEmail,
  removeSavedEmail,
} from '../../lib/auth/savedEmails';

const loginPageImage = require('../../assets/loginpageimage.png');

export default function LoginScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ message?: string }>();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { session, isLoading: authLoading, isProfileComplete, role, signIn } = useAuth();
  const { width: rawWidth, height: rawHeight } = useWindowDimensions();

  // Safe fallback dimensions on web to prevent 0x0 initial mount layout collapse
  const width =
    rawWidth ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : 390);
  const height =
    rawHeight ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerHeight
      : 844);

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
  const [savedEmailSuggestions, setSavedEmailSuggestions] = useState<string[]>([]);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const isSubmittingRef = useRef(false);

  // Load remembered email and saved suggestions on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [remembered, suggestions] = await Promise.all([
          getRememberedEmail(),
          getSavedEmails(),
        ]);
        if (isMounted) {
          if (remembered.email) {
            setEmail(remembered.email);
            setRememberMe(remembered.rememberMe);
          }
          setSavedEmailSuggestions(suggestions);
        }
      } catch {
        // Non-fatal
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Display URL query notices if redirected with message
  useEffect(() => {
    if (localParams.message) {
      toast('info', 'Notice', localParams.message);
    }
  }, [localParams.message, toast]);

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

  const handleEmailChange = useCallback((val: string) => {
    setEmail(val);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
  }, [fieldErrors.email]);

  const handlePasswordChange = useCallback((val: string) => {
    setPassword(val);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  }, [fieldErrors.password]);

  const handleSelectEmailSuggestion = useCallback((selectedEmail: string) => {
    haptics.select();
    setEmail(selectedEmail);
    setFieldErrors((prev) => ({ ...prev, email: undefined }));
  }, []);

  const handleRemoveEmailSuggestion = useCallback(async (targetEmail: string) => {
    haptics.light();
    const updated = await removeSavedEmail(targetEmail);
    setSavedEmailSuggestions(updated);
  }, []);

  const handleToggleRememberMe = useCallback(() => {
    setRememberMe((prev) => {
      const next = !prev;
      haptics.toggle(next);
      return next;
    });
  }, []);

  const handleNavigateForgotPassword = useCallback(() => {
    haptics.select();
    router.push('/(auth)/forgot-password');
  }, [router]);

  const handleNavigateSignup = useCallback(() => {
    haptics.select();
    router.push('/(auth)/signup');
  }, [router]);

  const handleLogin = async () => {
    if (isSubmittingRef.current || isLoading) return;

    haptics.light();

    // Field-level validation matching Web client
    const newFieldErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newFieldErrors.email = 'Email is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail.toLowerCase())) {
        newFieldErrors.email = 'Enter a valid email address.';
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
      const result = await signIn(trimmedEmail, password, rememberMe);

      if (!result.success) {
        haptics.reject();
        const errorMsg = result.error || 'Invalid email or password.';

        if (result.status === 'inactive') {
          toast('error', 'Account Deactivated', errorMsg);
        } else if (result.status === 'pending') {
          toast('info', 'Pending Approval', errorMsg);
        } else {
          setFieldErrors({
            email: errorMsg,
            password: errorMsg,
          });
          toast('error', 'Sign In Failed', errorMsg);
        }
        return;
      }

      haptics.confirm();

      // Refresh local suggestions list
      const updatedSuggestions = await getSavedEmails();
      setSavedEmailSuggestions(updatedSuggestions);

      // Route based on profile completion status and canonical role
      if (!result.isProfileComplete) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace(getMobileRoleHomeRoute(result.role) as any);
      }
    } catch {
      haptics.reject();
      toast('error', 'Sign In Error', 'Sign in failed. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';
  const showcaseBg = isDark ? '#111111' : '#ffffff';

  // Filter suggestion pills: show when email is empty or partially matches
  const visibleEmailSuggestions = savedEmailSuggestions.filter((s) => {
    if (!email.trim()) return true;
    return s.toLowerCase().includes(email.trim().toLowerCase()) && s.toLowerCase() !== email.trim().toLowerCase();
  });

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
            <ReachLongLogo width={220} height={110} />
          </View>

          {/* Central Hero Stage: Title + Machinery Asset */}
          <View style={styles.showcaseHeroContent}>
            <View style={styles.showcaseHeadingBlock}>
              <Text
                variant="display"
                style={[
                  styles.showcaseTitle,
                  { color: isDark ? '#ffffff' : '#0f172a' },
                ]}
              >
                Manage your fleet.
              </Text>
              <Text
                variant="display"
                style={[styles.showcaseSubtitle, { color: primarySkyBlue }]}
              >
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
                    <ReachLongLogo
                      width={isTablet ? 190 : 160}
                      height={isTablet ? 95 : 80}
                    />
                  </View>
                )}

                {/* Card Title */}
                <Text
                  variant="title"
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

                {/* Form Controls */}
                <View style={[styles.form, { gap: isShortScreen ? 10 : 14 }]}>
                  {/* Email Address Field with Autofill & Suggestions */}
                  <View style={styles.inputWrapper}>
                    <Input
                      label="Email address"
                      required
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={handleEmailChange}
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      importantForAutofill="yes"
                      autoCorrect={false}
                      error={fieldErrors.email}
                      leftIcon={<Mail size={16} color={isDark ? '#9ca3af' : '#626970'} />}
                    />

                    {/* Non-sensitive Saved Email Autofill Suggestion Chips */}
                    {(isEmailFocused || !email) && visibleEmailSuggestions.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.suggestionsScroll}
                          keyboardShouldPersistTaps="handled"
                        >
                          {visibleEmailSuggestions.map((item) => (
                            <View
                              key={item}
                              style={[
                                styles.suggestionChip,
                                {
                                  backgroundColor: isDark ? '#0c4a6e' : '#e0f2fe',
                                  borderColor: isDark ? '#0284c7' : '#bae6fd',
                                },
                              ]}
                            >
                              <Pressable
                                variant="plain"
                                haptic="select"
                                style={styles.suggestionSelectPressable}
                                onPress={() => handleSelectEmailSuggestion(item)}
                                accessibilityRole="button"
                                accessibilityLabel={`Autofill ${item}`}
                              >
                                <Mail size={12} color={isDark ? '#38bdf8' : '#0284c7'} />
                                <Text
                                  variant="caption"
                                  style={[styles.suggestionText, { color: isDark ? '#ffffff' : '#0369a1' }]}
                                  numberOfLines={1}
                                >
                                  {item}
                                </Text>
                              </Pressable>
                              <Pressable
                                variant="plain"
                                haptic="light"
                                style={styles.suggestionRemovePressable}
                                onPress={() => handleRemoveEmailSuggestion(item)}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${item} suggestion`}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <X size={11} color={isDark ? '#cbd5e1' : '#64748b'} />
                              </Pressable>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

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
                    textContentType="password"
                    importantForAutofill="yes"
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
                      haptic={false}
                      style={styles.rememberMeContainer}
                      onPress={handleToggleRememberMe}
                      hitSlopToMin48={true}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: rememberMe }}
                      accessibilityLabel="Remember me"
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
                        variant="body"
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
                      <Text
                        variant="label"
                        style={[styles.forgotPasswordText, { color: primarySkyBlue }]}
                      >
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
                    accessibilityRole="button"
                    accessibilityLabel="Sign in"
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text variant="heading" style={styles.signInButtonText}>
                        Sign in
                      </Text>
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
                    variant="caption"
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
                    <Text
                      variant="label"
                      style={[styles.requestAccessText, { color: primarySkyBlue }]}
                    >
                      Request access
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Bottom Screen Copyright Footer */}
            <View style={styles.screenFooter}>
              <Text
                variant="micro"
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
    alignItems: 'flex-start',
    justifyContent: 'center',
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
  showcaseTitle: {},
  showcaseSubtitle: {},
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
    aspectRatio: 1.5,
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
    flex: 1,
    marginVertical: 12,
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
    marginBottom: 16,
  },
  title: {
    textAlign: 'left',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    width: '100%',
  },
  suggestionsContainer: {
    marginTop: -4,
    marginBottom: 6,
    width: '100%',
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  suggestionSelectPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  suggestionText: {
    maxWidth: 220,
  },
  suggestionRemovePressable: {
    padding: 2,
    marginLeft: 2,
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
  rememberMeText: {},
  forgotPasswordText: {},
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
  cardFooterText: {},
  requestAccessText: {},
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
