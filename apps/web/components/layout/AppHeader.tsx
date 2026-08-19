"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatedSearch,
  AnimatedBell,
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { BranchSelector } from "@/components/layout/BranchSelector";
import { GlobalCreateModal } from "@/components/layout/GlobalCreateModal";

import { TooltipWrapper } from "@/components/ui";

export interface AppHeaderProps {
  user: User;
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  const getPageTitle = () => {
    if (pathname.startsWith("/my-work")) return "My Work Action Center";
    if (pathname.startsWith("/crm")) return "CRM & Client Management";
    if (pathname.startsWith("/machines")) return "Machine Directory";
    if (pathname.startsWith("/service")) return "Service & Maintenance";
    if (pathname.startsWith("/inventory")) return "Inventory & Stock Ledger";
    if (pathname.startsWith("/vendors")) return "Vendor Management";
    if (pathname.startsWith("/purchase-orders")) return "Purchase Orders";
    if (pathname.startsWith("/challans")) return "Delivery Challans";
    if (pathname.startsWith("/documents")) return "Smart Document Repository";
    if (pathname.startsWith("/hr")) return "Human Resources";
    if (pathname.startsWith("/reports")) return "Operations & Analytics Reports";
    if (pathname.startsWith("/administration")) return "Administration Console";
    if (pathname.startsWith("/dashboard")) return "Dashboard Overview";
    if (pathname.startsWith("/branches")) return "Branch & Location Directory";
    if (pathname.startsWith("/operations")) return "Operations & Operator Logs";
    if (pathname.startsWith("/notifications")) return "Notifications Hub";
    if (pathname.startsWith("/users")) return "User Management";
    if (pathname.startsWith("/audit-logs")) return "Audit Security Logs";
    if (pathname.startsWith("/settings")) return "Platform Settings";
    return "REACH INTERNATIONAL";
  };

  return (
    <>
      <header className="hidden md:flex h-14 w-full border-b border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]/90 backdrop-blur-md px-6 items-center justify-between sticky top-0 z-30 shrink-0 select-none">
        {/* Page Title & Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-mute)]">REACH INTERNATIONAL</span>
          <span className="text-xs text-[var(--color-mute)]">/</span>
          <h1 className="text-sm font-extrabold text-[var(--color-ink)] tracking-tight">
            {getPageTitle()}
          </h1>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-3">
          {/* Top Bar + Create Action Button */}
          <GlobalCreateModal userRole={user.role} />

          {/* Branch Scoping Selector */}
          <BranchSelector currentBranchId={user.branch_id} />

          {/* Quick Access Search Trigger */}
          <TooltipWrapper content={`Quick Search (${isMac ? "⌘" : "Ctrl"}K)`} side="bottom">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              aria-label="Quick Search"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-[border-color,color] cursor-pointer shadow-2xs"
            >
              <AnimatedSearch size={14} className="text-[var(--color-mute)] shrink-0" />
              <span className="font-medium hidden sm:inline">Quick Search</span>
              <kbd className="flex items-center gap-0.5 rounded border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-mute)] shrink-0">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </button>
          </TooltipWrapper>

          {/* Notifications Shortcut (Admins) */}
          {(user.role === "admin" || user.role === "super_admin") && (
            <TooltipWrapper content="View Notifications" side="bottom">
              <Link
                href="/notifications"
                aria-label="View Notifications"
                className="p-2 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors relative inline-flex items-center justify-center"
              >
                <AnimatedBell size={16} />
              </Link>
            </TooltipWrapper>
          )}

          {/* Relocated Theme Toggle */}
          <div className="border-l border-[var(--color-hairline)] pl-2">
            <ThemeToggle />
          </div>

          {/* Role Pill Badge */}
          <div className="border-l border-[var(--color-hairline)] pl-3 flex items-center gap-2">
            {user.role === "super_admin" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300/80">
                <AnimatedShieldAlert size={12} className="text-red-600 dark:text-red-400" />
                Super Admin
              </span>
            )}
            {user.role === "admin" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80">
                <AnimatedShieldCheck size={12} className="text-amber-600 dark:text-amber-400" />
                Admin
              </span>
            )}
            {user.role === "engineer" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300/80">
                <AnimatedShield size={12} className="text-blue-600 dark:text-blue-400" />
                Engineer
              </span>
            )}
            {user.role === "supervisor" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300/80">
                <AnimatedShieldCheck size={12} className="text-purple-600 dark:text-purple-400" />
                Supervisor
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        userRole={user.role}
      />
    </>
  );
}
