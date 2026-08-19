/**
 * ServiceCentric Design Tokens — Border Radius
 * Bimodal radius system (6px app chrome / 100px marketing pills).
 */

export const radius = {
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '16px',
  pillCategory: '64px',
  pill: '100px',
  full: '9999px',
} as const;

export const radiusNumeric = {
  none: 0,
  sm: 6,
  md: 12,
  lg: 16,
  pillCategory: 64,
  pill: 100,
  full: 9999,
} as const;

export type RadiusTokens = typeof radius;
