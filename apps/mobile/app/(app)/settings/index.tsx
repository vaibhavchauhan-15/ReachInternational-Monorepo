/**
 * ReachInternational Mobile — Clean Settings Hub
 * 
 * Displays strictly the 4 canonical navigation cards:
 * 1. Account (/settings/account)
 * 2. Notification (/settings/notification)
 * 3. Preferences (/settings/preference / /settings/prefrences)
 * 4. About App (/settings/aboutapp)
 * Plus clean secure session sign out.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Card,
  Button,
  useTheme,
  ConfirmDialog,
  Text,
} from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  User,
  Bell,
  Sliders,
  Info,
  LogOut,
  ChevronRight,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';

interface SettingsNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function SettingsNavCard({
  icon,
  iconBg,
  title,
  onPress,
  accessibilityLabel,
}: SettingsNavCardProps) {
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

export default function SettingsHomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { theme, isDark } = useTheme();

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOutPress = () => {
    haptics.select();
    setShowSignOutDialog(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      setShowSignOutDialog(false);
      router.replace('/login');
    } catch (err) {
      console.error('[Settings] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SettingsScreenContainer
      title="Settings"
      showBack={false}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Account Card */}
      <SettingsNavCard
        icon={<User size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
        title="Account"
        onPress={() => router.push('/settings/account' as any)}
        accessibilityLabel="Navigate to Account Settings"
      />

      {/* 2. Notifications Card */}
      <SettingsNavCard
        icon={<Bell size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Notifications"
        onPress={() => router.push('/settings/notification' as any)}
        accessibilityLabel="Navigate to Notification Settings"
      />

      {/* 3. Preferences Card */}
      <SettingsNavCard
        icon={<Sliders size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Preferences"
        onPress={() => router.push('/settings/preference' as any)}
        accessibilityLabel="Navigate to Preferences Settings"
      />

      {/* 4. About App Card */}
      <SettingsNavCard
        icon={<Info size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="About App"
        onPress={() => router.push('/settings/aboutapp' as any)}
        accessibilityLabel="Navigate to About App"
      />

      {/* Session Sign Out Action */}
      <View style={styles.signOutBox}>
        <Button
          label="Sign Out"
          onPress={handleSignOutPress}
          variant="outline"
          shape="pill"
          icon={<LogOut size={16} color={theme.colors.ink} />}
          fullWidth
        />
      </View>

      {/* Confirm Sign Out Dialog */}
      <ConfirmDialog
        visible={showSignOutDialog}
        onClose={() => {
          if (!isSigningOut) setShowSignOutDialog(false);
        }}
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of Reach International on this mobile device?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSigningOut}
        icon={<LogOut size={22} color={theme.colors.error} />}
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
  signOutBox: {
    marginTop: spacingNumeric.lg,
  },
});
