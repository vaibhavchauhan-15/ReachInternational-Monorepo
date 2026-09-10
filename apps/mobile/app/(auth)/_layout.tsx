/**
 * ServiceCentric Mobile — Auth Stack Layout
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../components/ui/ThemeProvider';

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
      }}
    />
  );
}
