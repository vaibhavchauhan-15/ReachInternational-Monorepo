import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme } from '../../components/ui';
import { MobileBottomNav } from '../../components/navigation/MobileBottomNav';
import { OfflineBanner } from '../../components/offline/OfflineBanner';

import { NotificationPermissionModal } from '../../components/permissions';
import { shouldPromptNotificationPermission } from '../../lib/permissions';

export default function AppLayout() {
  const { session, isLoading, isProfileComplete } = useAuth();
  const { theme } = useTheme();
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);

  // Check if notification permission should be prompted after app install/login
  React.useEffect(() => {
    if (session && isProfileComplete) {
      const timer = setTimeout(async () => {
        const shouldPrompt = await shouldPromptNotificationPermission();
        if (shouldPrompt) {
          setShowPermissionModal(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session, isProfileComplete]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text style={{ color: theme.colors.mute }}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isProfileComplete) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <Tabs
        tabBar={() => <MobileBottomNav />}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Primary Monorepo Modules Accessible via Bottom Nav */}
        <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
        <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
        <Tabs.Screen name="users" options={{ title: 'Users' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />

        {/* Operational Modules Accessible via Settings & Command Palette */}
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: null }} />
        <Tabs.Screen name="clients" options={{ title: 'Clients', href: null }} />
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', href: null }} />
        <Tabs.Screen name="privacy" options={{ title: 'Privacy Policy', href: null }} />
        <Tabs.Screen name="terms" options={{ title: 'Terms of Service', href: null }} />
        <Tabs.Screen name="account-deletion" options={{ title: 'Account Deletion', href: null }} />
      </Tabs>

      {/* Post-Install / First-Run Notification Permission Primer */}
      <NotificationPermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
