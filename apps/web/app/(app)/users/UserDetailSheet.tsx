"use client";

import {
  AnimatedX,
  AnimatedBuilding2,
  AnimatedKey,
  AnimatedEdit,
  AnimatedTrash2,
  AnimatedMail,
  AnimatedPhone,
  AnimatedUserCheck,
  AnimatedUserX,
  AnimatedCalendarClock,
} from "@/components/ui/animated-icons";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, Badge, Select, Dialog, DialogContent } from "@/components/ui";
import type { User, UserRole } from "@/lib/types/database";

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "service_manager", label: "Service Manager" },
  { value: "service_engineer", label: "Service Engineer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "store_manager", label: "Store Manager" },
  { value: "operator", label: "Operator" },
  { value: "mechanic", label: "Mechanic" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "sales_executive", label: "Sales Executive" },
  { value: "rental_manager", label: "Rental Manager" },
];

interface UserDetailSheetProps {
  user: User | null;
  currentUser: User;
  isSuperAdmin: boolean;
  loadingId: { type: string; id: string } | null;
  onClose: () => void;
  onResetPassword: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
  onEdit: (user: User) => void;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onDelete: (userId: string) => void;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300/80 dark:border-red-800/80 shadow-xs">
          <ShieldAlert className="h-3 w-3 text-red-600 dark:text-red-400" />
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-xs">
          <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          Admin
        </span>
      );
    case "branch_manager":
      return <Badge variant="default">Branch Manager</Badge>;
    case "service_manager":
      return <Badge variant="default">Service Manager</Badge>;
    case "service_engineer":
    case "engineer":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800/80 shadow-xs">
          <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          Service Engineer
        </span>
      );
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
      return <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />;
    case "admin":
      return <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    case "service_manager":
    case "branch_manager":
      return <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
    case "service_engineer":
    case "engineer":
      return <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    default:
      return <Shield className="h-5 w-5 text-[var(--color-mute)]" />;
  }
}

export function UserDetailSheet({
  user,
  currentUser,
  isSuperAdmin,
  loadingId,
  onClose,
  onResetPassword,
  onToggleStatus,
  onEdit,
  onUpdateRole,
  onDelete,
}: UserDetailSheetProps) {
  const isLoading = user ? loadingId?.id === user.id : false;

  const canViewContactInfo = () => {
    if (!user) return false;
    if (currentUser.role === "super_admin") return true;
    if (currentUser.role === "admin") {
      if (user.role === "engineer") return true;
      if (user.id === currentUser.id) return true;
      return false;
    }
    if (user.id === currentUser.id) return true;
    return false;
  };

  const canManageUser = () => {
    if (!user) return false;
    if (currentUser.role === "super_admin") return true;
    if (currentUser.role === "admin" && user.role === "engineer") return true;
    return false;
  };

  const showContact = canViewContactInfo();
  const showManage = canManageUser();

  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) onClose(); }}>
      {user && (
        <DialogContent
          from="bottom"
          showCloseButton={false}
          className="max-w-lg bg-[var(--color-canvas-elevated)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--color-hairline)] shadow-2xl overflow-hidden max-h-[85vh] p-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold text-lg shadow-sm">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink)] leading-snug">
                  {user.full_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {getRoleBadge(user.role)}
                  {user.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs capitalize">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {user.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
            >
              <AnimatedX size={18} />
            </button>
          </div>

          {/* Scrollable Sheet Content */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Quick Contact Buttons */}
            {showContact && (
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`mailto:${user.email}`}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98 transition-all"
                >
                  <AnimatedMail size={16} className="text-[var(--color-link)]" />
                  Email User
                </a>
                {user.phone ? (
                  <a
                    href={`tel:${user.phone}`}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98 transition-all"
                  >
                    <AnimatedPhone size={16} className="text-[var(--color-success)]" />
                    Call Phone
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-mute)] opacity-60">
                    <AnimatedPhone size={16} /> No Phone
                  </div>
                )}
              </div>
            )}

            {/* Profile Info Summary Box */}
            <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5 text-xs text-[var(--color-body)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-mute)] font-medium flex items-center gap-1">
                  <AnimatedBuilding2 size={14} className="text-indigo-500" /> Assigned Branch Location
                </span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {user.branch ? `${user.branch.name} (${user.branch.city})` : "HQ / Global"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-mute)] font-medium">Email Address</span>
                <span className="font-semibold text-[var(--color-ink)]">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-mute)] font-medium">Phone Number</span>
                  <span className="font-semibold text-[var(--color-ink)]">{user.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-mute)] font-medium flex items-center gap-1">
                  <AnimatedCalendarClock size={14} className="text-[var(--color-mute)]" /> Registered Date
                </span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Admin Management Section */}
            {showManage && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  Management Actions
                </h4>

                {/* Change Role Selector (Super Admin) */}
                {isSuperAdmin && user.id !== currentUser.id && (
                  <div className="p-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
                    <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                      {getRoleIcon(user.role)}
                      User Permission Role
                    </label>
                    <Select
                      value={user.role}
                      options={roleOptions}
                      onChange={(e) => {
                        onUpdateRole(user.id, e.target.value as UserRole);
                      }}
                      disabled={isLoading}
                      className="w-full text-xs font-medium"
                    />
                  </div>
                )}

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      onEdit(user);
                      onClose();
                    }}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <AnimatedEdit size={16} className="text-[var(--color-link)]" /> Edit Account Info
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onResetPassword(user.id);
                      onClose();
                    }}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <AnimatedKey size={16} className="text-amber-500" /> Reset Security Password
                    </span>
                  </button>

                  {user.id !== currentUser.id && (
                    <button
                      onClick={() => {
                        onToggleStatus(user.id);
                        onClose();
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-98 transition-all"
                    >
                      <span className="flex items-center gap-2">
                        {user.status === "active" ? (
                          <>
                            <AnimatedUserX size={16} className="text-amber-600" /> Deactivate Account
                          </>
                        ) : (
                          <>
                            <AnimatedUserCheck size={16} className="text-emerald-600" /> Activate Account
                          </>
                        )}
                      </span>
                    </button>
                  )}

                  {user.id !== currentUser.id && (
                    <button
                      onClick={() => {
                        onDelete(user.id);
                        onClose();
                      }}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border border-red-200 dark:border-red-900/40 bg-red-50/30 text-xs font-semibold text-red-600 hover:bg-red-50 active:scale-98 transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <AnimatedTrash2 size={16} className="text-red-600" /> Delete User Account
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <Button variant="secondary" onClick={onClose} className="w-full justify-center">
              Close Sheet
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
