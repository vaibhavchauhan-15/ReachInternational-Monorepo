"use client";

import React from "react";
import {
  ReachInternationalLogo,
  LogoVariant,
} from "@/components/branding/ReachInternationalLogo";

export interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  showText?: boolean;
  textClassName?: string;
}

/**
 * Reusable Reach International Brand Logo Component.
 * Pure React + SVG + Typography + CSS implementation.
 * Wraps canonical ReachInternationalLogo component to ensure theme safety and sharp resolution.
 */
export function Logo({
  variant,
  size = 32,
  width,
  height,
  className = "",
  alt = "Reach International — Reaching All Heights",
  showText = true,
  textClassName = "",
}: LogoProps) {
  const effectiveSize = size || height || width || 32;

  // Determine variant: if showText is explicitly false, default to compact icon mode
  const effectiveVariant: LogoVariant =
    variant || (showText ? "full" : "compact");

  return (
    <ReachInternationalLogo
      variant={effectiveVariant}
      size={effectiveSize}
      className={className}
      alt={alt}
      textClassName={textClassName}
    />
  );
}

export { ReachInternationalLogo, ScissorLiftLogoIcon } from "@/components/branding";
