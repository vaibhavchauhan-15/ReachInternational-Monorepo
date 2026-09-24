"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ChevronDownIconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  isSpinning?: boolean;
  trigger?: string;
  animation?: string;
  interaction?: string;
  motion?: string;
  [key: string]: any;
}

/**
 * Static dropdown chevron arrow icon.
 * Used for dropdown selections, accordions, and selects across the application.
 * Opens and closes smoothly via standard CSS transitions (e.g. `rotate-180`).
 */
export const ChevronDownIcon = forwardRef<SVGSVGElement, ChevronDownIconProps>(
  ({ className, size = 16, strokeWidth = 2, isSpinning: _isSpinning, trigger: _trigger, animation: _animation, interaction: _interaction, motion: _motion, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("shrink-0", className)}
        {...props}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
);

ChevronDownIcon.displayName = "ChevronDownIcon";
export { ChevronDownIcon as ChevronDown };
