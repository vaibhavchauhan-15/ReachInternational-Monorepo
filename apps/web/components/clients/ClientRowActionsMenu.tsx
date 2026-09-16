"use client";

import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, RotateCcw } from "lucide-react";
import {
  AnimatedEdit,
  AnimatedTrash,
  AnimatedFileText,
} from "@/components/ui/animated-icons";
import { TooltipWrapper } from "@/components/ui";
import type { CRMClient } from "@/lib/types/database";

export interface ClientRowActionsMenuProps {
  client: CRMClient;
  canManageClients: boolean;
  onViewDetails: (c: CRMClient) => void;
  onEdit: (c: CRMClient) => void;
  onDelete: (c: CRMClient) => void;
  onRestore?: (c: CRMClient) => void;
  triggerClassName?: string;
  align?: "left" | "right";
}

/**
 * Lightweight Contextual Action Menu (⋮) for Client Directory
 *
 * Performance Guarantees (C15 & C17):
 * 1. Zero data fetching on menu open (pure UI coordinates calculation & portal mounting, <1ms).
 * 2. Strict Just-In-Time (JIT) execution:
 *    - View: triggers client detail drawer
 *    - Edit: triggers client edit modal
 *    - Delete: loads confirmation dialog (NO cascading deletion data preloaded)
 *    - Restore: triggers restore mutation
 * 3. 100% memoized to prevent redundant renders of non-active rows.
 */
export const ClientRowActionsMenu = memo(function ClientRowActionsMenu({
  client,
  canManageClients,
  onViewDetails,
  onEdit,
  onDelete,
  onRestore,
  triggerClassName,
  align = "right",
}: ClientRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean }>({
    top: 0,
    left: 0,
    openUpwards: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSoftDeleted = Boolean(client.deleted_at || client.status === "inactive");

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 192; // 12rem = 192px
    const menuHeight = (canManageClients ? 130 : 48) + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpwards = spaceBelow < menuHeight + 16;

    let leftPos = align === "left" ? rect.left : rect.right - menuWidth;
    if (leftPos < 12) leftPos = 12;
    if (leftPos + menuWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - menuWidth - 12;
    }

    let topPos = shouldOpenUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;
    if (topPos < 12) topPos = 12;

    setCoords({
      top: topPos,
      left: leftPos,
      openUpwards: shouldOpenUpwards,
    });
  }, [canManageClients, align]);

  const toggleOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!open) {
        updatePosition();
      }
      setOpen((prev) => !prev);
    },
    [open, updatePosition]
  );

  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <TooltipWrapper content="More actions">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className={
            triggerClassName ||
            "p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          }
          aria-label="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </TooltipWrapper>

      {mounted &&
        open &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-50 pointer-events-none">
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: "192px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl text-xs space-y-0.5"
              >
                {/* 1. View: View Details */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onViewDetails(client);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <AnimatedFileText size={14} className="text-sky-500 shrink-0" />
                  <span>View Details</span>
                </button>

                {/* 2. Edit: Edit Client */}
                {canManageClients && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onEdit(client);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <AnimatedEdit size={14} className="text-amber-500 shrink-0" />
                    <span>Edit Client</span>
                  </button>
                )}

                {/* 3. Restore (if soft-deleted/inactive) */}
                {canManageClients && isSoftDeleted && onRestore && (
                  <>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onRestore(client);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={14} className="text-emerald-500 shrink-0" />
                      <span>Restore Client</span>
                    </button>
                  </>
                )}

                {/* 4. Soft Delete / Deactivate (if active) */}
                {canManageClients && !isSoftDeleted && (
                  <>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onDelete(client);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <AnimatedTrash size={14} className="text-rose-500 shrink-0" />
                      <span>Deactivate</span>
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});
