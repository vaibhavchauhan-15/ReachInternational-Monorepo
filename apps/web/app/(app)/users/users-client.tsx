"use client";

import { useState, useCallback, useMemo, useEffect, useRef, useTransition } from "react";
import { highlightText } from "./user-search";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Check } from "lucide-react";
import {
  Button,
  Modal,
  useToast,
  ConfirmationDialog,
} from "@/components/ui";
import { AnimatedTrash2 } from "@/components/ui/animated-icons";
import { FileSpreadsheet, Download, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import type { User, UserRole, ProfileChangeRequest, AccountDeletionRequest } from "@/lib/types/database";

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
  exportUsersFilteredAction,
  searchUsersServerAction,
} from "@/app/actions/users";
import { getSupervisorsAction } from "@/app/actions/auth";
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

import {
  UserListAggregates,
  ROLE_OPTIONS,
  SUPERVISOR_ROLE_OPTIONS,
} from "./users-helpers";
import { UsersHeader } from "./UsersHeader";
import { UsersFilters } from "./UsersFilters";
import { UsersTable } from "./UsersTable";
import { PendingApprovalsSection } from "./PendingApprovalsSection";

// Re-export helper functions and types for backwards compatibility
export {
  getPendingRoleBadge,
  getInitials,
  getRoleAvatarStyle,
  ROLE_OPTIONS,
  SUPERVISOR_ROLE_OPTIONS,
  STATUS_OPTIONS,
  KYC_OPTIONS,
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
} from "./users-helpers";
export type { UserListAggregates, FilterOption } from "./users-helpers";

// Dynamic Imports for Modals & Heavy Sections
const UserCreateModal = dynamic(
  () => import("./UserCreateModal").then((mod) => mod.UserCreateModal),
  { ssr: false }
);
const UserEditModal = dynamic(
  () => import("./UserEditModal").then((mod) => mod.UserEditModal),
  { ssr: false }
);
const UserDetailSheet = dynamic(
  () => import("./UserDetailSheet").then((mod) => mod.UserDetailSheet),
  { ssr: false }
);
const ProfileChangeRequests = dynamic(
  () => import("./ProfileChangeRequests").then((mod) => mod.ProfileChangeRequests),
  { ssr: false }
);
const AccountDeletionRequestsSection = dynamic(
  () => import("./AccountDeletionRequestsSection").then((mod) => mod.AccountDeletionRequestsSection),
  { ssr: false }
);

export interface UsersPageClientProps {
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

  useEffect(() => { setUsersList(users); }, [users]);
  useEffect(() => { setPendingUsersList(pendingUsers); }, [pendingUsers]);
  useEffect(() => { setProfileRequestsList(profileChangeRequests); }, [profileChangeRequests]);

  // ── Pure High-Scale Server-Side Search Engine (Engineered for 100,000+ Users)
  // Queries PostgreSQL via GIN Trigram indexes on (name, phone, email, etc.)
  // Never downloads 100,000 rows to client RAM. Ultra-lean ~15KB network responses.
  const initialUrlSearch = searchParams?.get("search") || "";
  const [localSearchTerm, setLocalSearchTerm] = useState(initialUrlSearch);
  const [searchResults, setSearchResults] = useState<User[] | null>(() => {
    return initialUrlSearch ? users : null;
  });
  const [searchTotalCount, setSearchTotalCount] = useState<number>(() => {
    return initialUrlSearch ? totalCount : 0;
  });
  const [searchTotalPages, setSearchTotalPages] = useState<number>(() => {
    return initialUrlSearch ? totalPages : 0;
  });
  const [searchPage, setSearchPage] = useState<number>(currentPage);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isSearchActive = localSearchTerm.trim().length > 0;
  const filteredUsers = isSearchActive ? (searchResults ?? []) : usersList;
  useEffect(() => { setDeletionRequestsList(accountDeletionRequests); }, [accountDeletionRequests]);

