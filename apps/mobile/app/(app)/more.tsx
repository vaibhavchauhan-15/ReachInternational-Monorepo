/**
 * ReachInternational Mobile — More / Account Screen
 * Mirrors web /more: profile header, overflow nav tiles, account rows, sign out.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { getNavForRole, labelFor } from '@reachinternational/permissions';
import type { UserRole } from '@reachinternational/types';
import {
  Gauge,
  Wrench,
  Building2,
  Users,
  Shield,
  LogOut,
  Trash2,
  FileText,
  ShieldCheck,
  Settings,
  User,
  Sun,
  Moon,
  ChevronRight,
  Banknote,
  CalendarCheck,
} from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  hr: 'HR',
  operator: 'Operator',
};

// Icon string key → Lucide RN component
const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  banknote: Banknote,
  'calendar-check': CalendarCheck,
};

export default function MoreScreen() {
  const { theme, isDark, setMode } = useTheme();
  const { user, role, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const normalizedRole = ((role || 'operator') as string).toLowerCase() as UserRole;
  const { more, hasMore } = getNavForRole(normalizedRole);

  const userName = user?.user_metadata?.full_name || 'User';
  const userEmail = user?.email || '';
  const roleLabel = ROLE_LABELS[normalizedRole] || normalizedRole;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile Header ─── */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/profile' as any)}
          activeOpacity={0.8}
          style={[
            styles.profileCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.profileRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.ink },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.colors.canvas }]}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text
                style={[styles.profileName, { color: theme.colors.ink }]}
                numberOfLines={1}
              >
                {userName}
              </Text>
              <Text
                style={[styles.profileEmail, { color: theme.colors.mute }]}
                numberOfLines={1}
              >
                {userEmail}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: `${theme.colors.ink}10`, borderColor: `${theme.colors.ink}20` },
                  ]}
                >
                  <Text style={[styles.roleText, { color: theme.colors.ink }]}>
                    {roleLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={[
                styles.editBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
              accessibilityLabel="View Profile"
            >
              <ChevronRight size={15} color={theme.colors.mute} />
            </View>
          </View>
        </TouchableOpacity>

        {/* ─── Overflow Navigation Tiles ─── */}
        {more.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>
              MORE PAGES
            </Text>
            <View style={styles.tileGrid}>
              {more.map((item) => {
                const Icon = ICONS[item.icon] || Shield;
                const label = labelFor(item, normalizedRole);
                // Map href to native route
                const nativeHref = `/(app)${item.href}` as any;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => router.push(nativeHref)}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityLabel={label}
                  >
                    <Icon size={22} color={theme.colors.mute} />
                    <Text
                      style={[styles.tileLabel, { color: theme.colors.ink }]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Settings Row ─── */}
        <View
          style={[
            styles.actionGroup,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.push('/(app)/settings' as any)}
            style={styles.actionRowLast}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <Settings size={16} color={theme.colors.mute} />
              <Text style={[styles.actionLabel, { color: theme.colors.ink }]}>
                Settings
              </Text>
            </View>
            <ChevronRight size={16} color={theme.colors.mute} />
          </TouchableOpacity>
        </View>

        {/* ─── Sign Out ─── */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={styles.signOutBtn}
          activeOpacity={0.7}
          accessibilityLabel="Sign Out"
        >
          <LogOut size={16} color="#dc2626" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  // Profile card
  profileCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Section
  section: {
    gap: spacingNumeric.xs,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
  },
  tile: {
    flex: 1,
    minWidth: '45%',
    minHeight: 88,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  // Action group
  actionGroup: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  actionRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    minHeight: 44,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs + 2,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.xs,
    paddingVertical: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    minHeight: 44,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
});
