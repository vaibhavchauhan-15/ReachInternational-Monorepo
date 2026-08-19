"use client";

import React from "react";
import { motion, useReducedMotion, Variants, HTMLMotionProps } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconAnimationPreset =
  | "bounce"
  | "spin"
  | "rotate"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "gear"
  | "bell"
  | "pulse"
  | "shake"
  | "draw"
  | "sparkle"
  | "lens"
  | "tilt"
  | "pointing"
  | "wiggle"
  | "float"
  | "glow"
  | "flip"
  | "scale"
  | "path"
  | "path-loop"
  | "default"
  | "none";

export type IconAnimationVariant = IconAnimationPreset;

export type IconTrigger = "hover" | "parent-hover" | "click" | "always" | "continuous" | "none";

export interface AnimateIconProps extends Omit<HTMLMotionProps<"span">, "children"> {
  icon?: LucideIcon;
  children?: React.ReactNode;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  animation?: IconAnimationPreset;
  trigger?: IconTrigger;
  isSpinning?: boolean;
}

export type AnimatedIconProps = AnimateIconProps;

const animationVariants: Record<IconAnimationPreset, Variants> = {
  bounce: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.18, transition: { type: "spring", stiffness: 400, damping: 12 } },
    tap: { scale: 0.9 },
  },
  spin: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 180, transition: { type: "spring", stiffness: 200, damping: 15 } },
    tap: { rotate: 360, transition: { duration: 0.3 } },
  },
  rotate: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 90, transition: { type: "spring", stiffness: 300, damping: 15 } },
    tap: { rotate: 180 },
  },
  "arrow-right": {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: { x: 4, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: { x: 6 },
  },
  "arrow-left": {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: { x: -4, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: { x: -6 },
  },
  "arrow-up": {
    initial: { y: 0 },
    animate: { y: 0 },
    hover: { y: -4, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: { y: -6 },
  },
  "arrow-down": {
    initial: { y: 0 },
    animate: { y: 0 },
    hover: { y: 4, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: { y: 6 },
  },
  gear: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 90, transition: { type: "spring", stiffness: 250, damping: 15 } },
    tap: { rotate: 180 },
  },
  bell: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: {
      rotate: [0, -14, 14, -10, 10, -4, 4, 0],
      transition: { duration: 0.6, ease: "easeInOut" as const },
    },
    tap: { scale: 1.15 },
  },
  pulse: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.1, 1],
      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" as const },
    },
    hover: { scale: 1.2 },
    tap: { scale: 0.9 },
  },
  shake: {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: {
      x: [0, -4, 4, -4, 4, 0],
      transition: { duration: 0.4 },
    },
    tap: { scale: 0.9 },
  },
  draw: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.15, rotate: 5, transition: { type: "spring", stiffness: 300 } },
    tap: { scale: 0.95 },
  },
  sparkle: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.22, rotate: 18, transition: { type: "spring", stiffness: 350, damping: 12 } },
    tap: { scale: 0.88 },
  },
  lens: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.15, rotate: -10, transition: { type: "spring", stiffness: 300 } },
    tap: { scale: 0.9 },
  },
  tilt: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: -15, transition: { type: "spring", stiffness: 300 } },
    tap: { rotate: 0 },
  },
  pointing: {
    initial: { x: 0 },
    animate: {
      x: [0, 4, 0],
      transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" as const },
    },
    hover: { x: 6 },
    tap: { x: 8 },
  },
  wiggle: {
    initial: { rotate: 0 },
    animate: {
      rotate: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.5, ease: "easeInOut" as const },
    },
    hover: { rotate: 15 },
    tap: { scale: 0.9 },
  },
  float: {
    initial: { y: 0 },
    animate: {
      y: [0, -4, 0],
      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" as const },
    },
    hover: { y: -6 },
    tap: { y: 0 },
  },
  glow: {
    initial: { opacity: 1 },
    animate: {
      scale: [1, 1.08, 1],
      transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" as const },
    },
    hover: { scale: 1.15 },
    tap: { scale: 0.95 },
  },
  flip: {
    initial: { rotateY: 0 },
    animate: { rotateY: 0 },
    hover: { rotateY: 180, transition: { duration: 0.4 } },
    tap: { rotateY: 360 },
  },
  scale: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.2, transition: { type: "spring", stiffness: 300 } },
    tap: { scale: 0.9 },
  },
  path: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.15 },
    tap: { scale: 0.9 },
  },
  "path-loop": {
    initial: { scale: 1 },
    animate: { scale: [1, 1.1, 1], transition: { repeat: Infinity, duration: 1.5 } },
    hover: { scale: 1.2 },
    tap: { scale: 0.9 },
  },
  default: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.1, transition: { type: "spring", stiffness: 300 } },
    tap: { scale: 0.95 },
  },
  none: {
    initial: {},
    animate: {},
    hover: {},
    tap: {},
  },
};

export const AnimateIcon = React.forwardRef<HTMLSpanElement, AnimateIconProps>(
  (
    {
      icon: Icon,
      children,
      size,
      strokeWidth = 2,
      className,
      animation = "bounce",
      trigger = "hover",
      isSpinning = false,
      style,
      ...motionProps
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotion();
    const effectiveAnimation = prefersReducedMotion ? "none" : animation;
    const variants = animationVariants[effectiveAnimation] || animationVariants.none;

    const motionComponentProps = React.useMemo(() => {
      if (isSpinning) {
        return {
          animate: { rotate: 360 },
          transition: { repeat: Infinity, duration: 1, ease: "linear" as const },
        };
      }

      if (trigger === "always" || trigger === "continuous") {
        return {
          animate: variants.animate ? "animate" : "hover",
          variants,
        };
      }

      if (trigger === "hover") {
        return {
          initial: "initial",
          whileHover: "hover",
          whileTap: "tap",
          variants,
        };
      }

      if (trigger === "parent-hover") {
        return {
          variants,
        };
      }

      if (trigger === "click") {
        return {
          whileTap: "tap",
          variants,
        };
      }

      return {};
    }, [isSpinning, trigger, variants]);

    const iconDimensions = React.useMemo(() => {
      if (!size) return {};
      const s = typeof size === "number" ? `${size}px` : size;
      return { width: s, height: s };
    }, [size]);

    return (
      <motion.span
        ref={ref}
        className={cn("inline-flex items-center justify-center shrink-0 leading-none select-none", className)}
        style={{
          display: "inline-flex",
          ...iconDimensions,
          ...style,
        }}
        {...motionComponentProps}
        {...motionProps}
      >
        {Icon ? (
          <Icon size={size} strokeWidth={strokeWidth} className="w-full h-full" aria-hidden="true" />
        ) : (
          children
        )}
      </motion.span>
    );
  }
);

AnimateIcon.displayName = "AnimateIcon";

export const AnimatedIcon = AnimateIcon;

export function createAnimatedIcon(Icon: LucideIcon, defaultAnimation: IconAnimationPreset = "bounce") {
  const Component = React.forwardRef<HTMLSpanElement, Omit<AnimateIconProps, "icon">>(
    (props, ref) => (
      <AnimateIcon
        ref={ref}
        icon={Icon}
        animation={props.animation || defaultAnimation}
        {...props}
      />
    )
  );
  Component.displayName = `Animated${Icon.displayName || "Icon"}`;
  return Component;
}
