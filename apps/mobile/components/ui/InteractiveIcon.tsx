/**
 * ReachInternational Mobile — Interactive Icon Primitive
 * Provides responsive touch press micro-interactions synchronized with parent touch state.
 */

import React, { useEffect, useRef, useContext } from 'react';
import {
  Animated,
  AccessibilityInfo,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { CardPressContext } from './Card';

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
  pressed,
  variant = 'bounce',
  disabled = false,
  style,
}) => {
  const cardContext = useContext(CardPressContext);
  const effectivePressed = pressed !== undefined ? pressed : (cardContext?.isPressed ?? false);
  const anim = useRef(new Animated.Value(0)).current;
  const isReducedMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      isReducedMotion.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      isReducedMotion.current = enabled;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (disabled || isReducedMotion.current || variant === 'none') {
      anim.setValue(0);
      return;
    }

    Animated.spring(anim, {
      toValue: effectivePressed ? 1 : 0,
      useNativeDriver: true,
      tension: 300,
      friction: 22,
    }).start();
  }, [effectivePressed, disabled, variant, anim]);

  if (variant === 'none' || !icon) {
    return <>{icon}</>;
  }

  // Compute interpolations based on variant (calibrated to Apple iOS 17 standard)
  let transform: any[] = [];

  if (variant === 'bounce' || variant === 'scale') {
    transform = [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.94],
        }),
      },
    ];
  } else if (variant === 'lift') {
    transform = [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.96],
        }),
      },
    ];
  } else if (variant === 'arrow') {
    transform = [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 3],
        }),
      },
    ];
  } else if (variant === 'chevron') {
    transform = [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 2],
        }),
      },
    ];
  } else if (variant === 'rotate') {
    transform = [
      {
        rotate: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '30deg'],
        }),
      },
    ];
  } else if (variant === 'refresh') {
    transform = [
      {
        rotate: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ];
  } else if (variant === 'tilt') {
    transform = [
      {
        rotate: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '-10deg'],
        }),
      },
    ];
  }

  return (
    <Animated.View style={[styles.container, { transform }, style]} pointerEvents="none">
      {icon}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
