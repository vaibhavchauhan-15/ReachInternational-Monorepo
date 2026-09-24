"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SidebarTooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
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
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const Icon = item.icon;

  const handleIconMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleIconMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

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

  const handleSubItemTriggerClick = (e: React.MouseEvent) => {
    if (collapsed) {
      e.preventDefault();
      setFlyoutHref(isFlyoutOpen ? null : item.href);
    } else {
      onToggleMenu(!isMenuOpen);
    }
  };

  return (
    <SidebarMenuItem key={item.href}>
      <SidebarTooltip content={item.label} enabled={collapsed && !isFlyoutOpen}>
        <div className="relative w-full">
          {hasSubItems ? (
            <Collapsible open={!collapsed && isMenuOpen} onOpenChange={onToggleMenu}>
              <div
                ref={setAnchorEl}
                onClick={handleSubItemTriggerClick}
                onMouseEnter={handleIconMouseEnter}
                onMouseLeave={handleIconMouseLeave}
                aria-expanded={collapsed ? isFlyoutOpen : isMenuOpen}
                className={cn(
                  "group group/nav interactive-parent relative flex items-center w-full h-10 rounded-xl px-3 text-xs font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden",
                  isActive || isFlyoutOpen
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-2xs"
                    : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                )}
              >
                <div className="flex items-center justify-center shrink-0 w-4 h-4">
                  <Icon ref={iconRef} size={16} className={cn("h-4 w-4 shrink-0 transition-colors", (isActive || isFlyoutOpen) && "text-sky-600 dark:text-sky-400")} />
                </div>

                <span
                  className={cn(
                    "truncate transition-all duration-200 whitespace-nowrap overflow-hidden text-left",
                    collapsed ? "opacity-0 w-0 max-w-0 ml-0 pointer-events-none" : "opacity-100 flex-1 ml-3"
                  )}
                >
                  {item.label}
                </span>

                <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label={`Toggle ${item.label} sub-menu`}
                    className={cn(
                      "p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-500/30",
                      collapsed ? "opacity-0 w-0 overflow-hidden pointer-events-none p-0" : "opacity-100"
                    )}
                  >
                    <ChevronDown
                      size={15}
                      className={cn(
                        "transition-transform duration-200",
                        isMenuOpen ? "rotate-180" : ""
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
              </div>

              {!collapsed && (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.subItems?.map((sub) => {
                      const isSubActive = isActive && currentTab === sub.tab;
                      return (
                        <SidebarMenuSubItem key={sub.tab}>
                          <Link href={`${item.href}?tab=${sub.tab}`} className="focus:outline-none">
                            <SidebarMenuSubButton as="div" active={isSubActive}>
                              <span className="truncate">{sub.label}</span>
                            </SidebarMenuSubButton>
                          </Link>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              )}
            </Collapsible>
          ) : (
            <Link href={item.href} className="w-full block focus:outline-none">
              <SidebarMenuButton
                as="div"
                ref={setAnchorEl}
                active={isActive}
                aria-label={item.label}
                onMouseEnter={handleIconMouseEnter}
                onMouseLeave={handleIconMouseLeave}
                className={cn(
                  "w-full h-10 px-3 flex items-center rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden",
                  isActive
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 shadow-2xs"
                    : "text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                )}
              >
                <div className="flex items-center justify-center shrink-0 w-4 h-4">
                  <Icon ref={iconRef} size={16} className={cn("h-4 w-4 shrink-0 transition-colors", isActive && "text-sky-600 dark:text-sky-400 font-bold")} />
                </div>

                <span
                  className={cn(
                    "truncate transition-all duration-200 whitespace-nowrap overflow-hidden text-left",
                    collapsed ? "opacity-0 w-0 max-w-0 ml-0 pointer-events-none" : "opacity-100 flex-1 ml-3"
                  )}
                >
                  {item.label}
                </span>
              </SidebarMenuButton>
            </Link>
          )}

          {/* Floating Flyout Submenu when collapsed */}
          {hasSubItems && collapsed && (
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
      </SidebarTooltip>
    </SidebarMenuItem>
  );
}
