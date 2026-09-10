/**
 * ServiceCentric Mobile — Root Layout
 * Wraps top-level Expo Router navigation with QueryClientProvider, AuthProvider, and StatusBar.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth/useAuth';
import { ThemeProvider, useTheme } from '../components/ui/ThemeProvider';

function MobileAgentation() {
  if (process.env.NODE_ENV !== 'development' || Platform.OS !== 'web') {
    return null;
  }
  try {
    const { Agentation } = require('agentation');
    return <Agentation />;
  } catch {
    return null;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale time
      retry: 2,
    },
  },
});

function ThemedAppContainer() {
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
      <MobileAgentation />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ThemedAppContainer />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
