/**
 * ReachInternational Mobile — Canonical Touch Wrapper
 * Combines Android RenderThread native ripple, UI-thread Reanimated micro-scale,
 * semantic soft haptics, disabled/loading states, and 48dp minimum touch targets.
 */

import React, { createContext, memo, useContext, type ReactNode } from 'react';
import {
  Pressable as RNPressable,
  Platform,
  type GestureResponderEvent,
  type Insets,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { motion } from '@reachinternational/design-tokens';
import { haptics, type HapticKind } from '../../../lib/haptics';
import { useTheme } from '../ThemeProvider';
import { useReducedMotion } from '../../../lib/preferences/useReducedMotion';
import { getTouchFeedback, type TouchVariant } from './feedback';

const AnimatedRNPressable = Animated.createAnimatedComponent(RNPressable);

const PressProgressContext = createContext<SharedValue<number> | null>(null);

/**
 * Hook to access current press progress (0 to 1) for child animations
 */
export const usePressProgress = () => useContext(PressProgressContext);

export interface PressableProps extends Omit<RNPressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut'> {
  variant?: TouchVariant;
  /** Explicit haptic override. false = completely silent */
  haptic?: HapticKind | false;
  /** Custom ripple radius override */
  rippleRadius?: number;
  /** Enforce minimum 48dp target via hitSlop on small buttons */
  hitSlopToMin48?: boolean;
  /** Visual & interaction loading state */
  loading?: boolean;
  /** Legacy compatibility for components migrated from TouchableOpacity */
  activeOpacity?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
}

/**
 * Standard 48dp hitSlop inset for icons and small touchables
 */
const HIT_SLOP_MIN_48: Insets = { top: 8, bottom: 8, left: 8, right: 8 };

export const Pressable = memo(function Pressable({
  variant = 'card',
  haptic,
  rippleRadius,
  hitSlopToMin48 = true,
  loading = false,
  disabled = false,
  activeOpacity: _activeOpacity,
  style,
  children,
  onPress,
  onLongPress,
  accessibilityRole,
  accessibilityState,
  hitSlop,
  ...rest
}: PressableProps) {
  const { isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const config = getTouchFeedback(variant, isDark, rippleRadius);

  const isInteractive = !disabled && !loading;
  const progress = useSharedValue(0);

  // Micro-scale running on the UI thread
  const animStyle = useAnimatedStyle(() => {
    if (reduceMotion || config.scale === 1) {
      return {};
    }
    const currentScale = 1 - progress.value * (1 - config.scale);
    return {
      transform: [{ scale: currentScale }],
    };
  });

  // Material 3 disabled opacity: 38%
  const opacityStyle = !isInteractive ? { opacity: 0.38 } : undefined;

  // Native Android RenderThread ripple
  const androidRipple = isInteractive
    ? {
        color: config.rippleColor,
        borderless: config.borderless,
        radius: config.radius,
        foreground: Platform.OS === 'android' ? config.foreground : false,
      }
    : undefined;

  // Resolve 48dp hitSlop for small variants
  const resolvedHitSlop =
    hitSlop ??
    (hitSlopToMin48 && (variant === 'iconButton' || variant === 'icon' || variant === 'navTab' || variant === 'toggle')
      ? HIT_SLOP_MIN_48
      : undefined);

  // Determine accessibility role
  // Containers like 'card', 'listRow', and 'plain' frequently host interactive child elements
  // (inputs, action buttons, chips). In HTML / React Native Web, rendering them as <button>
  // causes fatal DOM nesting violations ('<button> cannot contain a nested <button>').
  // Therefore, container variants resolve to undefined (rendering as a semantic <div> on Web).
  const isContainerVariant = variant === 'card' || variant === 'listRow' || variant === 'plain';
  const resolvedRole =
    isContainerVariant
      ? (accessibilityRole === 'button' ? undefined : accessibilityRole)
      : (accessibilityRole ?? 'button');

  const handlePress = (e: GestureResponderEvent) => {
    if (!isInteractive) return;

    // Resolve semantic haptic trigger
    const targetHaptic = haptic !== undefined ? haptic : config.defaultHaptic;
    if (targetHaptic && targetHaptic !== 'none' && targetHaptic in haptics) {
      (haptics as any)[targetHaptic]();
    }

    onPress?.(e);
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    if (!isInteractive) return;
    if (variant === 'longPressRow') {
      haptics.longPress();
    }
    onLongPress?.(e);
  };

  return (
    <PressProgressContext.Provider value={progress}>
      <AnimatedRNPressable
        accessibilityRole={resolvedRole}
        accessibilityState={{
          disabled: !isInteractive,
          busy: loading,
          ...accessibilityState,
        }}
        hitSlop={resolvedHitSlop}
        android_ripple={androidRipple}
        disabled={!isInteractive}
        onPressIn={() => {
          if (isInteractive) {
            progress.value = withTiming(1, { duration: motion.duration.instant });
          }
        }}
        onPressOut={() => {
          if (isInteractive) {
            progress.value = withSpring(0, motion.spring.press);
          }
        }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={
          typeof style === 'function'
            ? ((state: any) => {
                const userStyle = style(state);
                return Array.isArray(userStyle)
                  ? [...userStyle, animStyle, opacityStyle]
                  : [userStyle, animStyle, opacityStyle];
              }) as any
            : Array.isArray(style)
            ? [...style, animStyle, opacityStyle]
            : [style, animStyle, opacityStyle]
        }
        {...rest}
      >
        {children}
      </AnimatedRNPressable>
    </PressProgressContext.Provider>
  );
});

export default Pressable;
