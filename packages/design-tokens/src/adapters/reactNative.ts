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

export const reactNativeSpacing = spacingNumeric;
export const reactNativeRadius = radiusNumeric;
export const reactNativeBreakpoints = breakpointsNumeric;
export const reactNativeMotionDurations = motionDurationsNumeric;

export interface ReactNativeTheme {
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacingNumeric;
  radius: typeof radiusNumeric;
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
