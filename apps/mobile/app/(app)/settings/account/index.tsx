/**
 * ReachInternational Mobile — Account Settings Screen
 * Route: /settings/account
 * 
 * Provides centralized account management:
 * 1. Profile Details (/settings/account/profile - with Edit Profile workflow)
 * 2. Change Password (/settings/account/change-password)
 * 3. Forgot Password (/settings/account/forgot-password)
 * 4. Change Email (/settings/account/change-email)
 * 5. Delete Account (/account-deletion)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text } from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  User,
  KeyRound,
  Lock,
  Mail,
  Trash2,
  ChevronRight,
} from '../../../../components/ui/icon';

interface AccountNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  isDestructive?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function AccountNavCard({
  icon,
  iconBg,
  title,
  subtitle,
  isDestructive = false,
  onPress,
  accessibilityLabel,
}: AccountNavCardProps) {
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
          borderColor: isDestructive
            ? (theme.colors.error || '#ee0000') + '40'
            : theme.colors.hairline,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          style={[
            styles.cardTitle,
            { color: isDestructive ? theme.colors.error : theme.colors.ink },
          ]}
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
        <ChevronRight
          size={18}
          color={isDestructive ? theme.colors.error : theme.colors.mute}
        />
      </View>
    </Pressable>
  );
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings');
  };

  return (
    <SettingsScreenContainer
      title="Account Settings"
      showBack={true}
      backRoute="/settings"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Profile Details Card */}
      <AccountNavCard
        icon={<User size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Profile Details"
        subtitle="View personal, shift, and statutory KYC records"
        onPress={() => router.push('/settings/account/profile' as any)}
        accessibilityLabel="Navigate to Profile Details"
      />

      {/* 2. Change Password Card */}
      <AccountNavCard
        icon={<KeyRound size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Change Password"
        subtitle="Update account password with security verification"
        onPress={() => router.push('/settings/account/change-password' as any)}
        accessibilityLabel="Navigate to Change Password"
      />

      {/* 3. Forgot Password Card */}
      <AccountNavCard
        icon={<Lock size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Forgot Password"
        subtitle="Send password recovery link to your work email"
        onPress={() => router.push('/settings/account/forgot-password' as any)}
        accessibilityLabel="Navigate to Forgot Password"
      />

      {/* 4. Change Email Card */}
      <AccountNavCard
        icon={<Mail size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
        title="Change Email"
        subtitle="Request email update with cryptographic verification"
        onPress={() => router.push('/settings/account/change-email' as any)}
        accessibilityLabel="Navigate to Change Email"
      />

      {/* 5. Delete Account Card */}
      <AccountNavCard
        icon={<Trash2 size={20} color="#e11d48" />}
        iconBg={isDark ? 'rgba(225, 29, 72, 0.15)' : '#fee2e2'}
        title="Delete Account"
        subtitle="Permanently erase account and identity records"
        isDestructive={true}
        onPress={() => router.push('/account-deletion' as any)}
        accessibilityLabel="Navigate to Delete Account"
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
