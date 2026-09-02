"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AnimatedDashboard,
  AnimatedGauge,
  AnimatedClock,
  AnimatedWrench,
  AnimatedClipboardList,
  AnimatedBell,
  AnimatedUsers,
  AnimatedSearch,
  AnimatedUser,
  AnimatedFileText,
  AnimatedSettings,
  AnimatedX,
  AnimatedChevronRight,
  AnimatedLogOut,
} from "@/components/ui/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import type { User, UserRole } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { Phone, MapPin, ShieldCheck, Clock, FileText, Edit, Shield } from "lucide-react";

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
  const [editProfileOpen, setEditProfileOpen] = useState(false);

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
          id: "search",
          label: "Search",
          icon: AnimatedSearch,
          isAction: true,
          actionType: "search",
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
        {
          id: "search",
          label: "Search",
          icon: AnimatedSearch,
          isAction: true,
          actionType: "search",
        },
        {
          id: "notifications",
          href: "/notifications",
          label: "Alerts",
          icon: AnimatedBell,
          roles: ["super_admin", "admin"],
        },
        ...(user.role === "super_admin" || user.role === "admin"
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
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-3 pb-safe pt-1 pointer-events-none"
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
              className="relative z-50 w-full bg-card border-t border-border rounded-t-[28px] shadow-2xl p-6 space-y-5 pb-safe max-h-[85vh] overflow-y-auto"
            >
              {/* Handle Bar */}
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto -mt-2 mb-2 opacity-80" />

              {/* Drawer Header with Close */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold shadow-md">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground leading-snug">
                      {user.full_name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="badge-base bg-muted text-muted-foreground text-[10px]">
                        {roleLabels[user.role]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={() => setProfileSheetOpen(false)}
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <AnimatedX size={20} />
                  </button>
                </div>
              </div>

              {/* User Detailed Operational & Identity Profile Info */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                    Profile & Operational Info
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {/* Shift Time Card */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border shadow-2xs">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        Shift Schedule
                      </p>
                      <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                        {user.shift_time || "Not Assigned (Standard)"}
                      </p>
                    </div>
                  </div>

                  {/* Phone / Mobile Card */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border shadow-2xs">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Phone size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        Mobile Phone
                      </p>
                      <p className="text-xs font-semibold font-mono text-foreground truncate mt-0.5">
                        {user.phone || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Address Card */}
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-background border border-border shadow-2xs">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        Address
                      </p>
                      <p className="text-xs font-semibold text-foreground leading-snug mt-0.5">
                        {[user.address, user.city, user.district, user.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Identity Docs (Aadhaar & Licence) Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-background border border-border shadow-2xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <ShieldCheck size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Aadhaar</span>
                      </div>
                      <p className="text-xs font-mono font-semibold text-foreground truncate">
                        {user.aadhaar_number
                          ? user.aadhaar_number.length >= 12
                            ? `XXXX-XXXX-${user.aadhaar_number.slice(-4)}`
                            : user.aadhaar_number
                          : "Not Provided"}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background border border-border shadow-2xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <FileText size={14} className="text-purple-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Licence</span>
                      </div>
                      <p className="text-xs font-mono font-semibold text-foreground truncate uppercase">
                        {user.license_number || "Not Provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit Profile Action Button */}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setProfileSheetOpen(false);
                    setEditProfileOpen(true);
                  }}
                  icon={<Edit size={14} className="text-sky-500" />}
                  className="h-10 rounded-xl justify-center font-bold text-xs shadow-xs border border-border hover:bg-muted active:scale-[0.98] transition-all"
                >
                  Edit Profile
                </Button>
              </div>

              {/* Sign Out Action */}
              <div className="pt-2">
                <form action={logout}>
                  <Button
                    type="submit"
                    variant="danger"
                    size="md"
                    fullWidth
                    icon={<AnimatedLogOut size={16} />}
                    className="p-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs border border-rose-500/20 shadow-xs active:scale-[0.98] transition-all justify-center"
                  >
                    Sign out of account
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      {user && (
        <EditProfileModal
          user={user}
          isOpen={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
        />
      )}

      {/* Mobile Search Command Palette Modal */}
      {user && (
        <CommandPalette
          isOpen={cmdOpen}
          onClose={() => setCmdOpen(false)}
          userRole={user.role}
        />
      )}
    </>
  );
}
