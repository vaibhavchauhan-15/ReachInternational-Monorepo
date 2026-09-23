/**
 * ServiceCentric Mobile — Native Card Primitive
 * Card container with canvas elevated background, hairline border, and optional press event.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'base' | 'elevated' | 'interactive';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const CardPressContext = React.createContext<{ isPressed: boolean }>({ isPressed: false });

export const Card: React.FC<CardProps> = ({ children, variant = 'base', onPress, style }) => {
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = React.useState(false);

  const isElevated = variant === 'elevated';
  const shadowProps = isElevated ? theme.shadows.floating : theme.shadows.whisper;

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.canvasElevated,
    borderColor: theme.colors.hairline,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginVertical: spacingNumeric.xs,
    ...shadowProps,
  };

  if (onPress) {
    return (
      <CardPressContext.Provider value={{ isPressed }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          activeOpacity={0.7}
          style={[cardStyle, style]}
        >
          {children}
        </TouchableOpacity>
      </CardPressContext.Provider>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
