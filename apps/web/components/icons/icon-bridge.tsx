"use client";

import React, { forwardRef, useRef, useImperativeHandle, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedIconBridgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  isSpinning?: boolean;
  className?: string;
  trigger?: string;
  animation?: string;
  interaction?: string;
  motion?: string;
  [key: string]: any;
}

/**
 * Higher-order component bridge for animated icons.
 * Enforces:
 * 1. Consistent size, padding, and layout (scales SVG to 100% of container, prevents overflow).
 * 2. Automatic parent-hover triggering: when inside a button, link, or card, hovering the parent
 *    triggers the icon's default animation.
 * 3. Standalone hover: when the icon is alone (no outer layout/padding), hovering the icon itself
 *    triggers the animation.
 * 4. Preserves 100% of the imported icon's default animation without adding any custom animations.
 * 5. Sanitizes custom non-DOM animation props (isSpinning, trigger, animation, interaction, motion)
 *    so they never leak down to child DOM elements or trigger React unknown-attribute warnings.
 */
export function createAnimatedIconBridge(
  IconComponent: React.ComponentType<any>,
  iconName = "Icon"
) {
  const WrappedIcon = forwardRef<any, AnimatedIconBridgeProps>(
    (
      {
        size = 20,
        className,
        isSpinning,
        trigger: _trigger,
        animation: _animation,
        interaction: _interaction,
        motion: _motion,
        strokeWidth,
        color,
        style,
        onMouseEnter,
        onMouseLeave,
        ...rest
      },
      forwardedRef
    ) => {
      const containerRef = useRef<HTMLSpanElement>(null);
      const innerHandleRef = useRef<any>(null);
      const hasParentRef = useRef(false);

      useImperativeHandle(forwardedRef, () => ({
        startAnimation: () => innerHandleRef.current?.startAnimation?.(),
        stopAnimation: () => innerHandleRef.current?.stopAnimation?.(),
      }));

      useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Find nearest interactive parent container (innermost matching container)
        const nearestParent = el.closest<HTMLElement>(
          'button, a, [role="button"], [data-hover-parent], .interactive-parent, [data-interactive-card], .badge-base, .cursor-pointer'
        );

        if (!nearestParent || nearestParent === el) {
          hasParentRef.current = false;
          return;
        }

        hasParentRef.current = true;
        let isHovered = false;

        const handleEnter = () => {
          if (!isHovered) {
            isHovered = true;
            innerHandleRef.current?.startAnimation?.();
          }
        };

        const handleLeave = () => {
          if (isHovered) {
            isHovered = false;
            innerHandleRef.current?.stopAnimation?.();
          }
        };

        nearestParent.addEventListener("mouseenter", handleEnter);
        nearestParent.addEventListener("mouseleave", handleLeave);

        return () => {
          nearestParent.removeEventListener("mouseenter", handleEnter);
          nearestParent.removeEventListener("mouseleave", handleLeave);
        };
      }, []);

      const sizeVal = size !== undefined ? (typeof size === "number" ? `${size}px` : size) : undefined;
      const sizeStyle = sizeVal ? { width: sizeVal, height: sizeVal } : undefined;

      return (
        <span
          ref={containerRef}
          className={cn(
            "inline-flex items-center justify-center shrink-0 align-middle leading-none [&>svg]:w-full [&>svg]:h-full [&>span]:w-full [&>span]:h-full [&>span>svg]:w-full [&>span>svg]:h-full [&>span]:inline-flex [&>span]:items-center [&>span]:justify-center [&>div]:w-full [&>div]:h-full [&>div>svg]:w-full [&>div>svg]:h-full [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center",
            isSpinning && "animate-spin",
            className
          )}
          style={{ ...sizeStyle, ...style }}
          onMouseEnter={(e) => {
            innerHandleRef.current?.startAnimation?.();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            if (!hasParentRef.current) {
              innerHandleRef.current?.stopAnimation?.();
            }
            onMouseLeave?.(e);
          }}
          {...rest}
        >
          <IconComponent
            ref={innerHandleRef}
            size={size}
            strokeWidth={strokeWidth}
            color={color}
            className="w-full h-full"
          />
        </span>
      );
    }
  );

  WrappedIcon.displayName = `AnimatedBridge(${iconName})`;
  return WrappedIcon;
}
