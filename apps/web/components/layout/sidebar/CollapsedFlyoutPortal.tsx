"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { NavItem } from "./types";

interface CollapsedFlyoutPortalProps {
  item: NavItem;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  onMouseEnterPortal?: () => void;
  onMouseLeavePortal?: () => void;
  currentTab: string;
  isActiveParent: boolean;
}

export function CollapsedFlyoutPortal({
  item,
  anchorEl,
  isOpen,
  onClose,
  onMouseEnterPortal,
  onMouseLeavePortal,
  currentTab,
  isActiveParent,
}: CollapsedFlyoutPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to anchor element and clamp within viewport
  useEffect(() => {
    if (isOpen && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const flyoutHeight = (item.subItems?.length || 0) * 40 + 50; // estimated height
      const viewportHeight = window.innerHeight;

      let calculatedTop = rect.top;
      if (calculatedTop + flyoutHeight > viewportHeight - 16) {
        calculatedTop = Math.max(16, viewportHeight - flyoutHeight - 16);
      }

      setPos({
        top: calculatedTop,
        left: rect.right + 8,
      });
    }
  }, [isOpen, anchorEl, item.subItems]);

  // Escape key & Outside pointer-down handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        portalRef.current &&
        !portalRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, anchorEl, onClose]);

  if (!mounted || !isOpen || !item.subItems) return null;

  const Icon = item.icon;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-none">
        <motion.div
          ref={portalRef}
          onMouseEnter={onMouseEnterPortal}
          onMouseLeave={onMouseLeavePortal}
          initial={{ opacity: 0, x: -8, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            position: "fixed",
            top: `${pos.top}px`,
            left: `${pos.left}px`,
          }}
          className="pointer-events-auto w-60 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-2.5 shadow-2xl text-[var(--color-ink)] backdrop-blur-md z-50 select-none"
        >
          {/* Header section with parent title */}
          <div className="px-3 py-2 border-b border-[var(--color-hairline)] mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className={`h-4 w-4 shrink-0 ${isActiveParent ? "text-sky-600 dark:text-sky-400" : "text-[var(--color-mute)]"}`} />
              <span className="text-xs font-bold text-[var(--color-ink)] truncate">{item.label}</span>
            </div>
            <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-extrabold uppercase px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
              Sub-Menu
            </span>
          </div>

          {/* Sub Items List */}
          <div className="space-y-0.5" role="menu" aria-orientation="vertical">
            {item.subItems.map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = isActiveParent && currentTab === sub.tab;

              return (
                <Link
                  key={sub.tab}
                  href={`${item.href}?tab=${sub.tab}`}
                  onClick={onClose}
                  role="menuitem"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isSubActive
                      ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 border border-sky-500/20 shadow-2xs"
                      : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <SubIcon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? "text-sky-600 dark:text-sky-400" : "text-[var(--color-mute)]"}`} />
                  <span className="truncate">{sub.label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
