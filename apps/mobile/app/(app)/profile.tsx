/**
 * ServiceCentric Mobile — User Profile Screen
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { spacingNumeric } from '@servicecentric/design-tokens';

export default function ProfileScreen() {
  const { user, role, branchId, signOut } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.canvas }]} contentContainerStyle={styles.content}>
      <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Technician Profile</Text>

      <Card style={styles.card}>
        <Text style={[styles.label, { color: theme.colors.mute }]}>Email</Text>
        <Text style={[styles.value, { color: theme.colors.ink }]}>{user?.email || 'N/A'}</Text>

        <Text style={[styles.label, { color: theme.colors.mute, marginTop: spacingNumeric.sm }]}>System Role</Text>
        <Badge status="active" customLabel={role || 'Engineer'} style={{ marginTop: 2 }} />

        <Text style={[styles.label, { color: theme.colors.mute, marginTop: spacingNumeric.sm }]}>Branch Scope</Text>
        <Text style={[styles.value, { color: theme.colors.ink }]}>{branchId || 'Headquarters (Default)'}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.label, { color: theme.colors.mute }]}>Appearance Theme</Text>
        <Button
          label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          variant="outline"
          size="sm"
          style={{ marginTop: spacingNumeric.xs }}
        />
      </Card>

      <Button
        label="Sign Out"
        onPress={handleLogout}
        variant="danger"
        fullWidth
        style={{ marginTop: spacingNumeric.md }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingNumeric.md, paddingTop: 50 },
  screenTitle: { fontSize: 24, fontWeight: '700', marginBottom: spacingNumeric.md },
  card: { marginVertical: spacingNumeric.xs },
  label: { fontSize: 12, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '600', marginTop: 2 },
});
