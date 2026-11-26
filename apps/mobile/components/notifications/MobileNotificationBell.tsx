/**
 * ReachInternational Mobile — Canonical Notification Bell Header Trigger
 * Min 44px touch target (hitSlopToMin48), tactile haptic feedback, unread badge (99+).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '../ui/touch/Pressable';
import { Bell } from '../ui/icon';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { useNotificationUnreadCount } from '../../lib/hooks/useNotificationsData';
import { capNotificationCount } from '@reachinternational/utils';
import { haptics } from '../../lib/haptics';

export interface MobileNotificationBellProps {
  style?: object;
}

export function MobileNotificationBell({ style }: MobileNotificationBellProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data: unreadCount = 0 } = useNotificationUnreadCount();

  const handlePress = () => {
    haptics.select();
    router.push('/(app)/notifications');
  };

  const badgeText = capNotificationCount(unreadCount);
  const accessibleLabel = `Notifications, ${
    unreadCount > 0 ? `${unreadCount} unread` : 'no unread'
  }`;

  return (
    <Pressable
      variant="plain"
      haptic={false}
      onPress={handlePress}
      hitSlopToMin48={true}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      style={[
        styles.iconBtn,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
    >
      <Bell size={15} color={theme.colors.ink} />

      {unreadCount > 0 && (
        <View
          style={[
            styles.badgeCapsule,
            {
              backgroundColor: theme.colors.link,
              borderColor: theme.colors.canvas,
            },
          ]}
          pointerEvents="none"
        >
          <Text
            variant="micro"
            style={[styles.badgeText, { color: '#ffffff' }]}
            numberOfLines={1}
          >
            {badgeText}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    height: 32,
    width: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCapsule: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
