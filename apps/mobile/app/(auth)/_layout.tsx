/**
 * ServiceCentric Mobile — Auth Stack Layout
 */

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';

export default function AuthLayout() {
  const { theme } = useTheme();
  const { session, isLoading, isProfileComplete } = useAuth();

  // Redirect authenticated user away from auth screens to dashboard or onboarding
  if (!isLoading && session) {
    if (!isProfileComplete) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return <Redirect href="/(app)/dashboard" />;
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
