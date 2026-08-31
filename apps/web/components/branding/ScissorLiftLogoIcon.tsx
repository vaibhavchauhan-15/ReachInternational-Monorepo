"use client";

import React from "react";

export interface ScissorLiftLogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  accentClassName?: string;
}

/**
 * Official Vector SVG Scissor Lift Icon for Reach International.
 * Renders a crisp, scalable, theme-aware industrial lifting platform with X-scissor arms and upward height indicator arrow.
 */
export function ScissorLiftLogoIcon({
  size = 32,
  className,
  accentClassName,
  style,
  ...props
}: ScissorLiftLogoIconProps) {
  const iconClass = className || "text-slate-900 dark:text-white";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-colors duration-200 ${iconClass}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      suppressHydrationWarning
      {...props}
    >
      {/* Heavy Base Chassis */}
      <rect x="16" y="82" width="68" height="6" rx="3" fill="currentColor" />
      <circle cx="26" cy="91" r="4.5" fill="currentColor" />
      <circle cx="74" cy="91" r="4.5" fill="currentColor" />

      {/* Hydraulic Base Mounts */}
      <rect x="22" y="78" width="8" height="4" fill="currentColor" />
      <rect x="70" y="78" width="8" height="4" fill="currentColor" />

      {/* Lower Scissor Level (Bottom X-Brace) */}
      <path
        d="M26 82 L74 54"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M74 82 L26 54"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="68" r="3" fill="currentColor" />

      {/* Upper Scissor Level (Top X-Brace) */}
      <path
        d="M26 54 L74 26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M74 54 L26 26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="40" r="3" fill="currentColor" />

      {/* Center Hydraulic Lift Cylinder */}
      <line
        x1="50"
        y1="78"
        x2="50"
        y2="28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="4 2"
        opacity="0.4"
      />

      {/* Upper Work Platform Deck */}
      <rect x="14" y="20" width="72" height="6" rx="2" fill="currentColor" />

      {/* Safety Guardrails */}
      <path
        d="M18 20 V8 H82 V20"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M50 20 V8" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
