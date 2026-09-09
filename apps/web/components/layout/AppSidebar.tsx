"use client";

import { useState, useMemo } from "react";
import {
  AnimatedClock,
  AnimatedStar,
  AnimatedUsers,
  AnimatedWrench,
  AnimatedClipboardList,
  AnimatedPackage,
  AnimatedAlertTriangle,
  AnimatedGauge,
  AnimatedBuilding2,
  AnimatedScrollText,
} from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";
import { CommandPalette } from "@/components/ui/CommandPalette";
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
import { MobileSidebarDrawer } from "./sidebar/MobileSidebarDrawer";

export { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED };
export type { NavItem, AppSidebarProps };

export const mainNavItems: NavItem[] = [
  {
    href: "/machines",
    label: "Machines",
    icon: AnimatedWrench,
    roles: [
      "super_admin", "admin", "manager", "service_manager", "service_engineer", "engineer",
      "supervisor", "mechanic", "store_manager"
    ],
    subItems: [
      { label: "Machine Directory", tab: "inventory" },
      // { label: "Service Logs", tab: "services" }, // Soft-removed per user request
      // { label: "Breakdown Complaints", tab: "complaints" }, // Soft-removed per user request
    ],
  },
  {
    href: "/operations",
    label: "Operations",
    icon: AnimatedGauge,
    roles: ["super_admin", "admin", "manager", "service_manager", "supervisor", "operator"],
    subItems: [
      { label: "Running Hours", tab: "logs" },
      { label: "Operator Machine Assignments", tab: "assignments" },
      // { label: "Site Movement / Loading-Unloading", tab: "site-movement" }, // Soft-removed per user request
      // { label: "Operator Roster & Salary", tab: "operators" }, // Soft-removed per user request
    ],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: AnimatedBuilding2,
    roles: ["super_admin", "admin", "manager", "service_manager"],
    subItems: [
      { label: "Client Directory", tab: "all" },
    ],
  },
  {
    href: "/users",
    label: "Employees & Users",
    icon: AnimatedUsers,
    roles: ["super_admin", "admin", "manager", "service_manager", "hr_manager"],
    subItems: [
      { label: "All Employee Accounts", tab: "all" },
    ],
  },
  {
    href: "/audit",
    label: "Audit Logs",
    icon: AnimatedScrollText,
    roles: [
      "super_admin", "admin", "manager", "service_manager", "supervisor",
      "service_engineer", "engineer", "mechanic", "store_manager", "hr_manager"
    ],
  },
];

export function AppSidebar({ user, collapsed, onToggleCollapse }: AppSidebarProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();

  const visibleMainItems = useMemo(
    () =>
      mainNavItems
        .filter((item) => !item.roles || item.roles.includes(user.role))
        .map((item) => {
          if (item.href === "/operations") {
            if (user.role === "operator") {
              return {
                ...item,
                subItems: [
                  { label: "Log Entry", tab: "entry" },
                  { label: "Log History", tab: "history" },
                ],
              };
            }
            return {
              ...item,
              subItems: [
                { label: "Running Hours", tab: "logs" },
                { label: "Operator Machine Assignments", tab: "assignments" },
                // { label: "Site Movement / Loading-Unloading", tab: "site-movement" }, // Soft-removed per user request
                // { label: "Operator Roster & Salary", tab: "operators" }, // Soft-removed per user request
              ],
            };
          }
          return item;
        }),
    [user.role]
  );

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

      {/* Mobile Drawer */}
      <MobileSidebarDrawer
        user={user}
        items={visibleMainItems}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        userRole={user.role}
      />
    </>
  );
}
