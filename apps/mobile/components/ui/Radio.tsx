/**
 * ReachInternational Mobile — Standardized Radio Primitive
 * Features animated inner dot, semantic toggle haptics, and 48dp touch target.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { motion, radiusNumeric } from '@reachinternational/design-tokens';
import { useTheme } from './ThemeProvider';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

export interface RadioProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: number;
  style?: ViewStyle;
}

export const Radio = memo(function Radio({
  selected,
  onSelect,
  disabled = false,
  accessibilityLabel = 'Radio button',
  size = 20,
  style,
}: RadioProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(selected ? 1 : 0, motion.spring.default);
  }, [selected, scale]);

  const handlePress = () => {
    if (disabled || selected) return;
    haptics.select();
    onSelect();
  };

  const dotAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const activeColor = theme.colors.primary;
  const inactiveBorder = isDark ? '#383838' : '#d4d4d4';

  return (
    <Pressable
      variant="toggle"
      haptic={false}
      hitSlopToMin48={true}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitBox, style]}
    >
      <View
        style={[
          styles.outerCircle,
          {
            width: size,
            height: size,
            borderRadius: radiusNumeric.full,
            borderColor: selected ? activeColor : inactiveBorder,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.innerDot,
            {
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: radiusNumeric.full,
              backgroundColor: activeColor,
            },
            dotAnim,
          ]}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hitBox: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {},
});

export default Radio;
