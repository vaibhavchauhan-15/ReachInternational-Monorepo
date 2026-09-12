"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, RefObject } from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

export interface UseDynamicDropdownPositionOptions {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  minWidth?: number;
  maxHeightCap?: number;
  offset?: number;
  matchTriggerWidth?: boolean;
  align?: "left" | "right";
}

/**
 * Custom hook that calculates dynamic viewport-aware coordinates and dimensions
 * for popover dropdown menus. Automatically flips upward when bottom space is constrained,
 * clamps maxHeight to available viewport height, and prevents horizontal viewport overflows
 * across both mobile and desktop viewports.
 *
 * Guarantees zero (0, 0) layout flickering on first open through synchronous layout
 * pre-measurement and retains valid coordinates during AnimatePresence exit animations.
 */
export function useDynamicDropdownPosition({
  isOpen,
  triggerRef,
  popoverRef,
  onClose,
  minWidth = 200,
  maxHeightCap = 300,
  offset = 6,
  matchTriggerWidth = true,
  align = "left",
}: UseDynamicDropdownPositionOptions) {
  const [mounted, setMounted] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [position, setPosition] = useState<DropdownPosition>({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 280,
    maxHeight: maxHeightCap,
    placement: "bottom",
  });

  // Keep latest onClose callback in a ref so effects never trigger infinite render loops
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Safety: if trigger element is not in DOM or not visible
    if (rect.width === 0 && rect.height === 0) return null;

    // Determine target width
    const targetWidth = matchTriggerWidth
      ? Math.min(Math.max(rect.width, minWidth), viewportWidth - 16)
      : Math.min(Math.max(minWidth, 300), viewportWidth - 16);

    // Determine horizontal position (left)
    let left = rect.left;
    if (align === "right") {
      left = rect.right - targetWidth;
    }
    if (left + targetWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - targetWidth - 8);
    }
    if (left < 8) {
      left = 8;
    }

    // Determine vertical available space
    const spaceBelow = viewportHeight - rect.bottom - offset - 8;
    const spaceAbove = rect.top - offset - 8;

    // Minimum comfortable height required without aggressive scrolling
    const neededComfortHeight = Math.min(maxHeightCap, 340);

    // Prefer flipping up if:
    // 1. Space below is less than needed comfort height and space above has more room than space below
    // 2. OR space below is critically restricted (< 200px) and space above is greater
    const preferUp =
      (spaceBelow < neededComfortHeight && spaceAbove > spaceBelow) ||
      (spaceBelow < 200 && spaceAbove > spaceBelow);

    let newPos: DropdownPosition;
    if (preferUp) {
      const calculatedMaxHeight = Math.min(maxHeightCap, Math.max(180, spaceAbove - 8));
      newPos = {
        top: undefined,
        bottom: viewportHeight - rect.top + offset,
        left,
        width: targetWidth,
        maxHeight: calculatedMaxHeight,
        placement: "top",
      };
    } else {
      const calculatedMaxHeight = Math.min(maxHeightCap, Math.max(180, spaceBelow - 8));
      newPos = {
        top: rect.bottom + offset,
        bottom: undefined,
        left,
        width: targetWidth,
        maxHeight: calculatedMaxHeight,
        placement: "bottom",
      };
    }

    // Bail out if coordinates and dimensions are identical to prevent cascading re-renders
    setPosition((prev) => {
      if (
        prev.top === newPos.top &&
        prev.bottom === newPos.bottom &&
        prev.left === newPos.left &&
        prev.width === newPos.width &&
        prev.maxHeight === newPos.maxHeight &&
        prev.placement === newPos.placement
      ) {
        return prev;
      }
      return newPos;
    });
    setIsPositioned((prev) => (prev ? prev : true));
    return newPos;
  }, [triggerRef, minWidth, maxHeightCap, offset, matchTriggerWidth, align]);

  // Mark mounted on client
  useIsomorphicLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Synchronously compute/verify coordinates before paint whenever isOpen changes to true
  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Dynamic repositioning on scroll, resize, or trigger dimensions changes while open
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      // If trigger has scrolled completely out of viewport bounds, dismiss smoothly
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
        onCloseRef.current?.();
        return;
      }
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    // Watch for size/layout shifts of trigger element (e.g. accordion transitions)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && triggerRef.current) {
      ro = new ResizeObserver(() => {
        updatePosition();
      });
      ro.observe(triggerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      if (ro) {
        ro.disconnect();
      }
    };
  }, [isOpen, updatePosition, triggerRef]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      onCloseRef.current?.();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, triggerRef, popoverRef]);

  return {
    mounted,
    position,
    isPositioned,
    updatePosition,
  };
}
