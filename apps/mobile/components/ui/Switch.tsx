/**
 * ReachInternational Mobile — Standardized Switch Primitive
 * Smooth Reanimated thumb spring motion, native ripple,
 * semantic haptics.toggle(on), and 48dp touch target.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { motion, radiusNumeric } from '@reachinternational/design-tokens';
import { useTheme } from './ThemeProvider';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_OFFSET = 3;

export const Switch = memo(function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = 'Toggle switch',
  style,
}: SwitchProps) {
  const { theme, isDark } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, motion.spring.default);
  }, [value, progress]);

  const handlePress = () => {
    if (disabled) return;
    const nextValue = !value;
    haptics.toggle(nextValue);
    onValueChange(nextValue);
  };

  const trackStyle = useAnimatedStyle(() => {
    const activeColor = theme.colors.primary;
    const inactiveColor = isDark ? '#262626' : '#e5e5e5';
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor]
    );

    return {
      backgroundColor,
    };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const translateX = progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Pressable
      variant="toggle"
      haptic={false} // Handled directly inside handlePress
      hitSlopToMin48={true}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, style]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: '#ffffff' },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radiusNumeric.full,
    padding: THUMB_OFFSET,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radiusNumeric.full,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default Switch;
