"use client";

import { useState, useMemo } from "react";
import {
  AnimatedDashboard,
  AnimatedStar,
  AnimatedUsers,
  AnimatedWrench,
  AnimatedClipboardList,
  AnimatedPackage,
  AnimatedBuilding2,
  AnimatedShoppingBag,
  AnimatedFileText,
  AnimatedBarChart3,
  AnimatedSettings,
  AnimatedBell,
  AnimatedAlertTriangle,
  AnimatedGauge,
  AnimatedRefresh,
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
    href: "/dashboard",
    label: "Dashboard",
    icon: AnimatedDashboard,
    roles: [
      "super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer",
      "supervisor", "store_manager", "operator", "mechanic",
      "hr_manager", "finance_manager", "sales_executive", "rental_manager"
    ],
  },
  {
    href: "/my-work",
    label: "My Work",
    icon: AnimatedStar,
    roles: [
      "super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer",
      "supervisor", "store_manager", "operator", "mechanic",
      "hr_manager", "finance_manager", "sales_executive", "rental_manager"
    ],
  },
  {
    href: "/rentals",
    label: "Rentals",
    icon: AnimatedBuilding2,
    roles: ["super_admin", "admin", "branch_manager", "rental_manager", "sales_executive", "finance_manager"],
  },
  {
    href: "/crm",
    label: "CRM",
    icon: AnimatedUsers,
    roles: ["super_admin", "admin", "branch_manager", "sales_executive", "rental_manager"],
    subItems: [
      { label: "Sales Dashboard", tab: "dashboard", icon: AnimatedDashboard },
      { label: "Leads", tab: "leads", icon: AnimatedClipboardList },
      { label: "Customers", tab: "customers", icon: AnimatedUsers },
      { label: "Interactions", tab: "interactions", icon: AnimatedBell },
      { label: "Opportunities", tab: "opportunities", icon: AnimatedStar },
      { label: "Quotations", tab: "quotations", icon: AnimatedFileText },
      { label: "Sales Orders", tab: "orders", icon: AnimatedShoppingBag },
      { label: "Machine Sales", tab: "machine-sales", icon: AnimatedWrench },
      { label: "Delivery & Handover", tab: "deliveries", icon: AnimatedPackage },
      { label: "Service Escalations", tab: "service-requests", icon: AnimatedAlertTriangle },
      { label: "Sales Settings", tab: "settings", icon: AnimatedSettings },
    ],
  },
  {
    href: "/machines",
    label: "Machines",
    icon: AnimatedWrench,
    roles: [
      "super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer",
      "supervisor", "operator", "mechanic", "store_manager", "sales_executive", "rental_manager", "finance_manager"
    ],
  },
  {
    href: "/operations",
    label: "Operations",
    icon: AnimatedGauge,
    roles: ["super_admin", "admin", "branch_manager", "service_manager", "supervisor", "operator"],
    subItems: [
      { label: "Daily Running Hours", tab: "logs", icon: AnimatedGauge },
      { label: "Operator Machine Assignments", tab: "assignments", icon: AnimatedStar },
      { label: "Site Movement / Loading-Unloading", tab: "site-movement", icon: AnimatedPackage },
      { label: "Operator Roster & Salary", tab: "operators", icon: AnimatedUsers },
    ],
  },
  {
    href: "/service",
    label: "Service",
    icon: AnimatedClipboardList,
    roles: [
      "super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer",
      "supervisor", "mechanic", "operator", "rental_manager"
    ],
    subItems: [
      { label: "Service Dashboard", tab: "dashboard", icon: AnimatedDashboard },
      { label: "Complaints", tab: "complaints", icon: AnimatedAlertTriangle },
      { label: "Service Schedule", tab: "schedule", icon: AnimatedClipboardList },
      { label: "FSR / Service Reports", tab: "reports", icon: AnimatedFileText },
    ],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: AnimatedPackage,
    roles: ["super_admin", "admin", "branch_manager", "service_manager", "store_manager", "service_engineer", "engineer", "mechanic", "operator", "finance_manager", "rental_manager"],
    subItems: [
      { label: "Dashboard", tab: "dashboard", icon: AnimatedDashboard },
      { label: "Part Master", tab: "master", icon: AnimatedPackage },
      { label: "Storage & Bins", tab: "locations", icon: AnimatedBuilding2 },
      { label: "Procurement", tab: "procurement", icon: AnimatedShoppingBag },
      { label: "Goods Receipt (GRN)", tab: "grn", icon: AnimatedFileText },
      { label: "Part Issues", tab: "issues", icon: AnimatedWrench },
      { label: "Returnable Parts", tab: "returns", icon: AnimatedClipboardList },
      { label: "Stock Ledger", tab: "transactions", icon: AnimatedBarChart3 },
      { label: "Transfers", tab: "transfers", icon: AnimatedRefresh },
    ],
  },
  {
    href: "/vendors",
    label: "Vendors",
    icon: AnimatedBuilding2,
    roles: ["super_admin", "admin", "branch_manager", "store_manager", "finance_manager"],
    subItems: [
      { label: "Vendor Directory", tab: "directory", icon: AnimatedBuilding2 },
      { label: "Performance", tab: "performance", icon: AnimatedBarChart3 },
    ],
  },
  {
    href: "/purchase-orders",
    label: "Purchase Orders",
    icon: AnimatedShoppingBag,
    roles: ["super_admin", "admin", "branch_manager", "store_manager", "finance_manager"],
    subItems: [
      { label: "All Purchase Orders", tab: "all", icon: AnimatedShoppingBag },
      { label: "My Approvals", tab: "approvals", icon: AnimatedAlertTriangle },
      { label: "Create PO", tab: "create", icon: AnimatedFileText },
    ],
  },
  {
    href: "/challans",
    label: "Challans",
    icon: AnimatedPackage,
    roles: ["super_admin", "admin", "branch_manager", "store_manager", "rental_manager", "finance_manager"],
  },
  {
    href: "/documents",
    label: "Documents",
    icon: AnimatedFileText,
    roles: [
      "super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer",
      "store_manager", "operator", "mechanic", "hr_manager", "rental_manager", "sales_executive", "finance_manager"
    ],
  },
  {
    href: "/hr",
    label: "HR",
    icon: AnimatedUsers,
    roles: ["super_admin", "admin", "branch_manager", "service_manager", "hr_manager", "finance_manager", "rental_manager"],
    subItems: [
      { label: "Dashboard", tab: "dashboard", icon: AnimatedDashboard },
      { label: "Employees", tab: "employees", icon: AnimatedUsers },
      { label: "Onboarding", tab: "onboarding", icon: AnimatedClipboardList },
      { label: "Departments", tab: "departments", icon: AnimatedBuilding2 },
      { label: "Designations", tab: "designations", icon: AnimatedStar },
      { label: "Salary & Payroll", tab: "payroll", icon: AnimatedFileText },
      { label: "User Requests", tab: "user_requests", icon: AnimatedSettings },
      { label: "Documents", tab: "documents", icon: AnimatedFileText },
    ],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: AnimatedBarChart3,
    roles: ["super_admin", "admin", "branch_manager", "finance_manager"],
    subItems: [
      { label: "Dashboard", tab: "dashboard", icon: AnimatedDashboard },
      { label: "Invoices & Notes", tab: "invoices", icon: AnimatedFileText },
      { label: "Payment Ledger", tab: "payments", icon: AnimatedShoppingBag },
      { label: "Receivables Aging", tab: "receivables", icon: AnimatedClipboardList },
      { label: "Payables & Vendors", tab: "payables", icon: AnimatedBuilding2 },
      { label: "3-Way Match Verification", tab: "po-match", icon: AnimatedSettings },
      { label: "Expenses", tab: "expenses", icon: AnimatedPackage },
      { label: "Payroll Summaries", tab: "payroll", icon: AnimatedUsers },
      { label: "Financial Reports", tab: "reports", icon: AnimatedBarChart3 },
      { label: "Finance Settings", tab: "settings", icon: AnimatedSettings },
    ],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: AnimatedBarChart3,
    roles: ["super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer", "mechanic", "operator", "store_manager", "hr_manager", "rental_manager", "sales_executive", "finance_manager"],
  },
  {
    href: "/administration",
    label: "Administration",
    icon: AnimatedSettings,
    roles: ["super_admin", "admin"],
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
          if (item.href === "/service") {
            if (user.role === "supervisor") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => ["dashboard", "complaints"].includes(sub.tab)),
              };
            }
          }
          if (item.href === "/inventory") {
            if (user.role === "operator") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => sub.tab === "procurement"),
              };
            }
            if (user.role === "service_engineer" || user.role === "engineer" || user.role === "mechanic") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => ["dashboard", "master", "procurement"].includes(sub.tab)),
              };
            }
            if (user.role === "finance_manager") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => ["dashboard", "master", "procurement", "grn", "transactions"].includes(sub.tab)),
              };
            }
          }
          if (item.href === "/hr") {
            if (user.role === "branch_manager") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => sub.tab !== "payroll"),
              };
            }
            if (user.role === "service_manager") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => sub.tab === "employees"),
              };
            }
            if (user.role === "finance_manager") {
              return {
                ...item,
                subItems: item.subItems?.filter((sub) => ["dashboard", "employees", "payroll"].includes(sub.tab)),
              };
            }
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
