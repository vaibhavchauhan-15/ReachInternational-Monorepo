/**
 * ReachInternational Mobile — Icon Behavior: spin
 * Continuous rotate while loading=true.
 * Cancels cleanly on unmount or when loading becomes false.
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { DUR } from '../../../../lib/motion/tokens';

export function useSpin(loading: boolean, reduceMotion: boolean = false) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loading && !reduceMotion) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, {
          duration: DUR.lg * 3, // ~1050ms per rotation
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [loading, reduceMotion, rotation]);

  return useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });
}
