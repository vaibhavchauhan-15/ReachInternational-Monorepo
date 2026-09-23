"use client";

import React, { useState, useTransition, useCallback, useRef, useEffect, useMemo, memo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldAlert, X, ChevronDown, Check, Search, RotateCcw } from "lucide-react";
import {
  AnimatedSlidersHorizontal,
  AnimatedFileText,
} from "@/components/ui/animated-icons";
import {
  Button,
  Pagination,
  FilterToolbar,
} from "@/components/ui";
import { AnimatedCounter } from "@/components/ui/Motion";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { CRMClient, User } from "@/lib/types/database";
import type { ClientKPIs } from "@/lib/data/clients";
import { getClientListAction, restoreClientAction } from "@/app/actions/clients";
import { serializeClientFilter, type ClientDirectoryFilter } from "@reachinternational/utils";
import { ClientsHeader } from "./ClientsHeader";
import { ClientsTable } from "./ClientsTable";
import { MobileClientCard } from "./MobileClientCard";
import { MobileClientCardSkeletonList } from "./ClientsSkeletons";

interface ClientQueryCacheEntry {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  timestamp: number;
}

// ─── C5: Code-Split Heavy Modals & Drawers (Loaded strictly on demand) ────────

const AddClientModal = dynamic(
  () => import("./ClientModal").then((mod) => mod.ClientModal),
  { ssr: false }
);

const EditClientModal = dynamic(
  () => import("./ClientModal").then((mod) => mod.ClientModal),
  { ssr: false }
);

const ClientDetailDrawer = dynamic(
  () => import("./ClientDetailDrawer").then((mod) => mod.ClientDetailDrawer),
  { ssr: false }
);

const DeleteDialog = dynamic(
  () => import("./ClientDeleteModal").then((mod) => mod.ClientDeleteModal),
  { ssr: false }
);

const ExportModule = dynamic(
  () => import("./ClientExportModal").then((mod) => mod.ClientExportModal),
  { ssr: false }
);

