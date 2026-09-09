"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AnimatedKey,
  AnimatedUser,
  AnimatedMapPin,
  AnimatedTrash2,
  AnimatedMoreVertical,
  AnimatedPower,
} from "@/components/ui/animated-icons";
import { Button, Select, TooltipWrapper } from "@/components/ui";
import { formatDate } from "@reachinternational/utils";
import { isSupervisedRole } from "@reachinternational/permissions";
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
  supervisors?: Array<{ value: string; label: string; description?: string }>;
  onToggleSelect?: (userId: string) => void;
  onViewDetails?: (user: User) => void;
  onResetPassword: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
  onEdit: (user: User) => void;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onUpdateSupervisor?: (userId: string, supervisorIds: string[] | string | null) => void;
  onDelete: (userId: string) => void;
}

function truncateText(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
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
  supervisors = [],
  onToggleSelect,
  onViewDetails,
  onResetPassword,
  onToggleStatus,
  onEdit,
  onUpdateRole,
  onUpdateSupervisor,
  onDelete,
}: UserRowProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 280,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 230;
    const estimatedMenuHeight = isSupervisedRole(user.role) ? 270 : 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Dynamically decide to open upwards if space below is too small and above has more room
    const shouldOpenUpwards = spaceBelow < estimatedMenuHeight + 16 && spaceAbove > spaceBelow;

    let left = rect.right - menuWidth;
    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }

    let top = 0;
    let maxHeight = 280;

    if (shouldOpenUpwards) {
      maxHeight = Math.max(120, Math.min(spaceAbove - 16, 380));
      top = Math.max(12, rect.top - maxHeight - 4);
    } else {
      maxHeight = Math.max(120, Math.min(spaceBelow - 16, 380));
      top = rect.bottom + 4;
    }

    setCoords({ top, left, maxHeight });
  }, [user.role]);

  const toggleDropdown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!dropdownOpen) {
        updatePosition();
      }
      setDropdownOpen((prev) => !prev);
    },
    [dropdownOpen, updatePosition]
  );

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen, updatePosition]);

  const isLoading = loadingId?.id === user.id;

  const roleOptions = isSuperAdmin
    ? allRoleOptions
    : allRoleOptions.filter((r) => r.value !== "super_admin");

  const assignedSupervisors = user.supervisors && user.supervisors.length > 0
    ? user.supervisors
    : user.supervisor
    ? [user.supervisor]
    : [];

  return (
    <tr
      onClick={() => {
        if (onViewDetails) {
          onViewDetails(user);
        }
      }}
      className={`transition-colors border-b border-[var(--color-hairline)] last:border-0 cursor-pointer group ${
        isSelected
          ? "bg-[var(--color-link-soft)]/25 dark:bg-[var(--color-link)]/15"
          : "hover:bg-[var(--color-hairline-soft-surface)]"
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (onViewDetails) {
            onViewDetails(user);
          }
        }
      }}
      aria-label={`View details for ${user.full_name}`}
    >
      {/* 0. Selection Checkbox */}
      {selectable && (
        <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect && onToggleSelect(user.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${user.full_name}`}
            className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
          />
        </td>
      )}

      {/* 1. User Name */}
      <td className="py-3 px-4">
        <span
          className="text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-link)] transition-colors block max-w-full"
          title={user.full_name}
        >
          {truncateText(user.full_name, 15)}
        </span>
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
            <span className="text-[var(--color-mute)] block max-w-[220px]" title={user.email}>
              {truncateText(user.email, 20)}
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

      {/* 4. Supervisor (Badges/Chips for all assigned supervisors) */}
      <td className="py-3 px-4">
        {isSupervisedRole(user.role) ? (
          assignedSupervisors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
              {assignedSupervisors.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)] shadow-2xs"
                  title={`Supervisor: ${s.full_name}${s.email ? ` (${s.email})` : ""}`}
                >
                  <AnimatedUser size={12} className="text-[var(--color-link)] shrink-0 opacity-80" />
                  <span className="truncate max-w-[120px]">{truncateText(s.full_name, 15)}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[var(--color-mute)] font-mono">Unassigned</span>
          )
        ) : (
          <span className="text-xs text-[var(--color-mute)] font-normal">—</span>
        )}
      </td>

      {/* 5. Working Location / Operating Base */}
      <td className="py-3 px-4">
        {user.working_location?.name ? (
          <div className="flex items-center gap-1.5 min-w-0" title={`Working Base: ${user.working_location.name}${user.working_location.city ? ` (${user.working_location.city})` : ""}`}>
            <AnimatedMapPin size={13} className="text-[var(--color-link)] shrink-0 opacity-70" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[var(--color-ink)] truncate max-w-[150px]">
                {user.working_location.name}
              </span>
              {user.working_location.city && (
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-[150px]">
                  {user.working_location.city}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-mute)] font-normal">—</span>
        )}
      </td>

      {/* 5. Employee City */}
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
      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end relative">
          <TooltipWrapper content="More actions" side="left">
            <Button
              ref={triggerRef}
              variant="ghost-sm"
              onClick={toggleDropdown}
              aria-label="More actions"
              className="h-8 w-8 p-0 flex items-center justify-center rounded-sm hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] cursor-pointer active:scale-[0.98] transition-all"
            >
              <AnimatedMoreVertical size={16} />
            </Button>
          </TooltipWrapper>

          {mounted &&
            dropdownOpen &&
            createPortal(
              <div className="fixed inset-0 z-50 pointer-events-none">
                <div
                  className="fixed inset-0 pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDropdown();
                  }}
                />
                <div
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "fixed",
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    width: "230px",
                    maxHeight: `${coords.maxHeight}px`,
                  }}
                  className="pointer-events-auto z-50 overflow-y-auto bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-md shadow-xl p-1 text-left text-[var(--color-ink)] animate-in fade-in zoom-in-95 duration-100"
                >
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
                      <div className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
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

                      {/* Supervisor Selector for Supervised Roles */}
                      {isSupervisedRole(user.role) && (
                        <>
                          <div className="border-t border-[var(--color-hairline)] my-1" />
                          <div className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] font-mono font-bold text-[var(--color-mute)] block mb-1 uppercase tracking-wider">
                              Assign Supervisor
                            </label>
                            <Select
                              value={user.supervisor_id || (user.supervisor_ids && user.supervisor_ids[0]) || ""}
                              options={[
                                { value: "", label: "No Supervisor" },
                                ...supervisors.map((s) => ({
                                  value: s.value,
                                  label: s.label,
                                })),
                              ]}
                              onChange={(e) => {
                                const val = e.target.value;
                                onUpdateSupervisor?.(user.id, val ? [val] : []);
                                closeDropdown();
                              }}
                              disabled={isLoading}
                              className="text-xs font-medium w-full h-8"
                            />
                          </div>
                        </>
                      )}

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
              </div>,
              document.body
            )}
        </div>
      </td>
    </tr>
  );
});
