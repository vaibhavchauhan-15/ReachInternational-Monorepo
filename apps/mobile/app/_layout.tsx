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
import { PostNotificationBanner } from '../components/notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { postNotification } from '../lib/notifications/postNotification';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, Text } from 'react-native';

// Keep native splash screen visible until root layout mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

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

  React.useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    // Check for Over-The-Air updates safely in production native environments
    const checkUpdatesSafely = async () => {
      try {
        if (!__DEV__ && Platform.OS !== 'web' && Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (update?.isAvailable) {
            await Updates.fetchUpdateAsync();
            postNotification({
              category: 'system',
              title: 'System Update Ready',
              body: 'A new update has been downloaded and will apply automatically on next restart.',
              severity: 'info',
            });
          }
        }
      } catch (err) {
        // Quietly ignore network/offline/update errors in the field
        console.warn('[Updates] Non-fatal OTA check notice:', err);
      }
    };

    checkUpdatesSafely();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
      <PostNotificationBanner />
      <MobileAgentation />
    </View>
  );
}

/**
 * Expo Router ErrorBoundary — catches runtime component render crashes
 * and prevents native Android 15 activity termination ("app keeps stopping").
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Application Encountered an Error</Text>
      <Text style={styles.errorMessage}>
        {error?.message || 'An unexpected operational issue occurred.'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={retry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>Reload Application</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.safeArea}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <ThemedAppContainer />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#09090b',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#0070f3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});

