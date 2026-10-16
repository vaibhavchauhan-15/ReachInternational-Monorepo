/**
 * ReachInternational Mobile — Cookies & Local Storage Policy Screen
 * Route: /settings/about/cookies
 * 
 * Transparent documentation on client storage, hardware keystores,
 * and session state management.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  Text,
  Badge,
} from '../../../../components/ui';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  ShieldCheck,
  Smartphone,
  Database,
  Lock,
  CheckCircle2,
} from '../../../../components/ui/icon';

export default function CookiesPolicyScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  return (
    <SettingsScreenContainer
      title="Cookies & Storage"
      showBack={true}
      backRoute="/settings/about"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* Header Overview Card */}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.badgeRow}>
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            Storage & Session Policy
          </Text>
          <Badge status="active" customLabel="STRICT SECURITY" />
        </View>
        <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
          Last Updated: October 2026 • Enterprise Fleet Standards
        </Text>
        <Text variant="body" style={[styles.bodyText, { color: theme.colors.body }]}>
          Reach International uses hardware keystore enclaves, local application storage, and essential HTTP session cookies solely to authenticate operators, facilitate offline shift logging, and preserve visual preferences.
        </Text>
      </Card>

      {/* Section 1: Hardware Keystore Authentication */}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Smartphone size={18} color="#0284c7" />
          <Text variant="subheading" style={{ color: theme.colors.ink }}>
            1. Hardware Keystore Storage
          </Text>
        </View>
        <Text variant="body" style={{ color: theme.colors.body }}>
          Authentication tokens and cryptographic refresh keys are stored exclusively in hardware-backed secure storage (Android KeyStore TEE / iOS Keychain Enclave) via Expo SecureStore. Sensitive credentials are never written to unencrypted disk or exposed to external apps.
        </Text>
        <View style={styles.bulletRow}>
          <CheckCircle2 size={14} color="#059669" />
          <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
            Automatically purged upon session logout or account deactivation.
          </Text>
        </View>
      </Card>

      {/* Section 2: Local Application Storage */}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Database size={18} color="#059669" />
          <Text variant="subheading" style={{ color: theme.colors.ink }}>
            2. Local Application Cache (AsyncStorage)
          </Text>
        </View>
        <Text variant="body" style={{ color: theme.colors.body }}>
          Non-sensitive application state is cached locally in sandboxed mobile storage to ensure uninterrupted service in low-connectivity construction and yard environments:
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletRow}>
            <CheckCircle2 size={14} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
              <Text variant="label" style={{ color: theme.colors.ink }}>Offline Shift Queue: </Text>
              Temporarily stores recorded Hour Meter Readings until cell network reconnects.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <CheckCircle2 size={14} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
              <Text variant="label" style={{ color: theme.colors.ink }}>User Preferences: </Text>
              Persists theme choice (Dark, Light, System), font scaling preset, and haptic vibration preference.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <CheckCircle2 size={14} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
              <Text variant="label" style={{ color: theme.colors.ink }}>Instant Cold-Start Cache: </Text>
              Hydrates recent machinery lists and roster data with zero network latency on startup.
            </Text>
          </View>
        </View>
      </Card>

      {/* Section 3: Web Cookies */}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Lock size={18} color="#7c3aed" />
          <Text variant="subheading" style={{ color: theme.colors.ink }}>
            3. Web Export Session Cookies
          </Text>
        </View>
        <Text variant="body" style={{ color: theme.colors.body }}>
          When the application runs in a web browser, it utilizes strictly essential, encrypted HTTP-only cookies with SameSite=Lax protection. These cookies transmit authorization headers securely to the Supabase API.
        </Text>
      </Card>

      {/* Section 4: Zero Advertising or Tracking Guarantee */}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color="#059669" />
          <Text variant="subheading" style={{ color: theme.colors.ink }}>
            4. Zero Third-Party Tracking Guarantee
          </Text>
        </View>
        <Text variant="body" style={{ color: theme.colors.body }}>
          Reach International never deploys advertising cookies, cross-site trackers, commercial pixels, or third-party marketing beacons. All stored telemetry remains strictly bound to your organization&apos;s heavy equipment operations.
        </Text>
      </Card>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subtitle: {
    marginTop: 2,
  },
  bodyText: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletList: {
    gap: 8,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
});
