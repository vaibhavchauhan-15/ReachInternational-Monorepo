import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle, ColorValue } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

export type LinearGradientPoint =
  | { x: number; y: number }
  | [number, number];

export interface LinearGradientProps extends ViewProps {
  colors: readonly [ColorValue, ColorValue, ...ColorValue[]] | readonly string[] | string[];
  locations?: readonly [number, number, ...number[]] | readonly number[] | number[] | null;
  start?: LinearGradientPoint | null;
  end?: LinearGradientPoint | null;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Universal cross-platform LinearGradient primitive.
 * Wraps expo-linear-gradient with safe web fallback and consistent typings across Android, iOS, and Web.
 */
export function AppLinearGradient({
  colors,
  locations,
  start,
  end,
  style,
  children,
  ...rest
}: LinearGradientProps) {
  // Ensure at least two colors for valid gradient rendering
  const safeColors: readonly [ColorValue, ColorValue, ...ColorValue[]] =
    Array.isArray(colors) && colors.length >= 2
      ? (colors as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]])
      : Array.isArray(colors) && colors.length === 1
      ? [colors[0], colors[0]]
      : ['transparent', 'transparent'];

  const safeLocations = Array.isArray(locations) && locations.length >= 2
    ? (locations as unknown as readonly [number, number, ...number[]])
    : undefined;

  return (
    <ExpoLinearGradient
      colors={safeColors}
      locations={safeLocations}
      start={start as any}
      end={end as any}
      style={style}
      {...rest}
    >
      {children}
    </ExpoLinearGradient>
  );
}

export { AppLinearGradient as LinearGradient };
export default AppLinearGradient;
