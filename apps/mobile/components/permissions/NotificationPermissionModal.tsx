/**
 * ReachInternational Mobile — NotificationPermissionModal
 * Clean, consistent notification permission dialog adhering to Vercel Geist tokens,
 * high-contrast light/dark themes, strict typography variants, 44px+ touch targets,
 * and zero duplicate modal nesting.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { Dialog } from '../ui/overlay/Dialog';
import { Touchable } from '../ui/Touchable';
import { haptics } from '@/lib/haptics';
import {
  requestNotificationPermission,
  dismissNotificationPrompt,
  type PermissionStatus,
} from '../../lib/permissions';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Bell, AlertTriangle, Truck, ShieldCheck, X } from '../ui/icon';

export interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onResolved?: (status: PermissionStatus) => void;
}

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onClose,
  onResolved,
}) => {
  const { theme, isDark } = useTheme();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const status = await requestNotificationPermission();
      if (status === 'granted') {
        haptics.success();
      } else {
        haptics.select();
      }
      if (onResolved) {
        onResolved(status);
      }
      onClose();
    } catch (err) {
      console.warn('[NotificationPermissionModal] Error requesting permission:', err);
      onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = async () => {
    haptics.select();
    await dismissNotificationPrompt();
    if (onResolved) {
      onResolved('undetermined');
    }
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleDismiss}
      persistent={isRequesting}
      contentStyle={styles.dialogCardOverride}
      testID="notification-permission-modal"
    >
      <View style={styles.contentContainer}>
        {/* Close 'X' Button */}
        <Touchable
          preset="icon"
          variant="iconButton"
          hitSlop={8}
          style={[
            styles.closeBtn,
            {
              backgroundColor: isDark ? '#262626' : '#f4f4f5',
              borderColor: theme.colors.hairline,
            },
          ]}
          onPress={handleDismiss}
          disabled={isRequesting}
          accessibilityLabel="Close notification permission dialog"
        >
          <X size={16} color={theme.colors.mute} />
        </Touchable>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.iconSquircle,
              {
                backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                borderColor: isDark ? 'rgba(14, 165, 233, 0.35)' : '#bae6fd',
              },
            ]}
          >
            <Bell size={26} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
          <Text
            variant="title"
            weight="semibold"
            style={[styles.title, { color: theme.colors.ink }]}
          >
            Enable Fleet & Shift Notifications
          </Text>
          <Text
            variant="body"
            style={[styles.subtitle, { color: theme.colors.mute }]}
          >
            Stay updated with essential alerts for your assigned equipment, active shifts, and daily operations.
          </Text>
        </View>

        {/* Feature Value Bullets */}
        <View style={styles.bulletsList}>
          {/* Item 1: Shift Conflicts */}
          <View
            style={[
              styles.bulletItem,
              {
                backgroundColor: isDark ? '#141414' : '#fafafa',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View
              style={[
                styles.bulletIconBox,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                },
              ]}
            >
              <AlertTriangle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
            </View>
            <View style={styles.bulletTextCol}>
              <Text
                variant="subheading"
                weight="semibold"
                style={[styles.bulletTitle, { color: theme.colors.ink }]}
              >
                Shift Conflict & Overtime Alerts
              </Text>
              <Text
                variant="caption"
                style={[styles.bulletDesc, { color: theme.colors.mute }]}
              >
                Immediate notification if duplicate machine custody or overtime overlaps occur.
              </Text>
            </View>
          </View>

          {/* Item 2: Equipment Assignments */}
          <View
            style={[
              styles.bulletItem,
              {
                backgroundColor: isDark ? '#141414' : '#fafafa',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View
              style={[
                styles.bulletIconBox,
                {
                  backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
                  borderColor: isDark ? 'rgba(14, 165, 233, 0.3)' : '#bae6fd',
                },
              ]}
            >
              <Truck size={15} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.bulletTextCol}>
              <Text
                variant="subheading"
                weight="semibold"
                style={[styles.bulletTitle, { color: theme.colors.ink }]}
              >
                Machine Assignment Updates
              </Text>
              <Text
                variant="caption"
                style={[styles.bulletDesc, { color: theme.colors.mute }]}
              >
                Receive real-time alerts when equipment is assigned to your site or shift.
              </Text>
            </View>
          </View>

          {/* Item 3: Privacy & Zero Spam */}
          <View
            style={[
              styles.bulletItem,
              {
                backgroundColor: isDark ? '#141414' : '#fafafa',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View
              style={[
                styles.bulletIconBox,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                },
              ]}
            >
              <ShieldCheck size={15} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={styles.bulletTextCol}>
              <Text
                variant="subheading"
                weight="semibold"
                style={[styles.bulletTitle, { color: theme.colors.ink }]}
              >
                Strict Operational Privacy
              </Text>
              <Text
                variant="caption"
                style={[styles.bulletDesc, { color: theme.colors.mute }]}
              >
                Zero promotional spam. Notifications are strictly limited to your active work.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Primary Action Button */}
          <Touchable
            preset="button"
            variant="buttonPrimary"
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isDark ? '#0ea5e9' : '#0284c7',
              },
            ]}
            onPress={handleEnable}
            disabled={isRequesting}
            accessibilityRole="button"
            accessibilityLabel="Enable notifications"
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Bell size={16} color="#ffffff" />
                <Text
                  variant="label"
                  weight="semibold"
                  style={[styles.primaryBtnText, { color: '#ffffff' }]}
                >
                  Enable Notifications
                </Text>
              </>
            )}
          </Touchable>

          {/* Secondary Dismiss Action Button */}
          <Touchable
            preset="button"
            variant="buttonOutline"
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: isDark ? '#141414' : '#fafafa',
                borderColor: theme.colors.hairline,
              },
            ]}
            onPress={handleDismiss}
            disabled={isRequesting}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
          >
            <Text
              variant="label"
              weight="medium"
              style={[styles.secondaryBtnText, { color: theme.colors.mute }]}
            >
              Maybe Later
            </Text>
          </Touchable>
        </View>
      </View>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialogCardOverride: {
    maxWidth: 420,
    borderRadius: 20,
    padding: spacingNumeric.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.35)',
      },
      default: {
        elevation: 28,
      },
    }),
  },
  contentContainer: {
    width: '100%',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: spacingNumeric.md,
  },
  iconSquircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: spacingNumeric.xs,
  },
  bulletsList: {
    gap: 8,
    marginBottom: spacingNumeric.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 12,
  },
  bulletIconBox: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletTextCol: {
    flex: 1,
  },
  bulletTitle: {
    marginBottom: 2,
  },
  bulletDesc: {
  },
  actionsRow: {
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46, // Comfortable >= 44px touch target
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.md,
  },
  primaryBtnText: {
    textAlign: 'center',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  secondaryBtnText: {
    textAlign: 'center',
  },
});
