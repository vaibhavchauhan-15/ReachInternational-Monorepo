"use client";

import { useState, useMemo } from "react";
import {
  AnimatedHome,
  AnimatedUsers,
  AnimatedWrench,
  AnimatedGauge,
  AnimatedBuilding2,
  AnimatedScrollText,
  AnimatedSettings,
  AnimatedCreditCard,
  AnimatedCalendarCheck,
} from "@/components/ui/animated-icons";
import dynamic from "next/dynamic";
import {
  Sidebar,
  SidebarFooter,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  useSidebar,
} from "@/components/ui/sidebar";

import type { NavItem, AppSidebarProps } from "./sidebar/types";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { QuickAccessTrigger } from "./sidebar/QuickAccessTrigger";
import { SidebarNavigation } from "./sidebar/SidebarNavigation";
import { UserProfileDropdown } from "./sidebar/UserProfileDropdown";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false }
);

const MobileSidebarDrawer = dynamic(
  () => import("./sidebar/MobileSidebarDrawer").then((mod) => mod.MobileSidebarDrawer),
  { ssr: false }
);

export { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED };
export type { NavItem, AppSidebarProps };

export const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: AnimatedHome,
    roles: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
  },
  {
    href: "/machines",
    label: "Machines",
    icon: AnimatedWrench,
    roles: ["super_admin", "admin", "manager", "supervisor", "operator"],
  },
  {
    href: "/operations",
    label: "Operations",
    icon: AnimatedGauge,
    roles: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: AnimatedBuilding2,
    roles: ["super_admin", "admin", "manager"],
  },
  {
    href: "/users",
    label: "Users",
    icon: AnimatedUsers,
    roles: ["super_admin", "admin", "manager", "hr", "supervisor"],
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: AnimatedCalendarCheck,
    roles: ["super_admin", "admin", "hr"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: AnimatedCreditCard,
    roles: ["super_admin", "admin", "hr"],
  },
  {
    href: "/audit",
    label: "Audit Logs",
    icon: AnimatedScrollText,
    roles: ["super_admin", "admin", "manager"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: AnimatedSettings,
    roles: ["super_admin", "admin", "manager", "supervisor", "hr", "operator"],
  },
];

export function AppSidebar({ user, collapsed, onToggleCollapse }: AppSidebarProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();

  const visibleMainItems = useMemo(() => {
    const filtered = mainNavItems.filter(
      (item) => !item.roles || item.roles.includes(user.role)
    );

    if (user.role === "operator") {
      filtered.sort((a, b) => {
        if (a.href === "/dashboard") return -1;
        if (b.href === "/dashboard") return 1;
        if (a.href === "/operations") return -1;
        if (b.href === "/operations") return 1;
        if (a.href === "/machines") return -1;
        if (b.href === "/machines") return 1;
        if (a.href === "/settings") return 1;
        if (b.href === "/settings") return -1;
        return 0;
      });
    }

    return filtered;
  }, [user.role]);

  return (
    <>
      {/* Desktop Main Sidebar */}
      <Sidebar>
        {/* BRAND ZONE */}
        <SidebarHeader
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />

        {/* QUICK ACCESS ZONE */}
        <QuickAccessTrigger
          collapsed={collapsed}
          onOpenCommandPalette={() => setCmdOpen(true)}
        />

        {/* NAVIGATION ZONE */}
        <SidebarNavigation
          items={visibleMainItems}
          collapsed={collapsed}
        />

        {/* USER PROFILE ZONE */}
        <SidebarFooter>
          <UserProfileDropdown
            user={user}
            collapsed={collapsed}
          />
        </SidebarFooter>
      </Sidebar>

      {/* Mobile Drawer (Lazy loaded strictly when opened on mobile) */}
      {mobileOpen && (
        <MobileSidebarDrawer
          user={user}
          items={visibleMainItems}
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
      )}

      {/* Global Command Palette (Lazy loaded strictly on command trigger) */}
      {cmdOpen && (
        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          userRole={user.role}
        />
      )}
    </>
  );
}
