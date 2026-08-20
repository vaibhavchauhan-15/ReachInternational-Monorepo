/**
 * ServiceCentric Mobile — Gateway Landing Screen
 * Automatically routes user to dashboard if authenticated, or login screen if unauthenticated.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth/useAuth';
import { colorsDark, spacingNumeric } from '@reachinternational/design-tokens';

export default function GatewayScreen() {
  const { isLoading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        router.replace('/(app)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colorsDark.link} />
      <Text style={styles.loadingText}>Initializing ServiceCentric Mobile...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  loadingText: {
    marginTop: spacingNumeric.md,
    color: colorsDark.body,
    fontSize: 14,
  },
});
