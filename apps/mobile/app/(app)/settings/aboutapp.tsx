/**
 * ReachInternational Mobile — About App Settings
 * Route: /settings/aboutapp
 * 
 * Displays strictly the 4 canonical navigation cards:
 * 1. App Information -> /settings/appinfo
 * 2. Privacy Policy -> /privacy (publicly accessible route)
 * 3. Terms & Conditions -> /terms (publicly accessible route)
 * 4. Support & Contact -> /settings/support
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text } from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Info,
  FileText,
  ClipboardList,
  Mail,
  ChevronRight,
} from '../../../components/ui/icon';

interface AboutNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function AboutNavCard({
  icon,
  iconBg,
  title,
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
      <Text
        variant="subheading"
        style={[styles.cardTitle, { color: theme.colors.ink }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.chevronBox}>
        <ChevronRight size={18} color={theme.colors.mute} />
      </View>
    </Pressable>
  );
}

export default function AboutAppScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <SettingsScreenContainer
      title="About App"
      showBack={true}
      onPressBack={() => router.back()}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. App Information Dedicated Page */}
      <AboutNavCard
        icon={<Info size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="App Information"
        onPress={() => router.push('/settings/appinfo' as any)}
        accessibilityLabel="Navigate to App Information"
      />

      {/* 2. Privacy Policy Dedicated Page */}
      <AboutNavCard
        icon={<FileText size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Privacy Policy"
        onPress={() => router.push('/privacy' as any)}
        accessibilityLabel="Navigate to Privacy Policy"
      />

      {/* 3. Terms & Conditions Dedicated Page */}
      <AboutNavCard
        icon={<ClipboardList size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
        title="Terms & Conditions"
        onPress={() => router.push('/terms' as any)}
        accessibilityLabel="Navigate to Terms and Conditions"
      />

      {/* 4. Support & Contact Dedicated Page */}
      <AboutNavCard
        icon={<Mail size={20} color={isDark ? '#60a5fa' : '#2563eb'} />}
        iconBg={isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'}
        title="Support & Contact"
        onPress={() => router.push('/settings/support' as any)}
        accessibilityLabel="Navigate to Support and Contact"
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  navCard: {
    minHeight: 56,
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
  cardTitle: {
    flex: 1,
  },
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
