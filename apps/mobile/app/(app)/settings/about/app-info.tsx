/**
 * ReachInternational Mobile — Dedicated App Information Screen
 * Route: /settings/about/app-info
 * 
 * Displays verified application specifications, runtime environment,
 * and engine details in clean industrial cards.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  Card,
  useTheme,
  ReachInternationalLogo,
  Text,
} from '../../../../components/ui';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
} from '../../../../lib/brand';
import {
  Cpu,
  Layers,
  Smartphone,
  Tag,
  ShieldCheck,
  Database,
} from '../../../../components/ui/icon';

interface SpecRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  isLast?: boolean;
}

function SpecRow({ icon, iconBg, label, value, isLast = false }: SpecRowProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.specRowContainer}>
      <View style={styles.specInnerRow}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.specTextCol}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            {label}
          </Text>
          <Text variant="subheading" style={{ color: theme.colors.ink }}>
            {value}
          </Text>
        </View>
      </View>
      {!isLast ? (
        <View
          style={[
            styles.specDivider,
            { backgroundColor: theme.colors.hairline },
          ]}
        />
      ) : null}
    </View>
  );
}

export default function AppInfoScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  return (
    <SettingsScreenContainer
      title="App Information"
      showBack={true}
      backRoute="/settings/about"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* Brand Hero Card */}
      <Card
        variant="elevated"
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.heroCenter}>
          <ReachInternationalLogo size={24} showTagline={false} />
          <Text variant="heading" style={[styles.brandTitle, { color: theme.colors.ink }]}>
            {BRAND_NAME}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            {BRAND_TAGLINE}
          </Text>
        </View>
      </Card>

      {/* Specifications Card */}
      <Card
        variant="elevated"
        style={[
          styles.specsCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <SpecRow
          icon={<Tag size={18} color={isDark ? '#38bdf8' : '#0284c7'} />}
          iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
          label="Version"
          value={`v${Constants.expoConfig?.version || '1.3.0'} (Build ${Constants.expoConfig?.android?.versionCode || 4})`}
        />

        <SpecRow
          icon={<Smartphone size={18} color={isDark ? '#34d399' : '#059669'} />}
          iconBg={isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5'}
          label="Platform Runtime"
          value="Expo SDK 57 • React Native"
        />

        <SpecRow
          icon={<Cpu size={18} color={isDark ? '#a78bfa' : '#7c3aed'} />}
          iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
          label="JavaScript Engine"
          value="Hermes Bytecode (AOT)"
        />

        <SpecRow
          icon={<Layers size={18} color={isDark ? '#fbbf24' : '#d97706'} />}
          iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
          label="Architecture Profile"
          value="Multi-Tenant Industrial Fleet"
        />

        <SpecRow
          icon={<ShieldCheck size={18} color={isDark ? '#34d399' : '#059669'} />}
          iconBg={isDark ? 'rgba(5, 150, 105, 0.15)' : '#d1fae5'}
          label="Hardware Cryptography"
          value="SecureStore (KeyStore / Keychain)"
        />

        <SpecRow
          icon={<Database size={18} color={isDark ? '#38bdf8' : '#0284c7'} />}
          iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
          label="Offline Synchronization"
          value="TanStack Query & Persistent Queue"
          isLast={true}
        />
      </Card>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 14,
  },
  heroCard: {
    padding: 20,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    marginTop: 2,
  },
  specsCard: {
    padding: 0,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  specRowContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  specInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specTextCol: {
    flex: 1,
    gap: 2,
  },
  specDivider: {
    height: 1,
    marginTop: 14,
  },
});
