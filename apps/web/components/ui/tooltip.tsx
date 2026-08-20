"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatedInfo } from "./animated-icons";

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;

export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  className?: string;
  sideOffset?: number;
}

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className = "", sideOffset = 6, children, side = "top", ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      sideOffset={sideOffset}
      className={`z-50 overflow-hidden rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-800 dark:border-zinc-200 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 ${className}`}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Convenient wrapper for wrapping any trigger element (e.g. icon button) with a tooltip.
 */
export function TooltipWrapper({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration,
  disabled = false,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  disabled?: boolean;
}) {
  if (!content) return <>{children}</>;

  return (
    <Tooltip delayDuration={delayDuration} open={disabled ? false : undefined}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Legacy & Canonical InfoTooltip for contextual information icons
 */
export function InfoTooltip({
  content,
  children,
  position = "top",
  className = "",
}: {
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <TooltipWrapper content={content} side={position}>
      <span className={`inline-flex items-center ${className}`}>
        {children ? (
          children
        ) : (
          <button
            type="button"
            aria-label="More information"
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <AnimatedInfo size={14} />
          </button>
        )}
      </span>
    </TooltipWrapper>
  );
}

/**
 * MetricTooltip for card header explanations
 */
export function MetricTooltip({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipWrapper
      content={
        <div className="max-w-xs p-1">
          <p className="font-bold text-xs">{title}</p>
          <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{description}</p>
        </div>
      }
      side="top"
      align="start"
    >
      <div className="inline-block w-full">{children}</div>
    </TooltipWrapper>
  );
}

/**
 * SidebarTooltip for collapsed navigation items
 */
export function SidebarTooltip({
  content,
  children,
  enabled = true,
  delayMs = 150,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  enabled?: boolean;
  delayMs?: number;
}) {
  if (!content) return <>{children}</>;

  return (
    <Tooltip delayDuration={delayMs} open={enabled ? undefined : false}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12} className="font-semibold text-xs py-1.5 px-3">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * TruncatedTooltip to wrap potentially long text strings
 */
export function TruncatedTooltip({
  text,
  className = "",
  maxLength = 30,
}: {
  text: string;
  className?: string;
  maxLength?: number;
}) {
  const isTruncated = text.length > maxLength;

  if (!isTruncated) {
    return <span className={className}>{text}</span>;
  }

  return (
    <TooltipWrapper content={text} side="top">
      <span className={`cursor-help truncate inline-block ${className}`}>
        {text}
      </span>
    </TooltipWrapper>
  );
}
