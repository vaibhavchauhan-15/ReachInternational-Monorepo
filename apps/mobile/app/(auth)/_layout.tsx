/**
 * ServiceCentric Mobile — Auth Stack Layout
 */

import React from 'react';
import { Stack } from 'expo-router';
import { colorsDark } from '@servicecentric/design-tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colorsDark.canvas },
      }}
    />
  );
}
