/**
 * ReachInternational Mobile — Canonical Switch Component
 * High-performance, butter-smooth enable/disable toggle switch with
 * fluid spring physics, hardware haptics, and Geist design tokens.
 */

import React, { useEffect } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from './ThemeProvider';
import { haptics } from '../../lib/haptics';
import { useReducedMotion } from '../../lib/preferences/useReducedMotion';

export interface SwitchProps {
  value?: boolean;
  checked?: boolean;
  onValueChange?: (value: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
  haptic?: boolean;
}

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 180,
  mass: 0.8,
};

export const Switch = React.forwardRef<View, SwitchProps>(function Switch(
  {
    value,
    checked,
    onValueChange,
    onCheckedChange,
    disabled = false,
    size = 'md',
    trackColor,
    thumbColor,
    accessibilityLabel,
    style,
    className: _className,
    testID,
    haptic = true,
  },
  ref
) {
  const { isDark } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const isChecked = Boolean(checked ?? value ?? false);

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 40 : 50;
  const trackHeight = isSmall ? 22 : 28;
  const trackRadius = trackHeight / 2;
  const thumbSize = isSmall ? 18 : 24;
  const thumbRadius = thumbSize / 2;
  const padding = 2;
  const travelDistance = trackWidth - thumbSize - padding * 2;

  // Authoritative Reach sky blue tokens (#0284c7 light / #0ea5e9 dark)
  const defaultActiveTrack = isDark ? '#0ea5e9' : '#0284c7';
  const defaultInactiveTrack = isDark ? '#27272a' : '#e4e4e7';
  const defaultInactiveBorder = isDark ? '#3f3f46' : '#d4d4d8';

  const activeTrackColor = trackColor?.true || defaultActiveTrack;
  const inactiveTrackColor = trackColor?.false || defaultInactiveTrack;
  const resolvedThumbColor = thumbColor || '#ffffff';

  const progress = useSharedValue(isChecked ? 1 : 0);

  useEffect(() => {
    const target = isChecked ? 1 : 0;
    if (prefersReducedMotion) {
      progress.value = withTiming(target, { duration: 100 });
    } else {
      progress.value = withSpring(target, SPRING_CONFIG);
    }
  }, [isChecked, prefersReducedMotion, progress]);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travelDistance }],
  }));

  const activeTrackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: progress.value > 0.4 ? activeTrackColor : defaultInactiveBorder,
  }));

  const handlePress = () => {
    if (disabled) return;
    const nextVal = !isChecked;
    if (haptic) {
      haptics.select();
    }
    onValueChange?.(nextVal);
    onCheckedChange?.(nextVal);
  };

  return (
    <Pressable
      ref={ref}
      role="switch"
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: isChecked, disabled }}
      aria-checked={isChecked}
      android_ripple={null}
      disabled={disabled}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.pressable,
        {
          width: trackWidth,
          height: trackHeight,
          opacity: disabled ? 0.45 : 1,
        },
        Platform.OS === 'web' &&
          ({
            cursor: disabled ? 'not-allowed' : 'pointer',
            outlineStyle: 'none',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          } as any),
        style,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: trackWidth,
            height: trackHeight,
            borderRadius: trackRadius,
            backgroundColor: inactiveTrackColor,
          },
          borderAnimatedStyle,
        ]}
      >
        {/* Active Blue Layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: activeTrackColor,
              borderRadius: trackRadius,
            },
            activeTrackAnimatedStyle,
          ]}
        />

        {/* White Circular Thumb Knob */}
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbRadius,
              backgroundColor: resolvedThumbColor,
              top: padding - 1,
              left: padding - 1,
            },
            thumbAnimatedStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

Switch.displayName = 'Switch';

const styles = StyleSheet.create({
  pressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 2.5,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.18)',
        } as any)
      : {}),
  },
});

export default Switch;
