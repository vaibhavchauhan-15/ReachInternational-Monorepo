"use client";

import { useState, useCallback, useMemo, useDeferredValue, useEffect, useRef } from "react";
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
import { LayoutGrid, Table as TableIcon, Check, X, Plus, Copy, Download, FileSpreadsheet, Trash2, Mail, Phone, MapPin, Clock } from "lucide-react";
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
  ExportButton,
} from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/Motion";
import {
  approveUser,
  rejectUser,
  createUser,
  resetUserPassword,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  bulkDeleteUsers,
  bulkApproveUsers,
  bulkRejectUsers,
  editUser,
} from "@/app/actions/users";
import { exportUsersToExcel, exportUsersToCSV } from "@/lib/utils/users-export";
import { formatDateTime, formatTimeAgo, formatTinyRelativeTime } from "@reachinternational/utils";
import { UserRow } from "./UserRow";
import { MobileUserCard } from "./MobileUserCard";
import { UserDetailSheet } from "./UserDetailSheet";
import dynamic from "next/dynamic";
import type { User, UserRole } from "@/lib/types/database";

const UserCreateModal = dynamic(() => import("./UserCreateModal").then(mod => mod.UserCreateModal), { ssr: false });
const UserEditModal = dynamic(() => import("./UserEditModal").then(mod => mod.UserEditModal), { ssr: false });

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
        className={`w-full h-9 px-2.5 sm:px-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-xs select-none ${
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
                  className={`w-full min-h-[36px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
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

interface UsersPageClientProps {
  users: User[];
  pendingUsers: User[];
  currentUser: User;
  isSuperAdmin: boolean;
}

export function UsersPageClient({
  users,
  pendingUsers,
  currentUser,
  isSuperAdmin,
}: UsersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Optimistic local state synchronized with server props
  const [usersList, setUsersList] = useState<User[]>(users);
  const [pendingUsersList, setPendingUsersList] = useState<User[]>(pendingUsers);

  useEffect(() => {
    setUsersList(users);
  }, [users]);

  useEffect(() => {
    setPendingUsersList(pendingUsers);
  }, [pendingUsers]);

  const [loading, setLoading] = useState<{ type: "approve" | "reject" | "create" | "reset" | "toggle" | "role" | "delete" | "edit"; id: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (searchParams?.get("action") === "create") {
      setShowCreateModal(true);
    }
  }, [searchParams]);
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

  // Multi-Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk Approvals / Rejections State
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [kycFilter, setKycFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");

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

  // Extract unique regions/states from usersList
  const stateOptions = useMemo(() => {
    const statesSet = new Set<string>();
    usersList.forEach((u) => {
      if (u.state && u.state.trim()) {
        statesSet.add(u.state.trim());
      } else if (u.location && u.location.trim()) {
        statesSet.add(u.location.trim());
      } else if (u.city && u.city.trim()) {
        statesSet.add(u.city.trim());
      }
    });

    const sortedStates = Array.from(statesSet).sort((a, b) => a.localeCompare(b));

    return [
      { id: "all", label: "All Regions", dotColor: "" },
      ...sortedStates.map((st) => ({
        id: st.toLowerCase(),
        label: st,
        dotColor: "bg-indigo-500",
      })),
    ];
  }, [usersList]);

  // Filter and Sort Users List
  const filteredUsers = useMemo(() => {
    const query = deferredSearch.toLowerCase().trim();
    const queryNoSpaces = query.replace(/\s+/g, "");

    const result = usersList.filter((u) => {
      // 1. Comprehensive Search Filter
      if (query) {
        const matchesName = u.full_name?.toLowerCase().includes(query);
        const matchesEmail = u.email?.toLowerCase().includes(query);
        const matchesPhone = u.phone ? u.phone.toLowerCase().includes(query) : false;
        const matchesCity = u.city ? u.city.toLowerCase().includes(query) : false;
        const matchesDistrict = u.district ? u.district.toLowerCase().includes(query) : false;
        const matchesState = u.state ? u.state.toLowerCase().includes(query) : false;
        const matchesLocation = u.location ? u.location.toLowerCase().includes(query) : false;
        const matchesRole = u.role?.toLowerCase().includes(query);
        const matchesAadhaar = u.aadhaar_number
          ? u.aadhaar_number.replace(/\s+/g, "").includes(queryNoSpaces)
          : false;
        const matchesLicense = u.license_number
          ? u.license_number.toLowerCase().includes(query)
          : false;

        if (
          !matchesName &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesCity &&
          !matchesDistrict &&
          !matchesState &&
          !matchesLocation &&
          !matchesRole &&
          !matchesAadhaar &&
          !matchesLicense
        ) {
          return false;
        }
      }

      // 2. Role Filter
      if (roleFilter !== "all") {
        if (roleFilter === "engineer" || roleFilter === "service_engineer") {
          if (u.role !== "engineer" && u.role !== "service_engineer") return false;
        } else if (u.role !== roleFilter) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== "all" && u.status !== statusFilter) {
        return false;
      }

      // 4. State / Region Filter
      if (stateFilter !== "all") {
        const userState = (u.state || u.location || u.city || "").toLowerCase();
        if (userState !== stateFilter) {
          return false;
        }
      }

      // 5. KYC / Verification Filter
      if (kycFilter !== "all") {
        const hasAadhaar = Boolean(u.aadhaar_number && u.aadhaar_number.trim().length > 0);
        const hasLicense = Boolean(u.license_number && u.license_number.trim().length > 0);
        if (kycFilter === "fully_verified" && (!hasAadhaar || !hasLicense)) return false;
        if (kycFilter === "aadhaar_only" && !hasAadhaar) return false;
        if (kycFilter === "license_only" && !hasLicense) return false;
        if (kycFilter === "pending_kyc" && hasAadhaar && hasLicense) return false;
      }

      // 6. Joined Date Range Filter
      if (dateRangeFilter !== "all") {
        if (!u.created_at) return false;
        const userDate = new Date(u.created_at).getTime();
        if (isNaN(userDate)) return false;
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (dateRangeFilter === "today") {
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          if (userDate < startOfToday) return false;
        } else if (dateRangeFilter === "7days") {
          if (now - userDate > 7 * oneDayMs) return false;
        } else if (dateRangeFilter === "30days") {
          if (now - userDate > 30 * oneDayMs) return false;
        } else if (dateRangeFilter === "90days") {
          if (now - userDate > 90 * oneDayMs) return false;
        } else if (dateRangeFilter === "this_year") {
          const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
          if (userDate < startOfYear) return false;
        }
      }

      return true;
    });

    // 7. High-Performance Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortBy === "name_asc") {
        return (a.full_name || "").localeCompare(b.full_name || "");
      }
      if (sortBy === "name_desc") {
        return (b.full_name || "").localeCompare(a.full_name || "");
      }
      if (sortBy === "role_asc") {
        return (a.role || "").localeCompare(b.role || "");
      }
      return 0;
    });

    return result;
  }, [usersList, deferredSearch, roleFilter, statusFilter, stateFilter, kycFilter, dateRangeFilter, sortBy]);

  const activeCount = usersList.filter((u) => u.status === "active").length;
  const engineerCount = usersList.filter((u) => u.role === "engineer" || u.role === "service_engineer").length;

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
    setRoleFilter("all");
    setStatusFilter("all");
    setStateFilter("all");
    setKycFilter("all");
    setDateRangeFilter("all");
    setSortBy("newest");
  }, []);

  // Multi-selection computed states
  const allFilteredSelected = useMemo(() => {
    return filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.includes(u.id));
  }, [filteredUsers, selectedUserIds]);

  const someFilteredSelected = useMemo(() => {
    return filteredUsers.some((u) => selectedUserIds.includes(u.id)) && !allFilteredSelected;
  }, [filteredUsers, selectedUserIds, allFilteredSelected]);

  const handleToggleSelect = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const filteredIds = filteredUsers.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }, [allFilteredSelected, filteredUsers]);

  const handleClearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const handleExportSelectedExcel = useCallback(() => {
    const targetUsers = selectedUserIds.length > 0
      ? usersList.filter((u) => selectedUserIds.includes(u.id))
      : filteredUsers;
    if (targetUsers.length === 0) {
      toast("warning", "No users available to export.");
      return;
    }
    exportUsersToExcel(targetUsers, selectedUserIds.length > 0 ? "Selected-Users" : "Users-Directory");
    toast("success", `Exported ${targetUsers.length} user${targetUsers.length > 1 ? "s" : ""} to Excel (.xlsx)`);
  }, [selectedUserIds, usersList, filteredUsers, toast]);

  const handleExportSelectedCSV = useCallback(() => {
    const targetUsers = selectedUserIds.length > 0
      ? usersList.filter((u) => selectedUserIds.includes(u.id))
      : filteredUsers;
    if (targetUsers.length === 0) {
      toast("warning", "No users available to export.");
      return;
    }
    exportUsersToCSV(targetUsers, selectedUserIds.length > 0 ? "Selected-Users" : "Users-Directory");
    toast("success", `Exported ${targetUsers.length} user${targetUsers.length > 1 ? "s" : ""} to CSV (.csv)`);
  }, [selectedUserIds, usersList, filteredUsers, toast]);

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
            <ExportButton
              format="xlsx"
              iconOnly
              onClick={handleExportSelectedExcel}
              tooltip="Export user directory to Excel (.xlsx)"
            />

            <Button
              variant="primary"
              icon={<AnimatedUserPlus size={15} />}
              responsive
              onClick={() => setShowCreateModal(true)}
              className="h-9 px-4 text-xs font-semibold whitespace-nowrap"
            >
              Add User
            </Button>
          </div>
        }
      />

      {/* Metrics Snapshot Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
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
            <AnimatedCounter value={usersList.length} />
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
              Pending Approvals
            </span>
            <AnimatedShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            <AnimatedCounter value={pendingUsersList.length} />
          </div>
        </motion.div>
      </div>

      {/* Pending Approvals Mobile & Desktop Card Section */}
      {pendingUsersList.length > 0 && (
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
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="success-sm"
                onClick={handleApproveAll}
                loading={isBulkApproving}
                className="h-8 px-3.5 text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                title={`Accept and approve all ${pendingUsersList.length} pending registration requests`}
              >
                Accept All ({pendingUsersList.length})
              </Button>
              <Button
                variant="danger-sm"
                onClick={() => setShowRejectAllConfirm(true)}
                loading={isBulkRejecting}
                className="h-8 px-3 text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
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
                  className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-amber-500/40 hover:shadow-md dark:hover:shadow-amber-950/25 transition-all duration-200 group overflow-hidden border-l-[3px] border-l-amber-500 dark:border-l-amber-400"
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
                  <div className="flex items-center gap-2 flex-shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-[var(--color-hairline)] w-full sm:w-auto justify-end mt-1 sm:mt-0">
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
        onSearchChange={setSearchTerm}
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
          {/* Responsive Custom Dropdown Filter Selectors for Role, Status, Region, KYC, Joined Date & Sort */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full">
            {/* 1. Role Selector */}
            <div className="w-full sm:w-56 min-w-0">
              <CustomFilterSelector
                label="Role"
                value={roleFilter}
                onChange={setRoleFilter}
                options={ROLE_OPTIONS}
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

            {/* 3. State / Region Selector */}
            <div className="w-full sm:w-48 min-w-0">
              <CustomFilterSelector
                label="Region"
                value={stateFilter}
                onChange={setStateFilter}
                options={stateOptions}
                ariaLabel="Filter by region or state"
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
                    onClick={() => setSearchTerm("")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {roleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                  <span>Role: {ROLE_OPTIONS.find((r) => r.id === roleFilter)?.label || roleFilter}</span>
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
                  <span>Region: {stateOptions.find((s) => s.id === stateFilter)?.label || stateFilter}</span>
                  <button
                    type="button"
                    onClick={() => setStateFilter("all")}
                    className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                    aria-label="Clear region filter"
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
        {filteredUsers.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
            <p className="text-sm font-semibold text-[var(--color-ink)]">No users found</p>
            <p className="text-xs text-[var(--color-mute)] mt-1">
              Try adjusting your search terms or clearing filters.
            </p>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost-sm"
                onClick={resetFilters}
                className="mt-3 h-8 px-3.5 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs cursor-pointer active:scale-[0.98] transition-all"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredUsers.map((u) => (
                <MobileUserCard
                  key={u.id}
                  user={u}
                  currentUser={currentUser}
                  loadingId={loading}
                  selectable={true}
                  isSelected={selectedUserIds.includes(u.id)}
                  onToggleSelect={handleToggleSelect}
                  onOpenSheet={(targetUser) => setSelectedSheetUser(targetUser)}
                  onResetPassword={handleResetPassword}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </AnimatePresence>
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
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected && filteredUsers.length > 0}
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
                  <th className="py-3 px-4 w-[21%] whitespace-nowrap">
                    User Account
                  </th>
                  <th className="py-3 px-4 w-[24%] whitespace-nowrap">
                    Contact Info
                  </th>
                  <th className="py-3 px-4 w-[18%] whitespace-nowrap">
                    Role & Access Level
                  </th>
                  <th className="py-3 px-4 w-[13%] whitespace-nowrap">
                    City
                  </th>
                  <th className="py-3 px-4 w-[10%] whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-3 px-4 w-[11%] whitespace-nowrap">
                    Joined Date
                  </th>
                  <th className="py-3 px-4 w-[84px] whitespace-nowrap text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                {filteredUsers.map((userItem) => (
                  <UserRow
                    key={userItem.id}
                    user={userItem}
                    currentUser={currentUser}
                    isSuperAdmin={isSuperAdmin}
                    loadingId={loading}
                    selectable={true}
                    isSelected={selectedUserIds.includes(userItem.id)}
                    onToggleSelect={handleToggleSelect}
                    onViewDetails={(u) => setSelectedSheetUser(u)}
                    onResetPassword={handleResetPassword}
                    onToggleStatus={handleToggleStatus}
                    onEdit={setShowEditModal}
                    onUpdateRole={handleUpdateRole}
                    onDelete={(id) => setDeletingUserId(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile User Detail Sheet Drawer */}
      <UserDetailSheet
        user={selectedSheetUser}
        currentUser={currentUser}
        isSuperAdmin={isSuperAdmin}
        loadingId={loading}
        onClose={() => setSelectedSheetUser(null)}
        onResetPassword={handleResetPassword}
        onToggleStatus={handleToggleStatus}
        onEdit={setShowEditModal}
        onUpdateRole={handleUpdateRole}
        onDelete={(id) => setDeletingUserId(id)}
      />

      {/* Create User Modal */}
      {showCreateModal && (
        <UserCreateModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          isSuperAdmin={isSuperAdmin}
          loading={loading?.type === "create"}
          onSubmit={handleCreateUser}
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
        />
      )}

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedUserIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-auto min-w-[320px] max-w-xl bg-[var(--color-ink)] text-white dark:bg-[#1a1a1a] dark:text-neutral-100 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-neutral-700/60 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
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
                className="h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportSelectedCSV}
                className="h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to CSV (.csv)"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={isBulkDeleting}
                className="h-8 px-3.5 rounded-sm text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
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