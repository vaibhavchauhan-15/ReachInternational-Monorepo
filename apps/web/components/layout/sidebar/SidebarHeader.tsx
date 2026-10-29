"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { ReachLogo } from "@/components/branding/ReachLogo";
import { TooltipWrapper } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SidebarHeader({ collapsed, onToggleCollapse }: SidebarHeaderProps) {
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-between border-b border-[var(--color-hairline)] h-16 px-4 select-none overflow-hidden w-full relative"
      )}
    >
      {/* Expanded Brand Logo Link (Smoothly fades, slides & contracts width on collapse) */}
      <Link
        href="/dashboard"
        className={cn(
          "flex items-center select-none overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all duration-200 group p-1 -ml-1",
          collapsed
            ? "opacity-0 w-0 max-w-0 pointer-events-none -translate-x-3"
            : "opacity-100 flex-1 translate-x-0"
        )}
        aria-label="Reach International Dashboard"
        tabIndex={collapsed ? -1 : 0}
      >
        <ReachLogo
          height={36}
          priority
          className="shrink-0 transition-opacity duration-200 group-hover:opacity-90"
        />
      </Link>

      {/* Sidebar Toggle Action (In expanded: on right edge. In collapsed: centered in 72px sidebar) */}
      <TooltipWrapper
        content={collapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
        side="right"
      >
        <button
          type="button"
          onClick={() => {
            setIsLogoHovered(false);
            onToggleCollapse();
          }}
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
          onBlur={() => setIsLogoHovered(false)}
          aria-label={collapsed ? "Expand Sidebar" : "Collapse sidebar"}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
        >
          <AnimatePresence mode="wait" initial={false}>
            {collapsed ? (
              isLogoHovered ? (
                <motion.div
                  key="expand-icon"
                  initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 20 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none flex items-center justify-center"
                >
                  <PanelLeftOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed-logo"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none flex items-center justify-center"
                >
                  <ReachLogo height={18} priority className="shrink-0" />
                </motion.div>
              )
            ) : (
              <motion.div
                key="collapse-icon"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none flex items-center justify-center"
              >
                <PanelLeftClose className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </TooltipWrapper>
    </div>
  );
}
