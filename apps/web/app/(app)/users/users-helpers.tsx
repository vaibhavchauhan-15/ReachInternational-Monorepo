import React from "react";

export interface FilterOption {
  id: string;
  label: string;
  activeColor?: string;
  dotColor?: string;
}

export interface UserListAggregates {
  total: number;
  active: number;
  operators: number;
  engineers?: number;
  new_registrations: number;
  totalUsers?: number;
  activeUsers?: number;
  operatorCount?: number;
  engineerCount?: number;
  states: Array<{ id: string; label: string }>;
}

export function getPendingRoleBadge(role: string): React.ReactNode {
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
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-xs whitespace-nowrap">
          Manager
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 shadow-xs whitespace-nowrap">
          Supervisor
        </span>
      );
    case "hr":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs whitespace-nowrap">
          HR
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          Operator
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

export function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getRoleAvatarStyle(role: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "from-amber-500/20 to-amber-600/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50";
    case "manager":
      return "from-indigo-500/20 to-indigo-600/10 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/50";
    case "supervisor":
      return "from-teal-500/20 to-teal-600/10 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700/50";
    case "hr":
      return "from-emerald-500/20 to-emerald-600/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50";
    case "operator":
    default:
      return "from-amber-500/15 to-orange-500/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50";
  }
}

export const ROLE_OPTIONS: FilterOption[] = [
  { id: "all", label: "All Roles", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "super_admin", label: "Super Admins", activeColor: "text-red-700 dark:text-red-400 font-semibold", dotColor: "bg-red-500" },
  { id: "admin", label: "Admins", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
  { id: "manager", label: "Managers", activeColor: "text-indigo-700 dark:text-indigo-400 font-semibold", dotColor: "bg-indigo-500" },
  { id: "supervisor", label: "Supervisors", activeColor: "text-teal-700 dark:text-teal-400 font-semibold", dotColor: "bg-teal-500" },
  { id: "hr", label: "HR", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "operator", label: "Operators", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
];

export const SUPERVISOR_ROLE_OPTIONS: FilterOption[] = [
  { id: "all", label: "All Assigned Roles", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "operator", label: "Operators", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { id: "all", label: "All Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "inactive", label: "Inactive", activeColor: "text-slate-600 dark:text-slate-400 font-semibold", dotColor: "bg-slate-400 dark:bg-slate-500" },
  { id: "pending", label: "Pending", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
];

export const KYC_OPTIONS: FilterOption[] = [
  { id: "all", label: "All KYC Status", dotColor: "" },
  { id: "fully_verified", label: "Fully Verified (Aadhaar + DL)", dotColor: "bg-emerald-500" },
  { id: "aadhaar_only", label: "Aadhaar Provided", dotColor: "bg-sky-500" },
  { id: "license_only", label: "Driving Licence Provided", dotColor: "bg-blue-500" },
  { id: "pending_kyc", label: "Pending KYC (Missing Docs)", dotColor: "bg-amber-500" },
];

export const DATE_RANGE_OPTIONS: FilterOption[] = [
  { id: "all", label: "All Time", dotColor: "" },
  { id: "today", label: "Today", dotColor: "bg-emerald-500" },
  { id: "7days", label: "Last 7 Days", dotColor: "bg-sky-500" },
  { id: "30days", label: "Last 30 Days", dotColor: "bg-indigo-500" },
  { id: "90days", label: "Last 90 Days", dotColor: "bg-purple-500" },
  { id: "this_year", label: "This Year", dotColor: "bg-teal-500" },
];

export const SORT_OPTIONS: FilterOption[] = [
  { id: "newest", label: "Newest Joined", dotColor: "" },
  { id: "oldest", label: "Oldest Joined", dotColor: "" },
  { id: "name_asc", label: "Name (A → Z)", dotColor: "" },
  { id: "name_desc", label: "Name (Z → A)", dotColor: "" },
  { id: "role_asc", label: "Role (A → Z)", dotColor: "" },
];
