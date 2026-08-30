"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
  AnimatedBuilding2,
  AnimatedMail,
  AnimatedPhone,
  AnimatedMoreHorizontal,
  AnimatedMapPin,
  AnimatedKey,
  AnimatedUserCheck,
  AnimatedUserX,
  AnimatedWrench,
  AnimatedActivity,
  AnimatedPackage,
  AnimatedUsers,
} from "@/components/ui/animated-icons";
import { Badge, Button } from "@/components/ui";
import type { User } from "@/lib/types/database";

interface MobileUserCardProps {
  user: User;
  currentUser: User;
  loadingId: { type: string; id: string } | null;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (userId: string) => void;
  onOpenSheet: (user: User) => void;
  onResetPassword: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return <Badge variant="error" dot>Super Admin</Badge>;
    case "admin":
      return <Badge variant="warning" dot>Admin</Badge>;
    case "manager":
    case "branch_manager":
      return <Badge variant="default" dot>Manager</Badge>;
    case "service_manager":
      return <Badge variant="default" dot>Service Manager</Badge>;
    case "service_engineer":
    case "engineer":
      return <Badge variant="info" dot>Service Engineer</Badge>;
    case "supervisor":
      return <Badge variant="default" dot>Supervisor</Badge>;
    case "store_manager":
      return <Badge variant="warning" dot>Store Manager</Badge>;
    case "operator":
      return <Badge variant="warning" dot>Operator</Badge>;
    case "mechanic":
      return <Badge variant="error" dot>Mechanic</Badge>;
    case "hr_manager":
      return <Badge variant="success" dot>HR Manager</Badge>;
    default:
      return <Badge variant="neutral">{role}</Badge>;
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case "super_admin":
      return <AnimatedShieldAlert size={14} className="text-red-500" />;
    case "admin":
      return <AnimatedShieldCheck size={14} className="text-amber-500" />;
    case "manager":
    case "branch_manager":
      return <AnimatedBuilding2 size={14} className="text-indigo-500" />;
    case "service_manager":
      return <AnimatedShieldCheck size={14} className="text-sky-500" />;
    case "service_engineer":
    case "engineer":
      return <AnimatedWrench size={14} className="text-blue-500" />;
    case "supervisor":
      return <AnimatedShieldCheck size={14} className="text-teal-500" />;
    case "store_manager":
      return <AnimatedPackage size={14} className="text-purple-500" />;
    case "operator":
      return <AnimatedActivity size={14} className="text-amber-500" />;
    case "mechanic":
      return <AnimatedWrench size={14} className="text-orange-500" />;
    case "hr_manager":
      return <AnimatedUsers size={14} className="text-emerald-500" />;
    default:
      return <AnimatedShield size={14} className="text-muted-foreground" />;
  }
}

function getStatusIndicator(status: string) {
  switch (status) {
    case "active":
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Active
        </span>
      );
    case "inactive":
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
          Inactive
        </span>
      );
    case "pending":
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
          <span className="inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
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
  onResetPassword,
  onToggleStatus,
}: MobileUserCardProps) {
  const isLoading = loadingId?.id === user.id;

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

  const canManage = () => {
    if (currentUser.role === "super_admin") return true;
    if (currentUser.role === "admin" && user.role === "engineer") return true;
    return false;
  };

  const showContact = canViewContactInfo();
  const showManage = canManage();

  const borderAccentClass =
    user.role === "super_admin"
      ? "border-l-4 border-l-red-500 dark:border-l-red-500"
      : user.role === "admin"
      ? "border-l-4 border-l-amber-500 dark:border-l-amber-400"
      : user.role === "manager"
      ? "border-l-4 border-l-indigo-500 dark:border-l-indigo-400"
      : user.role === "service_manager"
      ? "border-l-4 border-l-sky-500 dark:border-l-sky-400"
      : user.role === "engineer" || user.role === "service_engineer"
      ? "border-l-4 border-l-blue-500 dark:border-l-blue-400"
      : user.role === "supervisor"
      ? "border-l-4 border-l-teal-500 dark:border-l-teal-400"
      : user.role === "store_manager"
      ? "border-l-4 border-l-purple-500 dark:border-l-purple-400"
      : user.role === "operator"
      ? "border-l-4 border-l-amber-500 dark:border-l-amber-400"
      : user.role === "mechanic"
      ? "border-l-4 border-l-orange-500 dark:border-l-orange-400"
      : user.role === "hr_manager"
      ? "border-l-4 border-l-emerald-500 dark:border-l-emerald-400"
      : "border-l-4 border-l-slate-400 dark:border-l-slate-600";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onOpenSheet(user)}
      className={`p-4 rounded-xl border ${
        isSelected
          ? "border-[var(--color-ink)] dark:border-white ring-1 ring-[var(--color-ink)] dark:ring-white bg-[var(--color-link-soft)]/20"
          : "border-[var(--color-hairline)] bg-gradient-to-b from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]"
      } shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-lg dark:hover:shadow-black/50 transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer ${borderAccentClass}`}
    >
      {/* Top Hairline Sheen Gradient on Hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-link)]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      {/* Top Header section: Checkbox, Name, Role badge, Status indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {selectable && (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect && onToggleSelect(user.id)}
                aria-label={`Select ${user.full_name}`}
                className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
              />
            </div>
          )}
          <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-xs">
            {getRoleIcon(user.role)}
          </div>

          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight group-hover:text-[var(--color-link)] transition-colors">
              {user.full_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {getRoleBadge(user.role)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {getStatusIndicator(user.status)}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSheet(user);
            }}
            className="p-1 rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] active:scale-95 transition-all"
            title="Open user options"
          >
            <AnimatedMoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Inset Details Box */}
      <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-[11px] truncate">
          <AnimatedMapPin size={14} className="flex-shrink-0 text-emerald-500" />
          <span className="truncate">
            {user.city || user.location || "India Operations"}
          </span>
        </div>
        {showContact ? (
          <>
            <div className="flex items-center gap-2 text-[var(--color-body)] font-mono text-[11px] truncate">
              <AnimatedMail size={14} className="flex-shrink-0 text-blue-500" />
              <span className="truncate">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-2 text-[var(--color-body)] font-mono text-[11px] truncate">
                <AnimatedPhone size={14} className="flex-shrink-0 text-emerald-500" />
                <span>{user.phone}</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-[var(--color-mute)] italic">
            Contact details restricted for this role
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1.5 border-t border-[var(--color-hairline)]/50 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {showContact && (
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-sm bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition-colors"
            >
              <AnimatedMail size={12} />
              <span>Email</span>
            </a>
          )}
          {showContact && user.phone && (
            <a
              href={`tel:${user.phone}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-sm bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors"
            >
              <AnimatedPhone size={12} />
              <span>Call</span>
            </a>
          )}
        </div>

        {showManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost-sm"
              onClick={() => onResetPassword(user.id)}
              disabled={isLoading}
              title="Reset password"
              className="h-7 w-7 p-0 rounded-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center justify-center cursor-pointer active:scale-[0.98]"
            >
              <AnimatedKey size={13} />
            </Button>
            {user.id !== currentUser.id && (
              <Button
                variant="ghost-sm"
                onClick={() => onToggleStatus(user.id)}
                disabled={isLoading}
                title={user.status === "active" ? "Deactivate user" : "Activate user"}
                className="h-7 w-7 p-0 rounded-sm inline-flex items-center justify-center cursor-pointer active:scale-[0.98]"
              >
                {user.status === "active" ? (
                  <AnimatedUserX size={13} className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <AnimatedUserCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
