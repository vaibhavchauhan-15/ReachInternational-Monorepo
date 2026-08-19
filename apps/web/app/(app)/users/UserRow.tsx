"use client";

import { memo, useState, useCallback } from "react";
import {
  AnimatedShield,
  AnimatedShieldCheck,
  AnimatedShieldAlert,
  AnimatedBuilding2,
  AnimatedPackage,
  AnimatedActivity,
  AnimatedWrench,
  AnimatedUsers,
  AnimatedCreditCard,
  AnimatedTrendingUp,
  AnimatedTruck,
  AnimatedMapPin,
  AnimatedKey,
  AnimatedUser,
  AnimatedTrash2,
  AnimatedMoreVertical,
  AnimatedPower,
  AnimatedMail,
  AnimatedPhone,
} from "@/components/ui/animated-icons";
import { Button, Badge, Select, TooltipWrapper } from "@/components/ui";
import type { User, UserRole } from "@/lib/types/database";

const allRoleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "service_engineer", label: "Service Engineer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "store_manager", label: "Store Manager" },
  { value: "operator", label: "Operator" },
  { value: "mechanic", label: "Mechanic / Tech" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "sales_executive", label: "Sales Executive" },
  { value: "rental_manager", label: "Rental Manager" },
];

interface UserRowProps {
  user: User;
  currentUser: User;
  isSuperAdmin: boolean;
  loadingId: { type: string; id: string } | null;
  onResetPassword: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
  onEdit: (user: User) => void;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onDelete: (userId: string) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    case "inactive":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Inactive
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Pending
        </span>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return <Badge variant="error">Super Admin</Badge>;
    case "admin":
      return <Badge variant="warning">Admin</Badge>;
    case "branch_manager":
      return <Badge variant="default">Branch Manager</Badge>;
    case "service_manager":
      return <Badge variant="default">Service Manager</Badge>;
    case "service_engineer":
    case "engineer":
      return <Badge variant="default">Service Engineer</Badge>;
    case "supervisor":
      return <Badge variant="default">Supervisor</Badge>;
    case "store_manager":
      return <Badge variant="warning">Store Manager</Badge>;
    case "operator":
      return <Badge variant="warning">Operator</Badge>;
    case "mechanic":
      return <Badge variant="error">Mechanic</Badge>;
    case "hr_manager":
      return <Badge variant="success">HR Manager</Badge>;
    case "finance_manager":
      return <Badge variant="default">Finance Manager</Badge>;
    case "sales_executive":
      return <Badge variant="default">Sales Executive</Badge>;
    case "rental_manager":
      return <Badge variant="warning">Rental Manager</Badge>;
    default:
      return <Badge>{role}</Badge>;
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case "super_admin":
      return <AnimatedShieldAlert size={16} className="text-rose-600 dark:text-rose-400" />;
    case "admin":
      return <AnimatedShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />;
    case "branch_manager":
      return <AnimatedBuilding2 size={16} className="text-indigo-600 dark:text-indigo-400" />;
    case "service_manager":
      return <AnimatedShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />;
    case "service_engineer":
    case "engineer":
      return <AnimatedWrench size={16} className="text-sky-600 dark:text-sky-400" />;
    case "supervisor":
      return <AnimatedShieldCheck size={16} className="text-teal-600 dark:text-teal-400" />;
    case "store_manager":
      return <AnimatedPackage size={16} className="text-purple-600 dark:text-purple-400" />;
    case "operator":
      return <AnimatedActivity size={16} className="text-amber-600 dark:text-amber-400" />;
    case "mechanic":
      return <AnimatedWrench size={16} className="text-orange-600 dark:text-orange-400" />;
    case "hr_manager":
      return <AnimatedUsers size={16} className="text-emerald-600 dark:text-emerald-400" />;
    case "finance_manager":
      return <AnimatedCreditCard size={16} className="text-cyan-600 dark:text-cyan-400" />;
    case "sales_executive":
      return <AnimatedTrendingUp size={16} className="text-sky-600 dark:text-sky-400" />;
    case "rental_manager":
      return <AnimatedTruck size={16} className="text-violet-600 dark:text-violet-400" />;
    default:
      return <AnimatedShield size={16} className="text-muted-foreground" />;
  }
}

