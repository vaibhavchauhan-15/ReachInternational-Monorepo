"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AnimatedChevronDown,
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
} from "@/components/ui/animated-icons";
import { LogOut, Clock, Edit, Phone, MapPin, ShieldCheck, FileText, Trash2 } from "lucide-react";
import type { User } from "@/lib/types/database";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SidebarTooltip, Button } from "@/components/ui";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

interface UserProfileDropdownProps {
  user: User;
  collapsed: boolean;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  super_admin: {
    label: "Super Admin",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: AnimatedShieldAlert,
  },
  admin: {
    label: "Admin",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: AnimatedShieldCheck,
  },
  manager: {
    label: "Manager",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    icon: AnimatedShield,
  },
  service_manager: {
    label: "Service Manager",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: AnimatedShield,
  },
  engineer: {
    label: "Engineer",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: AnimatedShield,
  },
  service_engineer: {
    label: "Service Engineer",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    icon: AnimatedShield,
  },
  supervisor: {
    label: "Supervisor",
    badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    icon: AnimatedShield,
  },
  store_manager: {
    label: "Store Manager",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    icon: AnimatedShield,
  },
  operator: {
    label: "Operator",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: AnimatedShield,
  },
  mechanic: {
    label: "Mechanic",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    icon: AnimatedShield,
  },
  hr_manager: {
    label: "HR Manager",
    badgeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
    icon: AnimatedShield,
  },
};

