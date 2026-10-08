/**
 * ReachInternational Mobile — Icon Behavior: slideNudge
 * Arrow-right / external-link / row chevron translateX 2-3dp on touch press.
 */

import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export function useSlideNudge(
  pressProgress: SharedValue<number> | null,
  distance: number = 3,
  reduceMotion: boolean = false,
  enabled: boolean = true
) {
  return useAnimatedStyle(() => {
    'worklet';
    if (!enabled || reduceMotion || !pressProgress) {
      return { transform: [{ translateX: 0 }] };
    }
    const tx = pressProgress.value * distance;
    return {
      transform: [{ translateX: tx }],
    };
  });
}
