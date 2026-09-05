"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@/lib/types/database";
import { AppSidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from "@/components/layout/AppSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppShellClient({
  user,
  defaultCollapsed = false,
  children,
}: {
  user: User;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isInteractive, setIsInteractive] = useState(false);

  const saveSidebarState = useCallback((next: boolean) => {
    try {
      localStorage.setItem("reachinternational_sidebar_collapsed", String(next));
      document.cookie = `reachinternational_sidebar_collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.classList.toggle("sidebar-collapsed", next);
        document.documentElement.style.setProperty(
          "--sidebar-width",
          next ? `${SIDEBAR_WIDTH_COLLAPSED}px` : `${SIDEBAR_WIDTH_EXPANDED}px`
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("reachinternational_sidebar_collapsed");
      if (saved !== null) {
        const isSavedCollapsed = saved === "true";
        document.cookie = `reachinternational_sidebar_collapsed=${isSavedCollapsed}; path=/; max-age=31536000; SameSite=Lax`;
        if (isSavedCollapsed !== collapsed) {
          setCollapsed(isSavedCollapsed);
        }
      } else {
        localStorage.setItem("reachinternational_sidebar_collapsed", String(defaultCollapsed));
        document.cookie = `reachinternational_sidebar_collapsed=${defaultCollapsed}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore
    }

    // Enable smooth animations for user-initiated clicks only after initial reconciliation
    const timer = requestAnimationFrame(() => {
      setIsInteractive(true);
    });
    return () => cancelAnimationFrame(timer);
  }, [defaultCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveSidebarState(next);
      return next;
    });
  }, [saveSidebarState]);

  const setCollapsedState = useCallback((collapsedValue: boolean) => {
    setCollapsed(collapsedValue);
    saveSidebarState(collapsedValue);
  }, [saveSidebarState]);

  return (
    <SidebarProvider
      defaultCollapsed={defaultCollapsed}
      collapsed={collapsed}
      onCollapsedChange={setCollapsedState}
      isInteractive={isInteractive}
    >
      <div
        className="min-h-screen flex flex-col bg-[var(--color-canvas)]"
        style={
          {
            "--sidebar-width": collapsed
              ? `${SIDEBAR_WIDTH_COLLAPSED}px`
              : `${SIDEBAR_WIDTH_EXPANDED}px`,
          } as React.CSSProperties
        }
      >
        {/* Desktop Left Sidebar */}
        <AppSidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav user={user} />

        {/* Main Workspace Column */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 md:pl-[var(--sidebar-width)]",
            isInteractive
              ? "transition-[padding] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              : "transition-none"
          )}
        >
          {/* Main Content Viewport */}
          <main className="flex-1 w-full max-w-full px-3 sm:px-6 pt-3 md:pt-6 pb-24 md:pb-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
