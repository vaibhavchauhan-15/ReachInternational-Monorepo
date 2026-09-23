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

export type IconInteractionVariant =
  | "lift"
  | "slide"
  | "arrow"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "chevron"
  | "rotate"
  | "scale"
  | "bounce"
  | "refresh"
  | "spin"
  | "tilt"
  | "shake"
  | "pulse"
  | "none";

export type IconTrigger = "hover" | "parent-hover" | "click" | "always" | "continuous" | "none";

export interface AnimateIconProps extends Omit<HTMLMotionProps<"span">, "children"> {
  icon?: LucideIcon;
  children?: React.ReactNode;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  animation?: IconAnimationPreset;
  interaction?: IconInteractionVariant | IconAnimationPreset;
  motion?: IconInteractionVariant | IconAnimationPreset;
  trigger?: IconTrigger;
  isSpinning?: boolean;
}

export type AnimatedIconProps = AnimateIconProps;

export function getIconInteractionClass(
  animation?: IconAnimationPreset | string,
  interaction?: IconInteractionVariant | IconAnimationPreset | string
): string {
  const key = (interaction || animation || "bounce").toLowerCase();

  switch (key) {
    case "arrow":
    case "arrow-right":
      return "icon-arrow";
    case "arrow-left":
      return "icon-arrow-left";
    case "arrow-up":
      return "icon-arrow-up";
    case "arrow-down":
      return "icon-arrow-down";
    case "chevron":
      return "icon-chevron";
    case "lift":
    case "float":
      return "icon-lift";
    case "slide":
    case "pointing":
      return "icon-slide";
    case "rotate":
    case "gear":
      return "icon-rotate";
    case "refresh":
      return "icon-refresh";
    case "spin":
      return "icon-spin";
    case "tilt":
      return "icon-tilt";
    case "shake":
    case "bell":
      return "icon-shake";
    case "pulse":
    case "glow":
      return "icon-pulse";
    case "scale":
    case "draw":
    case "sparkle":
    case "lens":
      return "icon-scale";
    case "none":
      return "";
    case "bounce":
    case "default":
    default:
      return "icon-bounce";
  }
}