export const UserRow = memo(function UserRow({
  user,
  currentUser,
  isSuperAdmin,
  loadingId,
  onResetPassword,
  onToggleStatus,
  onEdit,
  onUpdateRole,
  onDelete,
}: UserRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const canViewContactInfo = (targetUser: User) => {
    if (currentUser.role === "super_admin" || currentUser.role === "admin") return true;
    if (targetUser.id === currentUser.id) return true;
    return false;
  };

  const canManageUser = (targetUser: User) => {
    if (currentUser.role === "super_admin") return true;
    if (currentUser.role === "admin" && targetUser.role !== "super_admin") return true;
    return false;
  };

  const toggleDropdown = useCallback(() => {
    setDropdownOpen((prev) => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  const isLoading = loadingId?.id === user.id;

  const roleOptions = isSuperAdmin
    ? allRoleOptions
    : allRoleOptions.filter((r) => r.value !== "super_admin");

  return (
    <tr className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors border-b border-[var(--color-hairline)]">
      {/* 1. User Name & Avatar */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-sm border border-[var(--color-hairline)] shadow-xs">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--color-ink)]">{user.full_name}</div>
            <div className="text-xs text-[var(--color-mute)] truncate font-mono">{user.email}</div>
          </div>
        </div>
      </td>

      {/* 2. Contact Phone & Email */}
      <td className="py-3 px-4">
        {canViewContactInfo(user) ? (
          <div className="flex flex-col gap-1 text-xs">
            {user.phone ? (
              <span className="flex items-center gap-1.5 text-[var(--color-ink)] font-mono font-medium">
                <AnimatedPhone size={14} className="text-emerald-500" />
                {user.phone}
              </span>
            ) : (
              <span className="text-[var(--color-mute)] italic">No Phone</span>
            )}
            <span className="flex items-center gap-1.5 text-[var(--color-mute)] font-mono">
              <AnimatedMail size={14} className="text-blue-500" />
              {user.email}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-mute)] italic">Contact Info Restricted</span>
        )}
      </td>

      {/* 3. Role & Permissions */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {getRoleIcon(user.role)}
          {getRoleBadge(user.role)}
        </div>
      </td>

      {/* 4. Assigned Company Branch & Location */}
      <td className="py-3 px-4">
        {user.branch ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
              <AnimatedBuilding2 size={14} className="text-indigo-500 shrink-0" />
              {user.branch.name}
            </span>
            <span className="text-[11px] text-[var(--color-mute)] font-medium">
              {user.branch.city} ({user.branch.code})
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)]">
            <AnimatedMapPin size={12} className="text-slate-400" />
            HQ / Unassigned
          </span>
        )}
      </td>

      {/* 5. Status Badge */}
      <td className="py-3 px-4">{getStatusBadge(user.status)}</td>

      {/* 6. Created Date */}
      <td suppressHydrationWarning className="py-3 px-4 text-xs font-mono text-[var(--color-mute)]">
        {new Date(user.created_at).toLocaleDateString()}
      </td>

      {/* 7. Actions Menu */}
      <td className="py-3 px-4">
        <div className="flex items-center justify-end relative">
          <TooltipWrapper content="More actions" side="left">
            <Button variant="ghost-sm" onClick={toggleDropdown} aria-label="More actions">
              <AnimatedMoreVertical size={16} />
            </Button>
          </TooltipWrapper>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={closeDropdown} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg shadow-xl py-1 min-w-[190px] text-[var(--color-ink)]">
                {canManageUser(user) ? (
                  <>
                    <button
                      onClick={() => {
                        onResetPassword(user.id);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                      disabled={isLoading}
                    >
                      <AnimatedKey size={16} className="text-amber-500" />
                      Reset Password
                    </button>
                    <button
                      onClick={() => {
                        onToggleStatus(user.id);
                        closeDropdown();
                      }}
                      className={`flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold hover:bg-[var(--color-hairline-soft-surface)] transition-colors ${
                        user.status === "active"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                      disabled={isLoading || user.id === currentUser.id}
                    >
                      <AnimatedPower size={16} />
                      {user.status === "active" ? "Deactivate User" : "Activate User"}
                    </button>
                    <button
                      onClick={() => {
                        onEdit(user);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                      disabled={isLoading}
                    >
                      <AnimatedUser size={16} className="text-[var(--color-link)]" />
                      Edit User & Branch
                    </button>
                    
                    <div className="border-t border-[var(--color-hairline)] my-1" />
                    <div className="px-4 py-2">
                      <label className="text-[11px] font-bold text-[var(--color-mute)] block mb-1 uppercase tracking-wider">
                        Change Access Role
                      </label>
                      <Select
                        value={user.role}
                        options={roleOptions}
                        onChange={(e) => {
                          onUpdateRole(user.id, e.target.value as UserRole);
                          closeDropdown();
                        }}
                        disabled={isLoading || user.id === currentUser.id}
                        className="text-xs font-semibold w-full"
                      />
                    </div>

                    <div className="border-t border-[var(--color-hairline)] my-1" />
                    <button
                      onClick={() => {
                        onDelete(user.id);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      disabled={isLoading || user.id === currentUser.id}
                    >
                      <AnimatedTrash2 size={16} />
                      Delete User
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-2 text-xs text-[var(--color-mute)] text-center">
                    No actions available
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});
