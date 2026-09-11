"use client";

import { useState, useCallback, useMemo, useDeferredValue, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedShieldAlert,
  AnimatedUserPlus,
  AnimatedCopy,
  AnimatedUsers,
  AnimatedShieldCheck,
  AnimatedUserCheck,
  AnimatedSearch,
  AnimatedX,
  AnimatedSlidersHorizontal,
  AnimatedFileText,
  AnimatedTrash2,
  AnimatedChevronDown,
} from "@/components/ui/animated-icons";
import { LayoutGrid, Table as TableIcon, Check, X, Plus, Copy, Download, FileSpreadsheet, FileText, Trash2, Mail, Phone, MapPin, Clock, RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  Badge,
  Modal,
  useToast,
  PageHeader,
  ConfirmationDialog,
  FilterToolbar,
  TooltipWrapper,
} from "@/components/ui";
import { Pagination } from "@/components/ui/Table";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/Motion";
import { exportUsersFilteredAction } from "@/app/actions/users";
import {
  approveUser,
  rejectUser,
  createUser,
  resetUserPassword,
  toggleUserStatus,
  updateUserRole,
  updateUserSupervisor,
  deleteUser,
  bulkDeleteUsers,
  bulkApproveUsers,
  bulkRejectUsers,
  editUser,
  getPaginatedUsersAction,
} from "@/app/actions/users";
import { getSupervisorsAction, getWorkingLocationsAction } from "@/app/actions/auth";
import {
  approveProfileChangeRequest,
  rejectProfileChangeRequest,
  bulkApproveProfileChangeRequests,
  bulkRejectProfileChangeRequests,
} from "@/app/actions/profile";
import {
  approveAccountDeletionRequestAction,
  rejectAccountDeletionRequestAction,
} from "@/app/actions/account-deletion";
import { formatDateTime, formatTimeAgo, formatTinyRelativeTime } from "@reachinternational/utils";
import { UserRow } from "./UserRow";
import { MobileUserCard } from "./MobileUserCard";
import dynamic from "next/dynamic";
import type { User, UserRole, ProfileChangeRequest, AccountDeletionRequest } from "@/lib/types/database";

const UserCreateModal = dynamic(() => import("./UserCreateModal").then(mod => mod.UserCreateModal), { ssr: false });
const UserEditModal = dynamic(() => import("./UserEditModal").then(mod => mod.UserEditModal), { ssr: false });
const UserDetailSheet = dynamic(() => import("./UserDetailSheet").then(mod => mod.UserDetailSheet), { ssr: false });
const ProfileChangeRequestsSection = dynamic(() => import("./ProfileChangeRequestsSection").then(mod => mod.ProfileChangeRequestsSection), { ssr: false });
const AccountDeletionRequestsSection = dynamic(() => import("./AccountDeletionRequestsSection").then(mod => mod.AccountDeletionRequestsSection), { ssr: false });

function getPendingRoleBadge(role: string) {
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

function getRoleAvatarStyle(role: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "from-amber-500/20 to-amber-600/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50";
    case "manager":
    case "branch_manager":
      return "from-indigo-500/20 to-indigo-600/10 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/50";
    case "service_manager":
      return "from-sky-500/20 to-sky-600/10 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700/50";
    case "service_engineer":
    case "engineer":
      return "from-blue-500/20 to-blue-600/10 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/50";
    case "supervisor":
      return "from-teal-500/20 to-teal-600/10 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700/50";
    case "store_manager":
      return "from-purple-500/20 to-purple-600/10 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700/50";
    case "mechanic":
      return "from-orange-500/20 to-orange-600/10 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700/50";
    case "hr_manager":
      return "from-emerald-500/20 to-emerald-600/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50";
    case "operator":
    default:
      return "from-amber-500/15 to-orange-500/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50";
  }
}

const ROLE_OPTIONS = [
  { id: "all", label: "All Roles", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "service_engineer", label: "Engineers", activeColor: "text-blue-700 dark:text-blue-400 font-semibold", dotColor: "bg-blue-500" },
  { id: "service_manager", label: "Service Managers", activeColor: "text-sky-700 dark:text-sky-400 font-semibold", dotColor: "bg-sky-500" },
  { id: "manager", label: "Managers", activeColor: "text-indigo-700 dark:text-indigo-400 font-semibold", dotColor: "bg-indigo-500" },
  { id: "supervisor", label: "Supervisors", activeColor: "text-teal-700 dark:text-teal-400 font-semibold", dotColor: "bg-teal-500" },
  { id: "operator", label: "Operators", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
  { id: "mechanic", label: "Mechanics", activeColor: "text-orange-700 dark:text-orange-400 font-semibold", dotColor: "bg-orange-500" },
  { id: "store_manager", label: "Store Managers", activeColor: "text-purple-700 dark:text-purple-400 font-semibold", dotColor: "bg-purple-500" },
  { id: "hr_manager", label: "HR Managers", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "admin", label: "Admins", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
  { id: "super_admin", label: "Super Admins", activeColor: "text-red-700 dark:text-red-400 font-semibold", dotColor: "bg-red-500" },
];

const SUPERVISOR_ROLE_OPTIONS = [
  { id: "all", label: "All Assigned Roles", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "operator", label: "Operators", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
  { id: "mechanic", label: "Mechanics", activeColor: "text-orange-700 dark:text-orange-400 font-semibold", dotColor: "bg-orange-500" },
  { id: "service_engineer", label: "Engineers", activeColor: "text-blue-700 dark:text-blue-400 font-semibold", dotColor: "bg-blue-500" },
];

const STATUS_OPTIONS = [
  { id: "all", label: "All Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "inactive", label: "Inactive", activeColor: "text-slate-600 dark:text-slate-400 font-semibold", dotColor: "bg-slate-400 dark:bg-slate-500" },
  { id: "pending", label: "Pending", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
];

const KYC_OPTIONS = [
  { id: "all", label: "All KYC Status", dotColor: "" },
  { id: "fully_verified", label: "Fully Verified (Aadhaar + DL)", dotColor: "bg-emerald-500" },
  { id: "aadhaar_only", label: "Aadhaar Provided", dotColor: "bg-sky-500" },
  { id: "license_only", label: "Driving Licence Provided", dotColor: "bg-blue-500" },
  { id: "pending_kyc", label: "Pending KYC (Missing Docs)", dotColor: "bg-amber-500" },
];

const DATE_RANGE_OPTIONS = [
  { id: "all", label: "All Time", dotColor: "" },
  { id: "today", label: "Today", dotColor: "bg-emerald-500" },
  { id: "7days", label: "Last 7 Days", dotColor: "bg-sky-500" },
  { id: "30days", label: "Last 30 Days", dotColor: "bg-indigo-500" },
  { id: "90days", label: "Last 90 Days", dotColor: "bg-purple-500" },
  { id: "this_year", label: "This Year", dotColor: "bg-teal-500" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest Joined", dotColor: "" },
  { id: "oldest", label: "Oldest Joined", dotColor: "" },
  { id: "name_asc", label: "Name (A → Z)", dotColor: "" },
  { id: "name_desc", label: "Name (Z → A)", dotColor: "" },
  { id: "role_asc", label: "Role (A → Z)", dotColor: "" },
];

interface FilterOption {
  id: string;
  label: string;
  activeColor?: string;
  dotColor?: string;
}

interface CustomFilterSelectorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  align?: "left" | "right";
  className?: string;
}

function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
}: CustomFilterSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open]);

  const selectedOpt = options.find((o) => o.id === value) || options[0];

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${open ? "z-40" : "z-10"} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`w-full h-11 sm:h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-xs select-none ${
          open || value !== "all"
            ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/15 text-[var(--color-ink)]"
            : "bg-[var(--color-canvas)] border-[var(--color-hairline)] text-[var(--color-ink)] hover:border-[var(--color-ink)]/40"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {selectedOpt?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selectedOpt.dotColor}`} />
          )}
          <span className="text-[10px] font-mono text-[var(--color-mute)] uppercase shrink-0">
            {label}:
          </span>
          <span className="truncate font-semibold text-xs text-[var(--color-ink)]">
            {selectedOpt?.label}
          </span>
        </div>
        <AnimatedChevronDown
          size={13}
          className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--color-ink)]" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            aria-label={ariaLabel}
            className={`absolute top-full mt-1.5 z-50 min-w-full max-h-60 overflow-y-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl pointer-events-auto ${
              align === "right"
                ? "right-0 left-auto sm:left-0 sm:right-auto sm:min-w-[200px]"
                : "left-0 right-auto sm:left-0 sm:min-w-[220px]"
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full min-h-[44px] sm:min-h-[36px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)] font-semibold shadow-xs"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isSelected ? "bg-white" : opt.dotColor
                        }`}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
 
