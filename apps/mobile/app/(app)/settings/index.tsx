/**
 * ReachInternational Mobile — Field Settings Hub
 * Clean, polished modular settings navigation with dedicated sub-pages for:
 * 1. Account & Security (/settings/account)
 * 2. Notifications (/settings/notification)
 * 3. Preferences & Theme (/settings/preference)
 * 4. About App (/settings/aboutapp)
 * Plus Sign Out action button and brand telemetry.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Card,
  Badge,
  Button,
  useTheme,
  MobileHeader,
  ReachInternationalLogo,
  ConfirmDialog,
} from '../../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
} from '../../../lib/brand';
import {
  User,
  Bell,
  Palette,
  Info,
  LogOut,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react-native';

const NOTIF_PREFS_KEY = '@reach:notification_preferences';

export default function SettingsHubScreen() {
  const router = useRouter();
  const { user, role, signOut, refreshSession, userProfile } = useAuth();
  const { theme, isDark, mode } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Load push preference for badge indicator
  const loadNotifState = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.push === 'boolean') {
          setPushEnabled(parsed.push);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadNotifState();
  }, [loadNotifState]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshSession) await refreshSession();
      await loadNotifState();
    } catch (e) {
      console.warn('[SettingsHubScreen] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, loadNotifState]);

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    Haptics.selectionAsync().catch(() => {});
    setShowSignOutDialog(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      setShowSignOutDialog(false);
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('[Settings] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayEmail = userProfile?.email || user?.email || '';
  const roleLabel = (role || userProfile?.role || 'OPERATOR').toUpperCase().replace(/_/g, ' ');

  const themeModeLabel = mode === 'system' ? 'SYSTEM' : mode === 'dark' ? 'DARK' : 'LIGHT';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Edge-to-edge Top Header */}
      <MobileHeader
        title="Settings"
        showBack={false}
        showQuickAccess={true}
        showQuickAccessCapsule={false}
        showMoreMenu={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      >
        {/* ========================================================================= */}
        {/* HERO PROFILE ROW (TAP -> /settings/account) */}
        {/* ========================================================================= */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(app)/settings/account' as any);
          }}
          style={[
            styles.profileHeroCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.profileLeftRow}>
            <View
              style={[
                styles.avatarOrb,
                {
                  backgroundColor: theme.colors.ink,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.colors.canvas }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.profileName, { color: theme.colors.ink }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Badge status="active" customLabel={roleLabel} />
              </View>
              <Text style={[styles.profileEmail, { color: theme.colors.mute }]} numberOfLines={1}>
                {displayEmail}
              </Text>
            </View>

            <View
              style={[
                styles.chevronCircle,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
            >
              <ChevronRight size={16} color={theme.colors.mute} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Section Heading */}
        <Text style={[styles.sectionGroupTitle, { color: theme.colors.mute }]}>
          PREFERENCES & GOVERNANCE
        </Text>

        {/* ========================================================================= */}
        {/* SUB-PAGE 1: ACCOUNT & SECURITY */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(app)/settings/account' as any);
          }}
          style={styles.navTouchCard}
        >
          <View style={styles.navRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' }]}>
              <User size={19} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: theme.colors.ink }]}>
                Account & Security
              </Text>
              <Text style={[styles.navSubtitle, { color: theme.colors.mute }]}>
                Change password, personnel profile & data erasure
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* SUB-PAGE 2: NOTIFICATIONS */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(app)/settings/notification' as any);
          }}
          style={styles.navTouchCard}
        >
          <View style={styles.navRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe' }]}>
              <Bell size={19} color={isDark ? '#a78bfa' : '#7c3aed'} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.navTitleRow}>
                <Text style={[styles.navTitle, { color: theme.colors.ink }]}>
                  Notifications
                </Text>
                {pushEnabled ? (
                  <Badge status="active" customLabel="ACTIVE" />
                ) : (
                  <Badge status="error" customLabel="MUTED" />
                )}
              </View>
              <Text style={[styles.navSubtitle, { color: theme.colors.mute }]}>
                Push alerts, shift reminders & breakdown notices
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* SUB-PAGE 3: PREFERENCES & THEME */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(app)/settings/preference' as any);
          }}
          style={styles.navTouchCard}
        >
          <View style={styles.navRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
              <Palette size={19} color={isDark ? '#fbbf24' : '#d97706'} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.navTitleRow}>
                <Text style={[styles.navTitle, { color: theme.colors.ink }]}>
                  Preferences & Theme
                </Text>
                <Badge status="pending" customLabel={themeModeLabel} />
              </View>
              <Text style={[styles.navSubtitle, { color: theme.colors.mute }]}>
                Appearance (Light / Dark / System), font scale & haptics
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* SUB-PAGE 4: ABOUT APP */}
        {/* ========================================================================= */}
        <Card
          variant="interactive"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/(app)/settings/aboutapp' as any);
          }}
          style={styles.navTouchCard}
        >
          <View style={styles.navRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
              <Info size={19} color={isDark ? '#34d399' : '#059669'} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: theme.colors.ink }]}>
                About Reach International
              </Text>
              <Text style={[styles.navSubtitle, { color: theme.colors.mute }]}>
                v1.0.0 (Build 42) • Privacy Policy • Terms & Conditions
              </Text>
            </View>

            <ChevronRight size={18} color={theme.colors.mute} />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* SIGN OUT BUTTON AT THE END */}
        {/* ========================================================================= */}
        <View style={styles.signOutContainer}>
          <Button
            label="Sign Out of Session"
            onPress={handleSignOut}
            variant="danger"
            shape="pill"
            icon={<LogOut size={16} color="#ffffff" />}
            fullWidth
          />
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <ReachInternationalLogo size={18} showTagline={false} />
          <Text style={[styles.brandFooterText, { color: theme.colors.mute }]}>
            {BRAND_NAME} • {BRAND_TAGLINE}
          </Text>
          <Text style={[styles.brandVersionText, { color: theme.colors.mute }]}>
            v1.0.0 (Build 42) • Production Fleet Release
          </Text>
        </View>
      </ScrollView>

      {/* ─── Confirm Sign Out Dialog ─── */}
      <ConfirmDialog
        visible={showSignOutDialog}
        onClose={() => {
          if (!isSigningOut) setShowSignOutDialog(false);
        }}
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of Reach International on this mobile device?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSigningOut}
        icon={<LogOut size={22} color={theme.colors.error} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm + 2,
    paddingBottom: 96,
  },
  profileHeroCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  profileLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarOrb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileName: {
    fontSize: 15.5,
    fontWeight: '700',
    flex: 1,
  },
  profileEmail: {
    fontSize: 12.5,
    marginTop: 2,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  navTouchCard: {
    padding: 14,
    borderRadius: radiusNumeric.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  signOutContainer: {
    marginTop: spacingNumeric.md,
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  brandFooterText: {
    fontSize: 11.5,
    marginTop: 4,
  },
  brandVersionText: {
    fontSize: 10.5,
  },
});
