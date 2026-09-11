import React from 'react';
import {
  ReachInternationalLogo,
  type ReachInternationalLogoProps,
  type LogoVariant,
  type ThemePolarity,
} from '../branding/ReachInternationalLogo';

export interface LogoProps extends Omit<ReachInternationalLogoProps, 'variant'> {
  variant?: LogoVariant | ThemePolarity;
  showText?: boolean;
}

/**
 * Reusable Reach International Brand Logo Component for Mobile.
 * Pure React Native + SVG + Typography.
 * Wraps canonical ReachInternationalLogo component to ensure theme safety and sharp resolution.
 */
export function Logo({
  variant,
  size = 32,
  showText = true,
  ...props
}: LogoProps) {
  const effectiveVariant: LogoVariant =
    variant === 'compact' || variant === 'wordmark' || variant === 'full'
      ? variant
      : showText
      ? 'full'
      : 'compact';

  return (
    <ReachInternationalLogo
      variant={effectiveVariant}
      size={size}
      {...props}
    />
  );
}

export { ReachInternationalLogo, ScissorLiftLogoIcon, ReachBrandEmblem } from '../branding';