function TableSkeletonRows({ readOnly }: { readOnly?: boolean }) {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <tr key={i} className="animate-pulse border-b border-[var(--color-hairline)]/60">
          {!readOnly && (
            <td className="py-3.5 px-3 text-center">
              <div className="h-4 w-4 rounded bg-[var(--color-hairline)]/70 mx-auto" />
            </td>
          )}
          {/* Name */}
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[var(--color-hairline)]/80 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-3.5 w-24 bg-[var(--color-hairline)] rounded" />
                <div className="h-2.5 w-16 bg-[var(--color-hairline)]/60 rounded" />
              </div>
            </div>
          </td>
          {/* Contact */}
          <td className="py-3.5 px-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-[var(--color-hairline)]/80 rounded" />
              <div className="h-2.5 w-36 bg-[var(--color-hairline)]/60 rounded" />
            </div>
          </td>
          {/* Role */}
          <td className="py-3.5 px-4">
            <div className="h-5 w-20 rounded-full bg-[var(--color-hairline)]/70" />
          </td>
          {/* Supervisor */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-20 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Location */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-24 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* City */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-16 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Status */}
          <td className="py-3.5 px-4">
            <div className="h-5 w-16 rounded-md bg-[var(--color-hairline)]/70" />
          </td>
          {/* Joined Date */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-20 bg-[var(--color-hairline)]/70 rounded" />
          </td>
          {/* Actions */}
          <td className="py-3.5 px-3 text-right">
            <div className="h-7 w-7 rounded bg-[var(--color-hairline)]/60 ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

function MobileCardSkeletonList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs animate-pulse flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-hairline)] shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-24 bg-[var(--color-hairline)] rounded" />
                <div className="h-2.5 w-16 bg-[var(--color-hairline)]/60 rounded" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)]" />
          </div>
          <div className="space-y-2 pt-1 border-t border-[var(--color-hairline)]/60">
            <div className="h-3 w-36 bg-[var(--color-hairline)]/70 rounded" />
            <div className="h-3 w-28 bg-[var(--color-hairline)]/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface UserListAggregates {
  totalUsers: number;
  activeUsers: number;
  engineerCount: number;
  states: Array<{ id: string; label: string }>;
}

interface UsersPageClientProps {
  users: User[];
  pendingUsers: User[];
  profileChangeRequests?: ProfileChangeRequest[];
  accountDeletionRequests?: AccountDeletionRequest[];
  currentUser: User;
  isSuperAdmin: boolean;
  totalPages: number;
  totalCount: number;
  currentPage: number;
  aggregates?: UserListAggregates;
  readOnly?: boolean;
}

