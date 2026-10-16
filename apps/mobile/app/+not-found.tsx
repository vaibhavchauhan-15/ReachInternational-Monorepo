/**
 * ReachInternational Mobile — Route Fallback & Automatic Route Normalizer (+not-found)
 *
 * Catches route mismatches, legacy paths, and group prefixes (e.g. /(app)/settings/index, /settings/index).
 * Automatically normalizes group-prefixed routes to clean public URLs.
 * Renders an on-brand Geist 404 fallback for genuinely unknown paths.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { usePathname, Redirect, useRouter } from 'expo-router';
import { useTheme } from '../components/ui/ThemeProvider';
import { Text } from '../components/ui/Text';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AlertCircle, Home } from '../components/ui/icon';
import { haptics } from '../lib/haptics';

export default function NotFoundScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const webPath = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : '';
  const currentPath = (pathname || webPath || '').trim();

  // Normalize route mismatches (strip group prefixes like /(app) and trailing /index)
  if (currentPath) {
    const raw = currentPath;

    // Specific Settings aliases
    if (
      raw === '/(app)/settings/index' ||
      raw === '/settings/index' ||
      raw === '/(app)/settings' ||
      raw === '/setting' ||
      raw === '/(app)/setting'
    ) {
      return <Redirect href="/settings" />;
    }

    // Legacy Settings sub-page normalizations
    if (raw === '/settings/notification' || raw === '/(app)/settings/notification') {
      return <Redirect href="/settings/notifications" />;
    }
    if (
      raw === '/settings/preference' ||
      raw === '/(app)/settings/preference' ||
      raw === '/settings/prefrences' ||
      raw === '/(app)/settings/prefrences'
    ) {
      return <Redirect href="/settings/preferences" />;
    }
    if (
      raw === '/settings/fontsize' ||
      raw === '/(app)/settings/fontsize' ||
      raw === '/settings/font-size' ||
      raw === '/(app)/settings/font-size'
    ) {
      return <Redirect href="/settings/preferences/font-size" />;
    }
    if (raw === '/settings/aboutapp' || raw === '/(app)/settings/aboutapp') {
      return <Redirect href="/settings/about" />;
    }
    if (
      raw === '/settings/appinfo' ||
      raw === '/(app)/settings/appinfo' ||
      raw === '/settings/app-info' ||
      raw === '/(app)/settings/app-info'
    ) {
      return <Redirect href="/settings/about/app-info" />;
    }
    if (
      raw === '/settings/whats-new' ||
      raw === '/(app)/settings/whats-new' ||
      raw === '/settings/whatsnew' ||
      raw === '/(app)/settings/whatsnew' ||
      raw === '/whats-new' ||
      raw === '/release-notes'
    ) {
      return <Redirect href="/settings/about/whats-new" />;
    }
    if (
      raw === '/settings/support' ||
      raw === '/(app)/settings/support' ||
      raw === '/settings/contact' ||
      raw === '/(app)/settings/contact'
    ) {
      return <Redirect href="/settings/about/support" />;
    }
    if (raw === '/settings/password' || raw === '/(app)/settings/password') {
      return <Redirect href="/settings/account/change-password" />;
    }
    if (raw === '/settings/security' || raw === '/(app)/settings/security') {
      return <Redirect href="/settings/account" />;
    }
    if (raw === '/settings/account/edit-profile' || raw === '/(app)/settings/account/edit-profile') {
      return <Redirect href="/settings/account/profile" />;
    }

    // Specific Settings sub-pages aliases
    if (raw.startsWith('/(app)/settings/')) {
      const sub = raw.replace(/^\/\(app\)\/settings\//, '');
      return <Redirect href={`/settings/${sub}` as any} />;
    }

    if (raw.startsWith('/setting/')) {
      const sub = raw.replace(/^\/setting\//, '');
      return <Redirect href={`/settings/${sub}` as any} />;
    }

    // General /(app) group prefix strip
    if (raw.startsWith('/(app)/')) {
      const cleanPath = raw.replace(/^\/\(app\)/, '').replace(/\/index$/, '') || '/dashboard';
      return <Redirect href={cleanPath as any} />;
    }

    // General trailing /index strip (e.g. /dashboard/index -> /dashboard)
    if (raw.endsWith('/index') && raw !== '/index') {
      const cleanPath = raw.replace(/\/index$/, '') || '/dashboard';
      return <Redirect href={cleanPath as any} />;
    }
  }

  const handleReturnHome = () => {
    haptics.select();
    router.replace('/dashboard');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <Card variant="elevated" style={styles.card}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isDark ? 'rgba(238, 0, 0, 0.15)' : '#fee2e2',
            },
          ]}
        >
          <AlertCircle size={28} color={theme.colors.error} />
        </View>

        <Text variant="display" style={{ color: theme.colors.ink }}>
          404
        </Text>

        <Text variant="subheading" style={{ color: theme.colors.ink }}>
          Page Not Found
        </Text>

        <Text variant="body" style={[styles.description, { color: theme.colors.mute }]}>
          The requested route {pathname ? `"${pathname}"` : 'could not be resolved'}. It may have been moved or updated.
        </Text>

        <Button
          variant="primary"
          onPress={handleReturnHome}
          style={styles.actionBtn}
          accessibilityLabel="Return to Dashboard"
        >
          <Home size={16} color={theme.colors.canvas} />
          <Text variant="label" style={{ color: theme.colors.canvas }}>
            Return to Dashboard
          </Text>
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    marginBottom: 8,
  },
  actionBtn: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
