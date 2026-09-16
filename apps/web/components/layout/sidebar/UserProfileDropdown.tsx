"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedChevronDown } from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";
import { SidebarTooltip } from "@/components/ui";
import { UserProfileCard, ROLE_CONFIG } from "@/components/profile/UserProfileCard";

interface UserProfileDropdownProps {
  user: User;
  collapsed: boolean;
}

export const UserProfileDropdown = memo(function UserProfileDropdown({
  user,
  collapsed,
}: UserProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Dynamic Viewport Position State
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  }>({ left: 0, maxHeight: 480 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute dynamic position relative to trigger element and viewport bounds
  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(320, window.innerWidth - 24);
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (collapsed) {
        // Collapsed mode: place to the right of the sidebar
        const left = Math.max(12, Math.min(rect.right + 12, viewportWidth - popoverWidth - 12));
        const maxHeight = Math.min(500, Math.max(260, viewportHeight - 32));
        const bottomOffset = viewportHeight - rect.bottom;

        if (bottomOffset + maxHeight > viewportHeight - 12) {
          // Top boundary protection
          setPos({
            top: Math.max(12, viewportHeight - maxHeight - 12),
            left,
            maxHeight,
          });
        } else {
          setPos({
            bottom: Math.max(12, bottomOffset),
            left,
            maxHeight,
          });
        }
      } else {
        // Expanded mode: trigger is at the bottom of the sidebar
        const spaceAbove = rect.top - 8;
        const spaceBelow = viewportHeight - rect.bottom - 8;
        const left = Math.max(12, Math.min(rect.left, viewportWidth - popoverWidth - 12));

        if (spaceAbove >= 260 || spaceAbove >= spaceBelow) {
          // Position ABOVE trigger
          const maxHeight = Math.min(500, Math.max(260, spaceAbove - 16));
          const bottomOffset = viewportHeight - rect.top + 8;
          setPos({
            bottom: Math.max(12, bottomOffset),
            left,
            maxHeight,
          });
        } else {
          // Position BELOW trigger if trigger is positioned high
          const maxHeight = Math.min(500, Math.max(260, spaceBelow - 16));
          setPos({
            top: Math.max(12, rect.bottom + 8),
            left,
            maxHeight,
          });
        }
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, collapsed]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
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
  }, [open]);

  const roleMeta = ROLE_CONFIG[user.role] || {
    label: user.role.replace("_", " "),
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  };

  return (
    <div className="relative">
      <SidebarTooltip content={`${user.full_name} (${roleMeta.label})`} enabled={collapsed}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="User profile menu"
          className={`w-full flex items-center gap-3 rounded-xl hover:bg-[var(--color-hairline-soft-surface)] transition-all duration-150 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
            collapsed ? "justify-center p-2.5 h-11 w-11 mx-auto" : "px-3 py-2.5"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-extrabold shadow-2xs">
            {user.full_name.charAt(0).toUpperCase()}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                {user.full_name}
              </p>
              <p className="text-[11px] text-[var(--color-mute)] truncate font-medium capitalize mt-0.5">
                {roleMeta.label}
              </p>
            </div>
          )}

          {!collapsed && (
            <AnimatedChevronDown
              size={16}
              className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
      </SidebarTooltip>

      {/* Portal Popover */}
      {mounted &&
        open &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-[70] pointer-events-none">
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  left: `${pos.left}px`,
                  ...(pos.top !== undefined ? { top: `${pos.top}px` } : {}),
                  ...(pos.bottom !== undefined ? { bottom: `${pos.bottom}px` } : {}),
                  width: "320px",
                  maxHeight: `${pos.maxHeight}px`,
                }}
                className="pointer-events-auto rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-2xl shadow-black/10 dark:shadow-black/50 text-[var(--color-ink)] backdrop-blur-xl select-none flex flex-col overflow-hidden"
              >
                <UserProfileCard user={user} onClose={() => setOpen(false)} />
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});
