/**
 * ReachInternational Mobile — Reduced-Motion Aware Motion Hook
 * Provides system-aware animation tokens and helper functions.
 * When reduced motion is enabled (system accessibility or preference),
 * motion scales to 0 duration or opacity-only transitions.
 */

import { useMemo } from 'react';
import {
  ReduceMotion,
  withSpring,
  withTiming,
  Easing,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { useReducedMotion } from '../preferences/useReducedMotion';
import { SPATIAL, EFFECTS, DUR, EASE, DIST, SCALE } from './tokens';
import type { SpringConfig } from './springs';

export function useMotion() {
  const isReduced = useReducedMotion();

  return useMemo(() => {
    // When reduced motion is on, durations collapse to instant/minimal
    const dur = isReduced
      ? {
          instant: 0,
          xs: 0,
          sm: 0,
          md: 0,
          lg: 0,
          xl: 0,
        }
      : DUR;

    // Helper to create Reanimated withSpring with ReduceMotion.System attached
    const withSpatialSpring = (
      toValue: number,
      speed: keyof typeof SPATIAL = 'default',
      callback?: (finished?: boolean) => void,
    ) => {
      'worklet';
      const cfg: WithSpringConfig = {
        ...SPATIAL[speed],
        reduceMotion: ReduceMotion.System,
      };
      return withSpring(toValue, cfg, callback);
    };

    const withEffectsSpring = (
      toValue: number,
      speed: keyof typeof EFFECTS = 'default',
      callback?: (finished?: boolean) => void,
    ) => {
      'worklet';
      const cfg: WithSpringConfig = {
        ...EFFECTS[speed],
        reduceMotion: ReduceMotion.System,
      };
      return withSpring(toValue, cfg, callback);
    };

    const withMotionTiming = (
      toValue: number,
      durationMs: number = isReduced ? DUR.instant : DUR.md,
      easingCurve: readonly [number, number, number, number] = EASE.decel,
      callback?: (finished?: boolean) => void,
    ) => {
      'worklet';
      const cfg: WithTimingConfig = {
        duration: isReduced ? DUR.instant : durationMs,
        easing: Easing.bezier(
          easingCurve[0],
          easingCurve[1],
          easingCurve[2],
          easingCurve[3],
        ),
        reduceMotion: ReduceMotion.System,
      };
      return withTiming(toValue, cfg, callback);
    };

    return {
      isReduced,
      SPATIAL,
      EFFECTS,
      DUR: dur,
      EASE,
      DIST,
      SCALE,
      withSpatialSpring,
      withEffectsSpring,
      withMotionTiming,
    };
  }, [isReduced]);
}
