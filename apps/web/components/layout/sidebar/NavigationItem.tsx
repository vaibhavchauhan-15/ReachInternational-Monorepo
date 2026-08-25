"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AnimatedChevronDown } from "@/components/ui/animated-icons";
import { SidebarTooltip } from "@/components/ui";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/sidebar";
import { CollapsedSidebarFlyout } from "./CollapsedSidebarFlyout";
import type { NavItem } from "./types";

interface NavigationItemProps {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  currentTab: string;
  isMenuOpen: boolean;
  onToggleMenu: (open: boolean) => void;
  flyoutHref: string | null;
  setFlyoutHref: (href: string | null) => void;
}

export function NavigationItem({
  item,
  collapsed,
  pathname,
  currentTab,
  isMenuOpen,
  onToggleMenu,
  flyoutHref,
  setFlyoutHref,
}: NavigationItemProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const Icon = item.icon;

  let isActive = false;
  if (item.href.includes("?")) {
    const [itemPath, itemQuery] = item.href.split("?");
    const itemParams = new URLSearchParams(itemQuery);
    const itemTab = itemParams.get("tab");
    isActive = pathname === itemPath && currentTab === itemTab;
  } else if (item.href === "/dashboard") {
    isActive = pathname === "/dashboard" && (!currentTab || currentTab !== "history");
  } else {
    isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  }

  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
  const isFlyoutOpen = flyoutHref === item.href;

  // Collapsed Mode Renderer
  if (collapsed) {
    return (
      <SidebarMenuItem key={item.href}>
        <div className="w-full flex justify-center relative">
          <SidebarTooltip content={item.label} enabled={!isFlyoutOpen}>
            {hasSubItems ? (
              <SidebarMenuButton
                ref={setAnchorEl}
                active={isActive || isFlyoutOpen}
                aria-expanded={isFlyoutOpen}
                aria-label={item.label}
                onClick={() => {
                  setFlyoutHref(isFlyoutOpen ? null : item.href);
                }}
                className="focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
              >
                <Icon className={`h-4 w-4 shrink-0 ${(isActive || isFlyoutOpen) ? "text-sky-600 dark:text-sky-400 font-bold" : ""}`} />
              </SidebarMenuButton>
            ) : (
              <Link href={item.href} className="w-full flex justify-center focus:outline-none">
                <SidebarMenuButton
                  ref={setAnchorEl}
                  active={isActive}
                  aria-label={item.label}
                  className="focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-600 dark:text-sky-400 font-bold" : ""}`} />
                </SidebarMenuButton>
              </Link>
            )}
          </SidebarTooltip>

          {/* Floating Flyout Submenu */}
          {hasSubItems && (
            <CollapsedSidebarFlyout
              item={item}
              anchorEl={anchorEl}
              isOpen={isFlyoutOpen}
              onClose={() => setFlyoutHref(null)}
              currentTab={currentTab}
              isActiveParent={isActive}
            />
          )}
        </div>
      </SidebarMenuItem>
    );
  }

  // Expanded Mode Renderer
  return (
    <SidebarMenuItem key={item.href}>
      {hasSubItems ? (
        <Collapsible
          open={isMenuOpen}
          onOpenChange={onToggleMenu}
        >
          <div
            onClick={() => onToggleMenu(!isMenuOpen)}
            className={`relative flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
              isActive
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-2xs"
                : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 select-none">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-600 dark:text-sky-400" : ""}`} />
              <span className="truncate">{item.label}</span>
            </div>

            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label={`Toggle ${item.label} sub-menu`}
                className="p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              >
                <AnimatedChevronDown
                  size={16}
                  className="transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180"
                />
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems?.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = isActive && currentTab === sub.tab;
                return (
                  <SidebarMenuSubItem key={sub.tab}>
                    <Link href={`${item.href}?tab=${sub.tab}`} className="focus:outline-none">
                      <SidebarMenuSubButton active={isSubActive}>
                        <SubIcon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? "text-sky-600 dark:text-sky-400 font-bold" : ""}`} />
                        <span className="truncate">{sub.label}</span>
                      </SidebarMenuSubButton>
                    </Link>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Link href={item.href} className="focus:outline-none">
          <SidebarMenuButton active={isActive}>
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-600 dark:text-sky-400 font-bold" : ""}`} />
            <span className="truncate">{item.label}</span>
          </SidebarMenuButton>
        </Link>
      )}
    </SidebarMenuItem>
  );
}
