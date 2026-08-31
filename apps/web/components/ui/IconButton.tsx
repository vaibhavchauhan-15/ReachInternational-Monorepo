"use client";

import React, { forwardRef } from "react";
import { Button, ButtonProps, ButtonVariant } from "./Button";
import { TooltipWrapper } from "./tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  /** The icon to render inside the button */
  icon: React.ReactNode;
  /** Accessible label / tooltip text for screen-readers and hover tooltip */
  label: string;
  /** Custom size: sm (32px), md (36px), lg (44px) */
  size?: "sm" | "md" | "lg";
  /** Tooltip position */
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /** If true, skips wrapping with tooltip */
  disableTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      size = "md",
      variant = "secondary",
      tooltipSide = "top",
      disableTooltip = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const sizeMap: Record<"sm" | "md" | "lg", string> = {
      sm: "h-8 w-8 min-h-[32px] min-w-[32px] p-0 rounded-lg justify-center",
      md: "h-9 w-9 min-h-[36px] min-w-[36px] p-0 rounded-lg justify-center",
      lg: "h-11 w-11 min-h-[44px] min-w-[44px] p-0 rounded-xl justify-center",
    };

    const button = (
      <Button
        ref={ref as any}
        size="icon"
        variant={variant as ButtonVariant}
        aria-label={label}
        className={`${sizeMap[size]} ${className}`}
        {...props}
      >
        {icon}
      </Button>
    );

    if (disableTooltip) {
      return button;
    }

    return (
      <TooltipWrapper content={label} side={tooltipSide}>
        {button}
      </TooltipWrapper>
    );
  }
);

IconButton.displayName = "IconButton";
