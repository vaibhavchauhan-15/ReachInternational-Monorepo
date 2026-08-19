/**
 * ServiceCentric Design Tokens — Spacing Scale
 * 4px base unit scale mapping up to 128px section margins.
 */

export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '64px',
  '4xl': '96px',
  section: '128px',
} as const;

export const spacingNumeric = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 64,
  '4xl': 96,
  section: 128,
} as const;

export type SpacingTokens = typeof spacing;
