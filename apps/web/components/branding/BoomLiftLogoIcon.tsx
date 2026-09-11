"use client";

import React from "react";

export interface BoomLiftLogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Official Vector SVG Boom Lift Icon for Reach International.
 * Renders a crisp, scalable industrial articulating boom lift with chassis,
 * counterweight turntable, diagonal boom arm, and elevated man-basket platform.
 */
export function BoomLiftLogoIcon({
  size = 32,
  className = "text-[var(--color-ink)]",
  style,
  ...props
}: BoomLiftLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-colors duration-200 ${className}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      suppressHydrationWarning
      {...props}
    >
      {/* Heavy Mobile Base Chassis */}
      <rect x="14" y="74" width="72" height="10" rx="4" fill="currentColor" />
      {/* Front & Rear Heavy Wheels */}
      <circle cx="25" cy="85" r="7.5" fill="currentColor" />
      <circle cx="25" cy="85" r="3.5" fill="var(--color-canvas, #fafafa)" />
      <circle cx="75" cy="85" r="7.5" fill="currentColor" />
      <circle cx="75" cy="85" r="3.5" fill="var(--color-canvas, #fafafa)" />

      {/* Turntable Counterweight Housing */}
      <rect x="18" y="58" width="26" height="16" rx="3" fill="currentColor" />
      <circle cx="30" cy="66" r="3" fill="var(--color-canvas, #fafafa)" />

      {/* Main Articulating Lower Boom Arm */}
      <line
        x1="30"
        y1="64"
        x2="58"
        y2="36"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Hydraulic Lift Actuator Cylinder */}
      <line
        x1="36"
        y1="70"
        x2="48"
        y2="46"
        stroke="#0070f3"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Articulation Knuckle Joint */}
      <circle cx="58" cy="36" r="4.5" fill="currentColor" />

      {/* Telescopic Fly Boom Arm */}
      <line
        x1="58"
        y1="36"
        x2="78"
        y2="20"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Elevated Man-Basket / Personnel Platform */}
      {/* Platform Floor */}
      <rect x="74" y="20" width="22" height="3.5" rx="1.5" fill="currentColor" />
      {/* Safety Guardrails */}
      <path
        d="M76 20 V8 H94 V20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Mid-height Safety Rail */}
      <line
        x1="76"
        y1="14"
        x2="94"
        y2="14"
        stroke="#0070f3"
        strokeWidth="2"
      />
      {/* Upward Reach Accent Arrow */}
      <path
        d="M87 6 L90 2 L93 6"
        stroke="#0070f3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
