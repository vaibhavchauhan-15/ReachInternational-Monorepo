/**
 * ServiceCentric Design Tokens — Typography
 * Canonical font stacks, font weights, line heights, and typography presets.
 */

export const fontFamilies = {
  sans: 'var(--font-geist-sans), "Inter", "Helvetica Neue", Arial, sans-serif',
  mono: 'var(--font-geist-mono), "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const typographyPresets = {
  displayXl: {
    size: '48px',
    lineHeight: '48px',
    letterSpacing: '-2.4px',
    weight: fontWeights.semibold,
  },
  headingLg: {
    size: '32px',
    lineHeight: '40px',
    letterSpacing: '-1.28px',
    weight: fontWeights.semibold,
  },
  headingMd: {
    size: '20px',
    lineHeight: '28px',
    letterSpacing: '-0.4px',
    weight: fontWeights.semibold,
  },
  labelSm: {
    size: '14px',
    lineHeight: '20px',
    letterSpacing: '-0.28px',
    weight: fontWeights.medium,
  },
  monoEyebrow: {
    size: '12px',
    lineHeight: '16px',
    letterSpacing: '0px',
    weight: fontWeights.medium,
    fontFamily: fontFamilies.mono,
  },
  bodyLg: {
    size: '16px',
    lineHeight: '24px',
    letterSpacing: '0px',
    weight: fontWeights.regular,
  },
  bodyMd: {
    size: '14px',
    lineHeight: '20px',
    letterSpacing: '0px',
    weight: fontWeights.regular,
  },
  bodySm: {
    size: '12px',
    lineHeight: '16px',
    letterSpacing: '0px',
    weight: fontWeights.regular,
  },
  buttonLg: {
    size: '16px',
    lineHeight: '20px',
    letterSpacing: '0px',
    weight: fontWeights.medium,
  },
  buttonMd: {
    size: '14px',
    lineHeight: '20px',
    letterSpacing: '0px',
    weight: fontWeights.medium,
  },
  code: {
    size: '14px',
    lineHeight: '20px',
    letterSpacing: '0px',
    weight: fontWeights.regular,
    fontFamily: fontFamilies.mono,
  },
} as const;

export type TypographyTokens = typeof typographyPresets;
