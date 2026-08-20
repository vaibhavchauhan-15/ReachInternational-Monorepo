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
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ status, customLabel, style }) => {
  const { theme } = useTheme();
  const config = getStatusBadgeConfig(status);

  // Safely map colorToken key to theme color value
  const colorsRecord = theme.colors as unknown as Record<string, string>;
  const colorValue = colorsRecord[config.colorToken] || theme.colors.link;

  return (
    <View style={[styles.badge, { backgroundColor: colorValue + '1a', borderColor: colorValue + '40' }, style]}>
      <View style={[styles.dot, { backgroundColor: colorValue }]} />
      <Text style={[styles.text, { color: colorValue }]}>{customLabel || config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
