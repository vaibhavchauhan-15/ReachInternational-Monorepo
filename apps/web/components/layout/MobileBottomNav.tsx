"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AnimatedGauge,
  AnimatedWrench,
  AnimatedUsers,
  AnimatedUser,
  AnimatedBuilding2,
} from "@/components/ui/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import type { User, UserRole } from "@/lib/types/database";
import dynamic from "next/dynamic";
import { UserProfileCard } from "@/components/profile/UserProfileCard";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

interface MobileBottomNavProps {
  user: User;
}

interface NavItemConfig {
  id: string;
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | boolean;
  isAction?: boolean;
  actionType?: "search" | "profile";
  roles?: UserRole[];
}

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  service_manager: "Service Manager",
  engineer: "Service Engineer",
  service_engineer: "Service Engineer",
  supervisor: "Supervisor",
  store_manager: "Store Manager",
  operator: "Operator",
  mechanic: "Mechanic",
  hr_manager: "HR Manager",
};

export function MobileBottomNav({ user }: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Global ⌘K / Search shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isOperator = user.role === "operator";
  const canAccessClients = ["super_admin", "admin", "manager", "service_manager"].includes(user.role);
  const canAccessUsers = ["super_admin", "admin", "manager", "service_manager", "hr_manager", "supervisor"].includes(user.role);

  // Build responsive nav items based on user role
  const navItems: NavItemConfig[] = isOperator
    ? [
        {
          id: "operations",
          href: "/operations",
          label: "Operations",
          icon: AnimatedGauge,
        },
        {
          id: "profile",
          label: "Profile",
          icon: AnimatedUser,
          isAction: true,
          actionType: "profile",
        },
      ]
    : [
        {
          id: "machines",
          href: "/machines",
          label: "Machines",
          icon: AnimatedWrench,
        },
        {
          id: "operations",
          href: "/operations",
          label: "Operations",
          icon: AnimatedGauge,
        },
        ...(canAccessClients
          ? [
              {
                id: "clients",
                href: "/clients",
                label: "Clients",
                icon: AnimatedBuilding2,
              },
            ]
          : []),
        ...(canAccessUsers
          ? [
              {
                id: "users",
                href: "/users",
                label: "Users",
                icon: AnimatedUsers,
              },
            ]
          : []),
        {
          id: "profile",
          label: "Profile",
          icon: AnimatedUser,
          isAction: true,
          actionType: "profile",
        },
      ];

  // Filter items permitted for user role
  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <>
      {/* Mobile Floating Bottom Navbar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-3 pb-safe pt-1 pointer-events-none print:hidden"
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="pointer-events-auto mx-auto mb-2.5 max-w-lg bg-card/92 backdrop-blur-xl border border-border rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-1.5 flex items-center justify-around"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isTabMatch = item.href?.includes("?")
              ? searchParams.get("tab") === new URLSearchParams(item.href.split("?")[1]).get("tab")
              : true;

            const isActive = item.href
              ? pathname === item.href.split("?")[0] && isTabMatch
              : item.actionType === "profile" && profileSheetOpen;

            const handleItemClick = (e: React.MouseEvent) => {
              if (item.isAction) {
                e.preventDefault();
                if (item.actionType === "search") {
                  setCmdOpen(true);
                } else if (item.actionType === "profile") {
                  setProfileSheetOpen(true);
                }
              }
            };

            const content = (
              <motion.div
                whileTap={{ opacity: 0.7 }}
                transition={{ duration: 0.15 }}
                className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-full group focus:outline-none"
              >
                {/* Micro Icon + Label Container */}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <Icon
                    className={`h-5 w-5 transition-colors duration-150 ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  <span
                    className={`text-[10px] tracking-tight leading-none transition-colors duration-150 ${
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground font-medium group-hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Dynamic Active Click Dot Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-dot"
                      className="absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-foreground shadow-xs"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </span>
              </motion.div>
            );

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={handleItemClick}
                  type="button"
                  className="flex-1 flex justify-center focus:outline-none select-none"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href!}
                onClick={handleItemClick}
                className="flex-1 flex justify-center focus:outline-none select-none"
              >
                {content}
              </Link>
            );
          })}
        </motion.div>
      </nav>

      {/* Mobile Profile Slide-Up Drawer */}
      <AnimatePresence>
        {profileSheetOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex items-end justify-center">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setProfileSheetOpen(false)}
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="relative z-50 w-full max-w-lg bg-[var(--color-canvas-elevated)] border-t border-[var(--color-hairline)] rounded-t-2xl shadow-2xl p-3 pb-safe max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Grab Handle */}
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2 shrink-0" />

              {/* Shared Unified Profile Card (Same as Desktop with Dual-Tier Lazy Loading) */}
              <UserProfileCard
                user={user}
                onClose={() => setProfileSheetOpen(false)}
                isMobileDrawer={true}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Search Command Palette Modal (Lazy loaded strictly when tapped) */}
      {cmdOpen && user && (
        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          userRole={user.role}
        />
      )}
    </>
  );
}
