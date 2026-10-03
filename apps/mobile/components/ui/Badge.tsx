/**
 * ServiceCentric Mobile — Native Badge Primitive
 * Status badge powered by @reachinternational/design-tokens getStatusBadgeConfig.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { getStatusBadgeConfig, radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface BadgeProps {
  status: string;
  customLabel?: string;
  size?: 'sm' | 'md';
  uppercase?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  customLabel,
  size = 'md',
  uppercase = false,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const config = getStatusBadgeConfig(status);

  // Normalize status for special machine statuses
  const normalizedStatus = status.toLowerCase();
  let colorValue: string;

  if (normalizedStatus === 'available') {
    colorValue = isDark ? '#94a3b8' : '#64748b';
  } else if (normalizedStatus === 'rented' || normalizedStatus === 'on_rent') {
    colorValue = isDark ? '#38bdf8' : '#0284c7';
  } else {
    const colorsRecord = theme.colors as unknown as Record<string, string>;
    colorValue = colorsRecord[config.colorToken] || theme.colors.link;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeSm : styles.badgeMd,
        {
          backgroundColor: colorValue + (isDark ? '22' : '14'),
          borderColor: colorValue + (isDark ? '45' : '30'),
        },
        style,
      ]}
    >
      <View
        style={[
          styles.dot,
          isSmall ? styles.dotSm : styles.dotMd,
          { backgroundColor: colorValue },
        ]}
      />
      <Text
        style={[
          styles.text,
          isSmall ? styles.textSm : styles.textMd,
          {
            color: colorValue,
            textTransform: uppercase ? 'uppercase' : 'none',
          },
        ]}
        numberOfLines={1}
      >
        {customLabel || config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    minHeight: 22,
    height: 22,
    gap: 5,
  },
  badgeMd: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    minHeight: 24,
    height: 24,
    gap: 5.5,
  },
  dot: {
    borderRadius: 9999,
  },
  dotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotMd: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  textSm: {
    fontSize: 11.5,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 15,
  },
});
