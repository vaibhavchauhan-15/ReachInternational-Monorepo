/**
 * ServiceCentric Design Tokens — React Native / Expo Adapter
 * Adapts design tokens into strongly-typed React Native numeric spacing, radius,
 * shadow styles, and light/dark theme color maps.
 */

import { colorsLight, colorsDark, type ColorTokens } from '../tokens/colors';
import { spacingNumeric } from '../tokens/spacing';
import { radiusNumeric } from '../tokens/radius';
import { breakpointsNumeric } from '../tokens/breakpoints';
import { motionDurationsNumeric } from '../tokens/motion';
import { fontSizesNumeric } from '../tokens/typography';

export const reactNativeSpacing = spacingNumeric;
export const reactNativeRadius = radiusNumeric;
export const reactNativeBreakpoints = breakpointsNumeric;
export const reactNativeMotionDurations = motionDurationsNumeric;
export const reactNativeFontSizes = fontSizesNumeric;

/**
 * Standard Native Mobile Typography Hierarchy
 * Strictly mapped to Primary, Secondary, and Tertiary font sizes:
 * - Primary: Headings (22/18/16), Body (15), Button (15)
 * - Secondary: Subtitles (14), Field Labels (13.5), Badges (12.5-13), Filter Pills (13)
 * - Tertiary: Captions, Metadata, Monospace tags (12, absolute floor)
 */
export const reactNativeTypography = {
  // Primary Tier
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  bodyBold: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },

  // Secondary Tier
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 13.5, lineHeight: 18, fontWeight: '600' as const },
  badge: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' as const },
  filterPill: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },

  // Tertiary Tier (Minimum 12, never below 12)
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  mono: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
} as const;

export interface ReactNativeTheme {
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacingNumeric;
  radius: typeof radiusNumeric;
  typography: typeof reactNativeTypography;
  fontSizes: typeof fontSizesNumeric;
  shadows: {
    none: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    whisper: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    floating: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
}

export const lightThemeRN: ReactNativeTheme = {
  isDark: false,
  colors: colorsLight,
  spacing: spacingNumeric,
  radius: radiusNumeric,
  typography: reactNativeTypography,
  fontSizes: fontSizesNumeric,
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    whisper: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    floating: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

export const darkThemeRN: ReactNativeTheme = {
  isDark: true,
  colors: colorsDark,
  spacing: spacingNumeric,
  radius: radiusNumeric,
  typography: reactNativeTypography,
  fontSizes: fontSizesNumeric,
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    whisper: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.4,
      shadowRadius: 2,
      elevation: 2,
    },
    floating: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 8,
    },
  },
};

export function getRNTheme(isDark: boolean): ReactNativeTheme {
  return isDark ? darkThemeRN : lightThemeRN;
}
