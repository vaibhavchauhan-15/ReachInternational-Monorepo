/**
 * ReachInternational Mobile — Icon Size & Tone Design Tokens
 * Bound to centralized typography levels and Vercel Geist design tokens.
 */

import { type ColorValue } from 'react-native';
import { iconSize, scaled, type IconSizeVariant } from '@reachinternational/design-tokens';

export type IconSizeLevel =
  | IconSizeVariant
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl';

export const ICON_SIZE_ALIASES: Record<string, number> = {
  xs: iconSize.caption,    // 12
  sm: iconSize.label,      // 14
  md: iconSize.body,       // 16
  lg: iconSize.heading,    // 18
  xl: iconSize.title,      // 22
  '2xl': iconSize.display, // 28
  caption: iconSize.caption,
  label: iconSize.label,
  mono: iconSize.mono,
  body: iconSize.body,
  subheading: iconSize.subheading,
  heading: iconSize.heading,
  title: iconSize.title,
  display: iconSize.display,
};

export type IconTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info'
  | 'inherit';

export function resolveIconSize(
  size?: number | IconSizeLevel,
  scale: number = 1
): number {
  if (typeof size === 'number') {
    return scaled(size, scale);
  }
  if (typeof size === 'string' && size in ICON_SIZE_ALIASES) {
    return scaled(ICON_SIZE_ALIASES[size], scale);
  }
  return scaled(iconSize.body, scale); // 16 default
}

export function resolveIconColor(
  tone?: IconTone,
  color?: string | ColorValue,
  themeColors?: {
    ink: string;
    mute: string;
    primary: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  }
): ColorValue | undefined {
  if (color) return color;
  if (!tone || tone === 'inherit' || !themeColors) return undefined;

  switch (tone) {
    case 'muted':
      return themeColors.mute;
    case 'primary':
      return themeColors.primary;
    case 'danger':
      return themeColors.error;
    case 'success':
      return themeColors.success;
    case 'warning':
      return themeColors.warning;
    case 'info':
      return themeColors.info;
    case 'default':
    default:
      return themeColors.ink;
  }
}
