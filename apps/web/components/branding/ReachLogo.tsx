"use client";

import React from "react";
import Image from "next/image";

export interface ReachLogoProps {
  className?: string;
  /**
   * Theme variant:
   * - 'auto': responds dynamically to site theme (dark logo on light theme, light logo on dark theme)
   * - 'light': forces dark logo (for light backgrounds)
   * - 'dark': forces light logo with white text/icon (for dark backgrounds)
   * Defaults to 'auto'.
   */
  variant?: "light" | "dark" | "auto";
  showTagline?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  alt?: string;
}

/**
 * Official Authoritative Reach International Brand Logo Component for Web.
 * Renders the official dark & light themed brand assets with 2:1 native aspect ratio (1774 x 887).
 * Supports SSR, instant zero-FOUC theme switching, and crisp Retina scaling.
 */
export function ReachLogo({
  className = "",
  variant = "auto",
  width,
  height = 38,
  priority = false,
  alt = "Reach International — Reaching All Heights",
}: ReachLogoProps) {
  // Official master logo native aspect ratio is 2:1 (1774 x 887)
  const calculatedWidth = width ?? Math.round(height * 2);

  if (variant === "dark") {
    // Explicitly for dark backgrounds: display light logo (white text & symbol)
    return (
      <span className={`inline-flex items-center shrink-0 select-none ${className}`}>
        <Image
          src="/images/reach-logo-light.png"
          alt={alt}
          width={calculatedWidth}
          height={height}
          className="block object-contain"
          style={{ height: `${height}px`, width: "auto", aspectRatio: "2 / 1" }}
          priority={priority}
        />
      </span>
    );
  }

  if (variant === "light") {
    // Explicitly for light backgrounds: display dark logo (charcoal text & symbol)
    return (
      <span className={`inline-flex items-center shrink-0 select-none ${className}`}>
        <Image
          src="/images/reach-logo-dark.png"
          alt={alt}
          width={calculatedWidth}
          height={height}
          className="block object-contain"
          style={{ height: `${height}px`, width: "auto", aspectRatio: "2 / 1" }}
          priority={priority}
        />
      </span>
    );
  }

  // variant === 'auto': Dynamic theme switching with zero FOUC / zero layout shift via CSS & Tailwind
  return (
    <span className={`reach-logo-wrapper inline-flex items-center shrink-0 select-none ${className}`}>
      {/* Light Theme: show dark logo (charcoal logo on light background) */}
      <Image
        src="/images/reach-logo-dark.png"
        alt={alt}
        width={calculatedWidth}
        height={height}
        className="reach-logo-on-light dark:hidden block object-contain"
        style={{ height: `${height}px`, width: "auto", aspectRatio: "2 / 1" }}
        priority={priority}
      />
      {/* Dark Theme: show light logo (white logo on dark background) */}
      <Image
        src="/images/reach-logo-light.png"
        alt={alt}
        width={calculatedWidth}
        height={height}
        className="reach-logo-on-dark hidden dark:block object-contain"
        style={{ height: `${height}px`, width: "auto", aspectRatio: "2 / 1" }}
        priority={priority}
      />
    </span>
  );
}
