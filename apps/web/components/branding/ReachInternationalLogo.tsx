"use client";

import React from "react";
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
 * Pure React + Typography + CSS implementation.
 * Responsive, light & dark theme-aware, lightweight, sharp at all resolutions.
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
}: ReachInternationalLogoProps) {
  // Compact variant renders either icon mark or stylized monogram mark
  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${className}`}
        aria-label={alt}
        title={alt}
      >
        {showIcon ? (
          <ScissorLiftLogoIcon size={size} className={iconClassName} />
        ) : (
          <div className="flex items-center justify-center font-black text-slate-950 dark:text-white text-xs tracking-tighter bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg border border-sky-500/20">
            RI
          </div>
        )}
      </div>
    );
  }

  const iconSize = Math.max(24, Math.round(size * 1.05));

  return (
    <div
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label={alt}
    >
      {/* Optional Graphic Icon (For full variant when showIcon is true) */}
      {variant !== "wordmark" && showIcon && (
        <ScissorLiftLogoIcon size={iconSize} className={iconClassName} />
      )}

      {/* Brand Typography Block */}
      <div className={`flex flex-col justify-center ${textClassName}`}>
        {/* Main & Secondary Brand Title Row */}
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-black tracking-tight text-slate-950 dark:text-white uppercase font-sans text-[0.85em]">
            REACH
          </span>
          <span className="font-bold tracking-tight text-sky-600 dark:text-sky-400 uppercase font-sans text-[0.85em]">
            INTERNATIONAL
          </span>
        </div>

        {/* Divider Line & Tagline (For Full Variant) */}
        {variant === "full" && showTagline && (
          <div className="flex flex-col mt-1 w-full">
            <div className="h-[1px] w-full bg-slate-300 dark:bg-slate-700/80 rounded-full" />
            <span className="font-semibold tracking-[0.2em] text-[0.46em] text-slate-500 dark:text-slate-400 uppercase leading-none mt-1">
              REACHING ALL HEIGHTS
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
