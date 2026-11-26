"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ScrollArea — thin, native-scrolling wrapper for independent scroll regions.
 *
 * There is no custom scrollbar engine and no custom-rendered thumb: the
 * surface uses native scrolling and picks up the unified scrollbar system
 * (idle-hidden, scroll-reveal thumbs) from `app/globals.css` automatically.
 * Radix `ScrollArea` is deliberately not used — it renders its own thumb and
 * conflicts with the unified spec.
 *
 * Accessibility:
 * - Renders `role="region"` with a REQUIRED accessible name (`aria-label` or
 *   `aria-labelledby`); warns at dev time when missing.
 * - Becomes keyboard-scrollable (`tabIndex={0}`) when it contains no focusable
 *   children (measured at mount), so keyboard users can always scroll it.
 *   Focus alone never reveals the scrollbar — scrolling does.
 * - Shows a visible `:focus-visible` ring.
 *
 * Layout note: inside a flex/grid parent the ScrollArea (or the parent chain)
 * needs `min-h-0` / `min-w-0` to actually shrink and scroll instead of
 * growing with its content. This component does not change child dimensions.
 *
 * Use only for independent scroll regions (panels, lists, side viewports) —
 * never wrap whole pages; the document is its own scroll region.
 */
export interface ScrollAreaProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * Which axes may scroll. `vertical` clips X overflow, `horizontal` clips
   * Y overflow, `both` allows either. Non-overflowing content never shows a
   * scrollbar (`overflow: auto`).
   * @default "vertical"
   */
  orientation?: "vertical" | "horizontal" | "both";
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const orientationClass: Record<NonNullable<ScrollAreaProps["orientation"]>, string> = {
  vertical: "overflow-y-auto overflow-x-hidden",
  horizontal: "overflow-x-auto overflow-y-hidden",
  both: "overflow-auto",
};

export function ScrollArea({
  orientation = "vertical",
  className,
  children,
  tabIndex,
  ...rest
}: ScrollAreaProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const warnedRef = React.useRef(false);
  const [autoFocusable, setAutoFocusable] = React.useState(false);

  const ariaName = rest["aria-label"] ?? rest["aria-labelledby"];

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !ariaName && !warnedRef.current) {
      warnedRef.current = true;
      console.warn(
        "ScrollArea: `aria-label` or `aria-labelledby` is required so the `region` role has an accessible name."
      );
    }
  }, [ariaName]);

  React.useEffect(() => {
    // Keyboard access: focus the region only when its content has no focusable
    // children of its own (checked once at mount; children rarely change shape).
    if (tabIndex === undefined && ref.current && !ref.current.querySelector(FOCUSABLE_SELECTOR)) {
      setAutoFocusable(true);
    }
  }, [tabIndex]);

  return (
    <div
      ref={ref}
      role="region"
      tabIndex={tabIndex ?? (autoFocusable ? 0 : undefined)}
      className={cn(
        orientationClass[orientation],
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-link)] focus-visible:ring-offset-1",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
