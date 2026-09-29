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

/**
 * Mobile-Optimized Typography Presets (Industry Standard for Small Screens)
 * Strictly enforces a 3-tier hierarchy:
 * 1. Primary: Headings (22/18/16px), Body (15px), Buttons (15px)
 * 2. Secondary: Subtitles (14px), Labels (13.5px), Badges & Filter Pills (13px)
 * 3. Tertiary: Captions, Eyebrows & Tags (12px, absolute accessibility floor)
 */
export const mobileTypographyPresets = {
  primary: {
    display: {
      size: '26px',
      lineHeight: '32px',
      letterSpacing: '-0.8px',
      weight: fontWeights.bold,
    },
    headingLg: {
      size: '22px',
      lineHeight: '28px',
      letterSpacing: '-0.4px',
      weight: fontWeights.bold,
    },
    headingMd: {
      size: '18px',
      lineHeight: '24px',
      letterSpacing: '-0.2px',
      weight: fontWeights.semibold,
    },
    cardTitle: {
      size: '16px',
      lineHeight: '22px',
      letterSpacing: '-0.1px',
      weight: fontWeights.semibold,
    },
    body: {
      size: '15px',
      lineHeight: '22px',
      letterSpacing: '0px',
      weight: fontWeights.regular,
    },
    bodyMedium: {
      size: '15px',
      lineHeight: '22px',
      letterSpacing: '0px',
      weight: fontWeights.medium,
    },
    button: {
      size: '15px',
      lineHeight: '20px',
      letterSpacing: '0px',
      weight: fontWeights.semibold,
    },
  },
  secondary: {
    subtitle: {
      size: '14px',
      lineHeight: '20px',
      letterSpacing: '0px',
      weight: fontWeights.regular,
    },
    label: {
      size: '13.5px',
      lineHeight: '18px',
      letterSpacing: '-0.1px',
      weight: fontWeights.semibold,
    },
    badge: {
      size: '13px',
      lineHeight: '17px',
      letterSpacing: '0.2px',
      weight: fontWeights.semibold,
    },
    filterPill: {
      size: '13px',
      lineHeight: '18px',
      letterSpacing: '0px',
      weight: fontWeights.medium,
    },
  },
  tertiary: {
    caption: {
      size: '12px',
      lineHeight: '16px',
      letterSpacing: '0px',
      weight: fontWeights.regular,
    },
    captionMedium: {
      size: '12px',
      lineHeight: '16px',
      letterSpacing: '0px',
      weight: fontWeights.medium,
    },
    monoEyebrow: {
      size: '12px',
      lineHeight: '16px',
      letterSpacing: '0.5px',
      weight: fontWeights.semibold,
      fontFamily: fontFamilies.mono,
    },
    tag: {
      size: '12px',
      lineHeight: '16px',
      letterSpacing: '0px',
      weight: fontWeights.semibold,
    },
  },
} as const;

export const fontSizesNumeric = {
  // Primary Tier
  h1: 22,
  h2: 18,
  h3: 16,
  body: 15,
  button: 15,

  // Secondary Tier
  subtitle: 14,
  label: 13.5,
  badge: 13,
  filterPill: 13,

  // Tertiary Tier (Minimum 12px)
  caption: 12,
  tertiary: 12,
  eyebrow: 12,
} as const;
