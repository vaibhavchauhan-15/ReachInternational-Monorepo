"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedX } from "./animated-icons";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  position?: "right" | "bottom";
  className?: string;
}

const sizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  position = "right",
  className = "",
}: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Drawer Container */}
          <motion.div
            initial={
              position === "right"
                ? { x: "100%" }
                : { y: "100%" }
            }
            animate={{ x: 0, y: 0 }}
            exit={
              position === "right"
                ? { x: "100%" }
                : { y: "100%" }
            }
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`relative z-10 w-full ml-auto bg-[var(--color-canvas-elevated)] shadow-2xl border-l border-[var(--color-hairline)] flex flex-col h-full max-h-screen overflow-hidden ${
              sizeClasses[size]
            } ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shrink-0">
              <div className="flex flex-col space-y-1 min-w-0 flex-1 pr-4">
                {title && (
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] truncate">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-[var(--color-mute)]">{description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer shrink-0"
                aria-label="Close drawer"
              >
                <AnimatedX size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 shrink-0 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
