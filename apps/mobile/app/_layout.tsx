import '../lib/suppressWarnings';

/**
 * ServiceCentric Mobile — Root Layout
 * Wraps top-level Expo Router navigation with QueryClientProvider, AuthProvider, and StatusBar.
 */

import React from 'react';
import { View, StyleSheet, Platform, AppState, type AppStateStatus } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/auth/useAuth';
import { supabase } from '../lib/supabase';
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

function MobileGoogleAnalytics() {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const GA_ID = 'G-DC126P3SM9';
    if (document.getElementById('mobile-google-tag-script')) return;

    const script = document.createElement('script');
    script.id = 'mobile-google-tag-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    const initScript = document.createElement('script');
    initScript.id = 'mobile-google-tag-init';
    initScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    `;
    document.head.appendChild(initScript);
  }, []);

  return null;
}

function MobileWebScrollbarStyles() {
  const { isDark } = useTheme();

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'reach-mobile-scrollbar-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const thumbColor = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)';
    const thumbHover = isDark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(0, 0, 0, 0.38)';
    styleEl.innerHTML = `
      * {
        scrollbar-width: thin;
        scrollbar-color: ${thumbColor} transparent;
      }
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: ${thumbColor};
        border-radius: 9999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: ${thumbHover};
      }
    `;
  }, [isDark]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale time
      retry: 2,
    },
  },
});

function MobileOperatorAlertsListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Offline resilience: sync any notifications stored while operator was disconnected
  const syncOfflineNotifications = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: unreadNotifications, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, category, severity, metadata, created_at')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: true });

      if (error || !unreadNotifications || unreadNotifications.length === 0) return;

      const idsToMarkRead: string[] = [];
      for (const notif of unreadNotifications) {
        idsToMarkRead.push(notif.id);
        postNotification({
          id: notif.id,
          category: (notif.category as any) || 'log_entry',
          title: notif.title || 'Shift Logged on Your Behalf',
          body: notif.message,
          severity: (notif.severity as any) || 'info',
          metadata: notif.metadata,
        });
      }

      if (idsToMarkRead.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', idsToMarkRead);

        queryClient.invalidateQueries({
          queryKey: ['operator', 'entry-context', user.id],
        });
        queryClient.invalidateQueries({
          queryKey: ['operations', 'logs'],
        });
        queryClient.invalidateQueries({
          queryKey: ['today-shift-monitor'],
        });
      }
    } catch (err) {
      console.warn('[OfflineNotifications] Sync notice:', err);
    }
  }, [user?.id, queryClient]);

  React.useEffect(() => {
    if (!user?.id) return;

    // 1. Initial offline notifications sync on mount / authentication
    syncOfflineNotifications();

    // 2. Re-sync offline notifications when app transitions back to active foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncOfflineNotifications();
      }
    });

    // 3. Realtime WebSocket listener for immediate delivery while active
    const alertChannel = supabase.channel(`operator-alerts:${user.id}`);
    alertChannel
      .on('broadcast', { event: 'assisted_shift_logged' }, (eventPayload) => {
        const data = eventPayload?.payload;
        if (data) {
          postNotification({
            category: 'log_entry',
            title: data.title || 'Shift Logged on Your Behalf',
            body: data.body || `A supervisor recorded your shift on equipment ${data.machineCode || 'Equipment'} (${data.runningHours}h).`,
            severity: 'info',
            metadata: data,
          });

          queryClient.invalidateQueries({
            queryKey: ['operator', 'entry-context', user.id],
          });
          queryClient.invalidateQueries({
            queryKey: ['operations', 'logs'],
          });
          queryClient.invalidateQueries({
            queryKey: ['today-shift-monitor'],
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          syncOfflineNotifications();
        }
      });

    return () => {
      subscription.remove();
      supabase.removeChannel(alertChannel);
    };
  }, [user?.id, queryClient, syncOfflineNotifications]);

  return null;
}

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
      <MobileOperatorAlertsListener />
      <MobileAgentation />
      <MobileGoogleAnalytics />
      <MobileWebScrollbarStyles />
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

