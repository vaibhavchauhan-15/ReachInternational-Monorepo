"use client";

import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreVertical,
  Users,
  History,
  Shield,
  Building2,
  Wrench,
  FileText,
} from "lucide-react";
import {
  AnimatedEdit,
  AnimatedTrash,
} from "@/components/ui/animated-icons";
import { TooltipWrapper } from "@/components/ui";
import type { Machine } from "@/lib/types/database";

export interface MachineRowActionsMenuProps {
  machine: Machine;
  canEdit: boolean;
  isSupervisor: boolean;
  isAdmin: boolean;
  onEditMachine?: (m: Machine) => void;
  onEditPersonnel?: (m: Machine) => void;
  onEditClient?: (m: Machine) => void;
  onViewAudit?: (m: Machine) => void;
  onViewLogs?: (m: Machine) => void;
  onDelete: (m: Machine) => void;
  // Backward compatibility fallbacks
  onEdit?: (m: Machine) => void;
  onViewAssignments?: (m: Machine) => void;
  onViewHistory?: (m: Machine) => void;
  onViewDetails?: (m: Machine) => void;
  triggerClassName?: string;
  align?: "left" | "right";
}

/**
 * Lightweight Contextual Action Menu (⋮)
 * 
 * Features:
 * 1. Dedicated, separate Edit actions:
 *    - Edit Machine (Specs, HMR, Health)
 *    - Edit Supervisor & Operator (Personnel)
 *    - Edit Client (Client Assignment & Rental)
 * 2. Dedicated Audit option (redirects to machine audit tab)
 * 3. Dedicated Running Logs option (redirects to machine running logs tab)
 * 4. Dedicated Delete action (for Admins)
 * 5. Optimized for mobile viewports (360×800) with safe boundary clamping & min 44px touch targets.
 */
export const MachineRowActionsMenu = memo(function MachineRowActionsMenu({
  machine,
  canEdit,
  isSupervisor,
  isAdmin,
  onEditMachine,
  onEditPersonnel,
  onEditClient,
  onViewAudit,
  onViewLogs,
  onDelete,
  onEdit,
  onViewAssignments,
  onViewHistory,
  triggerClassName,
  align = "right",
}: MachineRowActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean; width: number }>({
    top: 0,
    left: 0,
    openUpwards: false,
    width: 224,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;
    const menuWidth = isMobile ? Math.min(240, window.innerWidth - 24) : 224;
    const menuHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpwards = spaceBelow < menuHeight + 16 && spaceAbove > spaceBelow;

    let leftPos = align === "left" ? rect.left : rect.right - menuWidth;
    if (leftPos < 12) leftPos = 12;
    if (leftPos + menuWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - menuWidth - 12;
    }

    let topPos = shouldOpenUpwards ? Math.max(12, rect.top - menuHeight - 4) : rect.bottom + 4;
    if (!shouldOpenUpwards && topPos + menuHeight > window.innerHeight - 12) {
      topPos = Math.max(12, window.innerHeight - menuHeight - 12);
    }

    setCoords({
      top: topPos,
      left: leftPos,
      openUpwards: shouldOpenUpwards,
      width: menuWidth,
    });
  }, [align]);

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

  const handleEditMachineAction = () => {
    setOpen(false);
    if (onEditMachine) {
      onEditMachine(machine);
    } else if (onEdit) {
      onEdit(machine);
    }
  };

  const handleEditPersonnelAction = () => {
    setOpen(false);
    if (onEditPersonnel) {
      onEditPersonnel(machine);
    } else if (onViewAssignments) {
      onViewAssignments(machine);
    } else if (onEdit) {
      onEdit(machine);
    }
  };

  const handleEditClientAction = () => {
    setOpen(false);
    if (onEditClient) {
      onEditClient(machine);
    } else if (onEdit) {
      onEdit(machine);
    }
  };

  const handleViewAuditAction = () => {
    setOpen(false);
    if (onViewAudit) {
      onViewAudit(machine);
    } else {
      router.push(`/machines/${machine.id}?tab=audit_trail`);
    }
  };

  const handleViewLogsAction = () => {
    setOpen(false);
    if (onViewLogs) {
      onViewLogs(machine);
    } else if (onViewHistory) {
      onViewHistory(machine);
    } else {
      router.push(`/machines/${machine.id}?tab=running_hours`);
    }
  };

  const allowPersonnelEdit = canEdit || isSupervisor;
  const allowClientEdit = canEdit;

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
            "p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
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
                  width: `${coords.width}px`,
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-xl text-xs space-y-0.5"
              >
                {/* 1. Edit Machine (Specs, HMR, Health) */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleEditMachineAction}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                  >
                    <AnimatedEdit size={14} className="text-amber-500 shrink-0" />
                    <span>Edit Machine</span>
                  </button>
                )}

                {/* 2. Edit Supervisor + Operator */}
                {allowPersonnelEdit && (
                  <button
                    type="button"
                    onClick={handleEditPersonnelAction}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                  >
                    <Users size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>Edit Supervisor & Operator</span>
                  </button>
                )}

                {/* 3. Edit Client */}
                {allowClientEdit && (
                  <button
                    type="button"
                    onClick={handleEditClientAction}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                  >
                    <Building2 size={14} className="text-sky-500 shrink-0" />
                    <span>Edit Client</span>
                  </button>
                )}

                <div className="my-1 border-t border-[var(--color-hairline)]" />

                {/* 4. Audit Option */}
                <button
                  type="button"
                  onClick={handleViewAuditAction}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                >
                  <Shield size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Audit</span>
                </button>

                {/* 5. Running Logs Option */}
                <button
                  type="button"
                  onClick={handleViewLogsAction}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                >
                  <History size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Running Logs</span>
                </button>

                {/* 6. Delete Machine: Admin Only */}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--color-hairline)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onDelete(machine);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
                    >
                      <AnimatedTrash size={14} className="text-rose-500 shrink-0" />
                      <span>Delete Machine</span>
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
