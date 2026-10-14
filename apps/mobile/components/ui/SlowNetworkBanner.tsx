/**
 * ReachInternational Mobile — SlowNetworkBanner Component
 * 
 * Displays an ambient warning banner when an asynchronous network operation
 * takes longer than the expected threshold (>7-8s), assuring users the app
 * has not frozen and offering retry or cancel options.
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import { Clock, RotateCcw, X } from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export interface SlowNetworkBannerProps {
  visible: boolean;
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const SlowNetworkBanner: React.FC<SlowNetworkBannerProps> = ({
  visible,
  message = 'Network connection is slow. Still communicating with server...',
  onRetry,
  onDismiss,
  style,
}) => {
  const { theme, isDark } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: isDark ? '#1a1306' : '#fffbeb',
          borderColor: isDark ? '#3d2605' : '#fef08a',
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.leftCol}>
        <ActivityIndicator
          size="small"
          color={isDark ? '#eab308' : '#b45309'}
          style={styles.spinner}
        />
        <Text
          variant="micro"
          style={[styles.messageText, { color: isDark ? '#fde047' : '#92400e' }]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>

      <View style={styles.rightCol}>
        {onRetry && (
          <Pressable
            variant="chip"
            haptic="select"
            hitSlopToMin48
            onPress={() => {
              try {
                haptics.select();
              } catch {
                // ignore
              }
              onRetry();
            }}
            style={[
              styles.retryChip,
              {
                backgroundColor: isDark ? 'rgba(250, 204, 21, 0.15)' : 'rgba(180, 83, 9, 0.1)',
                borderColor: isDark ? 'rgba(250, 204, 21, 0.3)' : 'rgba(180, 83, 9, 0.2)',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Retry request"
          >
            <RotateCcw size={10} color={isDark ? '#fde047' : '#92400e'} style={{ marginRight: 3 }} />
            <Text variant="micro" style={{ color: isDark ? '#fde047' : '#92400e' }}>
              Retry
            </Text>
          </Pressable>
        )}

        {onDismiss && (
          <Pressable
            variant="iconButton"
            haptic="tap"
            hitSlopToMin48
            onPress={onDismiss}
            style={styles.dismissBtn}
            accessibilityLabel="Dismiss banner"
          >
            <X size={12} color={isDark ? '#fde047' : '#92400e'} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 998,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  spinner: {
    transform: [{ scale: 0.75 }],
  },
  messageText: {
    flex: 1,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  retryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 24,
  },
  dismissBtn: {
    padding: 4,
  },
});

export default SlowNetworkBanner;
