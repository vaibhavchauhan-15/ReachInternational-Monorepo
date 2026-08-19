"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { ReachInternationalLogo, SidebarTooltip, TooltipWrapper } from "@/components/ui";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SidebarHeader({ collapsed, onToggleCollapse }: SidebarHeaderProps) {
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  return (
    <div
      className={`shrink-0 flex items-center border-b border-[var(--color-hairline)] h-16 transition-colors duration-200 ${
        collapsed ? "justify-center px-2" : "justify-between px-4"
      }`}
    >
      {collapsed ? (
        /* Collapsed Header: Brand logo with hover morph to expand button */
        <SidebarTooltip content="Expand Sidebar (Ctrl+B)" enabled={collapsed}>
          <button
            type="button"
            onClick={() => {
              setIsLogoHovered(false);
              onToggleCollapse();
            }}
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            onBlur={() => setIsLogoHovered(false)}
            aria-label="Expand Sidebar"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer mx-auto focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <AnimatePresence mode="wait">
              {isLogoHovered ? (
                <motion.div
                  key="expand-icon"
                  initial={{ opacity: 0, scale: 0.7, rotate: -30 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 30 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none flex items-center justify-center"
                >
                  <PanelLeftOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="logo-icon"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none flex items-center justify-center"
                >
                  <ReachInternationalLogo variant="compact" size={28} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </SidebarTooltip>
      ) : (
        /* Expanded Header: Full Brand Logo on left, collapse button on right */
        <>
          <Link
            href="/dashboard"
            className="flex items-center group select-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-500/30 rounded-lg p-1"
            aria-label="REACH INTERNATIONAL Dashboard"
          >
            <ReachInternationalLogo variant="full" size={24} />
          </Link>

          <TooltipWrapper content="Collapse sidebar (Ctrl+B)" side="right">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </TooltipWrapper>
        </>
      )}
    </div>
  );
}
