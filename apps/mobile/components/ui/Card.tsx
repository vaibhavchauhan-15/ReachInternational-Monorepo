/**
 * ReachInternational Mobile — Native Card Primitive
 * Card container with canvas elevated background, hairline border,
 * and Android RenderThread native ripple when interactive.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Pressable } from './touch/Pressable';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'base' | 'elevated' | 'interactive';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const CardPressContext = React.createContext<{ isPressed: boolean }>({ isPressed: false });

export const Card: React.FC<CardProps> = ({ children, variant = 'base', onPress, style }) => {
  const { theme } = useTheme();

  const isElevated = variant === 'elevated';
  const shadowProps = isElevated ? theme.shadows.floating : theme.shadows.whisper;

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.canvasElevated,
    borderColor: theme.colors.hairline,
    borderWidth: 1,
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.md,
    marginVertical: spacingNumeric.xs,
    overflow: 'hidden',
    ...shadowProps,
  };

  if (onPress) {
    return (
      <Pressable
        variant="card"
        rippleRadius={radiusNumeric.lg}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {({ pressed }) => (
          <CardPressContext.Provider value={{ isPressed: pressed }}>
            {children}
          </CardPressContext.Provider>
        )}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

export default Card;
