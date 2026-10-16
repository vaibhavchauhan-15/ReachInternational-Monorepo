import '../lib/suppressWarnings';
import React, { memo, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '../lib/auth/useAuth';
import { useTheme } from '../components/ui/ThemeProvider';
import { ReachBrandEmblem } from '../components/branding';
import { AppWebView } from '../shell/AppWebView';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { getShellMode } from '../lib/env';

const SHELL_MODE = getShellMode();

/**
 * NativeGatewayScreen — Optimized Mobile Launch / Splash Gateway
 *
 * Design & Performance Invariants:
 * 1. Zero Loading Spinner: Clean, high-end Apple/Material launch screen without distracting spinners.
 * 2. Industry Standard Logo Sizing: 144dp emblem (clamped to 120dp on compact screens <360px),
 *    matching Google Material 3 Splash & iOS Launch Screen specifications.
 * 3. 0ms Layout Overhead & GPU-Accelerated Micro-Animation: FadeIn entrance on the brand mark.
 * 4. Coordinated Splash Lifecycle: Synchronously dismisses native splash once destination route resolves.
 */
const NativeGatewayScreen = memo(function NativeGatewayScreen() {
  const { isLoading, session, role, isProfileComplete } = useAuth();
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();

  // Industry standard mobile splash emblem size: 144dp (clamped to 120dp on <360px ultra-compact viewports)
  const logoSize = width < 360 ? 120 : 144;

  // Once session resolution completes, ensure native splash screen is dismissed
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // While resolving session, render centered brand emblem with zero spinner and subtle elevation
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.logoContainer,
            isDark ? styles.logoDarkElevation : styles.logoLightElevation,
          ]}
        >
          <ReachBrandEmblem size={logoSize} bordered={true} />
        </Animated.View>
      </View>
    );
  }

  // Directly navigate to appropriate route once session is resolved
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
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLightElevation: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  logoDarkElevation: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 3,
  },
});


