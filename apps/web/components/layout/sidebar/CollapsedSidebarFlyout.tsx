"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { NavItem } from "./types";
import { SIDEBAR_WIDTH_COLLAPSED } from "@/components/ui/sidebar";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface CollapsedSidebarFlyoutProps {
  item: NavItem;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  isActiveParent: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface Position {
  left: number;
  top: number;
  caretTop: number;
}

function getEstimatedFlyoutHeight(subItemCount: number): number {
  // Header: ~45px, Container padding: 16px, Each subItem: ~36px + 4px gap = ~40px
  const count = Math.max(1, subItemCount);
  return 45 + 16 + (count * 40 - 4) + 2;
}

function calculateFlyoutPosition(
  flyoutEl: HTMLElement | null,
  anchorEl: HTMLElement | null,
  subItemCount: number
): Position | null {
  if (!anchorEl || !anchorEl.isConnected) return null;

  const rect = anchorEl.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
    return null;
  }

  const buttonCenterY = rect.top + rect.height / 2;

  // Accurately measure DOM height if mounted, otherwise use item-count derived estimate
  const measuredHeight = flyoutEl ? (flyoutEl.getBoundingClientRect().height || flyoutEl.offsetHeight) : 0;
  const flyoutHeight = measuredHeight > 30 ? measuredHeight : getEstimatedFlyoutHeight(subItemCount);
  const padding = 12;

  // Center flyout vertically with the icon button center
  const idealTop = buttonCenterY - flyoutHeight / 2;

  // Clamp top position so it doesn't overflow viewport top or bottom
  const minTop = padding;
  const maxTop = Math.max(minTop, window.innerHeight - flyoutHeight - padding);
  const constrainedTop = Math.max(minTop, Math.min(idealTop, maxTop));

  // Calculate caret vertical position relative to top of flyout card
  const caretSize = 12; // 12px diamond pointer
  let caretTop = buttonCenterY - constrainedTop - caretSize / 2;

  // Clamp caret position within card border radius bounds (keep at least 16px from rounded corners)
  const minCaretTop = 16;
  const maxCaretTop = Math.max(minCaretTop, flyoutHeight - 16 - caretSize);
  caretTop = Math.max(minCaretTop, Math.min(caretTop, maxCaretTop));

  // Position flyout immediately to the right of collapsed sidebar
  const left = Math.max(rect.right + 4, SIDEBAR_WIDTH_COLLAPSED + 4);

  return { left, top: constrainedTop, caretTop };
}

export function CollapsedSidebarFlyout({
  item,
  anchorEl,
  isOpen,
  onClose,
  currentTab,
  isActiveParent,
  onMouseEnter,
  onMouseLeave,
}: CollapsedSidebarFlyoutProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const subItemCount = item.subItems?.length || 1;

  // Callback to measure and update position
  const syncPosition = useCallback(() => {
    if (!anchorEl) return;
    const pos = calculateFlyoutPosition(flyoutRef.current, anchorEl, subItemCount);
    if (pos) {
      setPosition((prev) => {
        if (
          prev &&
          Math.abs(prev.top - pos.top) < 0.5 &&
          Math.abs(prev.left - pos.left) < 0.5 &&
          Math.abs(prev.caretTop - pos.caretTop) < 0.5
        ) {
          return prev;
        }
        return pos;
      });
    }
  }, [anchorEl, subItemCount]);

  // Ref callback to capture the DOM node as soon as it mounts and measure immediately
  const setFlyoutRef = useCallback(
    (node: HTMLDivElement | null) => {
      flyoutRef.current = node;
      if (node && anchorEl) {
        const pos = calculateFlyoutPosition(node, anchorEl, subItemCount);
        if (pos) {
          setPosition(pos);
        }
      }
    },
    [anchorEl, subItemCount]
  );

  // Sync position synchronously on open or anchor change
  useIsomorphicLayoutEffect(() => {
    if (!isOpen || !anchorEl) return;
    syncPosition();
  }, [isOpen, anchorEl, syncPosition]);

  // Window scroll & resize listeners + ResizeObserver for dynamic content
  useEffect(() => {
    if (!isOpen || !anchorEl) return;

    syncPosition();

    let ro: ResizeObserver | null = null;
    if (flyoutRef.current) {
      ro = new ResizeObserver(() => syncPosition());
      ro.observe(flyoutRef.current);
    }

    const handleScroll = () => syncPosition();
    const handleResize = () => syncPosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, anchorEl, syncPosition]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, anchorEl, onClose]);

  if (!mounted) return null;

  // Active position computation: use stored state, or fallback to immediate calculation from anchorEl
  const activePosition = position || (anchorEl ? calculateFlyoutPosition(null, anchorEl, subItemCount) : null);

  const ParentIcon = item.icon;
  const badgeLabel = item.badge ? String(item.badge) : "OVERVIEW";

  return createPortal(
    <AnimatePresence>
      {isOpen && activePosition && (
        <motion.div
          ref={setFlyoutRef}
          role="dialog"
          aria-label={`${item.label} submenu`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            left: `${activePosition.left}px`,
            top: `${activePosition.top}px`,
            zIndex: 60,
          }}
          className="w-68 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 select-none overflow-visible"
        >
          {/* Visual Connection Caret Beak */}
          <div
            className="absolute -left-1.5 w-3 h-3 rotate-45 bg-[var(--color-canvas-elevated)] border-l border-b border-[var(--color-hairline)] z-10"
            style={{ top: `${activePosition.caretTop}px` }}
          />

          {/* Header */}
          <div className="relative z-20 flex items-center justify-between px-4 py-3 bg-[var(--color-hairline-soft-surface)]/50 border-b border-[var(--color-hairline)] rounded-t-2xl">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <ParentIcon className={`h-4 w-4 shrink-0 ${isActiveParent ? "text-sky-600 dark:text-sky-400 font-bold" : "text-[var(--color-body)]"}`} />
              <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                {item.label}
              </span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
              {badgeLabel}
            </span>
          </div>

          {/* Submenu Links */}
          <div className="relative z-20 p-2 space-y-1">
            {item.subItems?.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = isActiveParent && currentTab === sub.tab;
              return (
                <Link
                  key={sub.tab}
                  href={`${item.href}?tab=${sub.tab}`}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs transition-colors duration-150 cursor-pointer ${
                    isSubActive
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-2xs"
                      : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] font-medium"
                  }`}
                >
                  <SubIcon className={`h-4 w-4 shrink-0 ${isSubActive ? "text-sky-600 dark:text-sky-400 font-bold" : ""}`} />
                  <span className="truncate">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
