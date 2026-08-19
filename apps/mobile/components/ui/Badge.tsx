/**
 * ServiceCentric Mobile — Native Badge Primitive
 * Status badge powered by @servicecentric/design-tokens getStatusBadgeConfig.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { getStatusBadgeConfig, radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';

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
    <View style={[styles.badge, { backgroundColor: colorValue + '22', borderColor: colorValue }, style]}>
      <Text style={[styles.text, { color: colorValue }]}>{customLabel || config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: spacingNumeric.xs,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
