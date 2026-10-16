/**
 * ReachInternational Mobile — Auth Stack Layout
 * Centralized native-stack navigation for authentication flows:
 * - Login: seamless entrance
 * - Signup: forward horizontal slide from right with gesture back
 * - Forgot Password: modal sheet vertical slide from bottom
 * - Onboarding: forward horizontal slide from right with gesture back
 * Dynamically respects system reduced-motion preferences.
 */

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';
import { useNavigationMotion } from '../../lib/motion';

export default function AuthLayout() {
  const { theme } = useTheme();
  const { session, isLoading, isProfileComplete, role } = useAuth();
  const motion = useNavigationMotion();

  // Redirect authenticated user away from auth screens to role Home or onboarding
  if (!isLoading && session) {
    if (!isProfileComplete) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return <Redirect href={getMobileRoleHomeRoute(role) as any} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
        ...motion.stackDefault,
      }}
    >
      <Stack.Screen name="login" options={{ animation: motion.stackModalTransparent.animation }} />
      <Stack.Screen name="signup" options={{ ...motion.stackDefault }} />
      <Stack.Screen
        name="forgot-password"
        options={{
          ...motion.stackModalSheet,
        }}
      />
      <Stack.Screen name="onboarding" options={{ ...motion.stackDefault }} />
    </Stack>
  );
}
