/**
 * ReachInternational Mobile — Icon Behavior: drawStroke
 * Animated stroke drawing for checkmarks and success states via strokeDashoffset.
 */

import React, { useEffect } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { DUR, SPATIAL } from '../../../../lib/motion/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DrawStrokeProps {
  size: number;
  color: string;
  strokeWidth?: number;
  variant?: 'check' | 'circle-check' | 'square-check';
  reduceMotion?: boolean;
}

export const AnimatedDrawCheck: React.FC<DrawStrokeProps> = ({
  size = 24,
  color = '#10b981',
  strokeWidth = 2,
  variant = 'check',
  reduceMotion = false,
}) => {
  const CHECK_LENGTH = 28;
  const CIRCLE_LENGTH = 63;

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      scale.value = 1;
      return;
    }

    progress.value = withTiming(1, {
      duration: DUR.md,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    scale.value = 1;
  }, [reduceMotion, progress, scale]);

  const animatedCheckProps = useAnimatedProps(() => {
    'worklet';
    return {
      strokeDashoffset: (1 - progress.value) * CHECK_LENGTH,
    };
  });

  const animatedCircleProps = useAnimatedProps(() => {
    'worklet';
    return {
      strokeDashoffset: (1 - progress.value) * CIRCLE_LENGTH,
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View style={containerStyle}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === 'circle-check' && (
          <AnimatedCircle
            cx={12}
            cy={12}
            r={10}
            strokeDasharray={CIRCLE_LENGTH}
            animatedProps={animatedCircleProps}
          />
        )}
        {variant === 'square-check' && (
          <AnimatedPath
            d="m9 11 3 3L22 4"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={animatedCheckProps}
          />
        )}
        {variant !== 'square-check' && (
          <AnimatedPath
            d={variant === 'circle-check' ? 'm9 12 2 2 4-4' : 'M20 6 9 17l-5-5'}
            strokeDasharray={CHECK_LENGTH}
            animatedProps={animatedCheckProps}
          />
        )}
      </Svg>
    </Animated.View>
  );
};
