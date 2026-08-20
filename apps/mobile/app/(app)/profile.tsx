import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { LogOut, Sun, Moon, Shield, Building } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, role, branchId, signOut } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="USER ACCOUNT"
        title="Field Staff Profile"
        subtitle="Account security, branch assignment & app preferences"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>USER IDENTIFICATION</Text>
          
          <Text style={[styles.label, { color: theme.colors.mute }]}>Account Email</Text>
          <Text style={[styles.value, { color: theme.colors.ink }]}>{user?.email || 'N/A'}</Text>

          <View style={styles.divider} />

          <Text style={[styles.label, { color: theme.colors.mute }]}>System Access Role</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Shield size={14} color={theme.colors.link} />
            <Badge status="active" customLabel={(role || 'Engineer').toUpperCase()} />
          </View>

          <View style={styles.divider} />

          <Text style={[styles.label, { color: theme.colors.mute }]}>Branch & Facility Scope</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Building size={14} color={theme.colors.mute} />
            <Text style={[styles.value, { color: theme.colors.ink, marginTop: 0 }]}>
              {branchId || 'Headquarters (Default Branch)'}
            </Text>
          </View>
        </Card>

        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>SYSTEM PREFERENCES</Text>
          <Text style={[styles.label, { color: theme.colors.mute }]}>Appearance Mode</Text>
          
          <Button
            label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            variant="outline"
            size="sm"
            icon={isDark ? <Sun size={14} color={theme.colors.warning} /> : <Moon size={14} color={theme.colors.ink} />}
            style={{ marginTop: spacingNumeric.xs }}
          />
        </Card>

        <Button
          label="Sign Out of Session"
          onPress={handleLogout}
          variant="danger"
          shape="pill"
          icon={<LogOut size={16} color="#ffffff" />}
          fullWidth
          style={{ marginTop: spacingNumeric.md }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingNumeric.md, paddingBottom: spacingNumeric.xl },
  card: { marginVertical: spacingNumeric.xs, padding: spacingNumeric.md },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: spacingNumeric.xs },
});
