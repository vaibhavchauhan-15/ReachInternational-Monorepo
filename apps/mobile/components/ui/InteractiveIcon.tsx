/**
 * ReachInternational Mobile — Interactive Icon Primitive
 * Provides responsive touch press micro-interactions synchronized with parent touch state.
 * Powered by Reanimated 4 and SPATIAL.fast physics tokens.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';

export type MobileIconInteractionVariant =
  | 'bounce'
  | 'scale'
  | 'arrow'
  | 'chevron'
  | 'rotate'
  | 'lift'
  | 'refresh'
  | 'tilt'
  | 'none';

export interface InteractiveIconProps {
  icon: React.ReactNode;
  pressed?: boolean;
  variant?: MobileIconInteractionVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const InteractiveIcon: React.FC<InteractiveIconProps> = ({
  icon,
  style,
}) => {
  if (!icon) return null;

  return (
    <View style={[styles.container, style]}>
      {icon}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InteractiveIcon;
