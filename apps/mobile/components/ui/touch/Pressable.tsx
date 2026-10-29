/**
 * ReachInternational Mobile — Canonical Touch Wrapper
 * Combines Android RenderThread native ripple, UI-thread Reanimated micro-scale,
 * semantic soft haptics, disabled/loading states, and 48dp minimum touch targets.
 * Complies with Google Material Design 3 and Apple Human Interface Guidelines.
 */

import React, { createContext, memo, useContext, useEffect, useState, forwardRef, type ReactNode } from 'react';
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
  className?: string;
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

export const Pressable = memo(
  forwardRef<React.ElementRef<typeof RNPressable>, PressableProps>(function Pressable(
    {
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
    }: PressableProps,
    ref
  ) {
    const { isDark } = useTheme();
    const reduceMotion = useReducedMotion();
    const config = getTouchFeedback(variant, isDark, rippleRadius);

    const isInteractive = !disabled && !loading;
    const progress = useSharedValue(0);

    // Reset progress and pressed state when component unmounts or interaction state changes
    useEffect(() => {
      progress.value = 0;
      setIsPressed(false);
      return () => {
        setIsPressed(false);
        progress.value = 0;
      };
    }, [disabled, loading, progress]);

    // Micro-scale running on the UI thread (strictly 1.0 on cards, list items, and tabs)
    const animStyle = useAnimatedStyle(() => {
      'worklet';
      if (reduceMotion || config.scale === 1.0) {
        return {};
      }
      const currentScale = 1 - (1 - config.scale) * progress.value;
      return {
        transform: [{ scale: currentScale }],
      };
    });

    // Material 3 disabled opacity: 38%
    const opacityStyle = !isInteractive ? { opacity: 0.38 } : undefined;

    // Native Android RenderThread ripple
    const androidRipple =
      Platform.OS === 'android' && isInteractive
        ? {
            color: config.rippleColor,
            borderless: config.borderless,
            radius: config.radius,
            foreground: config.foreground,
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
    const isContainerVariant =
      variant === 'card' || variant === 'listRow' || variant === 'plain' || variant === 'kpiCard';
    const resolvedRole =
      isContainerVariant
        ? (accessibilityRole === 'button' ? undefined : accessibilityRole)
        : (accessibilityRole ?? 'button');

    const resolvePressStyle = (isPressed: boolean): ViewStyle | undefined => {
      if (!isPressed || !isInteractive) return undefined;

      const pressStyles: ViewStyle = {};

      // Apply activeOpacity on iOS and Web
      if (Platform.OS !== 'android') {
        const effectiveOpacity = _activeOpacity ?? config.activeOpacity;
        if (effectiveOpacity < 1.0) {
          pressStyles.opacity = effectiveOpacity;
        }
      }

      // Apply pressed background tint if defined
      if (config.pressedBackgroundColor) {
        pressStyles.backgroundColor = config.pressedBackgroundColor;
      }

      return Object.keys(pressStyles).length > 0 ? pressStyles : undefined;
    };

    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = (_e: GestureResponderEvent) => {
      if (!isInteractive) return;
      setIsPressed(true);
      if (config.scale !== 1.0 && !reduceMotion) {
        progress.value = withTiming(1, { duration: 80 });
      }
    };

    const handlePressOut = (_e: GestureResponderEvent) => {
      if (!isInteractive) return;
      setIsPressed(false);
      if (config.scale !== 1.0 && !reduceMotion) {
        progress.value = withSpring(0, { damping: 15, stiffness: 300 });
      }
    };

    const handleResponderTerminate = () => {
      setIsPressed(false);
      if (config.scale !== 1.0 && !reduceMotion) {
        progress.value = withSpring(0, { damping: 15, stiffness: 300 });
      }
    };

    const handlePress = (e: GestureResponderEvent) => {
      if (!isInteractive) return;

      setIsPressed(false);
      if (config.scale !== 1.0 && !reduceMotion) {
        progress.value = withSpring(0, { damping: 15, stiffness: 300 });
      }

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

    const webTouchStyle: ViewStyle = Platform.select({
      web: {
        outlineStyle: 'none',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        cursor: isInteractive ? 'pointer' : 'not-allowed',
      } as any,
      default: {},
    });

    const pressFeedbackStyle = resolvePressStyle(isPressed);
    const resolvedUserStyle =
      typeof style === 'function' ? style({ pressed: isPressed }) : style;
    const flatUser = Array.isArray(resolvedUserStyle)
      ? resolvedUserStyle
      : [resolvedUserStyle];

    const finalStyle = [
      webTouchStyle,
      ...flatUser,
      animStyle,
      opacityStyle,
      pressFeedbackStyle,
    ];

    const resolvedChildren =
      typeof children === 'function' ? (children as any)({ pressed: isPressed }) : children;

    const sanitizedChildren =
      resolvedChildren === '' || resolvedChildren === false
        ? null
        : Array.isArray(resolvedChildren)
        ? resolvedChildren.map((child) => (child === '' || child === false ? null : child))
        : resolvedChildren;

    return (
      <PressProgressContext.Provider value={progress}>
        <AnimatedRNPressable
          ref={ref as any}
          {...(rest as any)}
          accessibilityRole={resolvedRole}
          accessibilityState={{
            disabled: !isInteractive,
            busy: loading,
            ...accessibilityState,
          }}
          hitSlop={resolvedHitSlop}
          android_ripple={androidRipple}
          disabled={!isInteractive}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onResponderTerminate={handleResponderTerminate}
          onResponderTerminationRequest={() => true}
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={finalStyle}
        >
          {sanitizedChildren}
        </AnimatedRNPressable>
      </PressProgressContext.Provider>
    );
  })
);

export default Pressable;