const animationVariants: Record<IconAnimationPreset, Variants> = {
  bounce: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.1, transition: { type: "spring", stiffness: 450, damping: 22 } },
    tap: { scale: 0.94 },
  },
  spin: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 360, transition: { duration: 0.5, ease: "easeInOut" as const } },
    tap: { rotate: 720, transition: { duration: 0.3 } },
  },
  rotate: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 30, transition: { type: "spring", stiffness: 350, damping: 20 } },
    tap: { rotate: 60, scale: 0.94 },
  },
  "arrow-right": {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: { x: 3, transition: { type: "spring", stiffness: 400, damping: 20 } },
    tap: { x: 4, scale: 0.96 },
  },
  "arrow-left": {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: { x: -3, transition: { type: "spring", stiffness: 400, damping: 20 } },
    tap: { x: -4, scale: 0.96 },
  },
  "arrow-up": {
    initial: { y: 0 },
    animate: { y: 0 },
    hover: { y: -2, transition: { type: "spring", stiffness: 400, damping: 20 } },
    tap: { y: -3, scale: 0.96 },
  },
  "arrow-down": {
    initial: { y: 0 },
    animate: { y: 0 },
    hover: { y: 2, transition: { type: "spring", stiffness: 400, damping: 20 } },
    tap: { y: 3, scale: 0.96 },
  },
  gear: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: 45, transition: { type: "spring", stiffness: 300, damping: 18 } },
    tap: { rotate: 90, scale: 0.94 },
  },
  bell: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: {
      rotate: [0, -10, 10, -6, 6, 0],
      transition: { duration: 0.45, ease: "easeInOut" as const },
    },
    tap: { scale: 1.05 },
  },
  pulse: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.08, 1],
      transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" as const },
    },
    hover: { scale: 1.08 },
    tap: { scale: 0.94 },
  },
  shake: {
    initial: { x: 0 },
    animate: { x: 0 },
    hover: {
      x: [0, -3, 3, -2, 2, 0],
      transition: { duration: 0.35 },
    },
    tap: { scale: 0.94 },
  },
  draw: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.08, rotate: 6, transition: { type: "spring", stiffness: 350, damping: 20 } },
    tap: { scale: 0.94 },
  },
  sparkle: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 15, transition: { type: "spring", stiffness: 350, damping: 18 } },
    tap: { scale: 0.94 },
  },
  lens: {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: 1, rotate: 0 },
    hover: { scale: 1.08, rotate: -8, transition: { type: "spring", stiffness: 300, damping: 18 } },
    tap: { scale: 0.94 },
  },
  tilt: {
    initial: { rotate: 0 },
    animate: { rotate: 0 },
    hover: { rotate: -10, scale: 1.04, transition: { type: "spring", stiffness: 350, damping: 20 } },
    tap: { rotate: -15, scale: 0.94 },
  },
  pointing: {
    initial: { x: 0 },
    animate: {
      x: [0, 3, 0],
      transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" as const },
    },
    hover: { x: 3 },
    tap: { x: 4 },
  },
  wiggle: {
    initial: { rotate: 0 },
    animate: {
      rotate: [0, -8, 8, -6, 6, 0],
      transition: { duration: 0.45, ease: "easeInOut" as const },
    },
    hover: { rotate: 10 },
    tap: { scale: 0.94 },
  },
  float: {
    initial: { y: 0 },
    animate: {
      y: [0, -3, 0],
      transition: { repeat: Infinity, duration: 2, ease: "easeInOut" as const },
    },
    hover: { y: -3 },
    tap: { y: 0 },
  },
  glow: {
    initial: { opacity: 1 },
    animate: {
      scale: [1, 1.06, 1],
      transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" as const },
    },
    hover: { scale: 1.08 },
    tap: { scale: 0.94 },
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
    hover: { scale: 1.08, transition: { type: "spring", stiffness: 450, damping: 22 } },
    tap: { scale: 0.94 },
  },
  path: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.08 },
    tap: { scale: 0.94 },
  },
  "path-loop": {
    initial: { scale: 1 },
    animate: { scale: [1, 1.06, 1], transition: { repeat: Infinity, duration: 1.5 } },
    hover: { scale: 1.08 },
    tap: { scale: 0.94 },
  },
  default: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    hover: { scale: 1.09, transition: { type: "spring", stiffness: 450, damping: 22 } },
    tap: { scale: 0.94 },
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
      interaction,
      motion: motionPreset,
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
    const effectiveInteraction = interaction || motionPreset || animation;
    const interactionClass = prefersReducedMotion
      ? ""
      : getIconInteractionClass(animation, effectiveInteraction);
    const isParentDriven = trigger === "parent-hover" || trigger === "hover";

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

      if (trigger === "click") {
        return {
          whileTap: "tap",
          variants,
        };
      }

      if (trigger === "parent-hover") {
        return {
          variants,
        };
      }

      // Default: trigger === "hover" (full interactive animation on hover + tap)
      return {
        initial: "initial",
        whileHover: "hover",
        whileTap: "tap",
        variants,
      };
    }, [isSpinning, trigger, variants]);

    const iconDimensions = React.useMemo(() => {
      if (!size) return {};
      const s = typeof size === "number" ? `${size}px` : size;
      return { width: s, height: s };
    }, [size]);

    return (
      <motion.span
        ref={ref}
        data-interactive-icon={effectiveInteraction}
        className={cn(
          "inline-flex items-center justify-center shrink-0 leading-none select-none",
          isParentDriven && "interactive-icon",
          isParentDriven && interactionClass,
          className
        )}
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

export interface InteractiveIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: LucideIcon;
  children?: React.ReactNode;
  variant?: IconInteractionVariant | IconAnimationPreset;
  interaction?: IconInteractionVariant | IconAnimationPreset;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  isSpinning?: boolean;
}

export const InteractiveIcon = React.forwardRef<HTMLSpanElement, InteractiveIconProps>(
  (
    {
      icon: Icon,
      children,
      variant,
      interaction,
      size,
      strokeWidth = 2,
      className,
      isSpinning = false,
      style,
      ...props
    },
    ref
  ) => {
    const effectiveVariant = interaction || variant || "bounce";
    const interactionClass = getIconInteractionClass(effectiveVariant);
    const iconDimensions = React.useMemo(() => {
      if (!size) return {};
      const s = typeof size === "number" ? `${size}px` : size;
      return { width: s, height: s };
    }, [size]);

    return (
      <span
        ref={ref}
        data-interactive-icon={effectiveVariant}
        className={cn(
          "interactive-icon inline-flex items-center justify-center shrink-0 leading-none select-none",
          interactionClass,
          isSpinning && "animate-spin",
          className
        )}
        style={{
          display: "inline-flex",
          ...iconDimensions,
          ...style,
        }}
        {...props}
      >
        {Icon ? (
          <Icon size={size} strokeWidth={strokeWidth} className="w-full h-full" aria-hidden="true" />
        ) : (
          children
        )}
      </span>
    );
  }
);

InteractiveIcon.displayName = "InteractiveIcon";

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
