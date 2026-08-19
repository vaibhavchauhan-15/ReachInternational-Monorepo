"use client";

import { useEffect, useState } from "react";
import { AnimatedSearch } from "@/components/ui/animated-icons";
import { SidebarTooltip } from "@/components/ui";

interface QuickAccessTriggerProps {
  collapsed: boolean;
  onOpenCommandPalette: () => void;
}

export function QuickAccessTrigger({ collapsed, onOpenCommandPalette }: QuickAccessTriggerProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <div className="p-3 border-b border-[var(--color-hairline)] shrink-0">
      {!collapsed ? (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all cursor-pointer overflow-hidden shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <AnimatedSearch size={14} className="text-[var(--color-mute)] shrink-0" />
          <span className="font-semibold truncate text-[var(--color-ink)]">Quick Access</span>
          <kbd className="ml-auto flex items-center gap-0.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-mute)] shrink-0">
            {isMac ? "⌘" : "Ctrl"}K
          </kbd>
        </button>
      ) : (
        <SidebarTooltip content={`Quick Access (${isMac ? "⌘" : "Ctrl"}K)`}>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Quick Access Search"
            className="flex items-center justify-center h-10 w-10 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors mx-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <AnimatedSearch size={16} />
          </button>
        </SidebarTooltip>
      )}
    </div>
  );
}
