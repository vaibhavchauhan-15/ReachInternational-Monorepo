/**
 * ServiceCentric Mobile — Native Card Primitive
 * Card container with canvas elevated background, hairline border, and optional press event.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style }) => {
  const { theme } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.canvasElevated,
    borderColor: theme.colors.hairline,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginVertical: spacingNumeric.xs,
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[cardStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
