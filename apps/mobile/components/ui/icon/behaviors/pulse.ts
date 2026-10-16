/**
 * ReachInternational Mobile — Icon Behavior: pulse
 * Micro-scale bounce disabled across mobile icons to ensure crisp, stable rendering without jitter.
 */

import { useAnimatedStyle } from 'react-native-reanimated';

export function usePulse(
  _pulseKey: string | number | boolean | undefined,
  _reduceMotion: boolean = false,
  _enabled: boolean = true
) {
  return useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: 1 }],
    };
  });
}
