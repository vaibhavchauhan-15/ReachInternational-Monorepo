"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar";
import { NavigationItem } from "./NavigationItem";
import type { NavItem } from "./types";

interface SidebarNavigationProps {
  items: NavItem[];
  collapsed: boolean;
}

export function SidebarNavigation({ items, collapsed }: SidebarNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [flyoutHref, setFlyoutHref] = useState<string | null>(null);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // Close flyout when collapsed state changes or route changes
  useEffect(() => {
    setFlyoutHref(null);
  }, [collapsed, pathname]);

  // Handle Escape key to close flyout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFlyoutHref(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Core Operations</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => {
            const defaultTab = item.subItems ? item.subItems[0].tab : "";
            const currentTab = searchParams.get("tab") || defaultTab;
            const isTabMatch = item.href.includes("?")
              ? searchParams.get("tab") === new URLSearchParams(item.href.split("?")[1]).get("tab")
              : (!searchParams.get("tab") || searchParams.get("tab") !== "history");
            const isActive =
              pathname === item.href.split("?")[0] && isTabMatch;

            const isMenuOpen =
              openMenus[item.href] !== undefined ? openMenus[item.href] : isActive;

            return (
              <NavigationItem
                key={item.href}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                currentTab={currentTab}
                isMenuOpen={isMenuOpen}
                onToggleMenu={(open) =>
                  setOpenMenus((prev) => ({ ...prev, [item.href]: open }))
                }
                flyoutHref={flyoutHref}
                setFlyoutHref={setFlyoutHref}
              />
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}
