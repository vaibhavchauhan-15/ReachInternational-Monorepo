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
      "super_admin", "admin", "service_manager", "service_engineer", "engineer",
      "supervisor", "mechanic", "store_manager", "sales_executive", "rental_manager", "finance_manager"
    ],
    subItems: [
      { label: "Machine Directory", tab: "inventory", icon: AnimatedWrench },
      // { label: "Service Logs", tab: "services", icon: AnimatedClipboardList }, // Soft-removed per user request
      // { label: "Breakdown Complaints", tab: "complaints", icon: AnimatedAlertTriangle }, // Soft-removed per user request
    ],
  },
  {
    href: "/operations",
    label: "Operations",
    icon: AnimatedGauge,
    roles: ["super_admin", "admin", "service_manager", "supervisor", "operator"],
    subItems: [
      { label: "Running Hours", tab: "logs", icon: AnimatedGauge },
      { label: "Operator Machine Assignments", tab: "assignments", icon: AnimatedStar },
      // { label: "Site Movement / Loading-Unloading", tab: "site-movement", icon: AnimatedPackage }, // Soft-removed per user request
      // { label: "Operator Roster & Salary", tab: "operators", icon: AnimatedUsers }, // Soft-removed per user request
    ],
  },
  {
    href: "/users",
    label: "Employees & Users",
    icon: AnimatedUsers,
    roles: ["super_admin", "admin", "service_manager", "hr_manager"],
    subItems: [
      { label: "All Employee Accounts", tab: "all", icon: AnimatedUsers },
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
                  { label: "Log Entry", tab: "entry", icon: AnimatedGauge },
                  { label: "Log History", tab: "history", icon: AnimatedClock },
                ],
              };
            }
            return {
              ...item,
              subItems: [
                { label: "Running Hours", tab: "logs", icon: AnimatedGauge },
                { label: "Operator Machine Assignments", tab: "assignments", icon: AnimatedStar },
                // { label: "Site Movement / Loading-Unloading", tab: "site-movement", icon: AnimatedPackage }, // Soft-removed per user request
                // { label: "Operator Roster & Salary", tab: "operators", icon: AnimatedUsers }, // Soft-removed per user request
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
