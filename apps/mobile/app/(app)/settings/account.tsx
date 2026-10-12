/**
 * ReachInternational Mobile — Account Settings
 * Route: /settings/account
 * 
 * Displays strictly the 3 canonical navigation cards:
 * 1. Edit Profile -> /profile?edit=true
 * 2. Change Password -> /settings/password
 * 3. Delete Account -> /account-deletion
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text } from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  User,
  KeyRound,
  Shield,
  Trash2,
  ChevronRight,
} from '../../../components/ui/icon';

interface AccountNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  isDestructive?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function AccountNavCard({
  icon,
  iconBg,
  title,
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
          borderColor: isDestructive ? (theme.colors.error || '#ee0000') + '40' : theme.colors.hairline,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
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

  return (
    <SettingsScreenContainer
      title="Account"
      showBack={true}
      onPressBack={() => router.back()}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Edit Profile Card */}
      <AccountNavCard
        icon={<User size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Edit Profile"
        onPress={() => router.push('/profile/edit' as any)}
        accessibilityLabel="Open Edit Profile screen"
      />

      {/* 2. Change Password Card */}
      <AccountNavCard
        icon={<KeyRound size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Change Password"
        onPress={() => router.push('/settings/password' as any)}
        accessibilityLabel="Navigate to Change Password screen"
      />

      {/* 3. Account Security Card */}
      <AccountNavCard
        icon={<Shield size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="Account Security"
        onPress={() => router.push('/settings/security' as any)}
        accessibilityLabel="Navigate to Account Security screen"
      />

      {/* 4. Delete Account Card */}
      <AccountNavCard
        icon={<Trash2 size={20} color="#e11d48" />}
        iconBg={isDark ? 'rgba(225, 29, 72, 0.15)' : '#fee2e2'}
        title="Delete Account"
        isDestructive={true}
        onPress={() => router.push('/account-deletion' as any)}
        accessibilityLabel="Navigate to Delete Account screen"
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
