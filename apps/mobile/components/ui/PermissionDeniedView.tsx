/**
 * ReachInternational Mobile — Canonical PermissionDeniedView Component
 * 
 * Renders an enterprise RBAC boundary screen when a user attempts to access
 * an unauthorized module or action, replacing blank screens or abrupt redirects.
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on navigation actions
 * - Clear role discrepancy explanation and safe return path
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import { ShieldAlert, ArrowLeft, Home } from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export interface PermissionDeniedViewProps {
  title?: string;
  description?: string;
  featureName?: string;
  currentRole?: string | null;
  requiredRoles?: string[];
  onBack?: () => void;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const PermissionDeniedView: React.FC<PermissionDeniedViewProps> = ({
  title = 'Access Restricted',
  description,
  featureName,
  currentRole,
  requiredRoles,
  onBack,
  fullScreen = true,
  style,
  testID = 'permission-denied-view',
}) => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleReturnHome = () => {
    try {
      haptics.select();
    } catch {
      // ignore
    }

    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/dashboard');
    }
  };

  const defaultDesc = featureName
    ? `Your account role does not have authorization to view or manage ${featureName}.`
    : 'You do not have the required system permissions to access this screen.';

  const formattedCurrentRole = currentRole ? currentRole.toUpperCase().replace(/_/g, ' ') : null;
  const formattedRequiredRoles =
    requiredRoles && requiredRoles.length > 0
      ? requiredRoles.map((r) => r.toUpperCase().replace(/_/g, ' ')).join(', ')
      : null;

  return (
    <View
      style={[
        fullScreen ? styles.fullScreenContainer : styles.containedContainer,
        {
          backgroundColor: fullScreen ? theme.colors.canvas : theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={title}
      testID={testID}
    >
      <View
        style={[
          styles.contentCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Shield Icon Box with Theme-Aware Amber/Red Wash */}
        <View
          style={[
            styles.iconCapsule,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
            },
          ]}
        >
          <ShieldAlert size={32} color={isDark ? '#f87171' : '#dc2626'} />
        </View>

        {/* Title */}
        <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>
          {title}
        </Text>

        {/* Description */}
        <Text variant="body" style={[styles.description, { color: theme.colors.mute }]}>
          {description || defaultDesc}
        </Text>

        {/* Role Diagnostic Metadata */}
        {Boolean(formattedCurrentRole || formattedRequiredRoles) && (
          <View
            style={[
              styles.metaBox,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {Boolean(formattedCurrentRole) && (
              <View style={styles.metaRow}>
                <Text variant="micro" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                  YOUR ROLE:
                </Text>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Text variant="micro" style={{ color: theme.colors.ink }}>
                    {formattedCurrentRole}
                  </Text>
                </View>
              </View>
            )}

            {Boolean(formattedRequiredRoles) && (
              <View style={[styles.metaRow, { marginTop: 6 }]}>
                <Text variant="micro" style={[styles.metaLabel, { color: theme.colors.mute }]}>
                  AUTHORIZED:
                </Text>
                <Text variant="micro" style={[styles.authorizedRoles, { color: theme.colors.ink }]}>
                  {formattedRequiredRoles}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Return Button */}
        <Pressable
          variant="buttonPrimary"
          haptic="select"
          hitSlopToMin48
          onPress={handleReturnHome}
          style={[styles.returnBtn, { backgroundColor: theme.colors.ink }]}
          accessibilityRole="button"
          accessibilityLabel="Return to Dashboard"
        >
          <Home size={15} color={theme.colors.canvas} style={{ marginRight: 6 }} />
          <Text variant="label" style={{ color: theme.colors.canvas }}>
            Return to Dashboard
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingNumeric.lg,
  },
  containedContainer: {
    width: '100%',
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.md,
  },
  contentCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCapsule: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacingNumeric.md,
    maxWidth: 320,
  },
  metaBox: {
    width: '100%',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLabel: {
    opacity: 0.8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  authorizedRoles: {
    flexShrink: 1,
    textAlign: 'right',
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    minHeight: 46,
  },
});

export default PermissionDeniedView;