export const UserProfileDropdown = memo(function UserProfileDropdown({
  user,
  collapsed,
}: UserProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to trigger element
  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (collapsed) {
        const estimatedHeight = 360;
        let calculatedTop = rect.bottom - estimatedHeight;
        if (calculatedTop < 16) calculatedTop = 16;
        if (calculatedTop + estimatedHeight > viewportHeight - 16) {
          calculatedTop = Math.max(16, viewportHeight - estimatedHeight - 16);
        }

        setPos({
          top: calculatedTop,
          left: Math.min(rect.right + 12, viewportWidth - popoverWidth - 12),
        });
      } else {
        const bottomOffset = viewportHeight - rect.top + 8;
        setPos({
          bottom: Math.max(8, bottomOffset),
          left: Math.min(Math.max(12, rect.left), viewportWidth - popoverWidth - 12),
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, collapsed]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const roleMeta = ROLE_CONFIG[user.role] || {
    label: user.role.replace("_", " "),
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
    icon: AnimatedShield,
  };
  const RoleIcon = roleMeta.icon;

  const fullAddress = [user.address, user.city, user.district, user.state].filter(Boolean).join(", ");
  const maskedAadhaar = user.aadhaar_number
    ? user.aadhaar_number.length >= 12
      ? `XXXX-XXXX-${user.aadhaar_number.slice(-4)}`
      : user.aadhaar_number
    : null;

  return (
    <div className="relative">
      <SidebarTooltip content={`${user.full_name} (${roleMeta.label})`} enabled={collapsed}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="User profile menu"
          className={`w-full flex items-center gap-3 rounded-xl hover:bg-[var(--color-hairline-soft-surface)] transition-all duration-150 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
            collapsed ? "justify-center p-2.5 h-11 w-11 mx-auto" : "px-3 py-2.5"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-extrabold shadow-2xs">
            {user.full_name.charAt(0).toUpperCase()}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                {user.full_name}
              </p>
              <p className="text-[11px] text-[var(--color-mute)] truncate font-medium capitalize mt-0.5">
                {roleMeta.label}
              </p>
            </div>
          )}

          {!collapsed && (
            <AnimatedChevronDown
              size={16}
              className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </button>
      </SidebarTooltip>

      {/* Portal Popover */}
      {mounted &&
        open &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-50 pointer-events-none">
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  left: `${pos.left}px`,
                  ...(pos.top !== undefined ? { top: `${pos.top}px` } : {}),
                  ...(pos.bottom !== undefined ? { bottom: `${pos.bottom}px` } : {}),
                  width: "320px",
                  maxHeight: pos.bottom !== undefined
                    ? `min(480px, calc(100vh - ${pos.bottom + 16}px))`
                    : "min(480px, calc(100vh - 32px))",
                }}
                className="pointer-events-auto z-50 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-2xl shadow-black/10 dark:shadow-black/50 text-[var(--color-ink)] backdrop-blur-xl select-none overflow-y-auto"
              >
                {/* Profile Header Card */}
                <div className="p-3 border border-[var(--color-hairline)] bg-[var(--color-canvas)] rounded-xl mb-2.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold text-sm shadow-xs ring-1 ring-black/5 dark:ring-white/10">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                          {user.full_name}
                        </p>
                        <p className="text-[11px] text-[var(--color-mute)] truncate mt-0.5">
                          {user.email || "No email"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleMeta.badgeClass}`}
                          >
                            <RoleIcon size={11} />
                            {roleMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edit Profile Icon Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setEditModalOpen(true);
                      }}
                      title="Edit Profile"
                      aria-label="Edit Profile"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-sky-500 transition-colors cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <Edit size={13} />
                    </button>
                  </div>
                </div>

                {/* User Quick Info */}
                <div className="space-y-1.5 p-2.5 border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 rounded-xl mb-2 text-xs">
                  {/* Mobile Phone */}
                  <div className="flex items-center gap-2.5 py-1">
                    <Phone size={13} className="text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                        Phone
                      </span>
                      <span className="text-xs font-medium font-mono text-[var(--color-ink)] truncate">
                        {user.phone ? (user.phone.startsWith("+") ? user.phone : `+91 ${user.phone}`) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Shift Time */}
                  <div className="flex items-center gap-2.5 py-1 border-t border-[var(--color-hairline)]">
                    <Clock size={13} className="text-sky-500 shrink-0" />
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                        Shift
                      </span>
                      <span className="text-xs font-medium text-[var(--color-ink)] truncate">
                        {user.shift_time || "General Shift"}
                      </span>
                    </div>
                  </div>

                  {/* Base Yard / Location */}
                  <div className="flex items-start gap-2.5 py-1 border-t border-[var(--color-hairline)]">
                    <MapPin size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)] shrink-0">
                        Location
                      </span>
                      <span className="text-xs font-medium text-[var(--color-ink)] text-right leading-snug line-clamp-2">
                        {fullAddress || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Aadhaar & Licence Grid */}
                  {(user.aadhaar_number || user.license_number) && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[var(--color-hairline)]">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-indigo-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                            Aadhaar
                          </p>
                          <p className="text-[11px] font-mono font-medium text-[var(--color-ink)] truncate">
                            {maskedAadhaar || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <FileText size={12} className="text-purple-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                            Licence
                          </p>
                          <p className="text-[11px] font-mono font-medium text-[var(--color-ink)] truncate uppercase">
                            {user.license_number || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Actions & Links */}
                <div className="space-y-0.5">
                  <Link
                    href="/delete-account"
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <Trash2 size={13} className="text-rose-500 shrink-0" />
                    <span>Account Deletion</span>
                  </Link>

                  {/* Theme Toggle Row */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-canvas)] transition-colors">
                    <span className="text-xs font-medium text-[var(--color-ink)]">Appearance</span>
                    <ThemeToggle />
                  </div>
                </div>

                {/* Sign Out Button */}
                <div className="pt-1.5 border-t border-[var(--color-hairline)] mt-1.5">
                  <form action={logout}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      fullWidth
                      icon={<LogOut className="h-3.5 w-3.5 text-rose-500" />}
                      className="justify-start px-2.5 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                    >
                      Sign Out
                    </Button>
                  </form>
                </div>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}

      {/* Edit Profile Modal */}
      {user && (
        <EditProfileModal
          user={user}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
});
