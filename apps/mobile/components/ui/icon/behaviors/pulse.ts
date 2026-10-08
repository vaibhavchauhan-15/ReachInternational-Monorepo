/**
 * ReachInternational Mobile — Icon Behavior: pulse
 * Single scale 1.0 -> 1.12 -> 1.0 spring on pulseKey change or mount.
 */

import { useEffect, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import { SPATIAL } from '../../../../lib/motion/tokens';

export function usePulse(
  pulseKey: string | number | boolean | undefined,
  reduceMotion: boolean = false,
  enabled: boolean = true
) {
  const scale = useSharedValue(1);
  const isMounted = useRef(false);

  useEffect(() => {
    if (!enabled || reduceMotion) return;

    if (!isMounted.current) {
      isMounted.current = true;
      if (pulseKey === undefined) return;
    }

    scale.value = withSequence(
      withSpring(1.12, { ...SPATIAL.fast, reduceMotion: ReduceMotion.System }),
      withSpring(1.0, { ...SPATIAL.fast, reduceMotion: ReduceMotion.System })
    );
  }, [pulseKey, reduceMotion, enabled, scale]);

  return useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: scale.value }],
    };
  });
}