  const [loading, setLoading] = useState<{
    type: "approve" | "reject" | "create" | "reset" | "toggle" | "role" | "supervisor" | "delete" | "edit";
    id: string;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState<{ type: "approve" | "reject"; id: string } | null>(null);
  const [deletionLoading, setDeletionLoading] = useState<{ type: "approve" | "reject"; id: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentRoleOptions = readOnly ? SUPERVISOR_ROLE_OPTIONS : ROLE_OPTIONS;

  useEffect(() => {
    if (!readOnly && searchParams?.get("action") === "create") {
      setShowCreateModal(true);
    }
  }, [searchParams, readOnly]);

  // Strip legacy tab parameter (e.g. ?tab=all) to normalize URL to clean /users
  useEffect(() => {
    if (searchParams?.has("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const newQuery = params.toString();
      router.replace(newQuery ? `/users?${newQuery}` : "/users", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (readOnly) return;
    const handleQuickAddUser = () => {
      setShowCreateModal(true);
    };
    window.addEventListener("reach:quick-add-user", handleQuickAddUser);
    return () => window.removeEventListener("reach:quick-add-user", handleQuickAddUser);
  }, [readOnly]);

  const [showEditModal, setShowEditModal] = useState<User | null>(null);
  const [selectedSheetUser, setSelectedSheetUser] = useState<User | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<{ userId: string; userName: string; password: string } | null>(null);

  // Supervisor state for assignment
  const [availableSupervisors, setAvailableSupervisors] = useState<Array<{ value: string; label: string; description?: string }>>([]);

  useEffect(() => {
    if (readOnly) return;
    getSupervisorsAction().then((res) => { if (Array.isArray(res)) setAvailableSupervisors(res); }).catch(() => {});
  }, [readOnly]);

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    usersList
      .filter((u) => u.role === "supervisor" && u.status === "active")
      .forEach((s) => {
        map.set(s.id, { value: s.id, label: s.full_name, description: s.email || undefined });
      });
    availableSupervisors.forEach((s) => {
      if (!map.has(s.value)) map.set(s.value, s);
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
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");

  const roleFilter = searchParams?.get("role") || "all";
  const statusFilter = searchParams?.get("status") || "all";
  const stateFilter = searchParams?.get("state") || "all";
  const kycFilter = searchParams?.get("kyc") || "all";
  const dateRangeFilter = searchParams?.get("dateRange") || "all";
  const sortBy = searchParams?.get("sort") || "newest";

  const isQueryLoading = isPending || isSearchLoading;

  // Derive a key from current server-side filters to detect changes
  const currentFilterKey = `${roleFilter}:${statusFilter}:${stateFilter}:${kycFilter}:${dateRangeFilter}:${sortBy}`;

  // Synchronize local search state when URL search param changes via browser back/forward navigation
  useEffect(() => {
    const urlSearch = searchParams?.get("search") || "";
    if (urlSearch !== localSearchTerm) {
      setLocalSearchTerm(urlSearch);
      if (!urlSearch) {
        setSearchResults(null);
        setSearchTotalCount(0);
        setSearchTotalPages(0);
        setSearchPage(1);
      }
    }
  }, [searchParams]);

  // Synchronize search results with fresh server props when search term is active in URL
  useEffect(() => {
    const activeSearch = searchParams?.get("search") || "";
    if (activeSearch) {
      setSearchResults(users);
      setSearchTotalCount(totalCount);
      setSearchTotalPages(totalPages);
      setSearchPage(currentPage);
    }
  }, [users, searchParams, totalCount, totalPages, currentPage]);

  // Mobile Infinite Scroll State for Cards View
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
          if (inInitialPage && !usersMap.has(mu.id)) return false;
          return true;
        });
    });
  }, [usersList, users]);

  const handleLoadMoreMobile = useCallback(async () => {
    const hasMoreToLoad = isSearchActive ? searchPage < searchTotalPages : mobileHasMore;
    if (isFetchingMobileRef.current || !hasMoreToLoad || isLoadingMoreMobile) return;
    isFetchingMobileRef.current = true;
    setIsLoadingMoreMobile(true);
    setLoadMoreMobileError(null);

    try {
      if (isSearchActive) {
        const nextPage = searchPage + 1;
        const res = await searchUsersServerAction(localSearchTerm.trim(), {
          role: roleFilter !== "all" ? roleFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          state: stateFilter !== "all" ? stateFilter : undefined,
          kyc: kycFilter !== "all" ? kycFilter : undefined,
          dateRange: dateRangeFilter !== "all" ? dateRangeFilter : undefined,
          sort: sortBy !== "newest" ? sortBy : undefined,
          page: nextPage,
          pageSize: 50,
        });

        setSearchResults((prev) => {
          const existingIds = new Set((prev || []).map((u) => u.id));
          const newItems = (res.users || []).filter((u) => !existingIds.has(u.id));
          return [...(prev || []), ...newItems];
        });
        setSearchPage(nextPage);
        setSearchTotalPages(res.totalPages);
        setSearchTotalCount(res.total);
      } else {
        const nextPage = mobilePage + 1;
        const result = await getPaginatedUsersAction({
          search: searchParams?.get("search") || undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          kyc: kycFilter !== "all" ? kycFilter : undefined,
          state: stateFilter !== "all" ? stateFilter : undefined,
          dateRange: dateRangeFilter !== "all" ? dateRangeFilter : undefined,
          sort: sortBy !== "newest" ? sortBy : undefined,
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
      }
    } catch (err: unknown) {
      setLoadMoreMobileError(err instanceof Error ? err.message : "Failed to load more users.");
    } finally {
      setIsLoadingMoreMobile(false);
      isFetchingMobileRef.current = false;
    }
  }, [
    isSearchActive,
    searchPage,
    searchTotalPages,
    mobileHasMore,
    isLoadingMoreMobile,
    localSearchTerm,
    roleFilter,
    statusFilter,
    stateFilter,
    kycFilter,
    dateRangeFilter,
    sortBy,
    mobilePage,
    searchParams,
    PAGE_SIZE,
  ]);

  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) handleLoadMoreMobile();
      },
      { root: null, rootMargin: "300px", threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobile]);

  const handleMobileRetry = useCallback(() => {
    setLoadMoreMobileError(null);
    handleLoadMoreMobile();
  }, [handleLoadMoreMobile]);

  const updateFilter = useCallback((key: string, value: string) => {
    const params = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(searchParams?.toString() || "");
    if (value && value !== "all" && value !== "") params.set(key, value);
    else params.delete(key);
    params.delete("page"); // Reset to page 1 whenever any filter changes
    if (localSearchTerm.trim()) {
      params.set("search", localSearchTerm.trim());
    } else {
      params.delete("search");
    }
    const newQuery = params.toString();
    startTransition(() => {
      router.push(newQuery ? `/users?${newQuery}` : "/users", { scroll: false });
    });
  }, [localSearchTerm, searchParams, router]);

