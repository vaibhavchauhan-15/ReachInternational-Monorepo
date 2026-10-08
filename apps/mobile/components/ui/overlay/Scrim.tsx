/**
 * ReachInternational Mobile — Motion Overlay Scrim
 * Physics-driven backdrop for sheets, dialogs, drawers, and popovers.
 * Bound to animation progress with tap-to-dismiss behavior.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { EFFECTS, DUR } from '../../../lib/motion/tokens';
import { useMotion } from '../../../lib/motion/useMotion';

export interface ScrimProps {
  visible: boolean;
  onPress?: () => void;
  color?: string;
  maxOpacity?: number;
  style?: StyleProp<ViewStyle>;
  persistent?: boolean;
  animatedOpacity?: SharedValue<number>;
}

export const Scrim: React.FC<ScrimProps> = ({
  visible,
  onPress,
  color = '#000000',
  maxOpacity = 0.5,
  style,
  persistent = false,
  animatedOpacity,
}) => {
  const { isReduced } = useMotion();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      if (isReduced) {
        progress.value = 1;
      } else {
        progress.value = withSpring(1, {
          ...EFFECTS.default,
          reduceMotion: ReduceMotion.System,
        });
      }
    } else {
      if (isReduced) {
        progress.value = 0;
      } else {
        progress.value = withTiming(0, {
          duration: DUR.sm,
          reduceMotion: ReduceMotion.System,
        });
      }
    }
  }, [visible, isReduced, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity !== undefined ? animatedOpacity.value : progress.value * maxOpacity,
  }));

  if (!visible && !animatedOpacity && progress.value === 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color },
        animatedStyle,
        style,
      ]}
    >
      {!persistent && onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss overlay"
        />
      ) : null}
    </Animated.View>
  );
};
