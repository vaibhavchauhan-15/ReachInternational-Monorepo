/**
 * ReachInternational Mobile — Icon Behavior: morphPair
 * Pairs: menu ↔ close (3-bar transform), eye ↔ eye-off (slash draw), copy ↔ check.
 * Pure UI-thread Reanimated 4 and react-native-svg without heavy path interpolation.
 */

import React, { useEffect } from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
  interpolate,
  ReduceMotion,
} from 'react-native-reanimated';
import { SPATIAL, DUR } from '../../../../lib/motion/tokens';

const AnimatedLine = Animated.createAnimatedComponent(Line);

export interface MenuCloseMorphProps {
  isOpen: boolean;
  size?: number;
  color?: string;
  strokeWidth?: number;
  reduceMotion?: boolean;
}

/**
 * Menu ↔ Close: 3-bar UI thread transform
 * Closed (0): top y=6, middle y=12, bottom y=18
 * Open (1): top translates to (12,12) & rotates +45°, bottom to (12,12) & rotates -45°, middle opacity=0
 */
export const MenuCloseMorph: React.FC<MenuCloseMorphProps> = ({
  isOpen,
  size = 24,
  color = '#171717',
  strokeWidth = 2,
  reduceMotion = false,
}) => {
  const target = isOpen ? 1 : 0;
  const progress = useSharedValue(target);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = target;
    } else {
      progress.value = withSpring(target, {
        ...SPATIAL.fast,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [isOpen, target, reduceMotion, progress]);

  // Top line: from (4,6)-(20,6) to diagonal (5,5)-(19,19)
  const topProps = useAnimatedProps(() => {
    'worklet';
    const p = progress.value;
    return {
      x1: interpolate(p, [0, 1], [4, 5]),
      y1: interpolate(p, [0, 1], [6, 5]),
      x2: interpolate(p, [0, 1], [20, 19]),
      y2: interpolate(p, [0, 1], [6, 19]),
    };
  });

  // Middle line: from (4,12)-(20,12), fades out
  const midProps = useAnimatedProps(() => {
    'worklet';
    const p = progress.value;
    return {
      opacity: 1 - p,
      x1: 4,
      y1: 12,
      x2: 20,
      y2: 12,
    };
  });

  // Bottom line: from (4,18)-(20,18) to diagonal (5,19)-(19,5)
  const botProps = useAnimatedProps(() => {
    'worklet';
    const p = progress.value;
    return {
      x1: interpolate(p, [0, 1], [4, 5]),
      y1: interpolate(p, [0, 1], [18, 19]),
      x2: interpolate(p, [0, 1], [20, 19]),
      y2: interpolate(p, [0, 1], [18, 5]),
    };
  });

  return (
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
      <AnimatedLine animatedProps={topProps} />
      <AnimatedLine animatedProps={midProps} />
      <AnimatedLine animatedProps={botProps} />
    </Svg>
  );
};

export interface EyeMorphProps {
  isOff: boolean;
  size?: number;
  color?: string;
  strokeWidth?: number;
  reduceMotion?: boolean;
}

/**
 * Eye ↔ EyeOff: animated slash draw across eye
 */
export const EyeMorph: React.FC<EyeMorphProps> = ({
  isOff,
  size = 24,
  color = '#171717',
  strokeWidth = 2,
  reduceMotion = false,
}) => {
  const SLASH_LENGTH = 29;
  const target = isOff ? 1 : 0;
  const progress = useSharedValue(target);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = target;
    } else {
      progress.value = withTiming(target, {
        duration: DUR.sm,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [isOff, target, reduceMotion, progress]);

  const slashProps = useAnimatedProps(() => {
    'worklet';
    return {
      strokeDashoffset: (1 - progress.value) * SLASH_LENGTH,
      opacity: progress.value,
    };
  });

  return (
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
      <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <Circle cx={12} cy={12} r={3} />
      <AnimatedLine
        x1={2}
        y1={2}
        x2={22}
        y2={22}
        strokeDasharray={SLASH_LENGTH}
        animatedProps={slashProps}
      />
    </Svg>
  );
};
