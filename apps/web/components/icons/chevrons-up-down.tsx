"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ChevronsUpDownIconProps extends React.SVGAttributes<SVGSVGElement> {
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
 * Static ChevronsUpDown icon used for table sorting headers and neutral sort indicators.
 */
export const ChevronsUpDownIcon = forwardRef<SVGSVGElement, ChevronsUpDownIconProps>(
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
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
      </svg>
    );
  }
);

ChevronsUpDownIcon.displayName = "ChevronsUpDownIcon";
export { ChevronsUpDownIcon as ChevronsUpDown };
