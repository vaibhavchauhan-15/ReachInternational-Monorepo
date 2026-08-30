"use client";

import { useState, useCallback, useMemo, useDeferredValue, useEffect } from "react";
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
  AnimatedBuilding2,
  AnimatedWrench,
  AnimatedActivity,
  AnimatedPackage,
  AnimatedShield,
  AnimatedTrash2,
} from "@/components/ui/animated-icons";
import { LayoutGrid, Table as TableIcon, Check, X, Plus, Copy, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Badge,
  Modal,
  useToast,
  PageHeader,
  ConfirmationDialog,
  RefreshButton,
  FilterToolbar,
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
  editUser,
} from "@/app/actions/users";
import { exportUsersToExcel, exportUsersToCSV } from "@/lib/utils/users-export";
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-xs whitespace-nowrap">
          <AnimatedShieldAlert size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          <AnimatedShieldCheck size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
          Admin
        </span>
      );
    case "manager":
    case "branch_manager":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-xs whitespace-nowrap">
          <AnimatedBuilding2 size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          Manager
        </span>
      );
    case "service_manager":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 shadow-xs whitespace-nowrap">
          <AnimatedShieldCheck size={12} className="text-sky-600 dark:text-sky-400 shrink-0" />
          Service Manager
        </span>
      );
    case "service_engineer":
    case "engineer":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shadow-xs whitespace-nowrap">
          <AnimatedWrench size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
          Service Engineer
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 shadow-xs whitespace-nowrap">
          <AnimatedShieldCheck size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
          Supervisor
        </span>
      );
    case "store_manager":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 shadow-xs whitespace-nowrap">
          <AnimatedPackage size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
          Store Manager
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          <AnimatedActivity size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
          Operator
        </span>
      );
    case "mechanic":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/80 shadow-xs whitespace-nowrap">
          <AnimatedWrench size={12} className="text-orange-600 dark:text-orange-400 shrink-0" />
          Mechanic
        </span>
      );
    case "hr_manager":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs whitespace-nowrap">
          <AnimatedUsers size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          HR Manager
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-xs whitespace-nowrap">
          <AnimatedShield size={12} className="text-[var(--color-mute)] shrink-0" />
          {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "User"}
        </span>
      );
  }
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

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  // Filter Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      // Search filter (name, email, phone, location, role)
      if (deferredSearch.trim()) {
        const query = deferredSearch.toLowerCase();
        const matchesName = u.full_name.toLowerCase().includes(query);
        const matchesEmail = u.email.toLowerCase().includes(query);
        const matchesPhone = u.phone ? u.phone.toLowerCase().includes(query) : false;
        const matchesLocation = u.location ? u.location.toLowerCase().includes(query) : false;
        const matchesRole = u.role.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesLocation && !matchesRole) return false;
      }

      // Role filter
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && u.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [usersList, deferredSearch, roleFilter, statusFilter]);

  const activeCount = usersList.filter((u) => u.status === "active").length;
  const engineerCount = usersList.filter((u) => u.role === "engineer" || u.role === "service_engineer").length;

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchTerm.trim() !== "" ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

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
            <RefreshButton
              path="/users"
              tag="users"
              variant="ghost-sm"
              className="h-9 px-3 rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] text-xs font-medium shadow-xs cursor-pointer active:scale-[0.98] transition-all"
            />

            {/* View Switcher for Desktop / Mobile */}
            <div className="hidden sm:flex items-center bg-[var(--color-hairline-soft-surface)] p-0.5 rounded-sm border border-[var(--color-hairline)] text-xs h-9">
              <button
                type="button"
                onClick={() => setViewMode("auto")}
                className={`h-full px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
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
                className={`h-full px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
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
                className={`h-full px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
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

            <Button
              variant="secondary"
              onClick={handleExportSelectedExcel}
              className="h-9 px-3.5 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs hidden sm:inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
              title="Export users directory to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export</span>
            </Button>

            <Button
              variant="primary"
              icon={<AnimatedUserPlus size={15} />}
              responsive
              onClick={() => setShowCreateModal(true)}
              className="h-9 px-4 text-xs font-semibold whitespace-nowrap"
            >
              Add Employee / User
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
        <Card
          id="pending-approvals-section"
          padding="lg"
          className="border-amber-300/60 dark:border-amber-800/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AnimatedShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
              <h2 className="heading-md text-[var(--color-ink)]">Pending User Approvals</h2>
              <Badge variant="warning">{pendingUsersList.length}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {pendingUsersList.map((pUser) => (
                <motion.div
                  key={pUser.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--color-hairline)] bg-gradient-to-b from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)] shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all relative overflow-hidden group border-l-4 border-l-amber-500 dark:border-l-amber-400"
                >
                  {/* Top Hairline Sheen Gradient on Hover */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-sm border border-[var(--color-hairline)] shadow-xs">
                      {pUser.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--color-ink)] truncate" title={pUser.full_name}>
                          {pUser.full_name}
                        </span>
                        {getPendingRoleBadge(pUser.role)}
                      </div>
                      <div className="text-xs text-[var(--color-mute)] truncate mt-0.5" title={pUser.email}>
                        {pUser.email}
                      </div>
                      {pUser.phone && (
                        <div className="text-[11px] text-[var(--color-mute)] font-mono truncate">
                          {pUser.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <Button
                      variant="success-sm"
                      onClick={() => handleApprove(pUser.id)}
                      loading={loading?.type === "approve" && loading.id === pUser.id}
                      className="h-8 px-3 text-xs font-medium rounded-sm shadow-xs inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </Button>
                    <Button
                      variant="danger-sm"
                      onClick={() => handleReject(pUser.id)}
                      loading={loading?.type === "reject" && loading.id === pUser.id}
                      className="h-8 px-3 text-xs font-medium rounded-sm shadow-xs inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      )}

      {/* Filter and Search Controls Toolbar */}
      <FilterToolbar
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search user by name, email, phone, branch, or location..."
        activeFilterCount={(roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
        onResetFilters={resetFilters}
        defaultOpen={false}
      >
        {/* Touch & Desktop Filter Pills Container for Role and Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Role Filter Pills — Color coded per role */}
          <div className="flex items-center gap-1 p-0.5 rounded-sm bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0 max-w-full overflow-x-auto">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] px-1.5 shrink-0">
              Role
            </span>
            {[
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
            ].map((pill) => {
              const isActive = roleFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setRoleFilter(pill.id)}
                  className={`relative flex items-center gap-1.5 h-7 px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none active:scale-[0.98] ${
                    isActive
                      ? pill.activeColor + " shadow-xs font-semibold"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeUserRolePill"
                      className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-[calc(var(--radius-sm)-2px)] shadow-xs border border-[var(--color-hairline)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {pill.dotColor && (
                    <span className={`relative z-10 h-1.5 w-1.5 rounded-full ${pill.dotColor}`} />
                  )}
                  <span className="relative z-10">{pill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter Pills — Color coded per status */}
          <div className="flex items-center gap-1 p-0.5 rounded-sm bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0 max-w-full overflow-x-auto">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] px-1.5 shrink-0">
              Status
            </span>
            {[
              { id: "all", label: "All Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
              { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
              { id: "inactive", label: "Inactive", activeColor: "text-slate-600 dark:text-slate-400 font-semibold", dotColor: "bg-slate-400 dark:bg-slate-500" },
            ].map((pill) => {
              const isActive = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={`relative flex items-center gap-1.5 h-7 px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none active:scale-[0.98] ${
                    isActive
                      ? pill.activeColor + " shadow-xs font-semibold"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeUserStatusPill"
                      className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-[calc(var(--radius-sm)-2px)] shadow-xs border border-[var(--color-hairline)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {pill.dotColor && (
                    <span className={`relative z-10 h-1.5 w-1.5 rounded-full ${pill.dotColor}`} />
                  )}
                  <span className="relative z-10">{pill.label}</span>
                </button>
              );
            })}
          </div>
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
                  <th className="py-3 px-4 w-[55px] whitespace-nowrap text-right">
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

      {/* Mobile Floating Action Button (FAB) for Creating Users */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 right-4 z-30 md:hidden flex items-center gap-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 text-white px-4 py-3 rounded-full shadow-[0_8px_24px_rgba(2,132,199,0.35)] border border-sky-400/30 active:scale-95 focus:outline-none"
        title="Invite New User"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-bold tracking-tight">Invite User</span>
      </motion.button>

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
    </div>
  );
}