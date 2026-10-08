/**
 * ReachInternational Mobile — Spring Physics Helpers & Worklets
 * Provides damping ratio calculation, momentum projection, and boundary rubber-banding.
 */

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

/**
 * Damping from damping ratio for unit mass: c = 2 · ζ · √(k · m)
 * where m = 1 (unit mass), k = stiffness, and ζ = ratio.
 */
export const spring = (stiffness: number, ratio: number): SpringConfig => ({
  mass: 1,
  stiffness,
  damping: 2 * ratio * Math.sqrt(stiffness),
});

/**
 * Momentum projection: determines where a flick/swipe would come to rest
 * if it kept decelerating (Apple exponential-decay form).
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Rubber-band resistance: calculates non-linear resistance past a boundary edge.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
