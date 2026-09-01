import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { LogOut, Sun, Moon, Shield, Building, MapPin, Phone, Mail, User } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, role, signOut } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Simulate profile sync duration
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const metadata = user?.user_metadata || {};
  const fullName = metadata.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const userPhone = metadata.phone || '—';
  const locationString = [metadata.city, metadata.district, metadata.state].filter(Boolean).join(', ') || '—';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="USER ACCOUNT"
        title="Field Staff Profile"
        subtitle="Account credentials, field operational scope & system preferences"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* User Identity Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                {fullName[0]?.toUpperCase() || 'R'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: theme.colors.ink }]}>{fullName}</Text>
              <Text style={[styles.profileEmail, { color: theme.colors.mute }]}>{user?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Shield size={14} color={theme.colors.link} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>System Role:</Text>
            <Badge status="active" customLabel={(role || 'Operator').replace('_', ' ').toUpperCase()} />
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Phone size={14} color={theme.colors.mute} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Mobile Phone:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]}>{userPhone}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MapPin size={14} color={theme.colors.success} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Location:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]} numberOfLines={1}>{locationString}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Building size={14} color={theme.colors.mute} />
            <Text style={[styles.label, { color: theme.colors.mute }]}>Scope:</Text>
            <Text style={[styles.value, { color: theme.colors.ink }]}>Reach International Fleet (India)</Text>
          </View>
        </Card>

        {/* System Preferences Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>SYSTEM PREFERENCES</Text>
          <Text style={[styles.label, { color: theme.colors.mute }]}>Color Appearance</Text>

          <Button
            label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            variant="outline"
            size="sm"
            icon={isDark ? <Sun size={14} color={theme.colors.warning} /> : <Moon size={14} color={theme.colors.ink} />}
            style={{ marginTop: spacingNumeric.xs }}
          />
        </Card>

        {/* Sign Out Button */}
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 13, fontWeight: '700', flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: spacingNumeric.xs + 2 },
});
