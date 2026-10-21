import '../lib/suppressWarnings';
import React, { memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../lib/auth/useAuth';
import { useTheme } from '../components/ui/ThemeProvider';
import { AppWebView } from '../shell/AppWebView';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { getShellMode } from '../lib/env';

const SHELL_MODE = getShellMode();

/**
 * NativeGatewayScreen — Minimal Mobile Launch / Splash Gateway
 *
 * Design & Performance Invariants:
 * 1. Zero Logo & Minimalist Canvas: Splash screen logo completely removed, rendering clean theme canvas background.
 * 2. Zero Loading Spinner: Clean launch screen without distracting spinners.
 * 3. Coordinated Splash Lifecycle: Synchronously dismisses native splash once destination route resolves.
 */
const NativeGatewayScreen = memo(function NativeGatewayScreen() {
  const { isLoading, session, role, isProfileComplete } = useAuth();
  const { theme, isDark } = useTheme();

  // Once session resolution completes, ensure native splash screen is dismissed
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // While resolving session, render clean minimalist canvas with zero logo and zero spinner
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
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
});


