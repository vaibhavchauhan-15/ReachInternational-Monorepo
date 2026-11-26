"use client";

import { useSyncExternalStore } from "react";
import { AnimatedSearch } from "@/components/ui/animated-icons";
import { SidebarTooltip } from "@/components/ui";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

interface QuickAccessTriggerProps {
  collapsed: boolean;
  onOpenCommandPalette: () => void;
}

export function QuickAccessTrigger({ collapsed, onOpenCommandPalette }: QuickAccessTriggerProps) {
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent),
    () => false
  );

  return (
    <div className="p-3 border-b border-[var(--color-hairline)] shrink-0 overflow-hidden">
      <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
        <SidebarTooltip content={`Quick Access (${isMac ? "⌘" : "Ctrl"}K)`} enabled={collapsed}>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Quick Access Search"
            className={cn(
              "flex items-center rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-all duration-200 cursor-pointer overflow-hidden shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-500/30",
              collapsed
                ? "justify-center h-10 w-10 mx-auto p-0"
                : "flex-1 h-10 px-3 gap-2"
            )}
          >
            <AnimatedSearch size={15} className="text-[var(--color-mute)] shrink-0" />
            <span
              className={cn(
                "font-semibold truncate text-[var(--color-ink)] transition-all duration-200 whitespace-nowrap overflow-hidden text-left",
                collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 flex-1"
              )}
            >
              Quick Access
            </span>
            <kbd
              className={cn(
                "ml-auto flex items-center gap-0.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-mute)] shrink-0 transition-opacity duration-200",
                collapsed ? "opacity-0 hidden pointer-events-none" : "opacity-100"
              )}
            >
              {isMac ? "⌘" : "Ctrl"}K
            </kbd>
          </button>
        </SidebarTooltip>

        <SidebarTooltip content="Notifications" enabled={collapsed}>
          <div className="shrink-0">
            <NotificationBell
              placement="sidebar"
              className={cn(
                "h-10 w-10 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] hover:border-[var(--color-ink)] text-[var(--color-mute)] hover:text-[var(--color-ink)] shadow-2xs shrink-0",
                collapsed && "mx-auto"
              )}
            />
          </div>
        </SidebarTooltip>
      </div>
    </div>
  );
}
