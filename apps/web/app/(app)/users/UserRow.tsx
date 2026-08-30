"use client";

import { memo, useState, useCallback } from "react";
import {
  AnimatedKey,
  AnimatedUser,
  AnimatedTrash2,
  AnimatedMoreVertical,
  AnimatedPower,
} from "@/components/ui/animated-icons";
import { Button, Select, TooltipWrapper } from "@/components/ui";
import { formatDate } from "@reachinternational/utils";
import type { User, UserRole } from "@/lib/types/database";

const allRoleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "service_engineer", label: "Service Engineer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "store_manager", label: "Store Manager" },
  { value: "operator", label: "Operator" },
  { value: "mechanic", label: "Mechanic / Tech" },
  { value: "hr_manager", label: "HR Manager" },
];

interface UserRowProps {
  user: User;
  currentUser: User;
  isSuperAdmin: boolean;
  loadingId: { type: string; id: string } | null;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (userId: string) => void;
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          Active
        </span>
      );
    case "inactive":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          Inactive
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
          {status}
        </span>
      );
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          Admin
        </span>
      );
    case "manager":
    case "branch_manager":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
          Manager
        </span>
      );
    case "service_manager":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
          Service Manager
        </span>
      );
    case "service_engineer":
    case "engineer":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          Service Engineer
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
          Supervisor
        </span>
      );
    case "store_manager":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
          Store Manager
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          Operator
        </span>
      );
    case "mechanic":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
          Mechanic
        </span>
      );
    case "hr_manager":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          HR Manager
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground border border-border">
          {role}
        </span>
      );
  }
}

export const UserRow = memo(function UserRow({
  user,
  currentUser,
  isSuperAdmin,
  loadingId,
  selectable = false,
  isSelected = false,
  onToggleSelect,
  onResetPassword,
  onToggleStatus,
  onEdit,
  onUpdateRole,
  onDelete,
}: UserRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);

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

  const toggleDropdown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!dropdownOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 250);
    }
    setDropdownOpen((prev) => !prev);
  }, [dropdownOpen]);

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  const isLoading = loadingId?.id === user.id;

  const roleOptions = isSuperAdmin
    ? allRoleOptions
    : allRoleOptions.filter((r) => r.value !== "super_admin");

  return (
    <tr
      className={`transition-colors border-b border-[var(--color-hairline)] last:border-0 ${
        isSelected
          ? "bg-[var(--color-link-soft)]/25 dark:bg-[var(--color-link)]/15"
          : "hover:bg-[var(--color-hairline-soft-surface)]"
      }`}
    >
      {/* 0. Selection Checkbox */}
      {selectable && (
        <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect && onToggleSelect(user.id)}
            aria-label={`Select ${user.full_name}`}
            className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
          />
        </td>
      )}

      {/* 1. User Name */}
      <td className="py-3 px-4">
        <div className="text-sm font-semibold text-[var(--color-ink)] truncate" title={user.full_name}>
          {user.full_name}
        </div>
      </td>

      {/* 2. Contact Phone & Email */}
      <td className="py-3 px-4">
        {canViewContactInfo(user) ? (
          <div className="flex flex-col gap-0.5 text-xs">
            {user.phone ? (
              <span className="text-[var(--color-ink)] font-mono font-medium whitespace-nowrap">
                {user.phone}
              </span>
            ) : (
              <span className="text-[var(--color-mute)] italic">No Phone</span>
            )}
            <span className="text-[var(--color-mute)] truncate max-w-[220px]" title={user.email}>
              {user.email}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-mute)] italic">Contact Info Restricted</span>
        )}
      </td>

      {/* 3. Role & Permissions */}
      <td className="py-3 px-4 whitespace-nowrap">
        {getRoleBadge(user.role)}
      </td>

      {/* 4. Employee City */}
      <td className="py-3 px-4">
        {user.city || user.location ? (
          <span className="text-xs font-medium text-[var(--color-ink)] truncate block max-w-[160px]" title={(user.city || user.location) ?? undefined}>
            {user.city || user.location}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-mute)] font-normal">—</span>
        )}
      </td>

      {/* 5. Status Badge */}
      <td className="py-3 px-4 whitespace-nowrap">
        {getStatusBadge(user.status)}
      </td>

      {/* 6. Created Date */}
      <td suppressHydrationWarning className="py-3 px-4 text-xs font-mono text-[var(--color-mute)] whitespace-nowrap">
        {formatDate(user.created_at)}
      </td>

      {/* 7. Actions Menu */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end relative">
          <TooltipWrapper content="More actions" side="left">
            <Button
              variant="ghost-sm"
              onClick={toggleDropdown}
              aria-label="More actions"
              className="h-8 w-8 p-0 flex items-center justify-center rounded-sm hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer active:scale-[0.98] transition-all"
            >
              <AnimatedMoreVertical size={16} />
            </Button>
          </TooltipWrapper>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={closeDropdown} />
              <div className={`absolute right-0 ${openUpwards ? "bottom-full mb-1" : "top-full mt-1"} z-20 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-md shadow-lg p-1 min-w-[200px] text-left text-[var(--color-ink)]`}>
                {canManageUser(user) ? (
                  <>
                    <button
                      onClick={() => {
                        onResetPassword(user.id);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer text-left"
                      disabled={isLoading}
                    >
                      <AnimatedKey size={14} className="text-amber-500 shrink-0" />
                      <span>Reset Password</span>
                    </button>
                    <button
                      onClick={() => {
                        onToggleStatus(user.id);
                        closeDropdown();
                      }}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer text-left ${
                        user.status === "active"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                      disabled={isLoading || user.id === currentUser.id}
                    >
                      <AnimatedPower size={14} className="shrink-0" />
                      <span>{user.status === "active" ? "Deactivate User" : "Activate User"}</span>
                    </button>
                    <button
                      onClick={() => {
                        onEdit(user);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer text-left"
                      disabled={isLoading}
                    >
                      <AnimatedUser size={14} className="text-[var(--color-link)] shrink-0" />
                      <span>Edit User Account</span>
                    </button>
                    
                    <div className="border-t border-[var(--color-hairline)] my-1" />
                    <div className="px-3 py-1.5">
                      <label className="text-[10px] font-mono font-bold text-[var(--color-mute)] block mb-1 uppercase tracking-wider">
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
                        className="text-xs font-medium w-full h-8"
                      />
                    </div>

                    <div className="border-t border-[var(--color-hairline)] my-1" />
                    <button
                      onClick={() => {
                        onDelete(user.id);
                        closeDropdown();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                      disabled={isLoading || user.id === currentUser.id}
                    >
                      <AnimatedTrash2 size={14} className="text-rose-600 shrink-0" />
                      <span>Delete User</span>
                    </button>
                  </>
                ) : (
                  <div className="px-3 py-2 text-xs text-[var(--color-mute)] text-center">
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
