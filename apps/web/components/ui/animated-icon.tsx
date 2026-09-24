"use client";

import React from "react";

export type IconAnimationPreset = "default" | "none";
export type IconAnimationVariant = IconAnimationPreset;
export type IconInteractionVariant = "none";
export type IconTrigger = "none";

export interface AnimateIconProps {
  icon?: any;
  children?: React.ReactNode;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  animation?: any;
  interaction?: any;
  motion?: any;
  trigger?: any;
  isSpinning?: boolean;
  [key: string]: any;
}

export type AnimatedIconProps = AnimateIconProps;

export interface InteractiveIconProps {
  icon?: any;
  children?: React.ReactNode;
  variant?: any;
  interaction?: any;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  isSpinning?: boolean;
  [key: string]: any;
}

export const AnimateIcon = React.forwardRef<any, AnimateIconProps>(
  ({ icon: Icon, children, className, size, strokeWidth, animation: _a, interaction: _i, motion: _m, trigger: _t, ...props }, ref) => {
    if (Icon) {
      return <Icon ref={ref} className={className} size={size} strokeWidth={strokeWidth} {...props} />;
    }
    return <span ref={ref}>{children}</span>;
  }
);
AnimateIcon.displayName = "AnimateIcon";

export const AnimatedIcon = AnimateIcon;

export const InteractiveIcon = React.forwardRef<any, InteractiveIconProps>(
  ({ icon: Icon, children, className, size, strokeWidth, animation: _a, interaction: _i, motion: _m, trigger: _t, variant: _v, ...props }, ref) => {
    if (Icon) {
      return <Icon ref={ref} className={className} size={size} strokeWidth={strokeWidth} {...props} />;
    }
    return <span ref={ref}>{children}</span>;
  }
);
InteractiveIcon.displayName = "InteractiveIcon";

export function getIconInteractionClass(): string {
  return "";
}

export function createAnimatedIcon(Icon: any, _defaultAnimation?: any) {
  const Component = React.forwardRef<any, any>((props, ref) => {
    return Icon ? <Icon ref={ref} {...props} /> : null;
  });
  Component.displayName = `Animated(${Icon?.displayName || Icon?.name || "Icon"})`;
  return Component;
}
