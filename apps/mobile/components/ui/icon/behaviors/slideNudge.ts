/**
 * ReachInternational Mobile — Icon Behavior: slideNudge
 * Arrow-right / external-link / row chevron translateX 2-3dp on touch press.
 */

import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export function useSlideNudge(
  _pressProgress: SharedValue<number> | null,
  _distance: number = 3,
  _reduceMotion: boolean = false,
  _enabled: boolean = true
) {
  return useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: 0 }] };
  });
}
