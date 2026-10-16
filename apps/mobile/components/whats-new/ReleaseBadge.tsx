/**
 * ReachInternational Mobile — ReleaseBadge Component
 * Semantic pill badge indicating release version and delivery type (Native, OTA, Announcement).
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { ReleaseType } from '../../lib/whats-new/types';

export interface ReleaseBadgeProps {
  version: string;
  type: ReleaseType;
  isMajor?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ReleaseBadge({ version, type, isMajor = false, style }: ReleaseBadgeProps) {
  const { theme, isDark } = useTheme();

  const typeLabel =
    type === 'ota' ? 'Live Patch' : type === 'announcement' ? 'Notice' : 'App Release';

  const badgeBg = isDark
    ? isMajor
      ? 'rgba(2, 132, 199, 0.22)'
      : 'rgba(255, 255, 255, 0.08)'
    : isMajor
      ? 'rgba(2, 132, 199, 0.12)'
      : 'rgba(0, 0, 0, 0.05)';

  const borderColor = isMajor
    ? theme.colors.primary
    : isDark
      ? 'rgba(255, 255, 255, 0.15)'
      : theme.colors.hairline;

  const textColor = isMajor ? theme.colors.primary : theme.colors.ink;

  return (
    <View
      style={[
        styles.badgeContainer,
        {
          backgroundColor: badgeBg,
          borderColor,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Version ${version}, ${typeLabel}`}
    >
      <Text variant="caption" style={[styles.badgeText, { color: textColor }]}>
        {`v${version}`}
      </Text>
      <View style={[styles.dot, { backgroundColor: textColor }]} />
      <Text variant="caption" style={{ color: theme.colors.mute }}>
        {typeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  badgeText: {
    marginRight: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginRight: 4,
  },
});
