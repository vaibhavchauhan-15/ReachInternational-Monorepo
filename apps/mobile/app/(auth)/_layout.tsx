/**
 * ServiceCentric Mobile — Auth Stack Layout
 */

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { getMobileRoleHomeRoute } from '@reachinternational/permissions';

export default function AuthLayout() {
  const { theme } = useTheme();
  const { session, isLoading, isProfileComplete, role } = useAuth();

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
      }}
    />
  );
}
