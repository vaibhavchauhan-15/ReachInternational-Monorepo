/**
 * ServiceCentric Design Tokens — Motion & Easing
 * Standardized timing durations and cubic-bezier easing curves.
 */

export const motionDurations = {
  instant: '80ms',
  fast: '150ms',
  normal: '250ms',
  slow: '350ms',
  slower: '500ms',
} as const;

export const motionDurationsNumeric = {
  instant: 80,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
} as const;

export const motionEasings = {
  easeOutCubic: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeSpring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  easeSmooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type MotionTokens = {
  durations: typeof motionDurations;
  easings: typeof motionEasings;
};