  // ── Pure High-Scale Server-Side Search Engine (Engineered for 100,000+ Users)
  // • Queries PostgreSQL via GIN Trigram indexes on (name, phone, email, etc.)
  // • Debounced 180ms with AbortController to cancel stale in-flight requests.
  // • Synchronizes ?search= query parameter into the active URL via window.history.replaceState.
  const executeServerSearch = useCallback(
    (query: string, page: number = 1) => {
      const trimmed = query.trim();

      // Persist active search query & page to browser address bar without page jump
      if (typeof window !== "undefined") {
        const currentParams = new URLSearchParams(window.location.search);
        if (trimmed) {
          currentParams.set("search", trimmed);
        } else {
          currentParams.delete("search");
        }
        if (page > 1) {
          currentParams.set("page", String(page));
        } else {
          currentParams.delete("page");
        }
        const newQuery = currentParams.toString();
        window.history.replaceState(null, "", newQuery ? `/users?${newQuery}` : "/users");
      }

      if (!trimmed) {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (searchAbortRef.current) searchAbortRef.current.abort();
        setSearchResults(null);
        setSearchTotalCount(0);
        setSearchTotalPages(0);
        setSearchPage(1);
        setIsSearchLoading(false);
        return;
      }

      // Abort any preceding in-flight server query to eliminate race conditions
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsSearchLoading(true);

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const res = await searchUsersServerAction(trimmed, {
            role: roleFilter !== "all" ? roleFilter : undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            state: stateFilter !== "all" ? stateFilter : undefined,
            kyc: kycFilter !== "all" ? kycFilter : undefined,
            dateRange: dateRangeFilter !== "all" ? dateRangeFilter : undefined,
            sort: sortBy !== "newest" ? sortBy : undefined,
            page,
            pageSize: 50,
          });

          if (!controller.signal.aborted) {
            setSearchResults(res.users);
            setSearchTotalCount(res.total);
            setSearchTotalPages(res.totalPages);
            setSearchPage(page);
            setIsSearchLoading(false);
          }
        } catch (err: any) {
          if (!controller.signal.aborted) {
            console.error("[Search] Server query error:", err);
            setIsSearchLoading(false);
          }
        }
      }, 180);
    },
    [roleFilter, statusFilter, stateFilter, kycFilter, dateRangeFilter, sortBy]
  );

  const handleSearchChange = useCallback(
    (val: string) => {
      setLocalSearchTerm(val);
      executeServerSearch(val, 1);
    },
    [executeServerSearch]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isSearchActive) {
        executeServerSearch(localSearchTerm, newPage);
        return;
      }
      const params = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(searchParams?.toString() || "");
      if (newPage > 1) {
        params.set("page", String(newPage));
      } else {
        params.delete("page");
      }
      if (localSearchTerm.trim()) {
        params.set("search", localSearchTerm.trim());
      }
      const newQuery = params.toString();
      startTransition(() => {
        router.push(newQuery ? `/users?${newQuery}` : "/users", { scroll: false });
      });
    },
    [isSearchActive, localSearchTerm, executeServerSearch, searchParams, router]
  );

  // If active filters change while searching, refresh the search results with new filters
  useEffect(() => {
    if (localSearchTerm.trim()) {
      executeServerSearch(localSearchTerm, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilterKey]);

  // Clean up search timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);

  const handleSearchSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
  }, []);

  // Optimistic User Mutation Handlers
  const handleApprove = useCallback(
    async (userId: string) => {
      const prevPending = pendingUsersList;
      const prevUsers = usersList;
      const targetUser = pendingUsersList.find((u) => u.id === userId);

      setPendingUsersList((prev) => prev.filter((u) => u.id !== userId));
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" as const } : u))
      );
      setLoading({ type: "approve", id: userId });

      try {
        const result = await approveUser(userId);
        setLoading(null);
        if (result.error) {
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
      const prevPending = pendingUsersList;
      const prevUsers = usersList;
      const targetUser = pendingUsersList.find((u) => u.id === userId);

      setPendingUsersList((prev) => prev.filter((u) => u.id !== userId));
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      setLoading({ type: "reject", id: userId });

      try {
        const result = await rejectUser(userId);
        setLoading(null);
        if (result.error) {
          setPendingUsersList(prevPending);
          setUsersList(prevUsers);
          toast("error", result.error);
        } else {
          toast("success", result.message || `User ${targetUser?.full_name || ""} rejected`);
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
    const prevPending = pendingUsersList;
    const prevUsers = usersList;
    const pendingIds = pendingUsersList.map((u) => u.id);

    setUsersList((prev) =>
      prev.map((u) => (pendingIds.includes(u.id) ? { ...u, status: "active" as const } : u))
    );
    setPendingUsersList([]);
    setIsBulkApproving(true);

    try {
      const result = await bulkApproveUsers(pendingIds);
      setIsBulkApproving(false);
      if (result.error) {
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Successfully approved ${result.successCount || prevPending.length} users`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkApproving(false);
      setPendingUsersList(prevPending);
      setUsersList(prevUsers);
      toast("error", err?.message || "Failed to approve all users. Please try again.");
    }
  }, [pendingUsersList, usersList, router, toast]);

  const handleRejectAllConfirm = useCallback(async () => {
    if (pendingUsersList.length === 0) return;
    const prevPending = pendingUsersList;
    const prevUsers = usersList;
    const pendingIds = pendingUsersList.map((u) => u.id);

    setUsersList((prev) => prev.filter((u) => !pendingIds.includes(u.id)));
    setPendingUsersList([]);
    setIsBulkRejecting(true);

    try {
      const result = await bulkRejectUsers(pendingIds);
      setIsBulkRejecting(false);
      setShowRejectAllConfirm(false);
      if (result.error) {
        setPendingUsersList(prevPending);
        setUsersList(prevUsers);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Successfully rejected ${result.successCount || prevPending.length} users`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkRejecting(false);
      setShowRejectAllConfirm(false);
      setPendingUsersList(prevPending);
      setUsersList(prevUsers);
      toast("error", err?.message || "Failed to reject all users. Please try again.");
    }
  }, [pendingUsersList, usersList, router, toast]);

  const handleCreateUser = async (formData: any) => {
    setLoading({ type: "create", id: "new" });
    const result = await createUser(formData);
    setLoading(null);
    if (result.error) {
      toast("error", result.error);
    } else {
      toast("success", result.message || "User account created successfully");
      setShowCreateModal(false);
      router.refresh();
    }
  };

  const handleEditUser = async (formData: any) => {
    if (!showEditModal) return;
    const userId = showEditModal.id;
    setLoading({ type: "edit", id: userId });

    const prevUsers = usersList;
    const prevSearch = searchResults;
    const userUpdater = (u: User) =>
      u.id === userId
        ? {
            ...u,
            full_name: formData.full_name ?? u.full_name,
            email: formData.email ?? u.email,
            phone: formData.phone ?? u.phone,
            role: formData.role ?? u.role,
            status: formData.status ?? u.status,
            shift_time: formData.shift_time ?? u.shift_time,
            address: formData.address ?? u.address,
            aadhaar_number: formData.aadhaar_number ?? u.aadhaar_number,
            license_number: formData.license_number ?? u.license_number,
            state: formData.state ?? u.state,
            state_id: formData.state_id !== undefined ? (formData.state_id ? Number(formData.state_id) : null) : u.state_id,
            district: formData.district ?? u.district,
            city: formData.city ?? u.city,
            supervisor_id: formData.supervisor_id ?? u.supervisor_id,
            working_location_id: formData.working_location_id ?? u.working_location_id,
          }
        : u;

    setUsersList((prev) => prev.map(userUpdater));
    setSearchResults((prev) => (prev ? prev.map(userUpdater) : null));

    try {
      const result = await editUser(userId, formData);
      setLoading(null);
      if (result.error) {
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", result.error);
      } else {
        toast("success", result.message || "User updated successfully");
        setShowEditModal(null);
        router.refresh();
      }
    } catch (err: any) {
      setLoading(null);
      setUsersList(prevUsers);
      setSearchResults(prevSearch);
      toast("error", err?.message || "Failed to update user.");
    }
  };

  const handleResetPassword = useCallback((user: User) => {
    setResetConfirmUser({ id: user.id, name: user.full_name, email: user.email });
  }, []);

  const handleConfirmResetPassword = async () => {
    if (!resetConfirmUser) return;
    setIsResettingPassword(true);
    try {
      const result = await resetUserPassword(resetConfirmUser.id);
      setIsResettingPassword(false);
      setResetConfirmUser(null);
      if (result.formState?.error) {
        toast("error", result.formState.error);
      } else if (result.newPassword) {
        setShowPasswordModal({
          userId: resetConfirmUser.id,
          userName: resetConfirmUser.name,
          password: result.newPassword,
        });
      } else {
        toast("success", result.formState?.message || "Password reset instructions sent");
      }
    } catch (err: any) {
      setIsResettingPassword(false);
      toast("error", err?.message || "Failed to reset password.");
    }
  };

  const handleToggleStatus = useCallback(
    async (userId: string, currentStatus: "active" | "inactive" | "pending") => {
      const prevUsers = usersList;
      const prevSearch = searchResults;
      const source = searchResults ?? usersList;
      const targetUser = source.find((u: User) => u.id === userId);
      const newStatus = currentStatus === "active" ? "inactive" : "active";

      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus as any } : u))
      );
      setSearchResults((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, status: newStatus as any } : u)) : null
      );
      setLoading({ type: "toggle", id: userId });

      try {
        const result = await toggleUserStatus(userId);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          setSearchResults(prevSearch);
          toast("error", result.error);
        } else {
          toast("success", result.message || `User ${targetUser?.full_name || ""} ${newStatus === "active" ? "activated" : "deactivated"}`);
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", err?.message || "Failed to update status.");
      }
    },
    [usersList, searchResults, router, toast]
  );

  const handleRoleChange = useCallback(
    async (userId: string, newRole: UserRole) => {
      const prevUsers = usersList;
      const prevSearch = searchResults;
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setSearchResults((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)) : null
      );
      setLoading({ type: "role", id: userId });

      try {
        const result = await updateUserRole(userId, newRole);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          setSearchResults(prevSearch);
          toast("error", result.error);
        } else {
          toast("success", result.message || "Role updated successfully");
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", err?.message || "Failed to update role.");
      }
    },
    [usersList, searchResults, router, toast]
  );

  const handleSupervisorChange = useCallback(
    async (userId: string, supervisorIds: string[] | string | null) => {
      const prevUsers = usersList;
      const prevSearch = searchResults;
      const primaryId = Array.isArray(supervisorIds) ? supervisorIds[0] ?? null : supervisorIds;
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, supervisor_id: primaryId } : u)));
      setSearchResults((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, supervisor_id: primaryId } : u)) : null
      );
      setLoading({ type: "supervisor", id: userId });

      try {
        const result = await updateUserSupervisor(userId, supervisorIds);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          setSearchResults(prevSearch);
          toast("error", result.error);
        } else {
          toast("success", result.message || "Supervisor updated successfully");
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", err?.message || "Failed to update supervisor.");
      }
    },
    [usersList, searchResults, router, toast]
  );

  const handleDeleteUser = useCallback(
    async (user: User) => {
      const prevUsers = usersList;
      const prevSearch = searchResults;
      setUsersList((prev) => prev.filter((u) => u.id !== user.id));
      setSearchResults((prev) => (prev ? prev.filter((u) => u.id !== user.id) : null));
      setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
      setLoading({ type: "delete", id: user.id });

      try {
        const result = await deleteUser(user.id);
        setLoading(null);
        if (result.error) {
          setUsersList(prevUsers);
          setSearchResults(prevSearch);
          toast("error", result.error);
        } else {
          toast("success", result.message || `User ${user.full_name} deleted`);
          router.refresh();
        }
      } catch (err: any) {
        setLoading(null);
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", err?.message || "Failed to delete user.");
      }
    },
    [usersList, searchResults, router, toast]
  );

  // Profile and Account Deletion Request Handlers
  const handleApproveProfileChange = useCallback(
    async (requestId: string) => {
      const prevRequests = profileRequestsList;
      const targetReq = profileRequestsList.find((r) => r.id === requestId);
      setProfileRequestsList((prev) => prev.filter((r) => r.id !== requestId));
      setProfileLoading({ type: "approve", id: requestId });

      try {
        const result = await approveProfileChangeRequest(requestId);
        setProfileLoading(null);
        if (result.error) {
          setProfileRequestsList(prevRequests);
          toast("error", result.error);
        } else {
          toast("success", result.message || `Profile changes for ${targetReq?.user?.full_name || "user"} approved`);
          router.refresh();
        }
      } catch (err: any) {
        setProfileLoading(null);
        setProfileRequestsList(prevRequests);
        toast("error", err?.message || "Failed to approve profile change request.");
      }
    },
    [profileRequestsList, router, toast]
  );

  const handleRejectProfileChange = useCallback(
    async (requestId: string, reason?: string) => {
      const prevRequests = profileRequestsList;
      const targetReq = profileRequestsList.find((r) => r.id === requestId);
      setProfileRequestsList((prev) => prev.filter((r) => r.id !== requestId));
      setProfileLoading({ type: "reject", id: requestId });

      try {
        const result = await rejectProfileChangeRequest(requestId, reason);
        setProfileLoading(null);
        if (result.error) {
          setProfileRequestsList(prevRequests);
          toast("error", result.error);
        } else {
          toast("success", result.message || `Profile changes for ${targetReq?.user?.full_name || "user"} rejected`);
          router.refresh();
        }
      } catch (err: any) {
        setProfileLoading(null);
        setProfileRequestsList(prevRequests);
        toast("error", err?.message || "Failed to reject profile change request.");
      }
    },
    [profileRequestsList, router, toast]
  );

  const handleApproveAllProfileChanges = useCallback(async () => {
    if (profileRequestsList.length === 0) return;
    const prevRequests = profileRequestsList;
    setProfileRequestsList([]);
    setIsBulkApprovingProfile(true);

    try {
      const requestIds = prevRequests.map((r) => r.id);
      const result = await bulkApproveProfileChangeRequests(requestIds);
      setIsBulkApprovingProfile(false);
      if (result.error) {
        setProfileRequestsList(prevRequests);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Approved all ${prevRequests.length} profile change requests`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkApprovingProfile(false);
      setProfileRequestsList(prevRequests);
      toast("error", err?.message || "Failed to bulk approve profile requests.");
    }
  }, [profileRequestsList, router, toast]);

  const handleRejectAllProfileChanges = useCallback(async () => {
    if (profileRequestsList.length === 0) return;
    const prevRequests = profileRequestsList;
    setProfileRequestsList([]);
    setIsBulkRejectingProfile(true);

    try {
      const requestIds = prevRequests.map((r) => r.id);
      const result = await bulkRejectProfileChangeRequests(requestIds);
      setIsBulkRejectingProfile(false);
      if (result.error) {
        setProfileRequestsList(prevRequests);
        toast("error", result.error);
      } else {
        toast("success", result.message || `Rejected all ${prevRequests.length} profile change requests`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkRejectingProfile(false);
      setProfileRequestsList(prevRequests);
      toast("error", err?.message || "Failed to bulk reject profile requests.");
    }
  }, [profileRequestsList, router, toast]);

  const handleApproveDeletion = useCallback(
    async (request: AccountDeletionRequest, notes?: string) => {
      const prevRequests = deletionRequestsList;
      setDeletionRequestsList((prev) => prev.filter((r) => r.id !== request.id));
      setDeletionLoading({ type: "approve", id: request.id });

      try {
        const result = await approveAccountDeletionRequestAction(request.id, notes);
        setDeletionLoading(null);
        if (result.error) {
          setDeletionRequestsList(prevRequests);
          toast("error", result.error);
        } else {
          toast("success", result.message || "Account deletion request approved.");
          router.refresh();
        }
      } catch (err: any) {
        setDeletionLoading(null);
        setDeletionRequestsList(prevRequests);
        toast("error", err?.message || "Failed to approve account deletion request.");
      }
    },
    [deletionRequestsList, router, toast]
  );

  const handleRejectDeletion = useCallback(
    async (request: AccountDeletionRequest, notes?: string) => {
      const prevRequests = deletionRequestsList;
      setDeletionRequestsList((prev) => prev.filter((r) => r.id !== request.id));
      setDeletionLoading({ type: "reject", id: request.id });

      try {
        const result = await rejectAccountDeletionRequestAction(request.id, notes);
        setDeletionLoading(null);
        if (result.error) {
          setDeletionRequestsList(prevRequests);
          toast("error", result.error);
        } else {
          toast("success", result.message || "Account deletion request rejected.");
          router.refresh();
        }
      } catch (err: any) {
        setDeletionLoading(null);
        setDeletionRequestsList(prevRequests);
        toast("error", err?.message || "Failed to reject account deletion request.");
      }
    },
    [deletionRequestsList, router, toast]
  );

  // Bulk Selection & Export Handlers
  const handleToggleSelect = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const currentRenderedUsers = isSearchActive ? filteredUsers : usersList;

  const handleSelectAllFiltered = useCallback(() => {
    const list = isSearchActive ? filteredUsers : usersList;
    if (selectedUserIds.length === list.length && list.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(list.map((u) => u.id));
    }
  }, [selectedUserIds, isSearchActive, filteredUsers, usersList]);

  const handleClearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const allFilteredSelected = currentRenderedUsers.length > 0 && selectedUserIds.length === currentRenderedUsers.length;
  const someFilteredSelected = selectedUserIds.length > 0 && selectedUserIds.length < currentRenderedUsers.length;

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    const prevUsers = usersList;
    const prevSearch = searchResults;
    const deletedCount = selectedUserIds.length;

    setUsersList((prev) => prev.filter((u) => !selectedUserIds.includes(u.id)));
    setSearchResults((prev) => (prev ? prev.filter((u) => !selectedUserIds.includes(u.id)) : null));
    setIsBulkDeleting(true);

    try {
      const result = await bulkDeleteUsers(selectedUserIds);
      setIsBulkDeleting(false);
      setShowBulkDeleteModal(false);
      if (result.error) {
        setUsersList(prevUsers);
        setSearchResults(prevSearch);
        toast("error", result.error);
      } else {
        setSelectedUserIds([]);
        toast("success", result.message || `Successfully deleted ${deletedCount} users`);
        router.refresh();
      }
    } catch (err: any) {
      setIsBulkDeleting(false);
      setShowBulkDeleteModal(false);
      setUsersList(prevUsers);
      setSearchResults(prevSearch);
      toast("error", err?.message || "Failed to delete selected users.");
    }
  }, [selectedUserIds, usersList, searchResults, router, toast]);

  // Export Implementations (Excel, CSV, PDF with 12 clean unified columns)
  const handleExportCurrentPage = useCallback(
    async (format: "xlsx" | "csv" | "pdf") => {
      try {
        const { exportUsersToExcel, exportUsersToCSV, exportUsersToPDF } = await import("@/lib/utils/users-export");
        if (format === "xlsx") {
          exportUsersToExcel(usersList, "Users-Page", `Page ${currentPage}`);
        } else if (format === "csv") {
          exportUsersToCSV(usersList, "Users-Page");
        } else {
          exportUsersToPDF(usersList, "Users-Page", `Page ${currentPage}`);
        }
        toast("success", `Exported ${usersList.length} users to .${format}`);
      } catch (err: any) {
        toast("error", err?.message || "Failed to export current page.");
      }
    },
    [usersList, currentPage, toast]
  );

  const handleExportFiltered = useCallback(
    async (format: "xlsx" | "csv" | "pdf") => {
      try {
        const filteredUsers = await exportUsersFilteredAction({
          search: searchParams?.get("search") || undefined,
          role: searchParams?.get("role") || undefined,
          status: searchParams?.get("status") || undefined,
          kyc: searchParams?.get("kyc") || undefined,
          state: searchParams?.get("state") || undefined,
          dateRange: searchParams?.get("dateRange") || undefined,
          sort: searchParams?.get("sort") || undefined,
        });

        const { exportUsersToExcel, exportUsersToCSV, exportUsersToPDF } = await import("@/lib/utils/users-export");
        if (format === "xlsx") {
          exportUsersToExcel(filteredUsers, "Users-Filtered", "Filtered Results");
        } else if (format === "csv") {
          exportUsersToCSV(filteredUsers, "Users-Filtered");
        } else {
          exportUsersToPDF(filteredUsers, "Users-Filtered", "Filtered Results");
        }
        toast("success", `Exported ${filteredUsers.length} users to .${format}`);
      } catch (err: any) {
        toast("error", err?.message || "Failed to export filtered dataset.");
      }
    },
    [searchParams, toast]
  );

  const handleExportAll = useCallback(
    async (format: "xlsx" | "csv" | "pdf") => {
      try {
        const allUsers = await exportUsersFilteredAction({});
        const { exportUsersToExcel, exportUsersToCSV, exportUsersToPDF } = await import("@/lib/utils/users-export");
        if (format === "xlsx") {
          exportUsersToExcel(allUsers, "Users-Directory-All", "Full Directory");
        } else if (format === "csv") {
          exportUsersToCSV(allUsers, "Users-Directory-All");
        } else {
          exportUsersToPDF(allUsers, "Users-Directory-All", "Full Directory");
        }
        toast("success", `Exported entire directory (${allUsers.length} users) to .${format}`);
      } catch (err: any) {
        toast("error", err?.message || "Failed to export full directory.");
      }
    },
    [toast]
  );

  const handleExportSelected = useCallback(
    async (format: "xlsx" | "csv" | "pdf") => {
      if (selectedUserIds.length === 0) return;
      try {
        const selectedUsers = [...usersList, ...pendingUsersList].filter((u) => selectedUserIds.includes(u.id));
        const { exportUsersToExcel, exportUsersToCSV, exportUsersToPDF } = await import("@/lib/utils/users-export");
        if (format === "xlsx") {
          exportUsersToExcel(selectedUsers, "Users-Selected", "Selected Users");
        } else if (format === "csv") {
          exportUsersToCSV(selectedUsers, "Users-Selected");
        } else {
          exportUsersToPDF(selectedUsers, "Users-Selected", "Selected Users");
        }
        toast("success", `Exported ${selectedUsers.length} selected users to .${format}`);
      } catch (err: any) {
        toast("error", err?.message || "Failed to export selected users.");
      }
    },
    [selectedUserIds, usersList, pendingUsersList, toast]
  );

  useEffect(() => {
    const handleQuickExportExcel = () => {
      if (selectedUserIds.length > 0) {
        handleExportSelected("xlsx");
      } else {
        handleExportFiltered("xlsx");
      }
    };
    const handleQuickExportCsv = () => {
      if (selectedUserIds.length > 0) {
        handleExportSelected("csv");
      } else {
        handleExportFiltered("csv");
      }
    };
    const handleQuickExportPdf = () => {
      if (selectedUserIds.length > 0) {
        handleExportSelected("pdf");
      } else {
        handleExportFiltered("pdf");
      }
    };
    const handleQuickExport = (e: Event) => {
      const customEvent = e as CustomEvent<{ format?: "excel" | "csv" | "pdf" }>;
      const format = customEvent.detail?.format;
      if (format === "csv") {
        handleQuickExportCsv();
      } else if (format === "pdf") {
        handleQuickExportPdf();
      } else {
        handleQuickExportExcel();
      }
    };

    window.addEventListener("reach:quick-export-excel", handleQuickExportExcel);
    window.addEventListener("reach:quick-export-csv", handleQuickExportCsv);
    window.addEventListener("reach:quick-export-pdf", handleQuickExportPdf);
    window.addEventListener("reach:quick-export", handleQuickExport);
    window.addEventListener("reach:quick-print", handleQuickExportPdf);
    return () => {
      window.removeEventListener("reach:quick-export-excel", handleQuickExportExcel);
      window.removeEventListener("reach:quick-export-csv", handleQuickExportCsv);
      window.removeEventListener("reach:quick-export-pdf", handleQuickExportPdf);
      window.removeEventListener("reach:quick-export", handleQuickExport);
      window.removeEventListener("reach:quick-print", handleQuickExportPdf);
    };
  }, [selectedUserIds, handleExportSelected, handleExportFiltered]);

  const stateOptions = useMemo(() => {
    const baseStates = aggregates?.states ?? [];
    if (baseStates.length === 0) {
      const stateSet = new Set<string>();
      usersList.forEach((u) => { if (u.state) stateSet.add(u.state); });
      return [
        { id: "all", label: "All States", dotColor: "" },
        ...Array.from(stateSet).sort().map((st) => ({
          id: st,
          label: st,
          dotColor: "bg-indigo-500",
        })),
      ];
    }
    return [
      { id: "all", label: "All States", dotColor: "" },
      ...baseStates.map((st) => ({
        id: st.id,
        label: st.label,
        dotColor: "bg-indigo-500",
      })),
    ];
  }, [aggregates?.states, usersList]);

  const activeFilterCount =
    (roleFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (stateFilter !== "all" ? 1 : 0) +
    (kycFilter !== "all" ? 1 : 0) +
    (dateRangeFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0) +
    (localSearchTerm.trim() !== "" ? 1 : 0);

  const resetFilters = useCallback(() => {
    setLocalSearchTerm("");
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    setSearchResults(null);
    setSearchTotalCount(0);
    setSearchTotalPages(0);
    setSearchPage(1);
    setIsSearchLoading(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/users");
    }
    startTransition(() => {
      router.push("/users", { scroll: false });
    });
  }, [router]);

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-6">
      {/* 1. Header with Export Menu & KPI Cards */}
      <UsersHeader
        totalCount={totalCount}
        readOnly={readOnly}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        aggregates={aggregates}
        usersCount={usersList.length}
        pendingCount={pendingUsersList.length}
        profileRequestsCount={profileRequestsList.length}
        deletionRequestsCount={deletionRequestsList.length}
        selectedCount={selectedUserIds.length}
        onRoleFilterChange={(val) => updateFilter("role", val)}
        onStatusFilterChange={(val) => updateFilter("status", val)}
        onAddUser={() => setShowCreateModal(true)}
        onExportCurrentPage={handleExportCurrentPage}
        onExportFiltered={handleExportFiltered}
        onExportAll={handleExportAll}
        onExportSelected={handleExportSelected}
        onScrollToProfileRequests={() => {
          const el = document.getElementById("profile-change-requests-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onScrollToDeletionRequests={() => {
          const el = document.getElementById("account-deletion-requests-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onScrollToPendingApprovals={() => {
          const el = document.getElementById("pending-approvals-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />

      {/* 2. Account Deletion Requests Section */}
      {!readOnly && deletionRequestsList.length > 0 && (
        <AccountDeletionRequestsSection
          requests={deletionRequestsList}
          onApprove={handleApproveDeletion}
          onReject={handleRejectDeletion}
          loadingState={deletionLoading}
        />
      )}

      {/* 3. Profile Change Requests Section */}
      {!readOnly && profileRequestsList.length > 0 && (
        <ProfileChangeRequests
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

      {/* 4. Pending Registrations Section */}
      {!readOnly && pendingUsersList.length > 0 && (
        <PendingApprovalsSection
          pendingUsers={pendingUsersList}
          onApprove={handleApprove}
          onReject={handleReject}
          onApproveAll={handleApproveAll}
          onRejectAllConfirm={() => setShowRejectAllConfirm(true)}
          onSelectUser={(u) => setSelectedSheetUser(u)}
          loadingState={loading}
          isBulkApproving={isBulkApproving}
          isBulkRejecting={isBulkRejecting}
        />
      )}

      {/* 5. Filter Toolbar & Dropdowns */}
      <UsersFilters
        searchTerm={localSearchTerm}
        onSearchChange={handleSearchChange}
        onSubmitSearch={handleSearchSubmit}
        isQueryLoading={isQueryLoading}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        roleFilter={roleFilter}
        onRoleFilterChange={(val) => updateFilter("role", val)}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => updateFilter("status", val)}
        stateFilter={stateFilter}
        onStateFilterChange={(val) => updateFilter("state", val)}
        kycFilter={kycFilter}
        onKycFilterChange={(val) => updateFilter("kyc", val)}
        dateRangeFilter={dateRangeFilter}
        onDateRangeFilterChange={(val) => updateFilter("dateRange", val)}
        sortBy={sortBy}
        onSortByChange={(val) => updateFilter("sort", val)}
        roleOptions={currentRoleOptions}
        stateOptions={stateOptions}
      />

      {/* 6. Content View: Desktop Table / Mobile Cards */}
      <UsersTable
        viewMode={viewMode}
        usersList={isSearchActive ? filteredUsers : usersList}
        mobileUsersList={isSearchActive ? filteredUsers : mobileUsersList}
        currentUser={currentUser}
        isSuperAdmin={isSuperAdmin}
        readOnly={readOnly}
        loading={loading}
        isQueryLoading={isQueryLoading}
        selectedUserIds={selectedUserIds}
        allFilteredSelected={allFilteredSelected}
        someFilteredSelected={someFilteredSelected}
        onSelectAllFiltered={handleSelectAllFiltered}
        onToggleSelect={handleToggleSelect}
        onOpenSheet={(u) => setSelectedSheetUser(u)}
        onEditUser={(u) => setShowEditModal(u)}
        onResetPassword={(userId) => {
          const source = searchResults ?? usersList;
          const u = source.find((x: User) => x.id === userId);
          if (u) handleResetPassword(u);
        }}
        onToggleStatus={(userId) => {
          const source = searchResults ?? usersList;
          const u = source.find((x: User) => x.id === userId);
          if (u) handleToggleStatus(userId, u.status as any);
        }}
        onRoleChange={handleRoleChange}
        onSupervisorChange={handleSupervisorChange}
        onDeleteUser={(userId) => {
          const source = searchResults ?? usersList;
          const u = source.find((x: User) => x.id === userId);
          if (u) handleDeleteUser(u);
        }}
        supervisors={supervisorOptions}
        searchTerm={localSearchTerm}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        currentPage={isSearchActive ? searchPage : currentPage}
        totalPages={isSearchActive ? searchTotalPages : totalPages}
        totalCount={isSearchActive ? searchTotalCount : totalCount}
        pageSize={isSearchActive ? 50 : PAGE_SIZE}
        onPageChange={handlePageChange}
        mobileHasMore={isSearchActive ? searchPage < searchTotalPages : mobileHasMore}
        isLoadingMoreMobile={isLoadingMoreMobile}
        loadMoreMobileError={loadMoreMobileError}
        onMobileRetry={handleMobileRetry}
        mobileSentinelRef={mobileSentinelRef}
      />

      {/* 7. Dialogs & Modals */}
      {selectedSheetUser && (
        <UserDetailSheet
          user={selectedSheetUser}
          onClose={() => setSelectedSheetUser(null)}
          currentUser={currentUser}
          isSuperAdmin={isSuperAdmin}
          loadingId={loading}
          supervisors={supervisorOptions}
          onEdit={(u) => {
            setSelectedSheetUser(null);
            setShowEditModal(u);
          }}
          onResetPassword={(userId) => {
            const u = usersList.find((x) => x.id === userId) || (selectedSheetUser.id === userId ? selectedSheetUser : null);
            if (u) handleResetPassword(u);
          }}
          onToggleStatus={(userId) => {
            const u = usersList.find((x) => x.id === userId) || (selectedSheetUser.id === userId ? selectedSheetUser : null);
            if (u) handleToggleStatus(userId, u.status as any);
          }}
          onUpdateRole={handleRoleChange}
          onUpdateSupervisor={handleSupervisorChange}
          onDelete={(userId) => {
            const u = usersList.find((x) => x.id === userId) || (selectedSheetUser.id === userId ? selectedSheetUser : null);
            if (u) handleDeleteUser(u);
          }}
        />
      )}

      {showCreateModal && (
        <UserCreateModal
          open={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            if (searchParams?.get("action") === "create") {
              const url = new URL(window.location.href);
              url.searchParams.delete("action");
              router.replace(url.pathname + (url.search ? url.search : ""));
            }
          }}
          isSuperAdmin={isSuperAdmin}
          loading={loading?.type === "create"}
          onSubmit={handleCreateUser}
          supervisors={supervisorOptions}
        />
      )}

      {showEditModal && (
        <UserEditModal
          user={showEditModal}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowEditModal(null)}
          loading={loading?.type === "edit"}
          onSubmit={handleEditUser}
          supervisors={supervisorOptions}
        />
      )}

      {resetConfirmUser && (
        <ConfirmationDialog
          isOpen={!!resetConfirmUser}
          onClose={() => setResetConfirmUser(null)}
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
                onClick={() => handleExportSelected("xlsx")}
                className="h-9 sm:h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportSelected("csv")}
                className="h-9 sm:h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to CSV (.csv)"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportSelected("pdf")}
                className="h-9 sm:h-8 px-3 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                title="Export selected users to PDF (.pdf)"
              >
                <FileText className="h-3.5 w-3.5 text-rose-400" />
                <span>PDF</span>
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