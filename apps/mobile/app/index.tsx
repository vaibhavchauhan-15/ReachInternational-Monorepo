import '../lib/suppressWarnings';
import React, { memo, useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '../lib/auth/useAuth';
import { useTheme } from '../components/ui/ThemeProvider';
import { ReachLongLogo } from '../components/branding/ReachLongLogo';
import { useReducedMotion } from '../lib/preferences/useReducedMotion';
import { AppWebView } from '../shell/AppWebView';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { getShellMode } from '../lib/env';

const SHELL_MODE = getShellMode();

// Easing curves: smooth cubic bezier deceleration for native feel
const FADE_EASING = Easing.bezier(0.23, 1, 0.32, 1);

// Easing and timing: 700ms per transition (600–800 ms range)
const FADE_IN_DURATION_MS = 700;
const FADE_OUT_DURATION_MS = 700;

// Minimum display hold to ensure complete fade-in before fade-out initiates
const MIN_SPLASH_HOLD_MS = 1100;
// Safety fallback timeout ensuring navigation proceeds even if network latency stalls auth check
const MAX_SPLASH_TIMEOUT_MS = 4000;

/**
 * NativeGatewayScreen — High-Performance Brand Animated Splash & Gateway
 *
 * Design & Performance Invariants:
 * 1. Smooth Fade-In and Fade-Out: Pure opacity transition (0 → 1, hold, 1 → 0) at 700ms per transition.
 * 2. Native-Driver Compatible: Reanimated UI-thread execution with zero layout shifts or flickering.
 * 3. Centered 2:1 Long Logo: Preserves authentic aspect ratio and selected theme asset (Dark/Light).
 * 4. Synchronized Lifecycle: Prevents premature dismissal until fade-in completes and app initializes.
 * 5. Resource Cleanup: Cancels active animations and clears timers on unmount to prevent leaks.
 */
const NativeGatewayScreen = memo(function NativeGatewayScreen() {
  const { isLoading, session, role, isProfileComplete } = useAuth();
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const prefersReducedMotion = useReducedMotion();

  // Responsive, pixel-perfect 2:1 dimensions (1774 x 887 aspect ratio)
  const longLogoWidth = useMemo(() => {
    return Math.min(Math.max(Math.round(windowWidth * 0.72), 240), 320);
  }, [windowWidth]);
  const longLogoHeight = Math.round(longLogoWidth / 2);

  // Native-driver compatible opacity animation on UI thread
  const opacity = useSharedValue(0);

  // Lifecycle states
  const [minHoldElapsed, setMinHoldElapsed] = useState(false);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  // Guards preventing duplicate animation execution
  const isMountedRef = useRef(true);
  const fadeInStartedRef = useRef(false);
  const fadeOutStartedRef = useRef(false);

  // Synchronously dismiss native static splash screen once component mounts
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Track component mount status for resource cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelAnimation(opacity);
    };
  }, [opacity]);

  // Execute smooth fade-in animation: opacity 0 → 1
  useEffect(() => {
    if (fadeInStartedRef.current) return;
    fadeInStartedRef.current = true;

    if (prefersReducedMotion) {
      opacity.set(1);
    } else {
      opacity.set(withTiming(1, { duration: FADE_IN_DURATION_MS, easing: FADE_EASING }));
    }
  }, [opacity, prefersReducedMotion]);

  // Minimum display timer ensuring fade-in finishes and logo holds without premature dismissal
  useEffect(() => {
    const holdTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setMinHoldElapsed(true);
      }
    }, prefersReducedMotion ? 200 : MIN_SPLASH_HOLD_MS);

    return () => clearTimeout(holdTimer);
  }, [prefersReducedMotion]);

  // Safety fallback timer ensuring navigation proceeds even under delayed network or storage
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setMinHoldElapsed(true);
      }
    }, MAX_SPLASH_TIMEOUT_MS);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Execute smooth fade-out animation: opacity 1 → 0 once initialization is complete
  useEffect(() => {
    const isAppInitialized = !isLoading;
    const canFadeOut = minHoldElapsed && isAppInitialized;

    if (!canFadeOut || fadeOutStartedRef.current) return;
    fadeOutStartedRef.current = true;

    if (prefersReducedMotion) {
      if (isMountedRef.current) {
        setIsAnimationComplete(true);
      }
      return;
    }

    // Smooth fade-out from 1 → 0 over 700ms
    opacity.set(withTiming(0, { duration: FADE_OUT_DURATION_MS, easing: FADE_EASING }));

    const completionTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsAnimationComplete(true);
      }
    }, FADE_OUT_DURATION_MS);

    return () => clearTimeout(completionTimer);
  }, [minHoldElapsed, isLoading, opacity, prefersReducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  // While fade-in, hold, or fade-out animation is in progress, keep splash visible
  if (!isAnimationComplete) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Animated.View style={[styles.logoWrapper, animatedStyle]}>
          <ReachLongLogo
            width={longLogoWidth}
            height={longLogoHeight}
            themeVariant="auto"
            alt="Reach International"
          />
        </Animated.View>
      </View>
    );
  }

  // Once fade-out finishes and app is initialized, route directly to destination
  if (session) {
    if (!isProfileComplete) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return <Redirect href={getMobileRoleHomeRoute(role) as any} />;
  }

  return <Redirect href="/(auth)/login" />;
});

export default function GatewayScreen() {
  // WebView Shell Mode (Optional override via EXPO_PUBLIC_SHELL_MODE=webview)
  if (SHELL_MODE === 'webview') {
    return <AppWebView />;
  }

  // Authoritative Native Mobile App Mode (Default for Expo Go & Native Builds)
  return <NativeGatewayScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
