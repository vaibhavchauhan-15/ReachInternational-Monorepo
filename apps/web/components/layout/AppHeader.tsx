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
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false }
);

const GlobalCreateModal = dynamic(
  () => import("@/components/layout/GlobalCreateModal").then((mod) => mod.GlobalCreateModal),
  { ssr: false }
);

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
    if (pathname.startsWith("/machines")) return "Machine Directory";
    if (pathname.startsWith("/vendors")) return "Vendor Management";
    if (pathname.startsWith("/purchase-orders")) return "Purchase Orders";
    if (pathname.startsWith("/challans")) return "Delivery Challans";
    if (pathname.startsWith("/documents")) return "Smart Document Repository";
    if (pathname.startsWith("/reports")) return "Operations & Analytics Reports";
    if (pathname.startsWith("/administration")) return "Administration Console";
    if (pathname.startsWith("/dashboard")) return "Dashboard Overview";
    if (pathname.startsWith("/branches")) return "Branch & Location Directory";
    if (pathname.startsWith("/operations")) return "Operations & Operator Logs";
    if (pathname.startsWith("/notifications")) return "Notifications Hub";
    if (pathname.startsWith("/users")) return "User Management";
    if (pathname.startsWith("/audit-logs")) return "Audit Logs";
    if (pathname.startsWith("/audit")) return "Audit Logs";
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
            {user.role === "manager" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300/80">
                <AnimatedShieldCheck size={12} className="text-indigo-600 dark:text-indigo-400" />
                Manager
              </span>
            )}
            {user.role === "supervisor" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300/80">
                <AnimatedShieldCheck size={12} className="text-teal-600 dark:text-teal-400" />
                Supervisor
              </span>
            )}
            {user.role === "hr" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80">
                <AnimatedShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                HR
              </span>
            )}
            {user.role === "operator" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80">
                <AnimatedShield size={12} className="text-amber-600 dark:text-amber-400" />
                Operator
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette (Lazy loaded strictly on shortcut or click) */}
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
