import '../lib/suppressWarnings';
import '../global.css';
import { Text } from '../components/ui/Text';
import { PortalHost } from '@rn-primitives/portal';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Disable Reanimated strict mode warning triggered by NativeWind v4 (react-native-css-interop)
// which writes to shared values during component render when processing CSS animations/transitions.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

/**
 * ServiceCentric Mobile — Root Layout
 * Wraps top-level Expo Router navigation with QueryClientProvider, AuthProvider, and StatusBar.
 */

import React from 'react';
import { View, StyleSheet, Platform, AppState, type AppStateStatus, useWindowDimensions } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useNavigationMotion } from '../lib/motion';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  asyncStoragePersister,
  dehydrateOptions,
  CACHE_MAX_AGE_MS,
  appBuster,
} from '../lib/optimistic/persist';
import { AuthProvider, useAuth } from '../lib/auth/useAuth';
import { supabase } from '../lib/supabase';
import { ThemeProvider, useTheme } from '../components/ui/ThemeProvider';
import { PostNotificationBanner } from '../components/notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useFonts } from 'expo-font';
import { postNotification } from '../lib/notifications/postNotification';
import { TypeScaleProvider, useTypeScale } from '../lib/typography/TypeScaleProvider';
import { offlineQueueManager, syncCoordinator, networkConnectivityManager } from '../lib/offline';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OverlayHostProvider, ToastProvider } from '../components/ui/overlay';
import { Pressable } from '../components/ui/touch/Pressable';
import { isAgentationEnabled, getSentryDsn } from '../lib/env';

// Prevent native splash screen from autohiding until fonts, type scale, and core resources load
SplashScreen.preventAutoHideAsync().catch(() => {});

function MobileAgentation() {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (!isAgentationEnabled()) {
    return null;
  }

  const [isMounted, setIsMounted] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedPosition = localStorage.getItem('feedback-toolbar-position');
      if (savedPosition) {
        const pos = JSON.parse(savedPosition);
        if (
          typeof pos?.x === 'number' &&
          typeof pos?.y === 'number' &&
          (pos.x > window.innerWidth - 44 ||
            pos.y > window.innerHeight - 44 ||
            pos.x < 0 ||
            pos.y < 0)
        ) {
          localStorage.removeItem('feedback-toolbar-position');
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [pathname]);

  if (!isMounted) {
    return null;
  }

  try {
    const { Agentation } = require('agentation');
    return <Agentation key={pathname || 'mobile-web'} className="reach-agentation-toolbar" />;
  } catch (err) {
    if (__DEV__) {
      console.warn('[MobileAgentation] Failed to mount agentation toolbar:', err);
    }
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
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const styleId = 'reach-mobile-scrollbar-styles';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      :root {
        --mobile-scrollbar-thumb: rgba(0, 0, 0, 0.22);
        --mobile-scrollbar-thumb-hover: rgba(0, 0, 0, 0.38);
        --mobile-canvas: #fafafa;
      }
      :root.dark,
      .dark:root,
      .dark {
        --mobile-scrollbar-thumb: rgba(255, 255, 255, 0.22);
        --mobile-scrollbar-thumb-hover: rgba(255, 255, 255, 0.38);
        --mobile-canvas: #09090b;
      }
      html, body {
        background-color: var(--mobile-canvas);
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
      #root {
        display: flex;
        height: 100%;
        width: 100%;
        flex: 1;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--mobile-scrollbar-thumb) transparent;
        -webkit-tap-highlight-color: transparent !important;
      }
      *:focus, *:active {
        outline: none !important;
      }
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: var(--mobile-scrollbar-thumb);
        border-radius: 9999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--mobile-scrollbar-thumb-hover);
      }
      /* Suppress user-agent default outlines and borders on text inputs */
      input, textarea {
        outline: none !important;
      }
      /* Agentation Toolbar Floating Layer on Web */
      .reach-agentation-toolbar,
      [data-agentation-toolbar] {
        z-index: 100000 !important;
      }
      @media (max-width: 767px) {
        .reach-agentation-toolbar,
        [data-agentation-toolbar] {
          max-width: calc(100vw - 24px) !important;
        }
        .reach-agentation-toolbar:not([style*="top"]),
        [data-agentation-toolbar]:not([style*="top"]) {
          bottom: 80px !important;
          right: 14px !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale time
      retry: 2,
      refetchOnReconnect: false, // Managed by SyncCoordinator for screen-scoped revalidation (prevents tab refetch storms)
    },
  },
});

