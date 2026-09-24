"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ChevronUpIconProps extends React.SVGAttributes<SVGSVGElement> {
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
 * Static upward chevron arrow icon.
 * Used for table header sorting indicators and collapse triggers.
 */
export const ChevronUpIcon = forwardRef<SVGSVGElement, ChevronUpIconProps>(
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
        <path d="m18 15-6-6-6 6" />
      </svg>
    );
  }
);

ChevronUpIcon.displayName = "ChevronUpIcon";
export { ChevronUpIcon as ChevronUp };
