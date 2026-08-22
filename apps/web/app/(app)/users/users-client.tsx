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
} from "@/components/ui/animated-icons";
import { LayoutGrid, Table as TableIcon, Check, X, Plus, Copy } from "lucide-react";
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
  editUser,
} from "@/app/actions/users";
import { UserRow } from "./UserRow";
import { MobileUserCard } from "./MobileUserCard";
import { UserDetailSheet } from "./UserDetailSheet";
import dynamic from "next/dynamic";
import type { User, UserRole, Branch } from "@/lib/types/database";

const UserCreateModal = dynamic(() => import("./UserCreateModal").then(mod => mod.UserCreateModal), { ssr: false });
const UserEditModal = dynamic(() => import("./UserEditModal").then(mod => mod.UserEditModal), { ssr: false });

interface UsersPageClientProps {
  users: User[];
  pendingUsers: User[];
  branches?: Branch[];
  currentUser: User;
  isSuperAdmin: boolean;
}

export function UsersPageClient({
  users,
  pendingUsers,
  branches = [],
  currentUser,
  isSuperAdmin,
}: UsersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

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
  const [showPasswordModal, setShowPasswordModal] = useState<{
    userId: string;
    userName: string;
    password: string;
  } | null>(null);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");

  // Handlers for User Actions
  const handleApprove = useCallback(
    async (userId: string) => {
      setLoading({ type: "approve", id: userId });
      const result = await approveUser(userId);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User approved successfully");
        router.refresh();
      }
    },
    [router, toast]
  );

  const handleReject = useCallback(
    async (userId: string) => {
      setLoading({ type: "reject", id: userId });
      const result = await rejectUser(userId);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User rejected successfully");
        router.refresh();
      }
    },
    [router, toast]
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
    async (userId: string) => {
      setLoading({ type: "reset", id: userId });
      const result = await resetUserPassword(userId);
      setLoading(null);
      if (result.formState.error) {
        toast("error", result.formState.error);
      } else if (result.newPassword) {
        setShowPasswordModal({ userId, userName: "", password: result.newPassword });
        toast("success", result.formState.message || "Password reset successfully");
        router.refresh();
      }
    },
    [router, toast]
  );

  const handleToggleStatus = useCallback(
    async (userId: string) => {
      setLoading({ type: "toggle", id: userId });
      const result = await toggleUserStatus(userId);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User status updated");
        router.refresh();
      }
    },
    [router, toast]
  );

  const handleUpdateRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      setLoading({ type: "role", id: userId });
      const result = await updateUserRole(userId, newRole);
      setLoading(null);
      if (result.error) {
        toast("error", result.error);
      } else {
        toast("success", result.message || "User role updated");
        router.refresh();
      }
    },
    [router, toast]
  );

  const handleDeleteUserConfirm = useCallback(async () => {
    if (!deletingUserId) return;
    setLoading({ type: "delete", id: deletingUserId });
    const result = await deleteUser(deletingUserId);
    setLoading(null);
    setDeletingUserId(null);
    if (result.error) {
      toast("error", result.error);
    } else {
      toast("success", result.message || "User deleted successfully");
      router.refresh();
    }
  }, [deletingUserId, router, toast]);

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
    return users.filter((u) => {
      // Search filter (name, email, phone, branch, location, role)
      if (deferredSearch.trim()) {
        const query = deferredSearch.toLowerCase();
        const matchesName = u.full_name.toLowerCase().includes(query);
        const matchesEmail = u.email.toLowerCase().includes(query);
        const matchesPhone = u.phone ? u.phone.toLowerCase().includes(query) : false;
        const matchesBranch = u.branch?.name ? u.branch.name.toLowerCase().includes(query) : false;
        const matchesCity = u.branch?.city ? u.branch.city.toLowerCase().includes(query) : false;
        const matchesRole = u.role.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesBranch && !matchesCity && !matchesRole) return false;
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
  }, [users, deferredSearch, roleFilter, statusFilter]);

  const activeCount = users.filter((u) => u.status === "active").length;
  const engineerCount = users.filter((u) => u.role === "engineer" || u.role === "service_engineer").length;

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchTerm.trim() !== "" ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-6">
      {/* Page Header */}
      <PageHeader
        title="Employee & User Management"
        description="View all employees, manage staff roles and access credentials, assign company branch locations, reset passwords, and onboard new employees."
        breadcrumbs={[{ label: "Employees & Users" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher for Desktop / Mobile */}
            <div className="hidden sm:flex items-center bg-[var(--color-hairline-soft-surface)] p-1 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-xs">
              <button
                type="button"
                onClick={() => setViewMode("auto")}
                className={`px-2.5 py-1 rounded-[calc(var(--radius-sm)-2px)] font-medium transition-all ${
                  viewMode === "auto"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                title="Auto responsive view"
              >
                Auto View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1 px-2.5 rounded-[calc(var(--radius-sm)-2px)] flex items-center gap-1 font-medium transition-all ${
                  viewMode === "cards"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                title="Cards view"
              >
                <AnimatedSlidersHorizontal size={14} />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1 px-2.5 rounded-[calc(var(--radius-sm)-2px)] flex items-center gap-1 font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-semibold shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                title="Table view"
              >
                <AnimatedFileText size={14} />
                Table
              </button>
            </div>

            <RefreshButton path="/users" tag="users" />

            <Button onClick={() => setShowCreateModal(true)} className="shadow-sm hidden sm:inline-flex">
              <AnimatedUserPlus size={16} className="mr-2" />
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
            <AnimatedCounter value={users.length} />
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
            if (pendingUsers.length > 0) {
              const el = document.getElementById("pending-approvals-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className={`cursor-pointer p-4 rounded-[var(--radius-md)] border transition-all ${
            pendingUsers.length > 0
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
            <AnimatedCounter value={pendingUsers.length} />
          </div>
        </motion.div>
      </div>

      {/* Pending Approvals Mobile & Desktop Card Section */}
      {pendingUsers.length > 0 && (
        <Card
          id="pending-approvals-section"
          padding="lg"
          className="border-amber-300/60 dark:border-amber-800/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AnimatedShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
              <h2 className="heading-md text-[var(--color-ink)]">Pending User Approvals</h2>
              <Badge variant="warning">{pendingUsers.length}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {pendingUsers.map((pUser) => (
                <motion.div
                  key={pUser.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-hairline)] bg-gradient-to-b from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)] shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all relative overflow-hidden group border-l-4 border-l-amber-500 dark:border-l-amber-400"
                >
                  {/* Top Hairline Sheen Gradient on Hover */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-sm border border-[var(--color-hairline)] shadow-xs">
                      {pUser.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--color-ink)] truncate">
                        {pUser.full_name}
                      </div>
                      <div className="text-xs text-[var(--color-mute)] truncate">{pUser.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="success-sm"
                      onClick={() => handleApprove(pUser.id)}
                      loading={loading?.type === "approve" && loading.id === pUser.id}
                      className="shadow-xs font-semibold px-3 py-1.5 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      variant="danger-sm"
                      onClick={() => handleReject(pUser.id)}
                      loading={loading?.type === "reject" && loading.id === pUser.id}
                      className="shadow-xs font-semibold px-3 py-1.5 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
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
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0 max-w-full overflow-x-auto">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)] px-1.5 shrink-0">
              Role Filter
            </span>
            {[
              { id: "all", label: "All Roles", activeColor: "text-[var(--color-ink)]", dotColor: "" },
              { id: "service_engineer", label: "Engineers", activeColor: "text-blue-700 dark:text-blue-400 font-semibold", dotColor: "bg-blue-500" },
              { id: "service_manager", label: "Service Managers", activeColor: "text-sky-700 dark:text-sky-400 font-semibold", dotColor: "bg-sky-500" },
              { id: "branch_manager", label: "Branch Managers", activeColor: "text-indigo-700 dark:text-indigo-400 font-semibold", dotColor: "bg-indigo-500" },
              { id: "supervisor", label: "Supervisors", activeColor: "text-teal-700 dark:text-teal-400 font-semibold", dotColor: "bg-teal-500" },
              { id: "operator", label: "Operators", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
              { id: "mechanic", label: "Mechanics", activeColor: "text-orange-700 dark:text-orange-400 font-semibold", dotColor: "bg-orange-500" },
              { id: "admin", label: "Admins", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
              { id: "super_admin", label: "Super Admins", activeColor: "text-red-700 dark:text-red-400 font-semibold", dotColor: "bg-red-500" },
            ].map((pill) => {
              const isActive = roleFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setRoleFilter(pill.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? pill.activeColor + " shadow-xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeUserRolePill"
                      className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-lg shadow-xs border border-[var(--color-hairline)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {pill.dotColor && (
                    <span className={`relative z-10 h-2 w-2 rounded-full ${pill.dotColor}`} />
                  )}
                  <span className="relative z-10">{pill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter Pills — Color coded per status */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0 max-w-full overflow-x-auto">
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
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? pill.activeColor + " shadow-xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeUserStatusPill"
                      className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-lg shadow-xs border border-[var(--color-hairline)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {pill.dotColor && (
                    <span className={`relative z-10 h-2 w-2 rounded-full ${pill.dotColor}`} />
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
              <Button variant="secondary" onClick={resetFilters} className="mt-3 text-xs">
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
        <Card padding="lg" className="shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="heading-md text-[var(--color-ink)]">All System Accounts</h2>
              <p className="body-sm text-[var(--color-mute)] text-xs mt-0.5">
                Showing {filteredUsers.length} of {users.length} registered accounts
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-hairline)]">
            <table className="w-full text-left">
              <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    User Account
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    Contact Info
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    Role & Access Level
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    Assigned Branch & Location
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    Status
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)]">
                    Joined Date
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-[var(--color-mute)] text-right">
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
        className="fixed bottom-20 right-4 z-30 md:hidden flex items-center gap-2 bg-[var(--color-ink)] text-[var(--color-canvas)] px-4 py-3 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.25)] border border-white/20 active:bg-neutral-800 focus:outline-none"
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
          branches={branches}
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

      {/* Password Reset Success Modal */}
      {showPasswordModal && (
        <Modal
          open={!!showPasswordModal}
          onClose={() => setShowPasswordModal(null)}
          title="Password Reset Successful"
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs body-md text-[var(--color-body)] leading-relaxed">
              The user&apos;s password has been reset. Below is the generated password credential:
            </p>
            <div className="bg-[var(--color-hairline-soft-surface)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)]">
              <label className="block text-[11px] font-semibold text-[var(--color-mute)] mb-1 uppercase tracking-wider">
                Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-[var(--color-canvas-elevated)] p-2 rounded border border-[var(--color-hairline)] font-bold text-[var(--color-ink)]">
                  {showPasswordModal.password}
                </code>
                <Button
                  variant="ghost-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(showPasswordModal.password);
                    toast("success", "Password copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button variant="primary" onClick={() => setShowPasswordModal(null)} className="w-full">
              Done
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <UserEditModal
          user={showEditModal}
          branches={branches}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowEditModal(null)}
          loading={loading?.type === "edit"}
          onSubmit={handleEditUser}
        />
      )}
    </div>
  );
}