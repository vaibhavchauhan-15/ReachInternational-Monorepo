/**
 * ServiceCentric Mobile — Root Layout
 * Wraps top-level Expo Router navigation with QueryClientProvider, AuthProvider, and StatusBar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth/useAuth';
import { colorsDark } from '@servicecentric/design-tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale time
      retry: 2,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          <Slot />
        </View>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
  },
});
