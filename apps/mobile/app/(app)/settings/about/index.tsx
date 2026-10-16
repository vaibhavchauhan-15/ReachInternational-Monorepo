/**
 * ReachInternational Mobile — About App Hub Screen
 * Route: /settings/about
 * 
 * Displays verified application governance, legal policies, and help channels:
 * 1. App Information (/settings/about/app-info)
 * 2. Privacy Policy (/settings/about/privacy)
 * 3. Terms & Conditions (/settings/about/terms)
 * 4. Support & Contact (/settings/about/support)
 * 5. Cookie Policy (/settings/about/cookies)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text } from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Sparkles,
  Info,
  FileText,
  ClipboardList,
  Mail,
  Shield,
  ChevronRight,
} from '../../../../components/ui/icon';

interface AboutNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function AboutNavCard({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: AboutNavCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      variant="card"
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.navCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          style={[styles.cardTitle, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          style={[styles.cardSubtitle, { color: theme.colors.mute }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.chevronBox}>
        <ChevronRight size={18} color={theme.colors.mute} />
      </View>
    </Pressable>
  );
}

export default function AboutAppHomeScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings');
  };

  return (
    <SettingsScreenContainer
      title="About App"
      showBack={true}
      backRoute="/settings"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 0. What's New */}
      <AboutNavCard
        icon={<Sparkles size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="What's New"
        subtitle="Latest features, performance enhancements & release notes"
        onPress={() => router.push('/settings/about/whats-new' as any)}
        accessibilityLabel="Navigate to What's New and Release Notes"
      />

      {/* 1. App Information */}
      <AboutNavCard
        icon={<Info size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="App Information"
        subtitle="Version, runtime environment, Hermes engine & specs"
        onPress={() => router.push('/settings/about/app-info' as any)}
        accessibilityLabel="Navigate to App Information"
      />

      {/* 2. Privacy Policy */}
      <AboutNavCard
        icon={<FileText size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Privacy Policy"
        subtitle="Operational shift telemetry and statutory KYC protection"
        onPress={() => router.push('/settings/about/privacy' as any)}
        accessibilityLabel="Navigate to Privacy Policy"
      />

      {/* 3. Terms & Conditions */}
      <AboutNavCard
        icon={<ClipboardList size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
        title="Terms & Conditions"
        subtitle="Enterprise fleet usage rules & HMR integrity standards"
        onPress={() => router.push('/settings/about/terms' as any)}
        accessibilityLabel="Navigate to Terms and Conditions"
      />

      {/* 4. Support & Contact */}
      <AboutNavCard
        icon={<Mail size={20} color={isDark ? '#60a5fa' : '#2563eb'} />}
        iconBg={isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'}
        title="Support & Contact"
        subtitle="Enterprise technical help desk and official website"
        onPress={() => router.push('/settings/about/support' as any)}
        accessibilityLabel="Navigate to Support and Contact"
      />

      {/* 5. Cookies & Storage Policy */}
      <AboutNavCard
        icon={<Shield size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Cookies & Storage Policy"
        subtitle="Hardware keystores, offline caches & session storage"
        onPress={() => router.push('/settings/about/cookies' as any)}
        accessibilityLabel="Navigate to Cookie Policy"
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  navCard: {
    minHeight: 64,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    flexShrink: 1,
  },
  cardSubtitle: {
    marginTop: 1,
  },
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
