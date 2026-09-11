/**
 * ReachInternational Mobile — Notification Permission Primer Modal
 * Presents a value-first explanation of why notifications are requested,
 * before triggering the native OS (Android 13+) or Web browser permission dialog.
 * Conforms to Vercel Geist design tokens and min 44px touch targets.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import {
  requestNotificationPermission,
  dismissNotificationPrompt,
  PermissionStatus,
} from '../../lib/permissions';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Bell, AlertTriangle, Truck, ShieldCheck, X } from 'lucide-react-native';

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

  if (!visible) return null;

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const status = await requestNotificationPermission();
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
    await dismissNotificationPrompt();
    if (onResolved) {
      onResolved('undetermined');
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Close X Button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                borderColor: theme.colors.hairline,
              },
            ]}
            onPress={handleDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close notification permission dialog"
          >
            <X size={16} color={theme.colors.mute} />
          </TouchableOpacity>

          {/* Hero Emblem Icon */}
          <View style={styles.heroSection}>
            <View
              style={[
                styles.iconSquircle,
                {
                  backgroundColor: isDark ? 'rgba(0, 112, 243, 0.15)' : '#eff6ff',
                  borderColor: isDark ? 'rgba(0, 112, 243, 0.35)' : '#bfdbfe',
                },
              ]}
            >
              <Bell size={28} color={theme.colors.link} />
            </View>
            <Text style={[styles.title, { color: theme.colors.ink }]}>
              Enable Fleet & Shift Notifications
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
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
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View
                style={[
                  styles.bulletIconBox,
                  { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' },
                ]}
              >
                <AlertTriangle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
              </View>
              <View style={styles.bulletTextCol}>
                <Text style={[styles.bulletTitle, { color: theme.colors.ink }]}>
                  Shift Conflict & Overtime Alerts
                </Text>
                <Text style={[styles.bulletDesc, { color: theme.colors.mute }]}>
                  Immediate notification if duplicate machine custody or overtime overlaps occur.
                </Text>
              </View>
            </View>

            {/* Item 2: Equipment Assignments */}
            <View
              style={[
                styles.bulletItem,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View
                style={[
                  styles.bulletIconBox,
                  { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' },
                ]}
              >
                <Truck size={15} color={isDark ? '#38bdf8' : '#0284c7'} />
              </View>
              <View style={styles.bulletTextCol}>
                <Text style={[styles.bulletTitle, { color: theme.colors.ink }]}>
                  Machine Assignment Updates
                </Text>
                <Text style={[styles.bulletDesc, { color: theme.colors.mute }]}>
                  Receive real-time alerts when equipment is assigned to your site or shift.
                </Text>
              </View>
            </View>

            {/* Item 3: Privacy & Zero Spam */}
            <View
              style={[
                styles.bulletItem,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View
                style={[
                  styles.bulletIconBox,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' },
                ]}
              >
                <ShieldCheck size={15} color={isDark ? '#34d399' : '#059669'} />
              </View>
              <View style={styles.bulletTextCol}>
                <Text style={[styles.bulletTitle, { color: theme.colors.ink }]}>
                  Strict Operational Privacy
                </Text>
                <Text style={[styles.bulletDesc, { color: theme.colors.mute }]}>
                  Zero promotional spam. Notifications are strictly limited to your active work.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* Primary Action Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.colors.ink,
                },
              ]}
              onPress={handleEnable}
              disabled={isRequesting}
              activeOpacity={0.8}
            >
              {isRequesting ? (
                <ActivityIndicator size="small" color={theme.colors.canvas} />
              ) : (
                <>
                  <Bell size={16} color={theme.colors.canvas} />
                  <Text style={[styles.primaryBtnText, { color: theme.colors.canvas }]}>
                    Enable Notifications
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Secondary Dismiss Action Button */}
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
              onPress={handleDismiss}
              disabled={isRequesting}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.colors.mute }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
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
    textAlign: 'center',
    marginBottom: spacingNumeric.md,
  },
  iconSquircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  bulletsList: {
    gap: 8,
    marginBottom: spacingNumeric.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 10,
  },
  bulletIconBox: {
    width: 30,
    height: 30,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletTextCol: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  bulletDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  actionsRow: {
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.md,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44, // Minimum 44px touch target
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
