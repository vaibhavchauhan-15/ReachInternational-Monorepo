/**
 * ReachInternational Mobile — Icon Behavior: ring
 * Bell damped oscillation keyframes ±12° on pulseKey update.
 */

import { useEffect, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DUR } from '../../../../lib/motion/tokens';

export function useRing(
  pulseKey: string | number | boolean | undefined,
  reduceMotion: boolean = false,
  enabled: boolean = true
) {
  const rotation = useSharedValue(0);
  const isMounted = useRef(false);

  useEffect(() => {
    if (!enabled || reduceMotion) return;

    if (!isMounted.current) {
      isMounted.current = true;
      if (pulseKey === undefined) return;
    }

    const t = DUR.xs; // 90ms per tick
    rotation.value = withSequence(
      withTiming(12, { duration: t, easing: Easing.out(Easing.quad) }),
      withTiming(-10, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(8, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(-4, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: t, easing: Easing.out(Easing.quad) })
    );
  }, [pulseKey, reduceMotion, enabled, rotation]);

  return useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });
}
