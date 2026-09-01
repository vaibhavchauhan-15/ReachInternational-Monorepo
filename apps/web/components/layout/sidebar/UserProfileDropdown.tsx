"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedChevronDown,
  AnimatedUsers,
  AnimatedFileText,
  AnimatedSettings,
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import { LogOut } from "lucide-react";
import type { User } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SidebarTooltip, Button } from "@/components/ui";

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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to trigger element
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 320;
      const viewportHeight = window.innerHeight;

      if (collapsed) {
        let calculatedTop = rect.bottom - popoverHeight;
        if (calculatedTop < 16) calculatedTop = 16;
        if (calculatedTop + popoverHeight > viewportHeight - 16) {
          calculatedTop = viewportHeight - popoverHeight - 16;
        }

        setPos({
          top: calculatedTop,
          left: rect.right + 12,
        });
      } else {
        setPos({
          bottom: viewportHeight - rect.top + 8,
          left: rect.left,
        });
      }
    }
  }, [open, collapsed]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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

  return (
    <div className="relative">
      <SidebarTooltip content={`${user.full_name} (${user.role.replace("_", " ")})`} enabled={collapsed}>
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
                {user.role.replace("_", " ")}
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
            <div className="fixed inset-0 z-50 pointer-events-none">
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  position: "fixed",
                  left: `${pos.left}px`,
                  ...(pos.top !== undefined ? { top: `${pos.top}px` } : {}),
                  ...(pos.bottom !== undefined ? { bottom: `${pos.bottom}px` } : {}),
                  width: collapsed ? "260px" : "250px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-2xl text-[var(--color-ink)] backdrop-blur-md select-none"
              >
                {/* Profile Summary Card */}
                <div className="p-3 border border-[var(--color-hairline)] bg-[var(--color-canvas)] rounded-[var(--radius-md)] mb-2 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold text-xs shadow-md">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                        {user.full_name}
                      </p>
                      <p className="text-[11px] text-[var(--color-mute)] truncate font-medium">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-hairline)]">
                    {user.role === "super_admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300/80">
                        <AnimatedShieldAlert size={12} className="text-red-600 dark:text-red-400" />
                        Super Admin
                      </span>
                    )}
                    {user.role === "admin" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80">
                        <AnimatedShieldCheck size={12} className="text-amber-600 dark:text-amber-400" />
                        Admin
                      </span>
                    )}
                    {(user.role === "engineer" || user.role === "service_engineer") && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300/80">
                        <AnimatedShield size={12} className="text-blue-600 dark:text-blue-400" />
                        Engineer
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>

                {/* Theme Toggle Row */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--color-hairline)] mb-1">
                  <span className="text-xs font-semibold text-[var(--color-ink)]">Theme</span>
                  <ThemeToggle />
                </div>

                {/* Administration & User Management Links */}
                {(user.role === "admin" || user.role === "super_admin") && (
                  <div className="space-y-0.5 py-1">
                    <Link
                      href="/users"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                    >
                      <AnimatedUsers size={14} className="text-amber-500" />
                      User Management
                    </Link>
                    <Link
                      href="/audit-logs"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                    >
                      <AnimatedFileText size={14} className="text-purple-500" />
                      Audit Security Logs
                    </Link>
                    {user.role === "super_admin" && (
                      <Link
                        href="/administration?tab=settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                      >
                        <AnimatedSettings size={14} className="text-sky-500" />
                        Platform Settings
                      </Link>
                    )}
                  </div>
                )}

                <div className="my-1 border-t border-[var(--color-hairline)]" />

                <form action={logout}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    icon={<LogOut className="h-3.5 w-3.5 text-rose-500" />}
                    className="justify-start px-3 py-2 rounded-[var(--radius-sm)] text-xs font-semibold text-[var(--color-ink)] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    Sign Out
                  </Button>
                </form>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});
