"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedX } from "@/components/ui/animated-icons";
import { ReachInternationalLogo } from "@/components/ui";
import type { User } from "@/lib/types/database";
import type { NavItem } from "./types";
import { UserProfileDropdown } from "./UserProfileDropdown";

interface MobileSidebarDrawerProps {
  user: User;
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebarDrawer({ user, items, isOpen, onClose }: MobileSidebarDrawerProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Drawer Sidebar Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="relative z-50 w-72 h-full bg-[var(--color-canvas-elevated)] border-r border-[var(--color-hairline)] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-hairline)] h-16">
              <Link href="/dashboard" onClick={onClose} className="flex items-center">
                <ReachInternationalLogo variant="full" size={24} />
              </Link>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar menu"
                className="p-2 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
              >
                <AnimatedX size={20} />
              </button>
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-mute)] mb-2 px-2">
                Core Operations
              </p>

              {items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                const firstHref = item.subItems?.[0]
                  ? `${item.href}?tab=${item.subItems[0].tab}`
                  : item.href;

                return (
                  <div key={item.href} className="space-y-1">
                    <Link
                      href={firstHref}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20"
                          : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-600 dark:text-sky-400" : ""}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>

                    {/* Sub-items if any */}
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="pl-6 space-y-0.5 border-l-2 border-[var(--color-hairline)] ml-4">
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.tab}
                              href={`${item.href}?tab=${sub.tab}`}
                              onClick={onClose}
                              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                            >
                              <SubIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Profile */}
            <div className="p-3 border-t border-[var(--color-hairline)]">
              <UserProfileDropdown user={user} collapsed={false} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
