/**
 * ReachInternational Mobile — Icon Behavior: pressNudge
 * Micro-scale 0.9 -> 1.0 spring on touch press.
 * Obeys reduced-motion and runs entirely on the UI thread.
 */

import { useAnimatedStyle, withSpring, type SharedValue } from 'react-native-reanimated';
import { SPATIAL } from '../../../../lib/motion/tokens';

export function usePressNudge(
  pressProgress: SharedValue<number> | null,
  reduceMotion: boolean,
  enabled: boolean = true
) {
  return useAnimatedStyle(() => {
    'worklet';
    if (!enabled || reduceMotion || !pressProgress) {
      return { transform: [{ scale: 1 }] };
    }
    // As press progress moves 0 -> 1, icon micro-scales to 0.90
    const scale = 1 - pressProgress.value * 0.10;
    return {
      transform: [{ scale }],
    };
  });
}
