/**
 * ReachInternational Mobile — Clean Settings Hub
 * Route: /settings/index
 * 
 * Displays strictly the 4 canonical navigation cards:
 * 1. Account (/settings/account)
 * 2. Notifications (/settings/notifications)
 * 3. Preferences (/settings/preferences)
 * 4. About App (/settings/about)
 * Plus clean secure session sign out with Confirmation Dialog.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../../../lib/auth/useAuth';
import {
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
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function SettingsNavCard({
  icon,
  iconBg,
  title,
  subtitle,
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

export default function SettingsHomeScreen() {
  const router = useRouter();
  const { signOut, userProfile, role } = useAuth();
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
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('[Settings] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const roleText = (role || userProfile?.role || 'Operator').toUpperCase();
  const appVersion = Constants.expoConfig?.version || '1.3.0';

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
        subtitle={`Profile, credentials, KYC & security (${roleText})`}
        onPress={() => router.push('/settings/account' as any)}
        accessibilityLabel="Navigate to Account Settings"
      />

      {/* 2. Notifications Card */}
      <SettingsNavCard
        icon={<Bell size={20} color={isDark ? '#a78bfa' : '#7c3aed'} />}
        iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
        title="Notifications"
        subtitle="Shift reminders, machinery alerts & push controls"
        onPress={() => router.push('/settings/notifications' as any)}
        accessibilityLabel="Navigate to Notification Settings"
      />

      {/* 3. Preferences Card */}
      <SettingsNavCard
        icon={<Sliders size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Preferences"
        subtitle="Theme mode, font size scaling & haptic feedback"
        onPress={() => router.push('/settings/preferences' as any)}
        accessibilityLabel="Navigate to Preferences Settings"
      />

      {/* 4. About App Card */}
      <SettingsNavCard
        icon={<Info size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="About App"
        subtitle={`Version ${appVersion}, privacy, terms, support & cookies`}
        onPress={() => router.push('/settings/about' as any)}
        accessibilityLabel="Navigate to About App"
      />

      {/* Session Sign Out Action */}
      <View style={styles.signOutBox}>
        <Button
          label="Sign Out"
          onPress={handleSignOutPress}
          variant="danger"
          shape="pill"
          icon={<LogOut size={16} color="#ffffff" />}
          fullWidth
        />
      </View>

      {/* App Version Info */}
      <View style={styles.versionContainer}>
        <Text
          variant="caption"
          style={[styles.versionText, { color: theme.colors.mute }]}
        >
          Version {appVersion}
        </Text>
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
  signOutBox: {
    marginTop: spacingNumeric.lg,
  },
  versionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.sm,
  },
  versionText: {
    textAlign: 'center',
  },
});
