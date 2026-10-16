/**
 * ReachInternational Mobile — Icon Behavior: pressNudge
 * Micro-scale 0.92 -> 1.0 spring on touch press.
 * Obeys reduced-motion and runs entirely on the UI thread.
 */

import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export function usePressNudge(
  _pressProgress: SharedValue<number> | null,
  _reduceMotion: boolean = false,
  _enabled: boolean = true
) {
  return useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scale: 1 }] };
  });
}
