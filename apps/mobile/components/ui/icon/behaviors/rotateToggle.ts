/**
 * ReachInternational Mobile — Icon Behavior: rotateToggle
 * Chevrons (0 <-> 180°) and Plus (0 <-> 45° → X).
 * Physics-based spring using SPATIAL.fast token.
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { SPATIAL, DUR } from '../../../../lib/motion/tokens';

export function useRotateToggle(
  isOpen: boolean,
  degrees: number = 180,
  reduceMotion: boolean = false,
  enabled: boolean = true
) {
  const target = isOpen ? 1 : 0;
  const progress = useSharedValue(target);

  useEffect(() => {
    if (!enabled) return;
    if (reduceMotion) {
      progress.value = target;
    } else {
      progress.value = withSpring(target, {
        ...SPATIAL.fast,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [isOpen, target, reduceMotion, enabled, progress]);

  return useAnimatedStyle(() => {
    'worklet';
    const angle = progress.value * degrees;
    return {
      transform: [{ rotate: `${angle}deg` }],
    };
  });
}
