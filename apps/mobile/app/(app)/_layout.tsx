import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, Text } from '../../components/ui';
import { MobileBottomNav } from '../../components/navigation/MobileBottomNav';
import { OfflineBanner } from '../../components/offline/OfflineBanner';

import { NotificationPermissionModal } from '../../components/permissions';
import { shouldPromptNotificationPermission } from '../../lib/permissions';
import { navigationPresets, screenAnim } from '../../lib/motion';

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
        <Text variant="body" style={{ color: theme.colors.mute }}>Loading session...</Text>
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
        initialRouteName="dashboard"
        tabBar={() => <MobileBottomNav />}
        screenOptions={{
          headerShown: false,
          ...navigationPresets.tabsFade,
        }}
      >
        {/* Primary Monorepo Modules Accessible via Bottom Nav */}
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
        <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
        <Tabs.Screen name="clients" options={{ title: 'Clients' }} />
        <Tabs.Screen name="users" options={{ title: 'Users' }} />
        <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
        <Tabs.Screen name="payroll" options={{ title: 'Payroll' }} />
        <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />

        {/* Settings Module Dedicated Sub-Pages */}
        <Tabs.Screen name="settings/account" options={{ ...screenAnim.tab, title: 'Account Settings', href: null }} />
        <Tabs.Screen name="settings/password" options={{ ...screenAnim.tab, title: 'Change Password', href: null }} />
        <Tabs.Screen name="settings/security" options={{ ...screenAnim.tab, title: 'Account Security', href: null }} />
        <Tabs.Screen name="settings/notification" options={{ ...screenAnim.tab, title: 'Notification Settings', href: null }} />
        <Tabs.Screen name="settings/preference" options={{ ...screenAnim.tab, title: 'Preferences', href: null }} />
        <Tabs.Screen name="settings/preferences" options={{ ...screenAnim.tab, title: 'Preferences', href: null }} />
        <Tabs.Screen name="settings/prefrences" options={{ ...screenAnim.tab, title: 'Preferences', href: null }} />
        <Tabs.Screen name="settings/fontsize" options={{ ...screenAnim.tab, title: 'Font Size', href: null }} />
        <Tabs.Screen name="settings/aboutapp" options={{ ...screenAnim.tab, title: 'About App', href: null }} />
        <Tabs.Screen name="settings/appinfo" options={{ ...screenAnim.tab, title: 'App Information', href: null }} />
        <Tabs.Screen name="settings/support" options={{ ...screenAnim.tab, title: 'Support & Contact', href: null }} />

        {/* Operational Modules Accessible via Settings & Command Palette */}
        <Tabs.Screen name="running-logs" options={{ ...screenAnim.tab, title: 'Running Logs', href: null }} />
        <Tabs.Screen name="audit" options={{ title: 'Audit', href: null }} />
        <Tabs.Screen name="hr" options={{ ...screenAnim.tab, title: 'HR', href: null }} />
        <Tabs.Screen name="profile/index" options={{ ...screenAnim.tab, title: 'Profile', href: null }} />
        <Tabs.Screen name="profile/edit" options={{ ...screenAnim.tab, title: 'Edit Profile', href: null }} />
        <Tabs.Screen name="privacy" options={{ ...screenAnim.tab, title: 'Privacy Policy', href: null }} />
        <Tabs.Screen name="terms" options={{ ...screenAnim.tab, title: 'Terms of Service', href: null }} />
        <Tabs.Screen name="account-deletion/index" options={{ ...navigationPresets.tabsFade, title: 'Account Deletion', href: null }} />
        <Tabs.Screen name="account-deletion/guide" options={{ ...navigationPresets.tabsFade, title: 'Account Deletion Guide', href: null }} />
        <Tabs.Screen name="motion-lab" options={{ ...navigationPresets.tabsFade, title: 'Motion Lab', href: null }} />
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