const CustomFilterSelector = memo(function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; activeColor?: string; dotColor?: string }[];
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${open ? "z-40" : "z-10"} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={ariaLabel || label}
        className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98] shadow-2xs"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="text-[var(--color-mute)] font-medium shrink-0">{label}:</span>
          {selectedOption?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          <span
            className={`truncate font-semibold ${
              selectedOption?.id !== "all"
                ? selectedOption?.activeColor || "text-[var(--color-ink)]"
                : "text-[var(--color-ink)]"
            }`}
          >
            {selectedOption?.label}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
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
                  className={`w-full min-h-[44px] sm:min-h-[36px] flex items-center justify-between px-3 sm:px-2.5 py-2.5 sm:py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
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
});

const CLIENT_STATUS_OPTIONS = [
  { id: "all", label: "All Status", activeColor: "text-[var(--color-ink)]", dotColor: "" },
  { id: "active", label: "Active", activeColor: "text-emerald-700 dark:text-emerald-400 font-semibold", dotColor: "bg-emerald-500" },
  { id: "inactive", label: "Inactive", activeColor: "text-amber-700 dark:text-amber-400 font-semibold", dotColor: "bg-amber-500" },
];

const CLIENT_SORT_OPTIONS = [
  { id: "company_name_asc", label: "Company Name (A → Z)" },
  { id: "company_name_desc", label: "Company Name (Z → A)" },
  { id: "code_asc", label: "Client Code (A → Z)" },
  { id: "code_desc", label: "Client Code (Z → A)" },
  { id: "created_at_desc", label: "Newest Registered" },
  { id: "created_at_asc", label: "Oldest Registered" },
];

interface ClientsCoordinatorClientProps {
  user: User;
  initialClients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  metrics: ClientKPIs;
  availableCities?: string[];
  currentSort?: string;
}

export function ClientsCoordinatorClient({
  user,
  initialClients,
  total,
  page,
  pageSize,
  metrics,
  availableCities = [],
  currentSort: initialSortParam = "company_name_asc",
}: ClientsCoordinatorClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Active filters from URL
  const searchParam = searchParams.get("search") || "";
  const statusParam = (searchParams.get("status") as "all" | "active" | "inactive") || "all";
  const cityParam = searchParams.get("city") || "all";
  const sortParam = searchParams.get("sort") || "company_name";
  const orderParam = (searchParams.get("order") as "asc" | "desc") || "asc";

  // In-memory query state for instant client-side tab switching
  const [clients, setClients] = useState<CRMClient[]>(initialClients);
  const [totalCount, setTotalCount] = useState<number>(total);
  const [currentPage, setCurrentPage] = useState<number>(page);
  const [currentPageSize, setCurrentPageSize] = useState<number>(pageSize);
  const [currentStatus, setCurrentStatus] = useState<"all" | "active" | "inactive">(statusParam);
  const [currentSearch, setCurrentSearch] = useState<string>(searchParam);
  const [localSearchTerm, setLocalSearchTerm] = useState<string>(searchParam);
  const [currentCity, setCurrentCity] = useState<string>(cityParam);
  const [currentSort, setCurrentSort] = useState<string>(sortParam);
  const [currentOrder, setCurrentOrder] = useState<"asc" | "desc">(orderParam);
  const [isTabLoading, setIsTabLoading] = useState<boolean>(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Strip legacy tab parameter (e.g. ?tab=all) to normalize URL to clean /clients
  useEffect(() => {
    if (searchParams?.has("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const newQuery = params.toString();
      router.replace(newQuery ? `/clients?${newQuery}` : "/clients", { scroll: false });
    }
  }, [searchParams, router]);

  // Mobile Infinite Scroll State for Cards View (Chunk-by-chunk lazy loading)
  const [mobileClientsList, setMobileClientsList] = useState<CRMClient[]>(initialClients);
  const [mobilePage, setMobilePage] = useState<number>(page);
  const [mobileHasMore, setMobileHasMore] = useState<boolean>(page < Math.ceil(total / pageSize));
  const [isLoadingMoreMobile, setIsLoadingMoreMobile] = useState<boolean>(false);
  const [loadMoreMobileError, setLoadMoreMobileError] = useState<string | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingMobileRef = useRef<boolean>(false);

  // C9: In-memory session query cache for 0ms sub-tab restorations
  const queryCacheRef = useRef<Map<string, ClientQueryCacheEntry>>(new Map());

  // Synchronize state when SSR props update and seed initial query cache
  useEffect(() => {
    setClients(initialClients);
    setMobileClientsList(initialClients);
    setMobilePage(page);
    setMobileHasMore(page < Math.ceil(total / pageSize));
    setLoadMoreMobileError(null);
    setTotalCount(total);
    setCurrentPage(page);
    setCurrentPageSize(pageSize);
    setCurrentStatus(statusParam);
    setCurrentSearch(searchParam);
    setLocalSearchTerm(searchParam);
    setCurrentCity(cityParam);
    setCurrentSort(sortParam);
    setCurrentOrder(orderParam);

    // Seed query cache with initial dataset
    const initialFilter: ClientDirectoryFilter = {
      status: statusParam,
      search: searchParam,
      city: cityParam,
      sortField: sortParam,
      sortOrder: orderParam,
      page,
      pageSize,
    };
    const initialKey = serializeClientFilter(initialFilter);
    queryCacheRef.current.set(initialKey, {
      clients: initialClients,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      timestamp: Date.now(),
    });

    // C9 Intelligent Detection: If the list query already has all active records (e.g. metrics.total === metrics.active)
    if (statusParam === "all" && metrics.total === metrics.active && !searchParam && cityParam === "all") {
      const activeKey = serializeClientFilter({
        ...initialFilter,
        status: "active",
      });
      queryCacheRef.current.set(activeKey, {
        clients: initialClients,
        total: metrics.active,
        page: 1,
        pageSize,
        totalPages: Math.ceil(metrics.active / pageSize),
        timestamp: Date.now(),
      });
    }

    // C9 Intelligent Detection: If inactive count is 0, pre-seed empty inactive dataset
    if (metrics.inactive === 0 && !searchParam && cityParam === "all") {
      const inactiveKey = serializeClientFilter({
        ...initialFilter,
        status: "inactive",
      });
      queryCacheRef.current.set(inactiveKey, {
        clients: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
        timestamp: Date.now(),
      });
    }
  }, [
    initialClients,
    total,
    page,
    pageSize,
    statusParam,
    searchParam,
    cityParam,
    sortParam,
    orderParam,
    metrics.total,
    metrics.active,
    metrics.inactive,
  ]);

  // Lazy modal & drawer display states (deferred chunks)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<CRMClient | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<CRMClient | null>(null);

  const [isExportModuleOpen, setIsExportModuleOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageClients = ["super_admin", "admin", "manager"].includes(user.role);

  // View mode switcher: "auto" | "cards" | "table"
  const [viewMode, setViewMode] = useState<"auto" | "cards" | "table">("auto");
  const isDesktop = useMediaQuery("(min-width: 641px)");

  const effectiveView: "table" | "cards" = useMemo(() => {
    if (viewMode === "table") return "table";
    if (viewMode === "cards") return "cards";
    return isDesktop ? "table" : "cards";
  }, [viewMode, isDesktop]);

  const displayedCardsClients = useMemo(() => {
    if (isDesktop && viewMode === "cards") {
      return clients;
    }
    return mobileClientsList;
  }, [isDesktop, viewMode, clients, mobileClientsList]);

  const currentSortKey = useMemo(() => {
    if (currentSort === "company_name") {
      return currentOrder === "desc" ? "company_name_desc" : "company_name_asc";
    }
    if (currentSort === "code") {
      return currentOrder === "desc" ? "code_desc" : "code_asc";
    }
    if (currentSort === "created_at") {
      return currentOrder === "asc" ? "created_at_asc" : "created_at_desc";
    }
    return "company_name_asc";
  }, [currentSort, currentOrder]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentStatus !== "all") count++;
    if (currentCity !== "all") count++;
    if (localSearchTerm.trim() !== "") count++;
    if (currentSortKey !== "company_name_asc") count++;
    return count;
  }, [currentStatus, currentCity, localSearchTerm, currentSortKey]);

  const cityOptions = useMemo(() => {
    const options = [{ id: "all", label: `All Locations (${availableCities.length})` }];
    availableCities.forEach((city) => {
      options.push({ id: city, label: city });
    });
    return options;
  }, [availableCities]);

  // Quick-add trigger from the reusable MobilePageHeader (+ / 3-dot)
  useEffect(() => {
    const handleQuickAdd = () => {
      setIsAddModalOpen(true);
    };
    window.addEventListener("reach:quick-add", handleQuickAdd);
    window.addEventListener("reach:quick-add-client", handleQuickAdd);
    return () => {
      window.removeEventListener("reach:quick-add", handleQuickAdd);
      window.removeEventListener("reach:quick-add-client", handleQuickAdd);
    };
  }, []);

  // Quick-export & quick-print events from mobile header & desktop more menu
  useEffect(() => {
    const handleExportExcel = () => {
      setIsExportModuleOpen(true);
    };
    const handleExportCSV = () => {
      setIsExportModuleOpen(true);
    };
    const handlePrintEvent = () => {
      window.print();
    };
    window.addEventListener("reach:quick-export-excel", handleExportExcel);
    window.addEventListener("reach:quick-export-csv", handleExportCSV);
    window.addEventListener("reach:quick-print", handlePrintEvent);
    return () => {
      window.removeEventListener("reach:quick-export-excel", handleExportExcel);
      window.removeEventListener("reach:quick-export-csv", handleExportCSV);
      window.removeEventListener("reach:quick-print", handlePrintEvent);
    };
  }, []);

  // ─── Silent URL Synchronization (Preserves bookmarkability without full RSC reload) ───

  const syncUrl = useCallback(
    (updates: {
      status?: "all" | "active" | "inactive";
      page?: number;
      pageSize?: number;
      search?: string;
      city?: string;
      sortField?: string;
      sortOrder?: "asc" | "desc";
    }) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);

      if (updates.status !== undefined) {
        if (updates.status !== "all") {
          params.set("status", updates.status);
        } else {
          params.delete("status");
        }
      }

      if (updates.page !== undefined) {
        if (updates.page > 1) {
          params.set("page", String(updates.page));
        } else {
          params.delete("page");
        }
      }

      if (updates.search !== undefined) {
        if (updates.search.trim()) {
          params.set("search", updates.search.trim());
        } else {
          params.delete("search");
        }
      }

      if (updates.city !== undefined) {
        if (updates.city !== "all") {
          params.set("city", updates.city);
        } else {
          params.delete("city");
        }
      }

      if (updates.sortField !== undefined) {
        if (updates.sortField !== "company_name") {
          params.set("sort", updates.sortField);
        } else {
          params.delete("sort");
        }
      }

      if (updates.sortOrder !== undefined) {
        if (updates.sortOrder !== "asc") {
          params.set("order", updates.sortOrder);
        } else {
          params.delete("order");
        }
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize !== 10) {
          params.set("pageSize", String(updates.pageSize));
        } else {
          params.delete("pageSize");
        }
      }

      const qs = params.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;
      window.history.replaceState(null, "", newUrl);
    },
    [pathname]
  );

  // ─── Query Execution with Cache Integration ───────────────────────────────────

  const executeFilterQuery = useCallback(
    async (nextFilter: ClientDirectoryFilter) => {
      const cacheKey = serializeClientFilter(nextFilter);
      const cached = queryCacheRef.current.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 60000) {
        setClients(cached.clients);
        setMobileClientsList(cached.clients);
        setMobilePage(cached.page);
        setMobileHasMore(cached.page < cached.totalPages);
        setLoadMoreMobileError(null);
        setTotalCount(cached.total);
        setCurrentPage(cached.page);
        setCurrentPageSize(cached.pageSize);
        if (nextFilter.status) setCurrentStatus(nextFilter.status);
        if (nextFilter.search !== undefined) {
          setCurrentSearch(nextFilter.search);
          setLocalSearchTerm(nextFilter.search);
        }
        if (nextFilter.city !== undefined) setCurrentCity(nextFilter.city);
        if (nextFilter.sortField) setCurrentSort(nextFilter.sortField);
        if (nextFilter.sortOrder) setCurrentOrder(nextFilter.sortOrder);
        syncUrl(nextFilter);
        return;
      }

      setIsTabLoading(true);
      try {
        const res = await getClientListAction(nextFilter);
        if (res.success && res.data) {
          const entry: ClientQueryCacheEntry = {
            clients: res.data.clients,
            total: res.data.total,
            page: res.data.page,
            pageSize: res.data.pageSize,
            totalPages: res.data.totalPages,
            timestamp: Date.now(),
          };
          queryCacheRef.current.set(cacheKey, entry);
          setClients(entry.clients);
          setMobileClientsList(entry.clients);
          setMobilePage(entry.page);
          setMobileHasMore(entry.page < entry.totalPages);
          setLoadMoreMobileError(null);
          setTotalCount(entry.total);
          setCurrentPage(entry.page);
          setCurrentPageSize(entry.pageSize);
          if (nextFilter.status) setCurrentStatus(nextFilter.status);
          if (nextFilter.search !== undefined) {
            setCurrentSearch(nextFilter.search);
            setLocalSearchTerm(nextFilter.search);
          }
          if (nextFilter.city !== undefined) setCurrentCity(nextFilter.city);
          if (nextFilter.sortField) setCurrentSort(nextFilter.sortField);
          if (nextFilter.sortOrder) setCurrentOrder(nextFilter.sortOrder);
          syncUrl(nextFilter);
        }
      } catch (err) {
        console.error("Error executing client directory query:", err);
      } finally {
        setIsTabLoading(false);
      }
    },
    [syncUrl]
  );

  // ─── C9: All / Active / Inactive Tab Handler ───────────────────────────────────

  const handleStatusChange = useCallback(
    async (newStatus: "all" | "active" | "inactive") => {
      if (newStatus === currentStatus) return;

      const targetFilter: ClientDirectoryFilter = {
        status: newStatus,
        search: currentSearch,
        city: currentCity,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: 1,
        pageSize: currentPageSize,
      };
      const targetKey = serializeClientFilter(targetFilter);

      // 1. Check in-memory session cache (60s TTL) -> 0ms cache hit
      const cached = queryCacheRef.current.get(targetKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        setClients(cached.clients);
        setMobileClientsList(cached.clients);
        setMobilePage(cached.page);
        setMobileHasMore(cached.page < cached.totalPages);
        setLoadMoreMobileError(null);
        setTotalCount(cached.total);
        setCurrentPage(cached.page);
        setCurrentStatus(newStatus);
        syncUrl({ status: newStatus, page: 1 });
        return;
      }

      // 2. C9 Detection: If clicking Active and existing list query already has status=active
      if (newStatus === "active") {
        // Case A: Initial or cached dataset was 'all' and total === active
        const allKey = serializeClientFilter({ ...targetFilter, status: "all" });
        const cachedAll = queryCacheRef.current.get(allKey);

        if (
          (cachedAll && metrics.total === metrics.active && !currentSearch) ||
          (currentStatus === "all" && metrics.total === metrics.active && !currentSearch)
        ) {
          const source = cachedAll || {
            clients,
            total: metrics.active,
            page: 1,
            pageSize: currentPageSize,
            totalPages: Math.ceil(metrics.active / currentPageSize),
          };
          queryCacheRef.current.set(targetKey, {
            ...source,
            timestamp: Date.now(),
          });
          setClients(source.clients);
          setMobileClientsList(source.clients);
          setMobilePage(1);
          setMobileHasMore(1 < Math.ceil(source.total / currentPageSize));
          setLoadMoreMobileError(null);
          setTotalCount(source.total);
          setCurrentPage(1);
          setCurrentStatus("active");
          syncUrl({ status: "active", page: 1 });
          return;
        }

        // Case B: If cached All has all rows (total <= pageSize), filter active in memory
        if (cachedAll && cachedAll.total <= cachedAll.pageSize) {
          const activeOnly = cachedAll.clients.filter(
            (c) => c.status === "active" && !c.deleted_at
          );
          if (activeOnly.length === metrics.active || !currentSearch) {
            const entry: ClientQueryCacheEntry = {
              clients: activeOnly,
              total: activeOnly.length,
              page: 1,
              pageSize: currentPageSize,
              totalPages: Math.max(1, Math.ceil(activeOnly.length / currentPageSize)),
              timestamp: Date.now(),
            };
            queryCacheRef.current.set(targetKey, entry);
            setClients(entry.clients);
            setMobileClientsList(entry.clients);
            setMobilePage(1);
            setMobileHasMore(1 < entry.totalPages);
            setLoadMoreMobileError(null);
            setTotalCount(entry.total);
            setCurrentPage(1);
            setCurrentStatus("active");
            syncUrl({ status: "active", page: 1 });
            return;
          }
        }
      }

      // 3. C9 Detection: If clicking Inactive and metrics.inactive === 0 (with no search)
      if (newStatus === "inactive" && metrics.inactive === 0 && !currentSearch) {
        const entry: ClientQueryCacheEntry = {
          clients: [],
          total: 0,
          page: 1,
          pageSize: currentPageSize,
          totalPages: 0,
          timestamp: Date.now(),
        };
        queryCacheRef.current.set(targetKey, entry);
        setClients([]);
        setMobileClientsList([]);
        setMobilePage(1);
        setMobileHasMore(false);
        setLoadMoreMobileError(null);
        setTotalCount(0);
        setCurrentPage(1);
        setCurrentStatus("inactive");
        syncUrl({ status: "inactive", page: 1 });
        return;
      }

      // 4. Cache Miss: Fetch on demand strictly when required
      setIsTabLoading(true);
      try {
        const res = await getClientListAction(targetFilter);
        if (res.success && res.data) {
          const entry: ClientQueryCacheEntry = {
            clients: res.data.clients,
            total: res.data.total,
            page: res.data.page,
            pageSize: res.data.pageSize,
            totalPages: res.data.totalPages,
            timestamp: Date.now(),
          };
          queryCacheRef.current.set(targetKey, entry);
          setClients(entry.clients);
          setMobileClientsList(entry.clients);
          setMobilePage(entry.page);
          setMobileHasMore(entry.page < entry.totalPages);
          setLoadMoreMobileError(null);
          setTotalCount(entry.total);
          setCurrentPage(entry.page);
          setCurrentStatus(newStatus);
          syncUrl({ status: newStatus, page: 1 });
        }
      } catch (err) {
        console.error("Failed to load status tab data:", err);
      } finally {
        setIsTabLoading(false);
      }
    },
    [
      currentStatus,
      currentSearch,
      currentCity,
      currentSort,
      currentOrder,
      currentPageSize,
      metrics.total,
      metrics.active,
      metrics.inactive,
      clients,
      syncUrl,
    ]
  );

  // ─── Filter & Search Handlers ───────────────────────────────────────────────

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      setLocalSearchTerm(newSearch);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        executeFilterQuery({
          status: currentStatus,
          search: newSearch,
          city: currentCity,
          sortField: currentSort,
          sortOrder: currentOrder,
          page: 1,
          pageSize: currentPageSize,
        });
      }, 350);
    },
    [executeFilterQuery, currentStatus, currentCity, currentSort, currentOrder, currentPageSize]
  );

  const handleSearchSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: currentCity,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: 1,
        pageSize: currentPageSize,
      });
    },
    [executeFilterQuery, currentStatus, localSearchTerm, currentCity, currentSort, currentOrder, currentPageSize]
  );

  const handleCityChange = useCallback(
    (newCity: string) => {
      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: newCity,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: 1,
        pageSize: currentPageSize,
      });
    },
    [executeFilterQuery, currentStatus, localSearchTerm, currentSort, currentOrder, currentPageSize]
  );

  const handleSortSelect = useCallback(
    (sortKey: string) => {
      let sortField = "company_name";
      let sortOrder: "asc" | "desc" = "asc";

      switch (sortKey) {
        case "company_name_desc":
          sortField = "company_name";
          sortOrder = "desc";
          break;
        case "code_asc":
          sortField = "code";
          sortOrder = "asc";
          break;
        case "code_desc":
          sortField = "code";
          sortOrder = "desc";
          break;
        case "created_at_desc":
          sortField = "created_at";
          sortOrder = "desc";
          break;
        case "created_at_asc":
          sortField = "created_at";
          sortOrder = "asc";
          break;
        case "company_name_asc":
        default:
          sortField = "company_name";
          sortOrder = "asc";
          break;
      }

      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: currentCity,
        sortField,
        sortOrder,
        page: 1,
        pageSize: currentPageSize,
      });
    },
    [currentStatus, localSearchTerm, currentCity, currentPageSize, executeFilterQuery]
  );

  const handleSortChange = useCallback(
    (column: string) => {
      const nextOrder = currentSort === column && currentOrder === "asc" ? "desc" : "asc";
      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: currentCity,
        sortField: column,
        sortOrder: nextOrder,
        page: currentPage,
        pageSize: currentPageSize,
      });
    },
    [
      executeFilterQuery,
      currentStatus,
      localSearchTerm,
      currentCity,
      currentSort,
      currentOrder,
      currentPage,
      currentPageSize,
    ]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: currentCity,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: newPage,
        pageSize: currentPageSize,
      });
    },
    [
      executeFilterQuery,
      currentStatus,
      localSearchTerm,
      currentCity,
      currentSort,
      currentOrder,
      currentPageSize,
    ]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      executeFilterQuery({
        status: currentStatus,
        search: localSearchTerm,
        city: currentCity,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: 1,
        pageSize: newPageSize,
      });
    },
    [
      executeFilterQuery,
      currentStatus,
      localSearchTerm,
      currentCity,
      currentSort,
      currentOrder,
    ]
  );

  const handleResetAllFilters = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setLocalSearchTerm("");
    executeFilterQuery({
      status: "all",
      search: "",
      city: "all",
      sortField: "company_name",
      sortOrder: "asc",
      page: 1,
      pageSize: 10,
    });
  }, [executeFilterQuery]);

  // Modal open triggers
  const handleOpenAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((client: CRMClient) => {
    setEditingClient(client);
    setIsEditModalOpen(true);
  }, []);

  const handleOpenDetailDrawer = useCallback((client: CRMClient) => {
    setViewingClient(client);
    setIsDetailDrawerOpen(true);
  }, []);

  const handleOpenDeleteDialog = useCallback((client: CRMClient) => {
    setDeletingClient(client);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleRestoreClient = useCallback(
    async (client: CRMClient) => {
      try {
        const res = await restoreClientAction(client.id);
        if (res.error) {
          setToastMessage({
            type: "error",
            text: res.error,
          });
          return;
        }

        // Immediate local state update:
        if (currentStatus === "inactive") {
          setClients((prev) => prev.filter((c) => c.id !== client.id));
          setMobileClientsList((prev) => prev.filter((c) => c.id !== client.id));
          setTotalCount((prev) => Math.max(0, prev - 1));
        } else {
          setClients((prev) =>
            prev.map((c) =>
              c.id === client.id ? { ...c, status: "active", deleted_at: null } : c
            )
          );
          setMobileClientsList((prev) =>
            prev.map((c) =>
              c.id === client.id ? { ...c, status: "active", deleted_at: null } : c
            )
          );
        }

        queryCacheRef.current.clear();
        setToastMessage({
          type: "success",
          text: `Client "${client.company_name || client.client_name}" restored successfully.`,
        });
        startTransition(() => {
          router.refresh();
        });
      } catch (err: any) {
        setToastMessage({
          type: "error",
          text: err.message || "Failed to restore client.",
        });
      }
    },
    [currentStatus, router]
  );

  const handleOpenExportModule = useCallback(() => {
    setIsExportModuleOpen(true);
  }, []);

  // ─── Mobile Chunk-by-Chunk Infinite Scroll Handler ───────────────────────────

  const handleLoadMoreMobile = useCallback(async () => {
    if (isFetchingMobileRef.current || !mobileHasMore || isLoadingMoreMobile || isTabLoading || isPending) return;
    isFetchingMobileRef.current = true;
    setIsLoadingMoreMobile(true);
    setLoadMoreMobileError(null);

    try {
      const nextPage = mobilePage + 1;
      const res = await getClientListAction({
        status: currentStatus !== "all" ? currentStatus : undefined,
        search: localSearchTerm.trim() || undefined,
        city: currentCity !== "all" ? currentCity : undefined,
        sortField: currentSort,
        sortOrder: currentOrder,
        page: nextPage,
        pageSize: currentPageSize,
      });

      if (res.success && res.data) {
        const { clients: nextClients, totalPages } = res.data;
        setMobileClientsList((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const freshClients = nextClients.filter((c) => !existingIds.has(c.id));
          return [...prev, ...freshClients];
        });
        setMobilePage(nextPage);
        setMobileHasMore(nextPage < totalPages);
      } else {
        setLoadMoreMobileError(res.error || "Failed to load more clients.");
      }
    } catch (err: any) {
      setLoadMoreMobileError(err?.message || "An unexpected error occurred while loading more clients.");
    } finally {
      setIsLoadingMoreMobile(false);
      isFetchingMobileRef.current = false;
    }
  }, [
    mobileHasMore,
    isLoadingMoreMobile,
    isTabLoading,
    isPending,
    mobilePage,
    currentStatus,
    localSearchTerm,
    currentCity,
    currentSort,
    currentOrder,
    currentPageSize,
  ]);

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
      { root: null, rootMargin: "350px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobile]);

  const handleMobileRetry = useCallback(() => {
    setLoadMoreMobileError(null);
    handleLoadMoreMobile();
  }, [handleLoadMoreMobile]);

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-6">
      {/* Toast Notice Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold shadow-md ${
              toastMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. ClientHeader with XLSX Export, MoreMenu, and Primary Add Client */}
      <ClientsHeader
        canManageClients={canManageClients}
        totalClients={metrics.total}
        onOpenAddModal={handleOpenAddModal}
        onOpenExportModal={handleOpenExportModule}
      />

      {/* 2. Interactive KPI Cards Row (matching /machines pattern) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Accounts Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusChange("all")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "all"
              ? "bg-[var(--color-canvas-elevated)] border-[var(--color-ink)] shadow-xs ring-1 ring-[var(--color-ink)]/10"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
            Total Accounts
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            <AnimatedCounter value={metrics.total} />
          </div>
        </motion.div>

        {/* Active Accounts Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusChange("active")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "active"
              ? "bg-emerald-50/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-emerald-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Active Accounts
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            <AnimatedCounter value={metrics.active} />
          </div>
        </motion.div>

        {/* Inactive Accounts Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStatusChange("inactive")}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentStatus === "inactive"
              ? "bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/20 dark:bg-amber-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-amber-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Inactive / Churned
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            <AnimatedCounter value={metrics.inactive} />
          </div>
        </motion.div>

        {/* Active Cities Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (currentCity !== "all") {
              handleCityChange("all");
            }
          }}
          className={`cursor-pointer p-3.5 sm:p-4 rounded-xl border transition-all ${
            currentCity !== "all"
              ? "bg-indigo-50/40 border-indigo-500 shadow-xs ring-1 ring-indigo-500/20 dark:bg-indigo-950/20"
              : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] hover:border-indigo-500/40"
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--color-mute)] uppercase tracking-wider">
            Active Cities
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] mt-1">
            <AnimatedCounter value={availableCities.length} />
          </div>
        </motion.div>
      </div>

      {/* 3. Search Bar & Filter Toolbar */}
      <FilterToolbar
        searchQuery={localSearchTerm}
        onSearchChange={handleSearchChange}
        placeholder="Search company name, code, contact person, city..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetAllFilters}
        onSubmitSearch={handleSearchSubmit}
        isLoading={isPending || isTabLoading}
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher is strictly hidden on mobile viewports (≤640px) */}
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
          </div>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          {/* Responsive Custom Dropdown Filter Selectors for Status, City/Location, & Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-2.5 w-full">
            {/* 1. Status Selector */}
            <div className="w-full min-w-0">
              <CustomFilterSelector
                label="Status"
                value={currentStatus}
                onChange={(val) => handleStatusChange(val as "all" | "active" | "inactive")}
                options={CLIENT_STATUS_OPTIONS}
                ariaLabel="Filter by client status"
                align="left"
              />
            </div>

            {/* 2. City / Location Selector */}
            <div className="w-full min-w-0">
              <CustomFilterSelector
                label="Location"
                value={currentCity}
                onChange={handleCityChange}
                options={cityOptions}
                ariaLabel="Filter by location"
                align="left"
              />
            </div>

            {/* 3. Sort By Selector */}
            <div className="w-full min-w-0">
              <CustomFilterSelector
                label="Sort"
                value={currentSortKey}
                onChange={handleSortSelect}
                options={CLIENT_SORT_OPTIONS}
                ariaLabel="Sort clients"
                align="right"
              />
            </div>
          </div>

          {/* Active Filter Badge Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-hairline)] text-xs">
              <span className="text-[11px] font-semibold text-[var(--color-mute)] mr-1">
                Active Filters:
              </span>
              {localSearchTerm.trim() !== "" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-medium">
                  <span>Search: &quot;{localSearchTerm}&quot;</span>
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="hover:text-rose-600 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {currentStatus !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                  <span>Status: {currentStatus === "active" ? "Active" : "Inactive"}</span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("all")}
                    className="hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {currentCity !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium">
                  <span>Location: {currentCity}</span>
                  <button
                    type="button"
                    onClick={() => handleCityChange("all")}
                    className="hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {currentSortKey !== "company_name_asc" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-medium">
                  <span>Sort: {CLIENT_SORT_OPTIONS.find((s) => s.id === currentSortKey)?.label || currentSortKey}</span>
                  <button
                    type="button"
                    onClick={() => handleSortSelect("company_name_asc")}
                    className="hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="text-[11px] font-bold text-[var(--color-link)] hover:underline ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </FilterToolbar>

      {/* 4. Mutually Exclusive View Rendering */}
      {effectiveView === "table" ? (
        /* Table Only View */
        <div className="w-full">
          <ClientsTable
            clients={clients}
            total={totalCount}
            page={currentPage}
            pageSize={currentPageSize}
            isPending={isPending || isTabLoading}
            canManageClients={canManageClients}
            sortField={currentSort}
            sortOrder={currentOrder}
            onSortChange={handleSortChange}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 25, 50, 100]}
            onViewClient={handleOpenDetailDrawer}
            onEditClient={handleOpenEditModal}
            onDeleteClient={handleOpenDeleteDialog}
            onRestoreClient={handleRestoreClient}
          />
        </div>
      ) : (
        /* Cards Only View */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {isPending || isTabLoading ? (
              <MobileClientCardSkeletonList count={currentPageSize} />
            ) : displayedCardsClients.length === 0 ? (
              <div className="col-span-full py-12 px-4 text-center rounded-2xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-hairline-soft-surface)] flex items-center justify-center text-[var(--color-mute)]">
                  <Search className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold text-[var(--color-ink)]">
                  {localSearchTerm.trim()
                    ? `No clients found matching "${localSearchTerm}"`
                    : "No clients match your criteria"}
                </div>
                <p className="text-xs text-[var(--color-mute)] max-w-sm">
                  {localSearchTerm.trim()
                    ? "No records matched Company Name, Code, Contact, or City. Check for typos or clear your search."
                    : "Try adjusting filters or search terms."}
                </p>
                {localSearchTerm.trim() && (
                  <Button variant="secondary" size="sm" onClick={() => handleSearchChange("")} className="mt-1">
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <AnimatePresence mode="popLayout">
                  {displayedCardsClients.map((client) => (
                    <MobileClientCard
                      key={client.id}
                      client={client}
                      canManageClients={canManageClients}
                      searchTerm={localSearchTerm}
                      onViewClient={handleOpenDetailDrawer}
                      onEditClient={handleOpenEditModal}
                      onDeleteClient={handleOpenDeleteDialog}
                      onRestoreClient={handleRestoreClient}
                    />
                  ))}
                </AnimatePresence>

                {/* Skeletons while loading other new client chunk-by-chunk on mobile scroll */}
                {isLoadingMoreMobile && (
                  <MobileClientCardSkeletonList count={2} />
                )}
              </>
            )}
          </div>

          {/* Infinite Scroll Sentinel for Mobile */}
          {!isDesktop && mobileHasMore && !loadMoreMobileError && !isTabLoading && !isPending && (
            <div ref={mobileSentinelRef} className="h-6 w-full pointer-events-none" />
          )}

          {/* Mobile Load More Error with Retry */}
          {!isDesktop && loadMoreMobileError && (
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

          {/* End-of-List Indicator on Mobile */}
          {!isDesktop && !mobileHasMore && mobileClientsList.length > 0 && !isTabLoading && !isPending && (
            <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
              <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
              <span className="font-medium text-[var(--color-mute)]">All clients have been displayed</span>
              <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
            </div>
          )}

          {/* Fallback pagination controls when explicitly on desktop view */}
          {totalCount > 0 && (
            <div className="pt-2 hidden sm:block">
              <Pagination
                page={currentPage}
                pageSize={currentPageSize}
                total={totalCount}
                onPageChange={handlePageChange}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── Lazy-Loaded Modals & Drawers (Loaded strictly on demand) ──────── */}

      {/* Lazy AddClientModal */}
      {isAddModalOpen && (
        <AddClientModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          client={null}
          onSuccess={() => {
            queryCacheRef.current.clear();
            setIsAddModalOpen(false);
            setToastMessage({
              type: "success",
              text: "New client registered successfully.",
            });
            router.refresh();
          }}
        />
      )}

      {/* Lazy EditClientModal */}
      {isEditModalOpen && (
        <EditClientModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingClient(null);
          }}
          client={editingClient}
          onSuccess={() => {
            queryCacheRef.current.clear();
            setIsEditModalOpen(false);
            setEditingClient(null);
            setToastMessage({
              type: "success",
              text: "Client details updated successfully.",
            });
            router.refresh();
          }}
        />
      )}

      {/* Lazy ClientDetailDrawer */}
      {isDetailDrawerOpen && (
        <ClientDetailDrawer
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false);
            setViewingClient(null);
          }}
          client={viewingClient}
          onOpenEdit={(c) => {
            setIsDetailDrawerOpen(false);
            setViewingClient(null);
            handleOpenEditModal(c);
          }}
        />
      )}

      {/* Lazy DeleteDialog */}
      {isDeleteDialogOpen && (
        <DeleteDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setDeletingClient(null);
          }}
          client={deletingClient}
          onSuccess={(deleted) => {
            // Immediate local state update: remove soft-deleted client from active list without full page reload
            setClients((prev) => prev.filter((c) => c.id !== deleted.id));
            setMobileClientsList((prev) => prev.filter((c) => c.id !== deleted.id));
            setTotalCount((prev) => Math.max(0, prev - 1));
            queryCacheRef.current.clear();
            setIsDeleteDialogOpen(false);
            setDeletingClient(null);
            setToastMessage({
              type: "success",
              text: `Client "${deleted.company_name || deleted.client_name}" soft-deleted successfully.`,
            });
            startTransition(() => {
              router.refresh();
            });
          }}
          onError={(err) => {
            setToastMessage({
              type: "error",
              text: err,
            });
          }}
        />
      )}

      {/* Lazy ExportModule */}
      {isExportModuleOpen && (
        <ExportModule
          isOpen={isExportModuleOpen}
          onClose={() => setIsExportModuleOpen(false)}
          currentFilter={{
            search: localSearchTerm,
            status: currentStatus,
            city: currentCity,
          }}
        />
      )}
    </div>
  );
}