export function UsersPageClient({
  users,
  pendingUsers,
  profileChangeRequests = [],
  accountDeletionRequests = [],
  currentUser,
  isSuperAdmin,
  totalPages,
  totalCount,
  currentPage,
  aggregates,
  readOnly = false,
}: UsersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Optimistic local state synchronized with server props
  const [usersList, setUsersList] = useState<User[]>(users);
  const [pendingUsersList, setPendingUsersList] = useState<User[]>(pendingUsers);
  const [profileRequestsList, setProfileRequestsList] = useState<ProfileChangeRequest[]>(profileChangeRequests);
  const [deletionRequestsList, setDeletionRequestsList] = useState<AccountDeletionRequest[]>(accountDeletionRequests);

  useEffect(() => {
    setUsersList(users);
  }, [users]);

  useEffect(() => {
    setPendingUsersList(pendingUsers);
  }, [pendingUsers]);

  useEffect(() => {
    setProfileRequestsList(profileChangeRequests);
  }, [profileChangeRequests]);

  useEffect(() => {
    setDeletionRequestsList(accountDeletionRequests);
  }, [accountDeletionRequests]);

  const [loading, setLoading] = useState<{ type: "approve" | "reject" | "create" | "reset" | "toggle" | "role" | "supervisor" | "delete" | "edit"; id: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState<{ type: "approve" | "reject"; id: string } | null>(null);
  const [deletionLoading, setDeletionLoading] = useState<{ type: "approve" | "reject"; id: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentRoleOptions = readOnly ? SUPERVISOR_ROLE_OPTIONS : ROLE_OPTIONS;

  useEffect(() => {
    if (!readOnly && searchParams?.get("action") === "create") {
      setShowCreateModal(true);
    }
  }, [searchParams, readOnly]);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedSheetUser, setSelectedSheetUser] = useState<User | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<{
    userId: string;
    userName: string;
    password: string;
  } | null>(null);

  // Supervisor state for assignment
  const [availableSupervisors, setAvailableSupervisors] = useState<Array<{ value: string; label: string; description?: string }>>([]);
  const [availableWorkingLocations, setAvailableWorkingLocations] = useState<Array<{ value: string; label: string; description?: string }>>([]);

  // Hydrate supervisors & working locations only for users who can manage accounts.
  // Read-only viewers (e.g. supervisors) skip these — saves 2 server-action round-trips per page load (critical on mobile networks).
  useEffect(() => {
    if (readOnly) return;

    getSupervisorsAction().then((res) => {
      if (Array.isArray(res)) {
        setAvailableSupervisors(res);
      }
    }).catch(() => {});

    getWorkingLocationsAction().then((res) => {
      if (Array.isArray(res)) {
        setAvailableWorkingLocations(res);
      }
    }).catch(() => {});
  }, [readOnly]);

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    usersList
      .filter((u) => u.role === "supervisor" && u.status === "active")
      .forEach((s) => {
        map.set(s.id, {
          value: s.id,
          label: s.full_name,
          description: s.email || undefined,
        });
      });
    availableSupervisors.forEach((s) => {
      if (!map.has(s.value)) {
        map.set(s.value, s);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [usersList, availableSupervisors]);

  // Multi-Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk Approvals / Rejections State
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);

  // Bulk Profile Approvals State
  const [isBulkApprovingProfile, setIsBulkApprovingProfile] = useState(false);
  const [isBulkRejectingProfile, setIsBulkRejectingProfile] = useState(false);

  // Search, Filter and Pagination State
  const PAGE_SIZE = 10;
  const [searchTerm, setSearchTerm] = useState(searchParams?.get("search") || "");
  const lastCommittedSearchRef = useRef(searchParams?.get("search") || "");
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");
  
  const roleFilter = searchParams?.get("role") || "all";
  const statusFilter = searchParams?.get("status") || "all";
  const stateFilter = searchParams?.get("state") || "all";
  const kycFilter = searchParams?.get("kyc") || "all";
  const dateRangeFilter = searchParams?.get("dateRange") || "all";
  const sortBy = searchParams?.get("sort") || "newest";

  // Query loading state: true when a transition is pending or when user is actively debouncing search input
  const isSearchDebouncing = searchTerm.trim() !== (searchParams?.get("search") || "").trim();
  const isQueryLoading = isPending || isSearchDebouncing;

  // Re-sync searchTerm when URL search param changes externally (browser back/forward, shared links)
  useEffect(() => {
    const urlSearch = searchParams?.get("search") || "";
    if (urlSearch !== lastCommittedSearchRef.current) {
      lastCommittedSearchRef.current = urlSearch;
      setSearchTerm(urlSearch);
    }
  }, [searchParams]);

  // Mobile Infinite Scroll State for Cards View (Viewport 418x930 and below)
  const [mobileUsersList, setMobileUsersList] = useState<User[]>(users);
  const [mobilePage, setMobilePage] = useState(currentPage);
  const [mobileHasMore, setMobileHasMore] = useState(currentPage < totalPages);
  const [isLoadingMoreMobile, setIsLoadingMoreMobile] = useState(false);
  const [loadMoreMobileError, setLoadMoreMobileError] = useState<string | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingMobileRef = useRef(false);

  useEffect(() => {
    setMobileUsersList(users);
    setMobilePage(currentPage);
    setMobileHasMore(currentPage < totalPages);
    setLoadMoreMobileError(null);
  }, [users, currentPage, totalPages]);

  useEffect(() => {
    setMobileUsersList((prevMobile) => {
      const usersMap = new Map(usersList.map((u) => [u.id, u]));
      return prevMobile
        .map((mu) => usersMap.get(mu.id) || mu)
        .filter((mu) => {
          const inInitialPage = users.some((u) => u.id === mu.id);
          if (inInitialPage && !usersMap.has(mu.id)) {
            return false;
          }
          return true;
        });
    });
  }, [usersList, users]);

  const handleLoadMoreMobile = useCallback(async () => {
    if (isFetchingMobileRef.current || !mobileHasMore || isLoadingMoreMobile) {
      return;
    }
    isFetchingMobileRef.current = true;
    setIsLoadingMoreMobile(true);
    setLoadMoreMobileError(null);

    try {
      const nextPage = mobilePage + 1;
      const result = await getPaginatedUsersAction({
        search: searchParams?.get("search") || undefined,
        role: searchParams?.get("role") || undefined,
        status: searchParams?.get("status") || undefined,
        kyc: searchParams?.get("kyc") || undefined,
        state: searchParams?.get("state") || undefined,
        dateRange: searchParams?.get("dateRange") || undefined,
        sort: searchParams?.get("sort") || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });

      if (result.error) {
        setLoadMoreMobileError(result.error);
      } else {
        setMobileUsersList((prev) => {
          const existingIds = new Set(prev.map((u) => u.id));
          const newItems = (result.users || []).filter((u) => !existingIds.has(u.id));
          return [...prev, ...newItems];
        });
        setMobilePage(nextPage);
        setMobileHasMore(nextPage < result.totalPages);
      }
    } catch (err: any) {
      setLoadMoreMobileError(err?.message || "Failed to load more users.");
    } finally {
      setIsLoadingMoreMobile(false);
      isFetchingMobileRef.current = false;
    }
  }, [mobileHasMore, isLoadingMoreMobile, mobilePage, searchParams, PAGE_SIZE]);

  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          handleLoadMoreMobile();
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobile]);

  const handleMobileRetry = useCallback(() => {
    setLoadMoreMobileError(null);
    handleLoadMoreMobile();
  }, [handleLoadMoreMobile]);


  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value && value !== "all" && value !== "") params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }, [searchParams, router]);

  const handlePageChange = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", String(newPage));
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }, [searchParams, router]);

  // Debounced search: 300ms pause, auto-runs query without requiring button click
  useEffect(() => {
    const trimmed = searchTerm.trim();
    const currentSearch = (searchParams?.get("search") || "").trim();

    if (trimmed === "") {
      if (currentSearch !== "") {
        lastCommittedSearchRef.current = "";
        updateFilter("search", "");
      }
      return;
    }

    // Search automatically if user takes a 300ms pause
    const handler = setTimeout(() => {
      if (trimmed !== currentSearch) {
        lastCommittedSearchRef.current = trimmed;
        updateFilter("search", trimmed);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, searchParams, updateFilter]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    if (val === "") {
      lastCommittedSearchRef.current = "";
      updateFilter("search", "");
    }
  }, [updateFilter]);

  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchTerm.trim();
    const currentSearch = searchParams?.get("search") || "";
    if (trimmed !== currentSearch) {
      lastCommittedSearchRef.current = trimmed;
      updateFilter("search", trimmed);
    }
  }, [searchTerm, searchParams, updateFilter]);

  const setRoleFilter = (val: string) => updateFilter("role", val);
  const setStatusFilter = (val: string) => updateFilter("status", val);
  const setStateFilter = (val: string) => updateFilter("state", val);
  const setKycFilter = (val: string) => updateFilter("kyc", val);
  const setDateRangeFilter = (val: string) => updateFilter("dateRange", val);
  const setSortBy = (val: string) => updateFilter("sort", val);

  // Handlers for User Actions with Instant Optimistic Updates
  const handleApprove = useCallback(
    async (userId: string) => {
      // 1. Snapshot previous state for rollback
      const prevPending = pendingUsersList;
      const prevUsers = usersList;
      const targetUser = pendingUsersList.find((u) => u.id === userId);

      // 2. Optimistic UI update: immediately remove from pending list and activate in users directory
      setPendingUsersList((prev) => prev.filter((u) => u.id !== userId));
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" as const } : u))
      );
      setLoading({ type: "approve", id: userId });

      try {
        const result = await approveUser(userId);
        setLoading(null);
        if (result.error) {
          // Rollback on server error
          setPendingUsersList(prevPending);
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || `User ${targetUser?.full_name || ""} approved successfully`);
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", err?.message || "Failed to approve user. Please try again.");
      }
    },
    [pendingUsersList, usersList, router, toast]
  );

  const handleReject = useCallback(
    async (userId: string) => {
      // 1. Snapshot previous state for rollback
      const prevPending = pendingUsersList;
      const prevUsers = usersList;
      const targetUser = pendingUsersList.find((u) => u.id === userId);

      // 2. Optimistic UI update: immediately remove from pending and users lists
      setPendingUsersList((prev) => prev.filter((u) => u.id !== userId));
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      setLoading({ type: "reject", id: userId });

      try {
        const result = await rejectUser(userId);
        setLoading(null);
        if (result.error) {
          // Rollback on server error
          setPendingUsersList(prevPending);
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || `User ${targetUser?.full_name || ""} rejected.`);
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", err?.message || "Failed to reject user. Please try again.");
      }
    },
    [pendingUsersList, usersList, router, toast]
  );

  const handleApproveAll = useCallback(async () => {
    if (pendingUsersList.length === 0) return;
    const pendingIds = pendingUsersList.map((u) => u.id);
    const prevPending = pendingUsersList;
    const prevUsers = usersList;

    // 1. Optimistic UI update: immediately empty pending list and activate pending users
    setPendingUsersList([]);
    setUsersList((prev) =>
      prev.map((u) => (pendingIds.includes(u.id) ? { ...u, status: "active" as const } : u))
    );
    setIsBulkApproving(true);

    try {
      const result = await bulkApproveUsers(pendingIds);
      setIsBulkApproving(false);
      if (result.error) {
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Successfully approved all ${pendingIds.length} users.`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkApproving(false);
      setPendingUsersList(prevPending);
      setUsersList(prevUsers);
      toast("error", err?.message || "Failed to approve all users.");
    }
  }, [pendingUsersList, usersList, router, toast]);

  const handleRejectAllConfirm = useCallback(async () => {
    if (pendingUsersList.length === 0) return;
    const pendingIds = pendingUsersList.map((u) => u.id);
    const prevPending = pendingUsersList;
    const prevUsers = usersList;

    // 1. Optimistic UI update: immediately empty pending list and remove pending users
    setPendingUsersList([]);
    setUsersList((prev) => prev.filter((u) => !pendingIds.includes(u.id)));
    setIsBulkRejecting(true);
    setShowRejectAllConfirm(false);

    try {
      const result = await bulkRejectUsers(pendingIds);
      setIsBulkRejecting(false);
      if (result.error) {
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Successfully rejected ${pendingIds.length} user requests.`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkRejecting(false);
      setPendingUsersList(prevPending);
      setUsersList(prevUsers);
      toast("error", err?.message || "Failed to reject all users.");
    }
  }, [pendingUsersList, usersList, router, toast]);

  // Handlers for Profile Change Requests with Optimistic Feedback
  const handleApproveProfileChange = useCallback(
    async (requestId: string) => {
      const prevList = profileRequestsList;
      const targetReq = profileRequestsList.find((r) => r.id === requestId);
      setProfileRequestsList((prev) => prev.filter((r) => r.id !== requestId));
      setProfileLoading({ type: "approve", id: requestId });

      // Optimistically update the user in the main directory table if present
      if (targetReq?.user_id && targetReq?.requested_data) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetReq.user_id ? { ...u, ...targetReq.requested_data } : u))
        );
      }

      try {
        const res = await approveProfileChangeRequest(requestId);
        setProfileLoading(null);
        if (res.error) {
          setProfileRequestsList(prevList);
          toast("error", res.error);
        } else {
          toast("success", res.message || "Profile changes approved and applied.");
          router.refresh();
        }
      } catch (err: any) {
        setProfileRequestsList(prevList);
        setProfileLoading(null);
        toast("error", err?.message || "An unexpected error occurred.");
      }
    },
    [profileRequestsList, router, toast]
  );

  const handleRejectProfileChange = useCallback(
    async (requestId: string, reason?: string) => {
      const prevList = profileRequestsList;
      setProfileRequestsList((prev) => prev.filter((r) => r.id !== requestId));
      setProfileLoading({ type: "reject", id: requestId });

      try {
        const res = await rejectProfileChangeRequest(requestId, reason);
        setProfileLoading(null);
        if (res.error) {
          setProfileRequestsList(prevList);
          toast("error", res.error);
        } else {
          toast("success", res.message || "Profile change request rejected.");
          router.refresh();
        }
      } catch (err: any) {
        setProfileRequestsList(prevList);
        setProfileLoading(null);
        toast("error", err?.message || "An unexpected error occurred.");
      }
    },
    [profileRequestsList, router, toast]
  );

  const handleApproveAllProfileChanges = useCallback(async () => {
    if (profileRequestsList.length === 0) return;
    const prevList = profileRequestsList;
    const requestIds = profileRequestsList.map((r) => r.id);
    setProfileRequestsList([]);
    setIsBulkApprovingProfile(true);

    try {
      const res = await bulkApproveProfileChangeRequests(requestIds);
      setIsBulkApprovingProfile(false);
      if (res.error) {
        setProfileRequestsList(prevList);
        toast("error", res.error);
      } else {
        toast("success", res.message || "All profile change requests approved.");
        router.refresh();
      }
    } catch (err: any) {
      setProfileRequestsList(prevList);
      setIsBulkApprovingProfile(false);
      toast("error", err?.message || "Failed to bulk approve profile requests.");
    }
  }, [profileRequestsList, router, toast]);

  const handleRejectAllProfileChanges = useCallback(async () => {
    if (profileRequestsList.length === 0) return;
    const prevList = profileRequestsList;
    const requestIds = profileRequestsList.map((r) => r.id);
    setProfileRequestsList([]);
    setIsBulkRejectingProfile(true);

    try {
      const res = await bulkRejectProfileChangeRequests(requestIds);
      setIsBulkRejectingProfile(false);
      if (res.error) {
        setProfileRequestsList(prevList);
        toast("error", res.error);
      } else {
        toast("success", res.message || "All profile change requests rejected.");
        router.refresh();
      }
    } catch (err: any) {
      setProfileRequestsList(prevList);
      setIsBulkRejectingProfile(false);
      toast("error", err?.message || "Failed to bulk reject profile requests.");
    }
  }, [profileRequestsList, router, toast]);

  // Handlers for Account Deletion Requests with Optimistic Feedback
  const handleApproveDeletion = useCallback(
    async (request: AccountDeletionRequest, notes?: string) => {
      const prevList = deletionRequestsList;
      const targetUserId = request.user_id;

      setDeletionRequestsList((prev) => prev.filter((r) => r.id !== request.id));
      if (targetUserId) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, status: "inactive" as const } : u))
        );
      }
      setDeletionLoading({ type: "approve", id: request.id });

      try {
        const res = await approveAccountDeletionRequestAction(request.id, targetUserId || undefined, notes);
        setDeletionLoading(null);
        if (!res.success) {
          setDeletionRequestsList(prevList);
          toast("error", res.error || "Failed to approve account deletion.");
        } else {
          toast("success", res.message || "Account deletion approved and user de-provisioned.");
          router.refresh();
        }
      } catch (err: any) {
        setDeletionLoading(null);
        setDeletionRequestsList(prevList);
        toast("error", err?.message || "Failed to approve account deletion.");
      }
    },
    [deletionRequestsList, router, toast]
  );

  const handleRejectDeletion = useCallback(
    async (request: AccountDeletionRequest, notes?: string) => {
      const prevList = deletionRequestsList;
      setDeletionRequestsList((prev) => prev.filter((r) => r.id !== request.id));
      setDeletionLoading({ type: "reject", id: request.id });

      try {
        const res = await rejectAccountDeletionRequestAction(request.id, notes);
        setDeletionLoading(null);
        if (!res.success) {
          setDeletionRequestsList(prevList);
          toast("error", res.error || "Failed to decline deletion request.");
        } else {
          toast("success", res.message || "Account deletion request declined.");
          router.refresh();
        }
      } catch (err: any) {
        setDeletionLoading(null);
        setDeletionRequestsList(prevList);
        toast("error", err?.message || "Failed to decline deletion request.");
      }
    },
    [deletionRequestsList, router, toast]
  );

  const handleCreateUser = useCallback(
    async (formData: FormData) => {
      setLoading({ type: "create", id: "" });
      const result = await createUser(formData);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User created successfully");
        setShowCreateModal(false);
        router.refresh();
      }
    },
    [router, toast]
  );

  const handleResetPassword = useCallback(
    (userId: string) => {
      const targetUser =
        usersList.find((u) => u.id === userId) ||
        pendingUsersList.find((u) => u.id === userId);
      if (!targetUser) {
        toast("error", "User not found.");
        return;
      }
      setResetConfirmUser({
        id: targetUser.id,
        name: targetUser.full_name || "User",
        email: targetUser.email || "",
      });
    },
    [usersList, pendingUsersList, toast]
  );

  const handleConfirmResetPassword = useCallback(async () => {
    if (!resetConfirmUser) return;
    const target = resetConfirmUser;
    setIsResettingPassword(true);
    setLoading({ type: "reset", id: target.id });

    try {
      const result = await resetUserPassword(target.id);
      setIsResettingPassword(false);
      setLoading(null);

      if (result.formState.error) {
        toast("error", result.formState.error);
      } else if (result.newPassword) {
        setResetConfirmUser(null);
        setCopiedPassword(false);
        setShowPasswordModal({
          userId: target.id,
          userName: target.name,
          password: result.newPassword,
        });
        toast("success", result.formState.message || `Password reset successfully for ${target.name}`);
        router.refresh();
      }
    } catch (err: any) {
      setIsResettingPassword(false);
      setLoading(null);
      toast("error", err?.message || "Failed to reset password. Please try again.");
    }
  }, [resetConfirmUser, router, toast]);

  const handleToggleStatus = useCallback(
    async (userId: string) => {
      const prevUsers = usersList;
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: u.status === "active" ? ("inactive" as const) : ("active" as const) }
            : u
        )
      );
      setLoading({ type: "toggle", id: userId });

      try {
        const result = await toggleUserStatus(userId);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || "User status updated");
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        toast("error", err?.message || "Failed to update user status.");
      }
    },
    [usersList, router, toast]
  );

  const handleUpdateRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      const prevUsers = usersList;
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setLoading({ type: "role", id: userId });

      try {
        const result = await updateUserRole(userId, newRole);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || "User role updated");
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        toast("error", err?.message || "Failed to update user role.");
      }
    },
    [usersList, router, toast]
  );

  const handleUpdateSupervisor = useCallback(
    async (userId: string, supervisorIdsInput: string[] | string | null) => {
      const prevUsers = usersList;
      const rawIds = Array.isArray(supervisorIdsInput)
        ? supervisorIdsInput
        : supervisorIdsInput
        ? [supervisorIdsInput]
        : [];
      const cleanSupervisorIds = rawIds.filter(Boolean);

      const matchedSupervisors = cleanSupervisorIds
        .map((id) => supervisorOptions.find((s) => s.value === id))
        .filter(Boolean)
        .map((s) => ({
          id: s!.value,
          full_name: s!.label,
          email: s!.description || undefined,
        }));

      const primarySupervisor = matchedSupervisors[0] || null;

      // Optimistic UI update: update local user immediately
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                supervisor_id: primarySupervisor ? primarySupervisor.id : null,
                supervisor_ids: cleanSupervisorIds,
                supervisor: primarySupervisor,
                supervisors: matchedSupervisors,
              }
            : u
        )
      );

      setSelectedSheetUser((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              supervisor_id: primarySupervisor ? primarySupervisor.id : null,
              supervisor_ids: cleanSupervisorIds,
              supervisor: primarySupervisor,
              supervisors: matchedSupervisors,
            }
          : prev
      );

      setLoading({ type: "supervisor", id: userId });

      try {
        const result = await updateUserSupervisor(userId, cleanSupervisorIds);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || "Supervisor assignment updated.");
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        toast("error", err?.message || "Failed to update supervisor assignment.");
      }
    },
    [usersList, supervisorOptions, router, toast]
  );

  const handleDeleteUserConfirm = useCallback(async () => {
    if (!deletingUserId) return;
    const targetId = deletingUserId;
    const prevUsers = usersList;
    const prevPending = pendingUsersList;

    setUsersList((prev) => prev.filter((u) => u.id !== targetId));
    setPendingUsersList((prev) => prev.filter((u) => u.id !== targetId));
    setLoading({ type: "delete", id: targetId });
    setDeletingUserId(null);

    try {
      const result = await deleteUser(targetId);
      setLoading(null);
      if (result.error) {
        setUsersList(prevUsers);
        setPendingUsersList(prevPending);
        toast("error", result.error);
      } else {
        toast("success", result.message || "User deleted successfully");
        router.refresh();
      }
    } catch (err: any) {
      setLoading(null);
      setUsersList(prevUsers);
      setPendingUsersList(prevPending);
      toast("error", err?.message || "Failed to delete user.");
    }
  }, [deletingUserId, usersList, pendingUsersList, router, toast]);

  const handleEditUser = useCallback(
    async (formData: FormData) => {
      if (!showEditModal) return;
      setLoading({ type: "edit", id: showEditModal.id });
      const result = await editUser(showEditModal.id, formData);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User updated successfully");
        setShowEditModal(null);
        router.refresh();
      }
    },
    [router, showEditModal, toast]
  );

  // Extract unique normalized states (prioritize global aggregates, fallback to usersList)
  const stateOptions = useMemo(() => {
    const baseStates =
      aggregates?.states && aggregates.states.length > 0
        ? aggregates.states
        : (() => {
            const statesMap = new Map<string, { id: string; label: string }>();
            usersList.forEach((u) => {
              if (u.state && u.state.trim()) {
                const cleanState = u.state.trim();
                const key = u.state_id ? String(u.state_id) : cleanState.toLowerCase();
                if (!statesMap.has(key)) {
                  statesMap.set(key, {
                    id: key,
                    label: cleanState,
                  });
                }
              }
            });
            return Array.from(statesMap.values()).sort((a, b) =>
              a.label.localeCompare(b.label)
            );
          })();

    return [
      { id: "all", label: "All States", dotColor: "" },
      ...baseStates.map((st) => ({
        id: st.id,
        label: st.label,
        dotColor: "bg-indigo-500",
      })),
    ];
  }, [aggregates?.states, usersList]);

  const totalUsersCount = aggregates?.totalUsers ?? totalCount ?? usersList.length;
  const activeCount = aggregates?.activeUsers ?? usersList.filter((u) => u.status === "active").length;
  const engineerCount = aggregates?.engineerCount ?? usersList.filter((u) => u.role === "engineer" || u.role === "service_engineer").length;

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (stateFilter !== "all" ? 1 : 0) +
    (kycFilter !== "all" ? 1 : 0) +
    (dateRangeFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0) +
    (searchTerm.trim() !== "" ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    lastCommittedSearchRef.current = "";
    startTransition(() => {
      router.push("?", { scroll: false });
    });
  }, [router]);

  // Multi-selection computed states
  const allFilteredSelected = useMemo(() => {
    return usersList.length > 0 && usersList.every((u) => selectedUserIds.includes(u.id));
  }, [usersList, selectedUserIds]);

  const someFilteredSelected = useMemo(() => {
    return usersList.some((u) => selectedUserIds.includes(u.id)) && !allFilteredSelected;
  }, [usersList, selectedUserIds, allFilteredSelected]);

  const handleToggleSelect = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    if (allFilteredSelected) {
      const idSet = new Set(usersList.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !idSet.has(id)));
    } else {
      const ids = usersList.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }, [allFilteredSelected, usersList]);

  const handleClearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  // Export Scope & Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [isExportingAll, setIsExportingAll] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  // 1. Export Current Page (users on current paginated view)
  const handleExportCurrentPage = useCallback(
    async (format: "xlsx" | "csv" = "xlsx") => {
      if (!usersList || usersList.length === 0) {
        toast("warning", "No users on current page to export.");
        return;
      }
      const filename = `Users-Page-${currentPage}`;
      const scopeLabel = `Page ${currentPage} of User Directory (${usersList.length} users)`;
      const { exportUsersToExcel, exportUsersToCSV } = await import("@/lib/utils/users-export");
      if (format === "xlsx") {
        exportUsersToExcel(usersList, filename, scopeLabel);
        toast("success", `Exported ${usersList.length} user${usersList.length > 1 ? "s" : ""} (Page ${currentPage}) to Excel (.xlsx)`);
      } else {
        exportUsersToCSV(usersList, filename);
        toast("success", `Exported ${usersList.length} user${usersList.length > 1 ? "s" : ""} (Page ${currentPage}) to CSV (.csv)`);
      }
    },
    [usersList, currentPage, toast]
  );

  // 2. Export All Matching Users (across all pages)
  const handleExportAllMatching = useCallback(
    async (format: "xlsx" | "csv" = "xlsx") => {
      try {
        setIsExportingAll(true);
        toast("info", "Preparing export of matching users across all pages...");
        const [fullList, { exportUsersToExcel, exportUsersToCSV }] = await Promise.all([
          exportUsersFilteredAction({
            search: searchTerm || undefined,
            role: roleFilter !== "all" ? roleFilter : undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            kyc: kycFilter !== "all" ? kycFilter : undefined,
            state: stateFilter !== "all" ? stateFilter : undefined,
            dateRange: dateRangeFilter !== "all" ? dateRangeFilter : undefined,
            sort: sortBy,
          }),
          import("@/lib/utils/users-export"),
        ]);

        if (!fullList || fullList.length === 0) {
          toast("warning", "No users found matching current filters.");
          return;
        }

        const filename = activeFilterCount > 0 ? "Users-Directory-Filtered" : "Users-Directory-All";
        const scopeLabel = activeFilterCount > 0
          ? `Filtered User Directory (${fullList.length} matching users)`
          : `Entire User Directory (${fullList.length} users)`;

        if (format === "xlsx") {
          exportUsersToExcel(fullList, filename, scopeLabel);
          toast("success", `Exported ${fullList.length} user${fullList.length > 1 ? "s" : ""} to Excel (.xlsx)`);
        } else {
          exportUsersToCSV(fullList, filename);
          toast("success", `Exported ${fullList.length} user${fullList.length > 1 ? "s" : ""} to CSV (.csv)`);
        }
      } catch (err: any) {
        toast("error", "Failed to export users: " + (err?.message || "Unknown error"));
      } finally {
        setIsExportingAll(false);
      }
    },
    [searchTerm, roleFilter, statusFilter, kycFilter, stateFilter, dateRangeFilter, sortBy, activeFilterCount, toast]
  );

  // 3. Export Selected Users (checked rows)
  const handleExportSelected = useCallback(
    async (format: "xlsx" | "csv" = "xlsx") => {
      if (selectedUserIds.length === 0) {
        toast("warning", "No users selected. Check one or more rows to export.");
        return;
      }
      const targetUsers = usersList.filter((u) => selectedUserIds.includes(u.id));
      if (targetUsers.length === 0) {
        toast("warning", "Selected users are no longer available on this page.");
        return;
      }
      const filename = "Users-Selected";
      const scopeLabel = `Selected Users (${targetUsers.length} users)`;
      const { exportUsersToExcel, exportUsersToCSV } = await import("@/lib/utils/users-export");
      if (format === "xlsx") {
        exportUsersToExcel(targetUsers, filename, scopeLabel);
        toast("success", `Exported ${targetUsers.length} selected user${targetUsers.length > 1 ? "s" : ""} to Excel (.xlsx)`);
      } else {
        exportUsersToCSV(targetUsers, filename);
        toast("success", `Exported ${targetUsers.length} selected user${targetUsers.length > 1 ? "s" : ""} to CSV (.csv)`);
      }
    },
    [selectedUserIds, usersList, toast]
  );

  // Bulk action bar bindings
  const handleExportSelectedExcel = useCallback(() => {
    handleExportSelected("xlsx");
  }, [handleExportSelected]);

  const handleExportSelectedCSV = useCallback(() => {
    handleExportSelected("csv");
  }, [handleExportSelected]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    const idsToDelete = [...selectedUserIds];
    const prevUsers = usersList;
    const prevPending = pendingUsersList;
    const deleteIdSet = new Set(idsToDelete);

    // Optimistic UI update: immediately remove from local users list
    setUsersList((prev) => prev.filter((u) => !deleteIdSet.has(u.id)));
    setPendingUsersList((prev) => prev.filter((u) => !deleteIdSet.has(u.id)));
    setIsBulkDeleting(true);
    setShowBulkDeleteModal(false);

    try {
      const result = await bulkDeleteUsers(idsToDelete);
      setIsBulkDeleting(false);
      if (result.error) {
        // Rollback on server error
        setUsersList(prevUsers);
        setPendingUsersList(prevPending);
        toast("error", result.error);
      } else {
        setSelectedUserIds([]);
        toast("success", result.message || `Successfully deleted ${result.successCount || idsToDelete.length} users.`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkDeleting(false);
      setUsersList(prevUsers);
      setPendingUsersList(prevPending);
      toast("error", err?.message || "Failed to delete selected users.");
    }
  }, [selectedUserIds, usersList, pendingUsersList, router, toast]);

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-6">
      {/* Page Header */}
      <PageHeader
        title="User Management"
        breadcrumbs={[{ label: "Users" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Export Scope Menu Dropdown */}
            <div className="relative inline-block" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                aria-label="Export user directory options"
                className={`h-11 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all ${
                  isExportMenuOpen ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/10" : ""
                }`}
                title="Export user directory (.xlsx / .csv)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold">Export</span>
                <AnimatedChevronDown
                  size={13}
                  className={`text-[var(--color-mute)] transition-transform duration-200 ${
                    isExportMenuOpen ? "rotate-180 text-[var(--color-ink)]" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-1.5 z-50 w-[290px] sm:w-[320px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl backdrop-blur-md text-[var(--color-ink)] overflow-hidden"
                  >
                    {/* Header: Title + Format Selector */}
                    <div className="p-3 border-b border-[var(--color-hairline)]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[var(--color-mute)]">
                          Export Directory
                        </span>
                        <span className="text-[11px] font-mono text-[var(--color-mute)]">
                          {totalCount} Total
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                        <button
                          type="button"
                          onClick={() => setExportFormat("xlsx")}
                          className={`h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            exportFormat === "xlsx"
                              ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                              : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat("csv")}
                          className={`h-7 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            exportFormat === "csv"
                              ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                              : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                          <span>CSV (.csv)</span>
                        </button>
                      </div>
                    </div>

                    {/* Scope Options */}
                    <div className="p-1.5 space-y-1">
                      {/* Option 1: Current Page */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExportCurrentPage(exportFormat);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                            <FileSpreadsheet className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--color-ink)]">
                              Current Page
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] truncate">
                              Page {currentPage} of {totalPages}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
                          {usersList.length} {usersList.length === 1 ? "user" : "users"}
                        </span>
                      </button>

                      {/* Option 2: All Matching Users */}
                      <button
                        type="button"
                        disabled={isExportingAll || totalCount === 0}
                        onClick={async () => {
                          await handleExportAllMatching(exportFormat);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                            {isExportingAll ? (
                              <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--color-ink)]">
                              All Matching Users
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] truncate">
                              {activeFilterCount > 0 ? "Filtered dataset across all pages" : "Entire directory across all pages"}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
                          {totalCount} {totalCount === 1 ? "user" : "users"}
                        </span>
                      </button>

                      {/* Option 3: Selected Users (Only when selectedUserIds.length > 0) */}
                      {selectedUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleExportSelected(exportFormat);
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-[var(--color-canvas)] transition-all cursor-pointer group border-t border-[var(--color-hairline)] mt-1 pt-2"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400 group-hover:scale-105 transition-transform">
                              <Check className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[var(--color-ink)]">
                                Selected Users
                              </div>
                              <p className="text-[11px] text-[var(--color-mute)] truncate">
                                Checked rows on current page
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                            {selectedUserIds.length} {selectedUserIds.length === 1 ? "user" : "users"}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Footer / Hint */}
                    <div className="px-3 py-2 bg-[var(--color-canvas)] border-t border-[var(--color-hairline)] rounded-b-xl flex items-center justify-between text-[10px] text-[var(--color-mute)]">
                      <span>Format: .{exportFormat}</span>
                      <span>Instant file download</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!readOnly && (
              <Button
                variant="primary"
                icon={<AnimatedUserPlus size={15} />}
                responsive
                onClick={() => setShowCreateModal(true)}
                className="h-9 px-4 text-xs font-semibold whitespace-nowrap"
              >
                Add User
              </Button>
            )}
          </div>
        }
      />

      {/* Metrics Snapshot Header Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-4 ${!readOnly && profileRequestsList.length > 0 ? "lg:grid-cols-5" : ""} gap-3.5`}>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setRoleFilter("all");
            setStatusFilter("all");
          }}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            roleFilter === "all" && statusFilter === "all"
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
            <AnimatedUsers size={16} className="text-[var(--color-ink)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            <AnimatedCounter value={totalUsersCount} />
          </div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            statusFilter === "active"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active Accounts
            </span>
            <AnimatedUserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            <AnimatedCounter value={activeCount} />
          </div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setRoleFilter(roleFilter === "service_engineer" || roleFilter === "engineer" ? "all" : "service_engineer")}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            roleFilter === "service_engineer" || roleFilter === "engineer"
              ? "bg-blue-50/40 border-blue-500 shadow-xs ring-1 ring-blue-500/20 dark:bg-blue-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-blue-500/40"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Engineers
            </span>
            <AnimatedShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-1">
            <AnimatedCounter value={engineerCount} />
          </div>
        </motion.div>

        {!readOnly && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (pendingUsersList.length > 0) {
                const el = document.getElementById("pending-approvals-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
              pendingUsersList.length > 0
                ? "bg-amber-50/40 border-amber-500 shadow-xs dark:bg-amber-950/20"
                : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)]"
            }`}
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                New Registrations
              </span>
              <AnimatedShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
              <AnimatedCounter value={pendingUsersList.length} />
            </div>
          </motion.div>
        )}

        {!readOnly && profileRequestsList.length > 0 && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const el = document.getElementById("profile-change-requests-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="cursor-pointer p-4 rounded-[var(--radius-md)] border border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/20 hover:border-indigo-500 transition-all col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Profile Updates
              </span>
              <AnimatedShieldAlert size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1">
              <AnimatedCounter value={profileRequestsList.length} />
            </div>
          </motion.div>
        )}

        {!readOnly && (
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (deletionRequestsList.length > 0) {
                const el = document.getElementById("account-deletion-requests-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
              deletionRequestsList.length > 0
                ? "bg-rose-50/40 border-rose-500 shadow-xs ring-1 ring-rose-500/20 dark:bg-rose-950/20"
                : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-rose-500/40"
            }`}
          >
            <div className="flex items-center justify-between text-[var(--color-mute)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Account Deletions
              </span>
              <Trash2 size={16} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
              <AnimatedCounter value={deletionRequestsList.length} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Dedicated Account Deletion Requests Section */}
      {!readOnly && deletionRequestsList.length > 0 && (
        <AccountDeletionRequestsSection
          requests={deletionRequestsList}
          onApprove={handleApproveDeletion}
          onReject={handleRejectDeletion}
          loadingState={deletionLoading}
        />
      )}

      {/* Dedicated Profile Change Requests Section */}
      {!readOnly && profileRequestsList.length > 0 && (
        <ProfileChangeRequestsSection
          requests={profileRequestsList}
          onApprove={handleApproveProfileChange}
          onReject={handleRejectProfileChange}
          onApproveAll={handleApproveAllProfileChanges}
          onRejectAll={handleRejectAllProfileChanges}
          loadingState={profileLoading}
          isBulkApproving={isBulkApprovingProfile}
          isBulkRejecting={isBulkRejectingProfile}
        />
      )}

      {/* Pending Account Requests Section */}
      {!readOnly && pendingUsersList.length > 0 && (
        <div
          id="pending-approvals-section"
          className="relative overflow-hidden rounded-2xl border border-amber-500/25 dark:border-amber-500/20 bg-gradient-to-b from-amber-500/[0.04] via-[var(--color-canvas-elevated)] to-[var(--color-canvas-elevated)] dark:from-amber-950/[0.18] dark:via-[var(--color-canvas-elevated)] dark:to-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs transition-all"
        >
          {/* Subtle Ambient Highlight at the Top Border */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 dark:via-amber-400/50 to-transparent pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-amber-500/15 dark:border-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
                <AnimatedShieldAlert size={18} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight">
                    Pending User Approvals
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {pendingUsersList.length} Pending
                  </span>
                </div>
                <p className="text-xs text-[var(--color-mute)] mt-0.5">
                  Review and authorize registration requests before granting system access
                </p>
              </div>
            </div>

            {/* Optimized Parallel Batch Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto">
              <Button
                variant="success-sm"
                onClick={handleApproveAll}
                loading={isBulkApproving}
                className="h-9 sm:h-8 px-3.5 flex-1 sm:flex-initial text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                title={`Accept and approve all ${pendingUsersList.length} pending registration requests`}
              >
                Accept All ({pendingUsersList.length})
              </Button>
              <Button
                variant="danger-sm"
                onClick={() => setShowRejectAllConfirm(true)}
                loading={isBulkRejecting}
                className="h-9 sm:h-8 px-3 flex-1 sm:flex-initial text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
                title={`Reject all ${pendingUsersList.length} pending registration requests`}
              >
                Reject All
              </Button>
            </div>
          </div>

          {/* Responsive Grid of Pending User Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <AnimatePresence mode="popLayout">
              {pendingUsersList.map((pUser) => (
                <motion.div
                  key={pUser.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
                  whileHover={{ y: -2 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    layout: { duration: 0.25, ease: "easeOut" },
                  }}
                  onClick={() => setSelectedSheetUser(pUser)}
                  className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-amber-500/40 hover:shadow-md dark:hover:shadow-amber-950/25 transition-all duration-200 group overflow-hidden border-l-[3px] border-l-amber-500 dark:border-l-amber-400 cursor-pointer"
                >
                  {/* Top Hairline Sheen on Hover */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 dark:via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 pr-1 flex-1">
                    {/* Avatar with Role-Themed Gradient and Live Status Pip */}
                    <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getRoleAvatarStyle(pUser.role)} font-bold text-sm border shadow-xs group-hover:scale-105 transition-transform duration-200 select-none`}>
                      <span>{getInitials(pUser.full_name)}</span>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 ring-2 ring-[var(--color-canvas-elevated)]"></span>
                      </span>
                    </div>

                    {/* User Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--color-ink)] truncate tracking-tight group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors" title={pUser.full_name}>
                          {pUser.full_name}
                        </span>
                        {getPendingRoleBadge(pUser.role)}
                        {pUser.created_at && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 text-[10px] sm:text-[11px] font-mono font-semibold text-amber-800 dark:text-amber-300 shadow-2xs shrink-0 select-none"
                            title={`Request sent: ${formatDateTime(pUser.created_at)} (${formatTimeAgo(pUser.created_at)})`}
                          >
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{formatTinyRelativeTime(pUser.created_at)}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-[var(--color-mute)]">
                        <span className="inline-flex items-center gap-1 truncate max-w-[200px]" title={pUser.email}>
                          <Mail className="h-3 w-3 shrink-0 opacity-60 text-[var(--color-ink)]" />
                          <span className="truncate">{pUser.email}</span>
                        </span>
                        {pUser.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] shrink-0" title={pUser.phone}>
                            <Phone className="h-3 w-3 shrink-0 opacity-60 text-[var(--color-ink)]" />
                            <span>{pUser.phone}</span>
                          </span>
                        )}
                        {pUser.city && (
                          <span className="inline-flex items-center gap-1 text-[11px] shrink-0" title={pUser.city}>
                            <MapPin className="h-3 w-3 shrink-0 opacity-60 text-[var(--color-ink)]" />
                            <span>{pUser.city}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 flex-shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-[var(--color-hairline)] w-full sm:w-auto justify-end mt-1 sm:mt-0"
                  >
                    <Button
                      variant="success-sm"
                      onClick={() => handleApprove(pUser.id)}
                      loading={loading?.type === "approve" && loading.id === pUser.id}
                      className="h-9 sm:h-8 flex-1 sm:flex-initial px-4 sm:px-3.5 text-xs font-semibold rounded-lg sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                      title={`Approve ${pUser.full_name}'s account`}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger-sm"
                      onClick={() => handleReject(pUser.id)}
                      loading={loading?.type === "reject" && loading.id === pUser.id}
                      className="h-9 sm:h-8 flex-1 sm:flex-initial px-3.5 sm:px-3 text-xs font-semibold rounded-lg sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
                      title={`Reject and delete ${pUser.full_name}'s request`}
                    >
                      Reject
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Filter and Search Controls Toolbar */}
      <FilterToolbar
        searchQuery={searchTerm}
        onSearchChange={handleSearchChange}
        onSubmitSearch={handleSearchSubmit}
        isLoading={isQueryLoading}
        placeholder="Search user by name, email, phone, city, state, aadhaar, or role..."
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        defaultOpen={false}
        actions={
          <div className="hidden sm:flex items-center bg-[var(--color-hairline-soft-surface)] p-0.5 rounded-lg border border-[var(--color-hairline)] text-xs h-9 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("auto")}
              className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                viewMode === "auto"
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
              }`}
              title="Auto responsive view"
            >
              Auto View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                viewMode === "cards"
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
              }`}
              title="Cards view"
            >
              <AnimatedSlidersHorizontal size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`h-full px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                viewMode === "table"
                  ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-transparent"
              }`}
              title="Table view"
            >
              <AnimatedFileText size={13} />
              <span>Table</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          {/* Responsive Custom Dropdown Filter Selectors for Role, Status, State, KYC, Joined Date & Sort */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full">
            {/* 1. Role Selector */}
            <div className="w-full sm:w-56 min-w-0">
              <CustomFilterSelector
                label="Role"
                value={roleFilter}
                onChange={setRoleFilter}
                options={currentRoleOptions}
                ariaLabel="Filter by role"
                align="left"
              />
            </div>

            {/* 2. Status Selector */}
            <div className="w-full sm:w-40 min-w-0">
              <CustomFilterSelector
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                ariaLabel="Filter by status"
                align="right"
              />
            </div>

            {/* 3. State Selector */}
            <div className="w-full sm:w-48 min-w-0">
              <CustomFilterSelector
                label="State"
                value={stateFilter}
                onChange={setStateFilter}
                options={stateOptions}
                ariaLabel="Filter by state"
                align="left"
              />
            </div>

            {/* 4. KYC / Verification Selector */}
            <div className="w-full sm:w-48 min-w-0">
              <CustomFilterSelector
                label="KYC"
                value={kycFilter}
                onChange={setKycFilter}
                options={KYC_OPTIONS}
                ariaLabel="Filter by KYC verification status"
                align="right"
              />
            </div>

            {/* 5. Joined Date Range Selector */}
            <div className="w-full sm:w-44 min-w-0">
              <CustomFilterSelector
                label="Joined"
                value={dateRangeFilter}
                onChange={setDateRangeFilter}
                options={DATE_RANGE_OPTIONS}
                ariaLabel="Filter by registration date"
                align="left"
              />
            </div>

            {/* 6. Sort By Selector */}
            <div className="w-full sm:w-44 min-w-0">
              <CustomFilterSelector
                label="Sort"
                value={sortBy}
                onChange={setSortBy}
                options={SORT_OPTIONS}
                ariaLabel="Sort users directory"
                align="right"
              />
            </div>
          </div>

          {/* Active Filter Chips Strip */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-[var(--color-hairline)] text-xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] mr-1 shrink-0">
                Active ({activeFilterCount}):
              </span>
              {searchTerm.trim() !== "" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Search: &quot;{searchTerm}&quot;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      lastCommittedSearchRef.current = "";
                      updateFilter("search", "");
                    }}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {roleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                  <span>Role: {currentRoleOptions.find((r) => r.id === roleFilter)?.label || roleFilter}</span>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear role filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <span>Status: {STATUS_OPTIONS.find((s) => s.id === statusFilter)?.label || statusFilter}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear status filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {stateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  <span>State: {stateOptions.find((s) => s.id === stateFilter)?.label || stateFilter}</span>
                  <button
                    type="button"
                    onClick={() => setStateFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear state filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {kycFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                  <span>KYC: {KYC_OPTIONS.find((k) => k.id === kycFilter)?.label || kycFilter}</span>
                  <button
                    type="button"
                    onClick={() => setKycFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear KYC filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateRangeFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <span>Joined: {DATE_RANGE_OPTIONS.find((d) => d.id === dateRangeFilter)?.label || dateRangeFilter}</span>
                  <button
                    type="button"
                    onClick={() => setDateRangeFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear date range filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {sortBy !== "newest" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                  <span>Sort: {SORT_OPTIONS.find((s) => s.id === sortBy)?.label || sortBy}</span>
                  <button
                    type="button"
                    onClick={() => setSortBy("newest")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear sort"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-bold text-[var(--color-link)] hover:underline ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </FilterToolbar>

      {/* Content View: Mobile Cards Stack vs Desktop Table */}
      <div className="relative">
        {/* Mobile / Responsive Cards View */}
        <div
          className={
            viewMode === "cards"
              ? "block"
              : viewMode === "table"
              ? "hidden"
              : "block md:hidden"
          }
        >
          {isQueryLoading ? (
            <MobileCardSkeletonList />
          ) : usersList.length === 0 ? (
            <div className="py-14 px-4 text-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-mute)] mb-3 shadow-xs">
                <AnimatedSearch size={22} />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">No users found</h3>
              <p className="text-xs text-[var(--color-mute)] mt-1.5 max-w-xs text-center leading-relaxed">
                {searchTerm.trim() !== "" && activeFilterCount > 1
                  ? `No user records match "${searchTerm}" with the active filter criteria. Try adjusting or clearing your filters.`
                  : searchTerm.trim() !== ""
                  ? `No user records match "${searchTerm}". Check for typos or try searching with name, phone, email, or role.`
                  : activeFilterCount > 0
                  ? "No users match the active filter criteria. Try adjusting or clearing some filters."
                  : "No registered users in this directory."}
              </p>
              {(searchTerm.trim() !== "" || activeFilterCount > 0) && (
                <Button
                  variant="ghost-sm"
                  onClick={resetFilters}
                  className="mt-4 h-8 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all"
                >
                  Clear Search & Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {mobileUsersList.map((u) => (
                    <MobileUserCard
                      key={u.id}
                      user={u}
                      currentUser={currentUser}
                      loadingId={loading}
                      selectable={!readOnly}
                      isSelected={selectedUserIds.includes(u.id)}
                      onToggleSelect={handleToggleSelect}
                      onOpenSheet={(targetUser) => setSelectedSheetUser(targetUser)}
                      onResetPassword={handleResetPassword}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Infinite Scroll Sentinel for Mobile View */}
              {mobileHasMore && !loadMoreMobileError && !isQueryLoading && (
                <div ref={mobileSentinelRef} className="h-6 w-full pointer-events-none" />
              )}

              {/* Loading More Indicator */}
              {isLoadingMoreMobile && (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-[var(--color-mute)]">
                  <AnimatedSearch className="animate-spin text-[var(--color-link)]" size={15} />
                  <span>Loading more staff...</span>
                </div>
              )}

              {/* Pagination Load More Error with Retry */}
              {loadMoreMobileError && (
                <div className="p-3 my-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between gap-3 text-xs shadow-xs">
                  <span className="text-[var(--color-error)] font-medium">{loadMoreMobileError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMobileRetry}
                    className="h-7 px-3 text-xs font-semibold rounded-md border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
              )}

              {/* End-of-List Indicator */}
              {!mobileHasMore && mobileUsersList.length > 0 && !isQueryLoading && (
                <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
                  <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                  <span className="font-medium text-[var(--color-mute)]">All users have been displayed</span>
                  <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                </div>
              )}

              {/* Fallback pagination controls when explicitly in desktop cards view */}
              {viewMode === "cards" && totalCount > 0 && (
                <div className="pt-2 hidden sm:block">
                  <Pagination
                    page={currentPage}
                    pageSize={PAGE_SIZE}
                    total={totalCount}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div
          className={
            viewMode === "cards"
              ? "hidden"
              : viewMode === "table"
              ? "block"
              : "hidden md:block"
          }
        >
          <Card padding="none" className="overflow-hidden border border-[var(--color-hairline)] shadow-xs rounded-[var(--radius-md)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  <tr>
                    {!readOnly && (
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected && usersList.length > 0}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = someFilteredSelected;
                            }
                          }}
                          onChange={handleSelectAllFiltered}
                          aria-label="Select all filtered users"
                          className="h-4 w-4 rounded-[4px] border-[var(--color-hairline)] text-[var(--color-ink)] focus:ring-[var(--color-link)] cursor-pointer transition-all accent-[var(--color-ink)]"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                      Name
                    </th>
                    <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                      Contact Info
                    </th>
                    <th className="py-3 px-4 w-[13%] whitespace-nowrap">
                      Role
                    </th>
                    <th className="py-3 px-4 w-[13%] whitespace-nowrap">
                      Supervisor
                    </th>
                    <th className="py-3 px-4 w-[14%] whitespace-nowrap">
                      Working Location
                    </th>
                    <th className="py-3 px-4 w-[9%] whitespace-nowrap">
                      City
                    </th>
                    <th className="py-3 px-4 w-[8%] whitespace-nowrap">
                      Status
                    </th>
                    <th className="py-3 px-4 w-[9%] whitespace-nowrap">
                      Joined Date
                    </th>
                    <th className="py-3 px-3 w-10 whitespace-nowrap text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                  {isQueryLoading ? (
                    <TableSkeletonRows readOnly={readOnly} />
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={readOnly ? 9 : 10} className="py-16 px-4 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-mute)] mb-3 shadow-xs">
                            <AnimatedSearch size={22} />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--color-ink)]">No users found</h3>
                          <p className="text-xs text-[var(--color-mute)] mt-1.5 text-center leading-relaxed">
                            {searchTerm.trim() !== "" && activeFilterCount > 1
                              ? `No user records match "${searchTerm}" with the active filter criteria. Try adjusting or clearing your filters.`
                              : searchTerm.trim() !== ""
                              ? `No user records match "${searchTerm}". Check for typos or try searching with name, phone, email, or role.`
                              : activeFilterCount > 0
                              ? "No users match the active filter criteria. Try adjusting or clearing some filters."
                              : "No registered users in this directory."}
                          </p>
                          {(searchTerm.trim() !== "" || activeFilterCount > 0) && (
                            <Button
                              variant="ghost-sm"
                              onClick={resetFilters}
                              className="mt-4 h-8 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all"
                            >
                              Clear Search & Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usersList.map((userItem) => (
                      <UserRow
                        key={userItem.id}
                        user={userItem}
                        currentUser={currentUser}
                        isSuperAdmin={isSuperAdmin}
                        loadingId={loading}
                        selectable={!readOnly}
                        isSelected={selectedUserIds.includes(userItem.id)}
                        supervisors={supervisorOptions}
                        onToggleSelect={handleToggleSelect}
                        onViewDetails={(u) => setSelectedSheetUser(u)}
                        onResetPassword={handleResetPassword}
                        onToggleStatus={handleToggleStatus}
                        onEdit={setShowEditModal}
                        onUpdateRole={handleUpdateRole}
                        onUpdateSupervisor={handleUpdateSupervisor}
                        onDelete={(id) => setDeletingUserId(id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isQueryLoading && totalCount > 0 && (
              <div className="px-4 bg-[var(--color-canvas)] border-t border-[var(--color-hairline)]">
                <Pagination
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  total={totalCount}
                  onPageChange={handlePageChange}
                  className="border-t-0"
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Mobile User Detail Sheet Drawer - mounted only when open */}
      {selectedSheetUser && (
        <UserDetailSheet
          user={selectedSheetUser}
          currentUser={currentUser}
          isSuperAdmin={isSuperAdmin}
          loadingId={loading}
          supervisors={supervisorOptions}
          onClose={() => setSelectedSheetUser(null)}
          onResetPassword={handleResetPassword}
          onToggleStatus={handleToggleStatus}
          onEdit={setShowEditModal}
          onUpdateRole={handleUpdateRole}
          onUpdateSupervisor={handleUpdateSupervisor}
          onDelete={(id) => setDeletingUserId(id)}
        />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <UserCreateModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          isSuperAdmin={isSuperAdmin}
          loading={loading?.type === "create"}
          onSubmit={handleCreateUser}
          supervisors={supervisorOptions}
          workingLocations={availableWorkingLocations}
        />
      )}

      {/* Delete User Confirmation Dialog */}
      {deletingUserId && (
        <ConfirmationDialog
          isOpen={!!deletingUserId}
          onClose={() => setDeletingUserId(null)}
          onConfirm={handleDeleteUserConfirm}
          title="Delete User Account"
          description="Are you sure you want to delete this user? This action will permanently remove access and cannot be undone."
          confirmLabel="Delete User"
          variant="danger"
          loading={loading?.type === "delete" && loading.id === deletingUserId}
        />
      )}

      {/* Reset Password Warning Confirmation Dialog */}
      {resetConfirmUser && (
        <ConfirmationDialog
          isOpen={!!resetConfirmUser}
          onClose={() => {
            if (!isResettingPassword) setResetConfirmUser(null);
          }}
          onConfirm={handleConfirmResetPassword}
          title="Reset User Password"
          description={
            <p className="text-xs text-[var(--color-body)] leading-relaxed">
              Are you sure you want to reset the security password for{" "}
              <strong className="text-[var(--color-ink)] font-semibold">{resetConfirmUser.name}</strong>{" "}
              {resetConfirmUser.email && (
                <span className="text-[var(--color-mute)]">({resetConfirmUser.email})</span>
              )}?
            </p>
          }
          confirmLabel={isResettingPassword ? "Resetting..." : "Reset Password"}
          cancelLabel="Cancel"
          variant="warning"
          loading={isResettingPassword}
        />
      )}

      {/* Password Reset Success Modal with Visible Copy Functionality */}
      {showPasswordModal && (
        <Modal
          open={!!showPasswordModal}
          onClose={() => {
            setShowPasswordModal(null);
            setCopiedPassword(false);
          }}
          title="Password Reset Successful"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold">New Password Generated</p>
                <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                  Password has been successfully updated for <strong className="text-[var(--color-ink)]">{showPasswordModal.userName}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-hairline-soft-surface)] p-3.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)]">
              <label className="block text-[11px] font-bold text-[var(--color-mute)] mb-1.5 uppercase tracking-wider">
                Generated Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={showPasswordModal.password}
                  aria-label="Generated Temporary Password"
                  className="w-full text-xs font-mono font-bold bg-[var(--color-canvas-elevated)] px-3 py-2 rounded-sm border border-[var(--color-hairline)] text-[var(--color-ink)] select-all focus:outline-none focus:ring-1 focus:ring-[var(--color-link)]"
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(showPasswordModal.password);
                    setCopiedPassword(true);
                    toast("success", "Password copied to clipboard");
                    setTimeout(() => setCopiedPassword(false), 2500);
                  }}
                  className={`h-9 px-3.5 text-xs font-medium rounded-sm inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98] transition-all shrink-0 ${
                    copiedPassword
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 text-white"
                  }`}
                  title="Copy password to clipboard"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                setShowPasswordModal(null);
                setCopiedPassword(false);
              }}
              className="w-full h-9 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all justify-center"
            >
              Done
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <UserEditModal
          user={showEditModal}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowEditModal(null)}
          loading={loading?.type === "edit"}
          onSubmit={handleEditUser}
          supervisors={supervisorOptions}
          workingLocations={availableWorkingLocations}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {!readOnly && selectedUserIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-auto min-w-0 sm:min-w-[320px] max-w-xl bg-[var(--color-ink)] text-white dark:bg-[#1a1a1a] dark:text-neutral-100 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-neutral-700/60 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-white/20 text-xs font-bold text-white">
                {selectedUserIds.length}
              </span>
              <span className="text-xs font-medium text-neutral-100 whitespace-nowrap">
                {selectedUserIds.length === 1 ? "1 selected" : `${selectedUserIds.length} selected`}
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-neutral-400 hover:text-white underline cursor-pointer ml-1"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              <button
                type="button"
                onClick={handleExportSelectedExcel}
                className="h-9 sm:h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportSelectedCSV}
                className="h-9 sm:h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to CSV (.csv)"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={isBulkDeleting}
                className="h-9 sm:h-8 px-3.5 rounded-sm text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                <AnimatedTrash2 size={14} />
                <span>Delete ({selectedUserIds.length})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteModal && (
        <ConfirmationDialog
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDeleteConfirm}
          title={`Delete ${selectedUserIds.length} User Account${selectedUserIds.length > 1 ? "s" : ""}`}
          description={
            <span>
              Are you sure you want to permanently delete{" "}
              <strong className="text-[var(--color-ink)] font-bold">
                {selectedUserIds.length} selected user{selectedUserIds.length > 1 ? "s" : ""}
              </strong>
              ? This action will permanently remove authentication credentials and directory records, and cannot be undone.
            </span>
          }
          confirmLabel={`Delete ${selectedUserIds.length} User${selectedUserIds.length > 1 ? "s" : ""}`}
          variant="danger"
          loading={isBulkDeleting}
        />
      )}

      {/* Reject All Confirmation Dialog */}
      {showRejectAllConfirm && (
        <ConfirmationDialog
          isOpen={showRejectAllConfirm}
          onClose={() => setShowRejectAllConfirm(false)}
          onConfirm={handleRejectAllConfirm}
          title={`Reject All ${pendingUsersList.length} Pending Registration Request${pendingUsersList.length > 1 ? "s" : ""}`}
          description={
            <span>
              Are you sure you want to reject and remove all{" "}
              <strong className="text-[var(--color-ink)] font-bold">
                {pendingUsersList.length} pending user request{pendingUsersList.length > 1 ? "s" : ""}
              </strong>
              ? This action will decline and permanently delete their registration records, and cannot be undone.
            </span>
          }
          confirmLabel={`Reject All (${pendingUsersList.length})`}
          variant="danger"
          loading={isBulkRejecting}
        />
      )}
    </div>
  );
}