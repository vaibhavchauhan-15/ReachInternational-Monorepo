"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface LogOutIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface LogOutIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  isSpinning?: boolean;
  trigger?: string;
  animation?: string;
  interaction?: string;
  motion?: string;
}

const ARROW_VARIANTS: Variants = {
  normal: {
    translateX: 0,
    transition: { duration: 0.3, ease: "easeInOut" },
  },
  animate: {
    translateX: [0, 3, 0],
    transition: {
      duration: 0.45,
      ease: "easeInOut",
    },
  },
};

const LogOutIcon = forwardRef<LogOutIconHandle, LogOutIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 28,
      isSpinning,
      strokeWidth,
      trigger,
      animation,
      interaction,
      motion: _m,
      ...props
    },
    ref
  ) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLSpanElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <span
        className={cn(
          "inline-flex items-center justify-center",
          isSpinning && "animate-spin",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth ?? "2"}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Exit / doorway frame */}
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          {/* Outward pointing arrow */}
          <motion.g animate={controls} variants={ARROW_VARIANTS}>
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </motion.g>
        </svg>
      </span>
    );
  }
);

LogOutIcon.displayName = "LogOutIcon";

export { LogOutIcon };