syncCoordinator.setQueryClient(queryClient);

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

function MobileOfflineSyncListener() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    // Invalidate TanStack query cache and alert operator upon sync complete
    const unsubscribe = offlineQueueManager.onSyncComplete((syncedCount) => {
      queryClient.invalidateQueries({ queryKey: ['operations', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'history-logs'] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'entry-context'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['today-shift-monitor'] });

      postNotification({
        category: 'log_entry',
        title: 'Offline Sync Complete',
        body: `Synchronized ${syncedCount} shift ${syncedCount === 1 ? 'log' : 'logs'} to cloud database.`,
        severity: 'success',
      });
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return null;
}

function MobileScreenSyncWatcher() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  React.useEffect(() => {
    syncCoordinator.setQueryClient(queryClient);
  }, [queryClient]);

  React.useEffect(() => {
    if (pathname) {
      syncCoordinator.setActiveScreen(pathname);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const raw = window.location.pathname;
        if (raw.includes('/(app)') || (raw.endsWith('/index') && raw !== '/index')) {
          const clean = raw.replace(/\/\(app\)/g, '').replace(/\/index$/, '') || '/';
          window.history.replaceState(null, '', clean + window.location.search + window.location.hash);
        }
      }
    }
  }, [pathname]);

  return null;
}

function ThemedAppContainer() {
  const { theme, isDark } = useTheme();
  const motion = useNavigationMotion();

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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.canvas },
          ...motion.stackDefault,
        }}
      >
        <Stack.Screen name="index" options={{ animation: motion.stackModalTransparent.animation }} />
        <Stack.Screen name="(auth)" options={{ animation: motion.stackModalTransparent.animation }} />
        <Stack.Screen name="(app)" options={{ animation: motion.stackModalTransparent.animation }} />
        <Stack.Screen
          name="privacy"
          options={{
            ...motion.stackModalSheet,
          }}
        />
        <Stack.Screen
          name="terms"
          options={{
            ...motion.stackModalSheet,
          }}
        />
        <Stack.Screen
          name="+not-found"
          options={{
            title: 'Oops!',
            animation: motion.stackModalTransparent.animation,
          }}
        />
      </Stack>
      <PortalHost />
      <PostNotificationBanner />
      <MobileOperatorAlertsListener />
      <MobileOfflineSyncListener />
      <MobileScreenSyncWatcher />
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
      <Text variant="title" style={styles.errorTitle}>Application Encountered an Error</Text>
      <Text variant="body" style={styles.errorMessage}>
        {error?.message || 'An unexpected operational issue occurred.'}
      </Text>
      <Pressable variant="buttonPrimary" haptic="tap" style={styles.retryButton} onPress={retry}>
        <Text variant="label" style={styles.retryButtonText}>Reload Application</Text>
      </Pressable>
    </View>
  );
}

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: getSentryDsn(),
  // Only capture traces in production to save quota
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  integrations: [
    Sentry.reactNativeTracingIntegration(),
  ],
  _experiments: {
    // Enable performance tracing for Expo Router
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  },
});

function TypographyGate({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
    'GeistMono-Medium': require('../assets/fonts/GeistMono-Medium.ttf'),
  });
  const { ready } = useTypeScale();
  const done = (fontsLoaded || !!fontError) && ready;

  React.useEffect(() => {
    if (done) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [done]);

  // Safety fallback: ensure splash screen hides within 3 seconds regardless of font or storage latency
  React.useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!done) return null;

  return <>{children}</>;
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider style={styles.safeArea}>
        <TypeScaleProvider>
          <TypographyGate>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: asyncStoragePersister,
                maxAge: CACHE_MAX_AGE_MS,
                buster: appBuster,
                dehydrateOptions: dehydrateOptions as any,
              }}
            >
              <AuthProvider>
                <ThemeProvider>
                  <OverlayHostProvider>
                    <ToastProvider>
                      <ThemedAppContainer />
                    </ToastProvider>
                  </OverlayHostProvider>
                </ThemeProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </TypographyGate>
        </TypeScaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  errorTitle: {
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#a1a1aa',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
  },
});

