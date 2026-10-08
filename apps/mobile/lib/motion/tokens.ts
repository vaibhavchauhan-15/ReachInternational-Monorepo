/**
 * ReachInternational Mobile — Motion Tokens (Android 16 / Material 3 Expressive)
 * Canonical single source of truth for physics-based springs, durations,
 * easings, distances, and scales across the entire mobile application.
 */

import { spring } from './springs';

/**
 * Spatial springs (position, size, rotation; may overshoot slightly)
 * Fast: stiffness 1400 / damping-ratio 0.9
 * Default: stiffness 700 / damping-ratio 0.9
 * Slow: stiffness 300 / damping-ratio 0.9
 */
export const SPATIAL = {
  fast: spring(1400, 0.9),
  default: spring(700, 0.9),
  slow: spring(300, 0.9),
} as const;

/**
 * Effects springs (opacity, colour; never overshoot)
 * Fast: stiffness 3800 / damping-ratio 1.0
 * Default: stiffness 1600 / damping-ratio 1.0
 * Slow: stiffness 800 / damping-ratio 1.0
 */
export const EFFECTS = {
  fast: spring(3800, 1.0),
  default: spring(1600, 1.0),
  slow: spring(800, 1.0),
} as const;

export const DUR = {
  instant: 0,
  xs: 90,
  sm: 150,
  md: 250,
  lg: 350,
  xl: 450,
} as const;

export const EASE = {
  standard: [0.2, 0, 0, 1] as const,
  decel: [0.05, 0.7, 0.1, 1] as const,
  accel: [0.3, 0, 0.8, 0.15] as const,
} as const;

export const DIST = {
  shiftAxis: 30,
  menuOffset: 8,
  sheetPeek: 24,
  toastSlide: 16,
} as const;

export const SCALE = {
  pressButton: 0.98,
  dialogFrom: 0.92,
  fadeThroughFrom: 0.92,
  backPreview: 0.9,
  popoverFrom: 0.8,
} as const;
