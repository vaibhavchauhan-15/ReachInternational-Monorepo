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
  accentClassName = "text-sky-600 dark:text-sky-400",
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
      {...props}
    >
      {/* Heavy Base Chassis */}
      <rect x="12" y="82" width="68" height="6" rx="3" fill="currentColor" />
      <circle cx="22" cy="91" r="4.5" fill="currentColor" />
      <circle cx="70" cy="91" r="4.5" fill="currentColor" />

      {/* Hydraulic Base Mounts */}
      <rect x="18" y="78" width="8" height="4" fill="currentColor" />
      <rect x="66" y="78" width="8" height="4" fill="currentColor" />

      {/* Lower Scissor Level (Bottom X-Brace) */}
      <path
        d="M22 82 L70 54"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M70 82 L22 54"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="46" cy="68" r="3" fill="currentColor" />

      {/* Upper Scissor Level (Top X-Brace) */}
      <path
        d="M22 54 L70 26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M70 54 L22 26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="46" cy="40" r="3" fill="currentColor" />

      {/* Center Hydraulic Lift Cylinder */}
      <line
        x1="46"
        y1="78"
        x2="46"
        y2="28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="4 2"
        opacity="0.4"
      />

      {/* Upper Work Platform Deck */}
      <rect x="10" y="20" width="72" height="6" rx="2" fill="currentColor" />

      {/* Safety Guardrails */}
      <path
        d="M14 20 V8 H78 V20"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M46 20 V8" stroke="currentColor" strokeWidth="2.5" />

      {/* Upward Height Indicator Arrow (Brand Accent Blue) */}
      <g className={accentClassName}>
        <path
          d="M89 54 V10"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M81 18 L89 8 L97 18"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
