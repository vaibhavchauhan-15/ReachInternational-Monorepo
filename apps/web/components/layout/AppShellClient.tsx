"use client";

import { useState, useEffect } from "react";
import type { User } from "@/lib/types/database";
import { AppSidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from "@/components/layout/AppSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { SidebarProvider } from "@/components/ui/sidebar";

export function AppShellClient({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("reachinternational_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("reachinternational_sidebar_collapsed", String(next));
      return next;
    });
  };

  const setCollapsedState = (collapsedValue: boolean) => {
    setCollapsed(collapsedValue);
    localStorage.setItem("reachinternational_sidebar_collapsed", String(collapsedValue));
  };

  return (
    <SidebarProvider collapsed={collapsed} onCollapsedChange={setCollapsedState}>
      <div className="min-h-screen flex flex-col bg-[var(--color-canvas)]">
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
          className="flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            paddingLeft: mounted ? (collapsed ? `${SIDEBAR_WIDTH_COLLAPSED}px` : `${SIDEBAR_WIDTH_EXPANDED}px`) : undefined,
          }}
        >
          {/* Main Content Viewport */}
          <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-6 pt-4 md:pt-6 pb-24 md:pb-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
