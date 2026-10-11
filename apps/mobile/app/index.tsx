import '../lib/suppressWarnings';
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth/useAuth';
import { useTheme } from '../components/ui/ThemeProvider';
import { AppWebView } from '../shell/AppWebView';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';

const SHELL_MODE = process.env.EXPO_PUBLIC_SHELL_MODE || 'native';

function NativeGatewayScreen() {
  const { isLoading, session, role, isProfileComplete } = useAuth();
  const { theme } = useTheme();

  // While resolving session, render clean background canvas with subtle indicator
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  // Directly open the apps without displaying the brand logo
  if (session) {
    if (!isProfileComplete) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return <Redirect href={getMobileRoleHomeRoute(role) as any} />;
  }

  return <Redirect href="/(auth)/login" />;
}

export default function GatewayScreen() {
  // WebView Shell Mode (Optional override via EXPO_PUBLIC_SHELL_MODE=webview)
  if (SHELL_MODE === 'webview') {
    return <AppWebView />;
  }

  // Authoritative Native Mobile App Mode (Default for Expo Go & Native Builds)
  if (SHELL_MODE === 'native') {
    return <NativeGatewayScreen />;
  }

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

