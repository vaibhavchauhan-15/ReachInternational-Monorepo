import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, Text } from '../../components/ui';
import { MobileBottomNav } from '../../components/navigation/MobileBottomNav';
import { OfflineBanner } from '../../components/offline/OfflineBanner';

import { NotificationPermissionModal } from '../../components/permissions';
import { WhatsNewController } from '../../components/whats-new';
import { shouldPromptNotificationPermission } from '../../lib/permissions';
import { useNavigationMotion } from '../../lib/motion';
import { ErrorState } from '../../components/ui/ErrorState';

export default function AppLayout() {
  const { session, isLoading, isProfileComplete } = useAuth();
  const { theme } = useTheme();
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const motion = useNavigationMotion();

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
        backBehavior="history"
        tabBar={() => <MobileBottomNav />}
        screenOptions={{
          headerShown: false,
          ...motion.tabsSlide,
          ...motion.tabsFade,
          sceneStyle: { backgroundColor: theme.colors.canvas },
        }}
      >
        {/* Primary Monorepo Modules Accessible via Bottom Nav (Strictly Monotonic Left-to-Right Nav Order) */}
        <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
        <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
        <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
        <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
        <Tabs.Screen name="users" options={{ title: 'Users' }} />
        <Tabs.Screen name="clients/index" options={{ title: 'Clients' }} />
        <Tabs.Screen name="clients/[id]" options={{ ...motion.tabsShift, title: 'Client Details', href: null }} />
        <Tabs.Screen name="payroll" options={{ title: 'Payroll' }} />
        <Tabs.Screen name="settings/index" options={{ title: 'Settings' }} />

        {/* Settings Module — Account */}
        <Tabs.Screen name="settings/account/index" options={{ ...motion.tabsShift, title: 'Account Settings', href: null }} />
        <Tabs.Screen name="settings/account/profile" options={{ ...motion.tabsShift, title: 'Profile', href: null }} />
        <Tabs.Screen name="settings/account/change-password" options={{ ...motion.tabsShift, title: 'Change Password', href: null }} />
        <Tabs.Screen name="settings/account/forgot-password" options={{ ...motion.tabsShift, title: 'Forgot Password', href: null }} />
        <Tabs.Screen name="settings/account/change-email" options={{ ...motion.tabsShift, title: 'Change Email', href: null }} />

        {/* Settings Module — Notifications */}
        <Tabs.Screen name="settings/notifications" options={{ ...motion.tabsShift, title: 'Notification Settings', href: null }} />

        {/* Settings Module — Preferences */}
        <Tabs.Screen name="settings/preferences/index" options={{ ...motion.tabsShift, title: 'Preferences', href: null }} />
        <Tabs.Screen name="settings/preferences/font-size" options={{ ...motion.tabsShift, title: 'Font Size', href: null }} />

        {/* Settings Module — About */}
        <Tabs.Screen name="settings/about/index" options={{ ...motion.tabsShift, title: 'About App', href: null }} />
        <Tabs.Screen name="settings/about/whats-new" options={{ ...motion.tabsShift, title: "What's New", href: null }} />
        <Tabs.Screen name="settings/about/about-us" options={{ ...motion.tabsShift, title: 'About Us', href: null }} />
        <Tabs.Screen name="settings/about/app-info" options={{ ...motion.tabsShift, title: 'App Information', href: null }} />
        <Tabs.Screen name="settings/about/privacy" options={{ ...motion.tabsShift, title: 'Privacy Policy', href: null }} />
        <Tabs.Screen name="settings/about/terms" options={{ ...motion.tabsShift, title: 'Terms of Service', href: null }} />
        <Tabs.Screen name="settings/about/support" options={{ ...motion.tabsShift, title: 'Support & Contact', href: null }} />
        <Tabs.Screen name="settings/about/cookies" options={{ ...motion.tabsShift, title: 'Cookies & Storage Policy', href: null }} />

        {/* Operational Modules Accessible via Settings & Command Palette */}
        <Tabs.Screen name="running-logs" options={{ ...motion.tabsShift, title: 'Running Logs', href: null }} />
        <Tabs.Screen name="audit" options={{ title: 'Audit', href: null }} />
        <Tabs.Screen name="hr" options={{ ...motion.tabsShift, title: 'HR', href: null }} />
        <Tabs.Screen name="profile/index" options={{ ...motion.tabsShift, title: 'Profile', href: null }} />
        <Tabs.Screen name="profile/edit" options={{ ...motion.tabsShift, title: 'Edit Profile', href: null }} />
        <Tabs.Screen name="privacy" options={{ ...motion.tabsShift, title: 'Privacy Policy', href: null }} />
        <Tabs.Screen name="terms" options={{ ...motion.tabsShift, title: 'Terms of Service', href: null }} />
        <Tabs.Screen name="account-deletion/index" options={{ ...motion.tabsShift, title: 'Account Deletion', href: null }} />
        <Tabs.Screen name="account-deletion/guide" options={{ ...motion.tabsShift, title: 'Account Deletion Guide', href: null }} />
        <Tabs.Screen name="motion-lab" options={{ ...motion.tabsShift, title: 'Motion Lab', href: null }} />
      </Tabs>

      {/* Post-Install / First-Run Notification Permission Primer */}
      <NotificationPermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
      />

      {/* Production-Ready What's New Announcement Controller */}
      <WhatsNewController suppress={showPermissionModal} />
    </View>
  );
}

/**
 * Tab-level ErrorBoundary prevents single-tab crashes from blowing away
 * the persistent MobileBottomNav shell and keeps the user in-app.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorWrapper}>
      <ErrorState
        error={error}
        title="Module Error"
        message="An unexpected issue occurred while rendering this section. You can try reloading or switch to another section below."
        onRetry={retry}
        retryLabel="Reload Section"
      />
      <MobileBottomNav />
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
  errorWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
