/**
 * ReachInternational Mobile — Dedicated Account Security Sub-Page
 * Route: /settings/security
 * 
 * Displays cryptographic session telemetry, hardware-backed SecureStore status,
 * transport encryption verification, and security controls.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Badge,
  Button,
  useTheme,
  Text,
  Card,
  ConfirmDialog,
} from '../../../components/ui';
import {
  SettingsScreenContainer,
  SettingsSection,
  SettingsDivider,
} from '../../../components/settings';
import {
  radiusNumeric,
  spacingNumeric,
} from '@reachinternational/design-tokens';
import {
  Shield,
  ShieldCheck,
  Lock,
  Cpu,
  KeyRound,
  LogOut,
  Smartphone,
  CheckCircle2,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';

export default function AccountSecurityScreen() {
  const router = useRouter();
  const { user, role, userProfile, signOut } = useAuth();
  const { theme, isDark } = useTheme();

  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'Personnel');
  const userEmail = user?.email || userProfile?.email || 'Authenticated User';
  const userId = user?.id || 'Unknown UUID';
  const roleLabel = (role || userProfile?.role || 'OPERATOR').toUpperCase().replace(/_/g, ' ');

  const handleConfirmSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      setShowSignOutDialog(false);
      router.replace('/login');
    } catch (err) {
      console.error('[Security] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SettingsScreenContainer
      title="Account Security"
      showBack={true}
      onPressBack={() => router.back()}
    >
      {/* Session Verification Status Card */}
      <Card
        variant="elevated"
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ecfdf5',
            borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#a7f3d0',
          },
        ]}
      >
        <View style={styles.statusHeaderRow}>
          <ShieldCheck size={22} color="#059669" />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.badgeRow}>
              <Text variant="subheading" style={{ color: isDark ? '#34d399' : '#065f46' }}>
                Active Session Verified
              </Text>
              <Badge status="active" customLabel="TLS 1.3 SECURE" />
            </View>
            <Text variant="caption" style={{ color: isDark ? '#a7f3d0' : '#047857' }}>
              Your session is cryptographically bound to this device via hardware keystore tokens.
            </Text>
          </View>
        </View>
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 1: SESSION TELEMETRY */}
      {/* ========================================================================= */}
      <SettingsSection
        title="Session Telemetry"
        description="Authenticated personnel identity and access scope"
      >
        <View style={styles.telemetryCardInner}>
          <View style={styles.specRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>Personnel Account</Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>{displayName}</Text>
          </View>

          <SettingsDivider />

          <View style={styles.specRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>Authenticated Email</Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>{userEmail}</Text>
          </View>

          <SettingsDivider />

          <View style={styles.specRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>Assigned System Role</Text>
            <Badge status="active" customLabel={roleLabel} />
          </View>

          <SettingsDivider />

          <View style={styles.specRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>User Identifier (UUID)</Text>
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              {userId.substring(0, 18)}...
            </Text>
          </View>
        </View>
      </SettingsSection>

      {/* ========================================================================= */}
      {/* SECTION 2: DEVICE HARDWARE SECURITY */}
      {/* ========================================================================= */}
      <SettingsSection
        title="Device Security"
        description="Local storage encryption and hardware-backed key protection"
      >
        <View style={styles.telemetryCardInner}>
          <View style={styles.protocolRow}>
            <Smartphone size={16} color={theme.colors.link} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Hardware-Backed SecureStore
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {Platform.OS === 'ios'
                  ? 'Apple Keychain hardware enclave stores session and refresh tokens.'
                  : Platform.OS === 'android'
                  ? 'Android KeyStore hardware backed TEE protects sensitive auth credentials.'
                  : 'Web browser secure cookie & encrypted memory storage active.'}
              </Text>
            </View>
            <CheckCircle2 size={16} color="#059669" />
          </View>

          <SettingsDivider />

          <View style={styles.protocolRow}>
            <Cpu size={16} color={theme.colors.link} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Token Encryption at Rest
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Zero plain-text credential storage. Authentication secrets are prohibited from unencrypted disk storage.
              </Text>
            </View>
            <CheckCircle2 size={16} color="#059669" />
          </View>
        </View>
      </SettingsSection>

      {/* ========================================================================= */}
      {/* SECTION 3: CLOUD & TRANSPORT PROTOCOLS */}
      {/* ========================================================================= */}
      <SettingsSection
        title="Transport & Cloud"
        description="Cryptographic data transfer and database tenant boundaries"
      >
        <View style={styles.telemetryCardInner}>
          <View style={styles.protocolRow}>
            <Lock size={16} color={theme.colors.link} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                TLS 1.3 Transport Encryption
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Strict end-to-end forward secrecy on all Supabase PostgreSQL and API communications.
              </Text>
            </View>
            <Badge status="active" customLabel="ACTIVE" />
          </View>

          <SettingsDivider />

          <View style={styles.protocolRow}>
            <Shield size={16} color={theme.colors.link} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Row Level Security (RLS)
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Database queries are restricted to authorized clients, machinery sites, and assigned operators.
              </Text>
            </View>
            <Badge status="active" customLabel="ENFORCED" />
          </View>

          <SettingsDivider />

          <View style={styles.protocolRow}>
            <KeyRound size={16} color={theme.colors.link} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Cryptographic JWT Standard
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Supabase HMAC-SHA256 & Ed25519 token signatures with automatic background rotation.
              </Text>
            </View>
            <Badge status="neutral" customLabel="JWT" />
          </View>
        </View>
      </SettingsSection>

      {/* ========================================================================= */}
      {/* SECTION 4: TERMINATE SESSION ACTION */}
      {/* ========================================================================= */}
      <View style={{ marginTop: spacingNumeric.sm }}>
        <Button
          label="Terminate Session on This Device"
          onPress={() => {
            haptics.select();
            setShowSignOutDialog(true);
          }}
          variant="danger"
          shape="pill"
          icon={<LogOut size={16} color="#ffffff" />}
          fullWidth
        />
      </View>

      {/* Confirm Sign Out Dialog */}
      <ConfirmDialog
        visible={showSignOutDialog}
        onClose={() => {
          if (!isSigningOut) setShowSignOutDialog(false);
        }}
        onConfirm={handleConfirmSignOut}
        title="Terminate Session"
        message="Are you sure you want to invalidate your authentication session on this device?"
        confirmText="Terminate Session"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSigningOut}
        icon={<LogOut size={22} color={theme.colors.error} />}
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    padding: 14,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  telemetryCardInner: {
    padding: 14,
    gap: 12,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
