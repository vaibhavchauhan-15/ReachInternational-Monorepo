"use client";

import React from "react";
import { ReachLogo } from "./ReachLogo";
import { ScissorLiftLogoIcon } from "./ScissorLiftLogoIcon";

export type LogoVariant = "full" | "compact" | "wordmark";

export interface ReachInternationalLogoProps {
  variant?: LogoVariant;
  size?: number;
  showIcon?: boolean;
  showTagline?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  alt?: string;
  priority?: boolean;
}

/**
 * Official Canonical Reach International Brand Component.
 * Delegates full and wordmark layouts to ReachLogo (Reach dark & light themed assets),
 * eliminating the legacy scissor lift lockup and raw DOM typography across the codebase.
 * Provides 100% parity with mobile's ReachInternationalLogo implementation.
 */
export function ReachInternationalLogo({
  variant = "full",
  size = 32,
  showIcon = true,
  showTagline = true,
  className = "",
  iconClassName = "",
  textClassName = "",
  alt = "Reach International — Reaching All Heights",
  priority = false,
}: ReachInternationalLogoProps) {
  // Compact variant renders either compact ReachLogo, ScissorLift icon, or stylized monogram mark
  if (variant === "compact") {
    if (!showIcon) {
      return (
        <div
          className={`inline-flex items-center justify-center select-none ${className}`}
          aria-label={alt}
          title={alt}
        >
          <div className="flex items-center justify-center font-black text-slate-950 dark:text-white text-xs tracking-tighter bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg border border-sky-500/20">
            RI
          </div>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        aria-label={alt}
        title={alt}
      >
        <ReachLogo
          height={Math.min(size, 24)}
          priority={priority}
          alt={alt}
          className={iconClassName}
        />
      </div>
    );
  }

  // Authoritative Long Logo for full & wordmark variants (2:1 aspect ratio)
  const calculatedHeight = size ? Math.max(24, Math.round(size * 1.25)) : 38;

  return (
    <ReachLogo
      height={calculatedHeight}
      priority={priority}
      alt={alt}
      className={className}
    />
  );
}
