"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  AnimatedMail,
  AnimatedPhone,
  AnimatedMapPin,
  AnimatedChevronRight,
} from "@/components/ui/animated-icons";
import type { User } from "@/lib/types/database";

interface MobileUserCardProps {
  user: User;
  currentUser: User;
  loadingId?: { type: string; id: string } | null;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (userId: string) => void;
  onOpenSheet: (user: User) => void;
  onResetPassword?: (userId: string) => void;
  onToggleStatus?: (userId: string) => void;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-xs whitespace-nowrap">
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          Admin
        </span>
      );
    case "manager":
    case "branch_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-xs whitespace-nowrap">
          Manager
        </span>
      );
    case "service_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 shadow-xs whitespace-nowrap">
          Service Manager
        </span>
      );
    case "service_engineer":
    case "engineer":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shadow-xs whitespace-nowrap">
          Service Engineer
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 shadow-xs whitespace-nowrap">
          Supervisor
        </span>
      );
    case "store_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 shadow-xs whitespace-nowrap">
          Store Manager
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          Operator
        </span>
      );
    case "mechanic":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/80 shadow-xs whitespace-nowrap">
          Mechanic
        </span>
      );
    case "hr_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs whitespace-nowrap">
          HR Manager
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-xs whitespace-nowrap">
          {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "User"}
        </span>
      );
  }
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleAvatarStyle(role?: string): string {
  switch (role) {
    case "super_admin":
      return "from-rose-500/20 to-red-600/25 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    case "admin":
      return "from-amber-500/20 to-amber-600/25 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "manager":
    case "branch_manager":
      return "from-indigo-500/20 to-indigo-600/25 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
    case "service_manager":
      return "from-sky-500/20 to-sky-600/25 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800";
    case "service_engineer":
    case "engineer":
      return "from-blue-500/20 to-blue-600/25 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800";
    case "supervisor":
      return "from-teal-500/20 to-teal-600/25 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800";
    case "store_manager":
      return "from-purple-500/20 to-purple-600/25 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800";
    case "operator":
      return "from-amber-500/20 to-yellow-600/25 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "mechanic":
      return "from-orange-500/20 to-orange-600/25 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800";
    case "hr_manager":
      return "from-emerald-500/20 to-emerald-600/25 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    default:
      return "from-zinc-500/20 to-zinc-600/25 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800";
  }
}

function getStatusIndicator(status: string) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          Active
        </span>
      );
    case "inactive":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-400"></span>
          Inactive
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
          Pending
        </span>
      );
    default:
      return null;
  }
}

export const MobileUserCard = memo(function MobileUserCard({
  user,
  currentUser,
  loadingId,
  selectable = false,
  isSelected = false,
  onToggleSelect,
  onOpenSheet,
}: MobileUserCardProps) {
  const canViewContactInfo = () => {
    if (currentUser.role === "super_admin") return true;
    if (currentUser.role === "admin") {
      if (user.role === "engineer") return true;
      if (user.id === currentUser.id) return true;
      return false;
    }
    if (user.id === currentUser.id) return true;
    return false;
  };

  const showContact = canViewContactInfo();

  const borderAccentClass =
    user.role === "super_admin"
      ? "border-l-[3px] border-l-rose-500"
      : user.role === "admin"
      ? "border-l-[3px] border-l-amber-500"
      : user.role === "manager"
      ? "border-l-[3px] border-l-indigo-500"
      : user.role === "service_manager"
      ? "border-l-[3px] border-l-sky-500"
      : user.role === "engineer" || user.role === "service_engineer"
      ? "border-l-[3px] border-l-blue-500"
      : user.role === "supervisor"
      ? "border-l-[3px] border-l-teal-500"
      : user.role === "store_manager"
      ? "border-l-[3px] border-l-purple-500"
      : user.role === "operator"
      ? "border-l-[3px] border-l-amber-500"
      : user.role === "mechanic"
      ? "border-l-[3px] border-l-orange-500"
      : user.role === "hr_manager"
      ? "border-l-[3px] border-l-emerald-500"
      : "border-l-[3px] border-l-slate-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onOpenSheet(user)}
      className={`p-3.5 rounded-xl border ${
        isSelected
          ? "border-[var(--color-ink)] dark:border-white ring-1 ring-[var(--color-ink)] dark:ring-white bg-[var(--color-link-soft)]/20"
          : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]"
      } shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-md transition-all flex flex-col gap-2.5 relative overflow-hidden group cursor-pointer ${borderAccentClass}`}
    >
      {/* Top Header section: Checkbox, Avatar, Name, Status, Chevron */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectable && (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect && onToggleSelect(user.id)}
                aria-label={`Select ${user.full_name}`}
                className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
              />
            </div>
          )}

          {/* Initials Avatar */}
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getRoleAvatarStyle(
              user.role
            )} font-bold text-xs border shadow-xs select-none`}
          >
            <span>{getInitials(user.full_name)}</span>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight group-hover:text-[var(--color-link)] transition-colors">
              {user.full_name}
            </h3>
            {user.location && (
              <span className="text-[11px] text-[var(--color-mute)] truncate mt-0.5">
                {user.location}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {getStatusIndicator(user.status)}
          <AnimatedChevronRight
            size={14}
            className="text-[var(--color-mute)] group-hover:text-[var(--color-ink)] group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>

      {/* Metadata Row: Contact on Left, Role Badge on Bottom Right */}
      <div className="pt-2 border-t border-[var(--color-hairline)] flex items-end justify-between gap-2 text-xs text-[var(--color-mute)]">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {showContact ? (
            <>
              <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                <AnimatedMail size={12} className="flex-shrink-0 text-[var(--color-ink)] opacity-60" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                  <AnimatedPhone size={12} className="flex-shrink-0 text-[var(--color-ink)] opacity-60" />
                  <span>{user.phone}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-[var(--color-mute)] italic">
              Restricted contact
            </div>
          )}
          {(user.city || user.location) && (
            <div className="flex items-center gap-1.5 text-[11px] truncate">
              <AnimatedMapPin size={12} className="flex-shrink-0 text-[var(--color-ink)] opacity-60" />
              <span className="truncate">{user.city || user.location}</span>
            </div>
          )}
        </div>

        {/* Role Badge shifted to Bottom Right of card */}
        <div className="shrink-0 self-end">
          {getRoleBadge(user.role)}
        </div>
      </div>
    </motion.div>
  );
});
