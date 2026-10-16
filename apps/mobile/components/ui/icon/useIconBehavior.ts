/**
 * ReachInternational Mobile — useIconBehavior Hook
 * Connects press context, reduced motion, and icon state to UI-thread Reanimated shared values.
 */

import { useEffect, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../lib/preferences/useReducedMotion';
import { SPATIAL, DUR } from '../../../lib/motion/tokens';
import type { IconBehaviorKey } from './registry';

export interface UseIconBehaviorOptions {
  behavior: IconBehaviorKey;
  state?: string | boolean;
  loading?: boolean;
  pulseKey?: string | number | boolean;
  animate?: 'press' | 'mount' | 'none' | 'spin' | 'ring' | 'pulse' | 'auto';
  degrees?: number;
  slideDistance?: number;
}

export function useIconBehavior({
  behavior,
  state,
  loading = false,
  pulseKey,
  animate = 'auto',
  degrees = 180,
  slideDistance = 3,
}: UseIconBehaviorOptions) {
  const reduceMotion = useReducedMotion();

  const isOpen = state === 'open' || state === true || state === '1';

  // Shared values for UI thread transforms
  const rotateVal = useSharedValue(isOpen ? degrees : 0);
  const spinVal = useSharedValue(0);
  const pulseVal = useSharedValue(1);
  const ringVal = useSharedValue(0);

  // 1. Rotate toggle effect
  useEffect(() => {
    const isRotate =
      (behavior as string) === 'rotateToggle' ||
      (state !== undefined && (behavior as string) === 'static');
    if (!isRotate) return;

    const target = isOpen ? degrees : 0;
    if (reduceMotion) {
      rotateVal.value = target;
    } else {
      rotateVal.value = withSpring(target, {
        ...SPATIAL.fast,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [isOpen, degrees, reduceMotion, behavior, state, rotateVal]);

  // 2. Spin continuous loading effect
  useEffect(() => {
    const isSpin = loading || animate === 'spin' || (behavior === 'spin' && loading);
    if (isSpin && !reduceMotion) {
      spinVal.value = 0;
      spinVal.value = withRepeat(
        withTiming(360, {
          duration: DUR.lg * 3, // ~1050ms
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(spinVal);
      spinVal.value = 0;
    }

    return () => {
      cancelAnimation(spinVal);
    };
  }, [loading, animate, behavior, reduceMotion, spinVal]);

  // 3. Pulse single scale bounce effect (disabled to prevent icon bounce / scaling)
  useEffect(() => {
    pulseVal.value = 1;
  }, [pulseKey, animate, behavior, pulseVal]);

  // 4. Ring bell damped oscillation effect
  const isRingMountedRef = useRef(false);
  useEffect(() => {
    const isRing = behavior === 'ring' || animate === 'ring';
    if (!isRing || reduceMotion) return;

    if (!isRingMountedRef.current) {
      isRingMountedRef.current = true;
      if (pulseKey === undefined) return;
    }

    const t = DUR.xs; // 90ms
    ringVal.value = withSequence(
      withTiming(12, { duration: t, easing: Easing.out(Easing.quad) }),
      withTiming(-10, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(8, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(-4, { duration: t, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: t, easing: Easing.out(Easing.quad) })
    );
  }, [pulseKey, animate, behavior, reduceMotion, ringVal]);

  // UI-thread animated style
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (animate === 'none') return {};

    const transforms: any[] = [];

    // Pulse scale (1.0 -> 1.12 -> 1.0)
    if (pulseVal.value !== 1 && !reduceMotion) {
      transforms.push({ scale: pulseVal.value });
    }

    // Rotate toggle
    if (rotateVal.value !== 0) {
      transforms.push({ rotate: `${rotateVal.value}deg` });
    }

    // Spin rotation
    if (spinVal.value !== 0) {
      transforms.push({ rotate: `${spinVal.value}deg` });
    }

    // Ring rotation
    if (ringVal.value !== 0 && !reduceMotion) {
      transforms.push({ rotate: `${ringVal.value}deg` });
    }

    return transforms.length > 0 ? { transform: transforms } : {};
  });

  return {
    animatedStyle,
    reduceMotion,
    isAnimationEnabled: animate !== 'none',
  };
}
