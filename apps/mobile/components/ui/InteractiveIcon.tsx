/**
 * ReachInternational Mobile — Interactive Icon Primitive
 * Provides responsive touch press micro-interactions synchronized with parent touch state.
 * Powered by Reanimated 4 and SPATIAL.fast physics tokens.
 */

import React, { useContext, useEffect } from 'react';
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import { CardPressContext } from './Card';
import { usePressProgress } from './touch/Pressable';
import { useReducedMotion } from '../../lib/preferences/useReducedMotion';
import { SPATIAL } from '../../lib/motion/tokens';

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
  const pressProgress = usePressProgress();
  const isReducedMotion = useReducedMotion();

  const effectivePressed =
    pressed !== undefined
      ? pressed
      : (cardContext?.isPressed ?? (pressProgress ? pressProgress.value > 0.1 : false));

  const anim = useSharedValue(0);

  useEffect(() => {
    if (disabled || isReducedMotion || variant === 'none') {
      anim.value = 0;
      return;
    }
    anim.value = withSpring(effectivePressed ? 1 : 0, {
      ...SPATIAL.fast,
      reduceMotion: ReduceMotion.System,
    });
  }, [effectivePressed, disabled, isReducedMotion, variant, anim]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (variant === 'none' || isReducedMotion || disabled) {
      return {};
    }

    const p = anim.value;

    switch (variant) {
      case 'bounce':
      case 'scale':
        return { transform: [{ scale: 1 - p * 0.08 }] };
      case 'lift':
        return { transform: [{ translateY: -p * 2 }, { scale: 1 - p * 0.04 }] };
      case 'arrow':
        return { transform: [{ translateX: p * 3 }] };
      case 'chevron':
        return { transform: [{ translateX: p * 2 }] };
      case 'rotate':
        return { transform: [{ rotate: `${p * 30}deg` }] };
      case 'refresh':
        return { transform: [{ rotate: `${p * 180}deg` }] };
      case 'tilt':
        return { transform: [{ rotate: `${-p * 10}deg` }] };
      default:
        return {};
    }
  });

  if (!icon) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
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
