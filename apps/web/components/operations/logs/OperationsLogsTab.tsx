"use client";

import React, { useState, useMemo, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOperationsClientLogsAction,
  getOperationsMachineLogsAction,
  getOperationsOperatorLogsAction,
  deleteOperatorHourLogAction,
} from "@/app/actions/operators";
import dynamic from "next/dynamic";
import {
  MachineSelect,
  ClientSelect,
  UserSelect,
  SearchableSelect,
  DateRangePicker,
  useToast,
  ConfirmationDialog,
  usePullToRefresh,
} from "@/components/ui";
import type {
  Machine,
  User,
  MachineHourLog,
  CRMClient,
} from "@/lib/types/database";
import { MONTH_NAMES } from "@/lib/pdf/pdf-config";
import {
  getISTDateString,
  formatDate,
  type NormalizedOperationsFilter,
  normalizeOperationsFilter,
  serializeNormalizedOperationsFilter,
  OPERATIONS_CACHE_TTLS,
} from "@reachinternational/utils";
import { formatClientFullAddress, getCurrentMonthValue } from "../operations-helpers";
import { OperationsMachineView } from "./OperationsMachineView";
import { OperationsClientView } from "./OperationsClientView";
import { OperationsOperatorView } from "./OperationsOperatorView";
import { OperationsLogsTable } from "./OperationsLogsTable";
import { OperationsLogsMobileList } from "./OperationsLogsMobileList";
import { OperationsSubViewCardSkeleton } from "../skeletons/OperationsSkeletons";

// Dynamic on-demand modals: only loaded when clicked
const PrintableSupervisorLogsModal = dynamic(
  () =>
    import("../PrintableSupervisorLogsModal").then(
      (mod) => mod.PrintableSupervisorLogsModal
    ),
  { ssr: false }
);

const ConflictResolutionModal = dynamic(
  () =>
    import("../modals/ConflictResolutionModal").then(
      (mod) => mod.ConflictResolutionModal
    ),
  { ssr: false }
);

import { isManagerOrAbove } from "@reachinternational/permissions";

const MachineHistoryQuickModal = dynamic(
  () =>
    import("../../machines/MachineHistoryQuickModal").then(
      (mod) => mod.MachineHistoryQuickModal
    ),
  { ssr: false }
);

const OperationsEditLogModal = dynamic(
  () =>
    import("../modals/OperationsEditLogModal").then(
      (mod) => mod.OperationsEditLogModal
    ),
  { ssr: false }
);

export interface OperationsLogsTabProps {
  machines: Machine[];
  dbClients?: CRMClient[];
  operators: User[];
  assignments: any[];
  hourLogs: MachineHourLog[];
  userRole?: string;
  user?: User;
  totalLogsCount?: number;
  currentPage?: number;
  logsPageSize?: number;
  logsSummary?: {
    totalRunHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    loggedDaysCount: number;
  };
  initialViewMode?: "machine" | "client" | "operator";
  initialMachineId?: string;
  initialClientId?: string;
  mostRecentClientId?: string;
  initialOperatorId?: string;
  initialMonth?: string;
  initialCustomStart?: string;
  initialCustomEnd?: string;
  initialSearch?: string;
  initialSite?: string;
  initialSort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  initialExpanded?: boolean;
}

export const OperationsLogsTab = React.memo(function OperationsLogsTab({
  machines,
  dbClients = [],
  operators,
  assignments,
  hourLogs,
  userRole,
  user,
  totalLogsCount,
  currentPage = 1,
  logsPageSize = 10,
  logsSummary,
  initialViewMode,
  initialMachineId,
  initialClientId,
  mostRecentClientId,
  initialOperatorId,
  initialMonth,
  initialCustomStart,
  initialCustomEnd,
  initialSearch,
  initialSite,
  initialSort,
  initialExpanded = false,
}: OperationsLogsTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Supervisor Running Hours Log Filtering & View Mode State
  const [logsViewMode, setLogsViewMode] = useState<"machine" | "client" | "operator">(
    initialViewMode || "machine"
  );
  const [logsSelectedMachineId, setLogsSelectedMachineId] = useState<string>(
    initialMachineId || ""
  );
  const [logsSelectedClientId, setLogsSelectedClientId] = useState<string>(
    initialClientId || ""
  );
  const [logsSelectedSite, setLogsSelectedSite] = useState<string>(initialSite || "");
  const [logsSelectedClientMachineId, setLogsSelectedClientMachineId] = useState<string>("all");
  const [logsSelectedOperatorId, setLogsSelectedOperatorId] = useState<string>(
    initialOperatorId || ""
  );
  const [logsSelectedMonth, setLogsSelectedMonth] = useState<string>(
    initialMonth ? initialMonth : getCurrentMonthValue()
  );
  const [logsCustomStartDate, setLogsCustomStartDate] = useState<string>(() => {
    if (initialCustomStart) return initialCustomStart;
    try {
      const today = getISTDateString();
      return today.slice(0, 7) + "-01";
    } catch (e) {
      return "";
    }
  });
  const [logsCustomEndDate, setLogsCustomEndDate] = useState<string>(() => {
    if (initialCustomEnd) return initialCustomEnd;
    try {
      return getISTDateString();
    } catch (e) {
      return "";
    }
  });
  const [committedSearch, setCommittedSearch] = useState<string>(initialSearch || "");

  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== committedSearch) {
      setCommittedSearch(initialSearch);
    }
  }, [initialSearch, committedSearch]);

  // Modals & export on demand
  const { toast } = useToast();
  const [showSupervisorPrintModal, setShowSupervisorPrintModal] = useState(false);

  // Listen for global mobile header and desktop header export/print trigger
  useEffect(() => {
    const handleExportPrint = (e: Event) => {
      e.preventDefault();
      setShowSupervisorPrintModal(true);
    };
    window.addEventListener("reach:export-print", handleExportPrint);
    window.addEventListener("reach:quick-print", handleExportPrint);
    return () => {
      window.removeEventListener("reach:export-print", handleExportPrint);
      window.removeEventListener("reach:quick-print", handleExportPrint);
    };
  }, []);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedConflictLog, setSelectedConflictLog] = useState<MachineHourLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MachineHourLog | null>(null);
  const [logToEdit, setLogToEdit] = useState<MachineHourLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [showMachineHistoryModal, setShowMachineHistoryModal] = useState(false);

  // Mobile Lazy Loading Scroll Stream State
  const [mobileLogsList, setMobileLogsList] = useState<MachineHourLog[]>(hourLogs);
  const [mobilePage, setMobilePage] = useState<number>(currentPage || 1);
  const [mobileHasMore, setMobileHasMore] = useState<boolean>(
    (hourLogs?.length || 0) < (totalLogsCount || 0)
  );
  const [isLoadingMoreMobile, setIsLoadingMoreMobile] = useState<boolean>(false);
  const [loadMoreMobileError, setLoadMoreMobileError] = useState<string | null>(null);
  const isFetchingMobileRef = useRef<boolean>(false);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  const handleOpenHistoryModal = useCallback(() => {
    setShowMachineHistoryModal(true);
  }, []);

  const handleRequestEditLog = useCallback((log: MachineHourLog) => {
    setLogToEdit(log);
  }, []);

  const handleRequestDeleteLog = useCallback((log: MachineHourLog) => {
    setLogToDelete(log);
  }, []);

  // Manager and above have full row-level edit and delete access across all tabs
  const canEditLog = useCallback(
    (_log: MachineHourLog) => {
      const role = (user?.role || userRole || "").toLowerCase();
      return isManagerOrAbove(role);
    },
    [user?.role, userRole]
  );

  const canDeleteLog = useCallback(
    (_log: MachineHourLog) => {
      const role = (user?.role || userRole || "").toLowerCase();
      return isManagerOrAbove(role);
    },
    [user?.role, userRole]
  );

  const handleLogUpdated = useCallback((updatedLog: MachineHourLog) => {
    setActiveLogs((prev) =>
      prev.map((l) =>
        l.id === updatedLog.id
          ? {
              ...l,
              ...updatedLog,
              machine: updatedLog.machine || l.machine,
              operator: updatedLog.operator || l.operator,
              client: updatedLog.client || l.client,
            }
          : l
      )
    );
    setMobileLogsList((prev) =>
      prev.map((l) =>
        l.id === updatedLog.id
          ? {
              ...l,
              ...updatedLog,
              machine: updatedLog.machine || l.machine,
              operator: updatedLog.operator || l.operator,
              client: updatedLog.client || l.client,
            }
          : l
      )
    );
    queryCacheRef.current.clear();
    Object.keys(subTabCacheRef.current).forEach((key) => {
      const entry = subTabCacheRef.current[key as keyof typeof subTabCacheRef.current];
      if (entry) {
        entry.hourLogs = entry.hourLogs.map((l) =>
          l.id === updatedLog.id
            ? {
                ...l,
                ...updatedLog,
                machine: updatedLog.machine || l.machine,
                operator: updatedLog.operator || l.operator,
                client: updatedLog.client || l.client,
              }
            : l
        );
      }
    });
  }, []);

  const handleDeleteLog = useCallback((deletedId: string) => {
    setActiveLogs((prev) => prev.filter((l) => l.id !== deletedId));
    setActiveTotalCount((prev) => Math.max(0, prev - 1));
    setMobileLogsList((prev) => prev.filter((l) => l.id !== deletedId));
    queryCacheRef.current.clear();
    Object.keys(subTabCacheRef.current).forEach((key) => {
      const entry = subTabCacheRef.current[key as keyof typeof subTabCacheRef.current];
      if (entry) {
        entry.hourLogs = entry.hourLogs.filter((l) => l.id !== deletedId);
        entry.totalLogsCount = Math.max(0, entry.totalLogsCount - 1);
      }
    });
  }, []);

  const handleConfirmDeleteLog = useCallback(async () => {
    if (!logToDelete) return;
    setIsDeletingLog(true);
    try {
      const res = await deleteOperatorHourLogAction({
        logId: logToDelete.id,
        reason: "Deleted from Operations Daily Running Hours table",
      });
      if (res.success) {
        toast("success", "Log Deleted", "The daily running hour log has been permanently deleted.");
        handleDeleteLog(logToDelete.id);
        setLogToDelete(null);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast("error", "Delete Failed", res.error || "Failed to delete log.");
      }
    } catch (err: any) {
      toast("error", "Delete Failed", err?.message || "An unexpected error occurred.");
    } finally {
      setIsDeletingLog(false);
    }
  }, [logToDelete, handleDeleteLog, router, toast]);

  // Local active dataset state (allows instant 0ms cached switching between sub-tabs)
  const [activeLogs, setActiveLogs] = useState<MachineHourLog[]>(hourLogs);
  const [activeSummary, setActiveSummary] = useState(
    logsSummary || { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 }
  );
  const [activeTotalCount, setActiveTotalCount] = useState<number>(totalLogsCount || 0);
  const [activeCurrentPage, setActiveCurrentPage] = useState<number>(currentPage || 1);
  const [activeLogsPageSize, setActiveLogsPageSize] = useState<number>(logsPageSize || 20);
  const [activeMachinesList, setActiveMachinesList] = useState<Machine[]>(machines);
  const [activeDbClients, setActiveDbClients] = useState<CRMClient[]>(dbClients);
  const [isClientDataLoading, setIsClientDataLoading] = useState<boolean>(false);

  // Sub-tab memory session cache: preserves machine & client datasets across toggles
  interface SubTabCacheData {
    hourLogs: MachineHourLog[];
    logsSummary: {
      totalRunHours: number;
      totalOtHours: number;
      totalBreakdowns: number;
      loggedDaysCount: number;
    };
    totalLogsCount: number;
    currentPage: number;
    logsPageSize: number;
    machines?: Machine[];
    dbClients?: CRMClient[];
    selectedId: string;
  }

  const subTabCacheRef = useRef<Record<"machine" | "client" | "operator", SubTabCacheData | null>>({
    machine: null,
    client: null,
    operator: null,
  });

  // Phase 9: Unified Normalized Query Cache (0ms instant hits, zero redundant database roundtrips)
  interface QueryCacheEntry {
    hourLogs: MachineHourLog[];
    logsSummary: {
      totalRunHours: number;
      totalOtHours: number;
      totalBreakdowns: number;
      loggedDaysCount: number;
    };
    totalLogsCount: number;
    currentPage: number;
    logsPageSize: number;
    machines?: Machine[];
    dbClients?: CRMClient[];
    timestamp: number;
  }

  const queryCacheRef = useRef<Map<string, QueryCacheEntry>>(new Map());

  // Synchronize state with URL props when route navigation updates
  useEffect(() => {
    if (initialViewMode) {
      setLogsViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  useEffect(() => {
    setLogsSelectedClientId(initialClientId || "");
  }, [initialClientId]);

  useEffect(() => {
    if (initialMachineId) {
      setLogsSelectedMachineId(initialMachineId);
      if (initialViewMode === "client") {
        setLogsSelectedClientMachineId(initialMachineId);
      }
    } else {
      if (initialViewMode === "client") {
        setLogsSelectedClientMachineId("all");
      }
    }
  }, [initialMachineId, initialViewMode]);

  useEffect(() => {
    if (initialMonth !== undefined) {
      setLogsSelectedMonth(initialMonth || getCurrentMonthValue());
    }
  }, [initialMonth]);

  useEffect(() => {
    if (initialSite !== undefined) {
      setLogsSelectedSite(initialSite || "");
    }
  }, [initialSite]);

  useEffect(() => {
    if (initialOperatorId) {
      setLogsSelectedOperatorId(initialOperatorId);
    }
  }, [initialOperatorId]);

  useEffect(() => {
    if (initialCustomStart) {
      setLogsCustomStartDate(initialCustomStart);
    }
  }, [initialCustomStart]);

  useEffect(() => {
    if (initialCustomEnd) {
      setLogsCustomEndDate(initialCustomEnd);
    }
  }, [initialCustomEnd]);

  // Sync state when props arrive from initial SSR
  useEffect(() => {
    // Only synchronize initial SSR props if active view mode matches initialViewMode
    if (initialViewMode && initialViewMode !== logsViewMode) {
      return;
    }
    setActiveLogs(hourLogs);
    setActiveSummary(logsSummary || { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 });
    setActiveTotalCount(totalLogsCount || 0);
    setActiveCurrentPage(currentPage || 1);
    setActiveLogsPageSize(logsPageSize || 20);
    setActiveMachinesList(machines);
    setActiveDbClients(dbClients);

    const mode = initialViewMode || logsViewMode || "machine";
    subTabCacheRef.current[mode] = {
      hourLogs,
      logsSummary: logsSummary || { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 },
      totalLogsCount: totalLogsCount || 0,
      currentPage: currentPage || 1,
      logsPageSize: logsPageSize || 20,
      machines,
      dbClients,
      selectedId: mode === "machine" ? (initialMachineId || "") : mode === "client" ? (initialClientId || "") : (initialOperatorId || ""),
    };

    // Seed Phase 9 normalized query cache
    const initialNormalized = normalizeOperationsFilter({
      viewMode: mode,
      machineId: mode === "machine" ? (initialMachineId || machines[0]?.id) : undefined,
      clientId: mode === "client" ? (initialClientId || dbClients[0]?.id) : undefined,
      operatorId: mode === "operator" ? (initialOperatorId || operators[0]?.id) : undefined,
      month: initialMonth || "current",
      customStart: initialCustomStart,
      customEnd: initialCustomEnd,
      site: initialSite,
      search: initialSearch,
      sort: initialSort,
      page: currentPage || 1,
      pageSize: logsPageSize || 20,
    });
    const initialKey = serializeNormalizedOperationsFilter(initialNormalized);
    queryCacheRef.current.set(initialKey, {
      hourLogs,
      logsSummary: logsSummary || { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 },
      totalLogsCount: totalLogsCount || 0,
      currentPage: currentPage || 1,
      logsPageSize: logsPageSize || 20,
      machines,
      dbClients,
      timestamp: Date.now(),
    });
  }, [hourLogs, logsSummary, totalLogsCount, currentPage, logsPageSize, machines, dbClients, initialViewMode, initialMachineId, initialClientId, initialOperatorId, operators, initialMonth, initialCustomStart, initialCustomEnd, initialSite, initialSearch, initialSort]);

  const currentLogs = activeLogs;
  const currentMachines = activeMachinesList;
  const currentDbClients = activeDbClients;
  const currentSummary = activeSummary;
  const currentTotalLogsCount = activeTotalCount;
  const currentCurrentPage = activeCurrentPage;
  const currentLogsPageSize = activeLogsPageSize;

  // Collapsible section states
  const [isClientSummaryExpanded, setIsClientSummaryExpanded] = useState(initialExpanded);
  const [activeSort, setActiveSort] = useState<string>(initialSort || "date-desc");
  const [isClientLogsLoading, setIsClientLogsLoading] = useState(false);
  const [isMachineSummaryExpanded, setIsMachineSummaryExpanded] = useState(false);
  const [isOperatorSummaryExpanded, setIsOperatorSummaryExpanded] = useState(false);

  useEffect(() => {
    if (initialExpanded !== undefined) {
      setIsClientSummaryExpanded(initialExpanded);
    }
  }, [initialExpanded]);


  // Sub-tab switching handler with in-memory caching and on-demand client loading
  const handleSubTabClick = useCallback(async (targetMode: "machine" | "client" | "operator") => {
    if (targetMode === logsViewMode) return;

    // 1. Stash current tab state into subTabCacheRef before leaving
    subTabCacheRef.current[logsViewMode] = {
      hourLogs: activeLogs,
      logsSummary: activeSummary,
      totalLogsCount: activeTotalCount,
      currentPage: activeCurrentPage,
      logsPageSize: activeLogsPageSize,
      machines: activeMachinesList,
      dbClients: activeDbClients,
      selectedId:
        logsViewMode === "machine"
          ? logsSelectedMachineId
          : logsViewMode === "client"
          ? logsSelectedClientId
          : logsSelectedOperatorId,
    };

    setLogsViewMode(targetMode);

    // 2. Check if target tab data is already in cache
    const cached = subTabCacheRef.current[targetMode];
    if (cached) {
      // Instant restore from cache (0ms latency, zero refetches!)
      setActiveLogs(cached.hourLogs);
      setActiveSummary(cached.logsSummary);
      setActiveTotalCount(cached.totalLogsCount);
      setActiveCurrentPage(cached.currentPage);
      setActiveLogsPageSize(cached.logsPageSize);
      if (cached.machines) setActiveMachinesList(cached.machines);
      if (cached.dbClients) setActiveDbClients(cached.dbClients);
      if (cached.selectedId) {
        if (targetMode === "machine") setLogsSelectedMachineId(cached.selectedId);
        if (targetMode === "client") setLogsSelectedClientId(cached.selectedId);
        if (targetMode === "operator") setLogsSelectedOperatorId(cached.selectedId);
      }

      // Silent URL sync without full-page server re-render
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "logs");
      params.set("view", targetMode);
      if (cached.selectedId) {
        if (targetMode === "machine") {
          params.set("machine", cached.selectedId);
          params.delete("client");
          params.delete("operator");
        } else if (targetMode === "client") {
          params.set("client", cached.selectedId);
          params.delete("machine");
          params.delete("operator");
        } else if (targetMode === "operator") {
          params.set("operator", cached.selectedId);
          params.delete("machine");
          params.delete("client");
        }
      }
      window.history.replaceState(null, "", `/operations?${params.toString()}`);
      return;
    }

    // 3. Not in cache: only then execute client query!
    if (targetMode === "client") {
      setIsClientDataLoading(true);
      // Clean slate for client view: reset client machine & site to avoid leaking machine tab filters
      setLogsSelectedClientMachineId("all");
      setLogsSelectedSite("");

      const targetClient = logsSelectedClientId && logsSelectedClientId !== "all" ? logsSelectedClientId : undefined;

      const params = new URLSearchParams(window.location.search);
      params.set("tab", "logs");
      params.set("view", "client");
      if (targetClient) params.set("client", targetClient);
      params.delete("machine");
      params.delete("operator");
      params.delete("site");
      window.history.replaceState(null, "", `/operations?${params.toString()}`);

      try {
        const res = await getOperationsClientLogsAction({
          clientId: targetClient,
          month: logsSelectedMonth,
          customStart: logsCustomStartDate,
          customEnd: logsCustomEndDate,
          site: undefined,
          machineId: undefined,
          search: committedSearch || undefined,
          sort: (activeSort as any) || "date-desc",
          page: 1,
          pageSize: 20,
          fetchLogs: true,
        });

        if (res.success && res.data) {
          const d = res.data;
          const targetId = d.activeClientId || (d.dbClients[0]?.id ?? "");
          setLogsSelectedClientId(targetId);
          setLogsSelectedClientMachineId("all");
          setLogsSelectedSite("");

          const newCache: SubTabCacheData = {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            dbClients: d.dbClients as any,
            machines: d.machines,
            selectedId: targetId,
          };
          subTabCacheRef.current["client"] = newCache;

          // Seed Phase 9 normalized query cache for instant 0ms restores
          const normalized = normalizeOperationsFilter({
            viewMode: "client",
            clientId: targetId,
            month: logsSelectedMonth,
            customStart: logsCustomStartDate,
            customEnd: logsCustomEndDate,
            site: undefined,
            machineId: undefined,
            search: committedSearch || undefined,
            sort: (activeSort as any) || "date-desc",
            page: 1,
            pageSize: 20,
          });
          queryCacheRef.current.set(serializeNormalizedOperationsFilter(normalized), {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            dbClients: d.dbClients as any,
            machines: d.machines,
            timestamp: Date.now(),
          });

          setActiveLogs(d.hourLogs);
          setActiveSummary(d.logsSummary);
          setActiveTotalCount(d.totalLogsCount);
          setActiveCurrentPage(d.currentPage);
          setActiveLogsPageSize(d.logsPageSize);
          setActiveDbClients(d.dbClients as any);
          setActiveMachinesList(d.machines);

          const updatedParams = new URLSearchParams(window.location.search);
          updatedParams.set("tab", "logs");
          updatedParams.set("view", "client");
          if (targetId) updatedParams.set("client", targetId);
          updatedParams.delete("machine");
          updatedParams.delete("operator");
          updatedParams.delete("site");
          window.history.replaceState(null, "", `/operations?${updatedParams.toString()}`);
        }
      } catch (err) {
        console.error("[OperationsLogsTab] Failed to fetch client logs:", err);
      } finally {
        setIsClientDataLoading(false);
      }
      return;
    }

    if (targetMode === "machine") {
      setIsClientDataLoading(true);
      setLogsSelectedSite("");
      const targetMachine = logsSelectedMachineId && logsSelectedMachineId !== "all" ? logsSelectedMachineId : undefined;

      const params = new URLSearchParams(window.location.search);
      params.set("tab", "logs");
      params.set("view", "machine");
      if (targetMachine) params.set("machine", targetMachine);
      params.delete("client");
      params.delete("operator");
      params.delete("site");
      window.history.replaceState(null, "", `/operations?${params.toString()}`);

      try {
        const res = await getOperationsMachineLogsAction({
          machineId: targetMachine,
          month: logsSelectedMonth,
          customStart: logsCustomStartDate,
          customEnd: logsCustomEndDate,
          site: undefined,
          search: committedSearch || undefined,
          sort: (initialSort as any) || "date-desc",
          page: 1,
          pageSize: 20,
        });

        if (res.success && res.data) {
          const d = res.data;
          const targetId = d.activeMachineId || (d.machines[0]?.id ?? "");
          setLogsSelectedMachineId(targetId);

          const newCache: SubTabCacheData = {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            machines: d.machines as any,
            selectedId: targetId,
          };
          subTabCacheRef.current["machine"] = newCache;

          setActiveLogs(d.hourLogs);
          setActiveSummary(d.logsSummary);
          setActiveTotalCount(d.totalLogsCount);
          setActiveCurrentPage(d.currentPage);
          setActiveLogsPageSize(d.logsPageSize);
          setActiveMachinesList(d.machines as any);
        }
      } catch (err) {
        console.error("[OperationsLogsTab] Failed to fetch machine logs:", err);
      } finally {
        setIsClientDataLoading(false);
      }
      return;
    }

    if (targetMode === "operator") {
      setIsClientDataLoading(true);
      setLogsSelectedSite("");
      const targetOperator =
        logsSelectedOperatorId && logsSelectedOperatorId !== "all"
          ? logsSelectedOperatorId
          : (operators[0]?.id ?? undefined);

      const params = new URLSearchParams(window.location.search);
      params.set("tab", "logs");
      params.set("view", "operator");
      if (targetOperator) params.set("operator", targetOperator);
      params.delete("machine");
      params.delete("client");
      params.delete("site");
      window.history.replaceState(null, "", `/operations?${params.toString()}`);

      try {
        const res = await getOperationsOperatorLogsAction({
          operatorId: targetOperator,
          month: logsSelectedMonth,
          customStart: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          customEnd: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          search: committedSearch || undefined,
          sort: (initialSort as any) || "date-desc",
          page: 1,
          pageSize: 20,
        });

        if (res.success && res.data) {
          const d = res.data;
          const targetId = d.activeOperatorId || targetOperator || (operators[0]?.id ?? "");
          setLogsSelectedOperatorId(targetId);

          const newCache: SubTabCacheData = {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            machines: activeMachinesList,
            dbClients: activeDbClients,
            selectedId: targetId,
          };
          subTabCacheRef.current["operator"] = newCache;

          setActiveLogs(d.hourLogs);
          setActiveSummary(d.logsSummary);
          setActiveTotalCount(d.totalLogsCount);
          setActiveCurrentPage(d.currentPage);
          setActiveLogsPageSize(d.logsPageSize);
        }
      } catch (err) {
        console.error("[OperationsLogsTab] Failed to fetch operator logs:", err);
      } finally {
        setIsClientDataLoading(false);
      }
      return;
    }
  }, [logsViewMode, activeLogs, activeSummary, activeTotalCount, activeCurrentPage, activeLogsPageSize, activeMachinesList, activeDbClients, logsSelectedMachineId, logsSelectedClientId, logsSelectedOperatorId, logsSelectedMonth, logsCustomStartDate, logsCustomEndDate, logsSelectedSite, logsSelectedClientMachineId, committedSearch, isClientSummaryExpanded, initialSort, operators, activeSort]);

  // Ref to hold latest filter state so callbacks remain referentially stable across re-renders
  const filterStateRef = useRef({
    logsViewMode,
    logsSelectedMachineId,
    logsSelectedClientMachineId,
    logsSelectedClientId,
    logsSelectedOperatorId,
    operators,
    logsSelectedMonth,
    logsCustomStartDate,
    logsCustomEndDate,
    logsSelectedSite,
    committedSearch,
    initialSort,
    currentLogsPageSize,
    isClientSummaryExpanded,
    activeMachinesList,
    activeDbClients,
  });
  filterStateRef.current = {
    logsViewMode,
    logsSelectedMachineId,
    logsSelectedClientMachineId,
    logsSelectedClientId,
    logsSelectedOperatorId,
    operators,
    logsSelectedMonth,
    logsCustomStartDate,
    logsCustomEndDate,
    logsSelectedSite,
    committedSearch,
    initialSort,
    currentLogsPageSize,
    isClientSummaryExpanded,
    activeMachinesList,
    activeDbClients,
  };

  // PHASE 9: Single Normalized Filter Architecture Handler
  // Flow: filter change -> URL update -> page = 1 -> query cache lookup -> database only if cache miss
  const handleNormalizedFilterChange = useCallback(
    async (
      updates: Record<string, string | number | undefined | boolean>,
      isExplicitPageChange: boolean = false
    ) => {
      const s = filterStateRef.current;
      // 1. Determine target view
      const targetView = (updates.view || s.logsViewMode || "machine") as "machine" | "client" | "operator";

      // When client changes, reset machine and site selections
      const isClientChanging = targetView === "client" && updates.client !== undefined && updates.client !== s.logsSelectedClientId;

      // 2. Resolve raw filter values
      const nextMachine = isClientChanging
        ? undefined
        : updates.machine !== undefined
        ? (updates.machine === "all" || updates.machine === "" ? undefined : String(updates.machine))
        : targetView === "machine"
        ? (s.logsSelectedMachineId && s.logsSelectedMachineId !== "all" ? s.logsSelectedMachineId : undefined)
        : (s.logsSelectedClientMachineId && s.logsSelectedClientMachineId !== "all" ? s.logsSelectedClientMachineId : undefined);

      const nextClient = updates.client !== undefined
        ? (updates.client === "all" || updates.client === "" ? undefined : String(updates.client))
        : (s.logsSelectedClientId && s.logsSelectedClientId !== "all" ? s.logsSelectedClientId : undefined);

      const nextOperator = updates.operator !== undefined
        ? (updates.operator === "all" || updates.operator === "" ? undefined : String(updates.operator))
        : (s.logsSelectedOperatorId && s.logsSelectedOperatorId !== "all" ? s.logsSelectedOperatorId : (s.operators[0]?.id ?? undefined));

      const nextMonth = updates.month !== undefined ? String(updates.month) : s.logsSelectedMonth;
      const nextStart = updates.start !== undefined ? String(updates.start) : (updates.customStart !== undefined ? String(updates.customStart) : s.logsCustomStartDate);
      const nextEnd = updates.end !== undefined ? String(updates.end) : (updates.customEnd !== undefined ? String(updates.customEnd) : s.logsCustomEndDate);
      const nextSite = isClientChanging
        ? undefined
        : updates.site !== undefined
        ? (updates.site === "all" || updates.site === "" ? undefined : String(updates.site))
        : (s.logsSelectedSite && s.logsSelectedSite !== "all" ? s.logsSelectedSite : undefined);

      const nextSearch = updates.search !== undefined
        ? (updates.search ? String(updates.search) : undefined)
        : (s.committedSearch || undefined);

      const nextSort = updates.sort !== undefined ? String(updates.sort) : (s.initialSort || "date-desc");
      const nextPg = isExplicitPageChange && updates.page !== undefined ? Math.max(1, Number(updates.page)) : 1;
      const nextPgSize = updates.pageSize !== undefined ? Math.max(1, Number(updates.pageSize)) : (s.currentLogsPageSize || 20);

      // Update local filter selection states
      if (updates.month !== undefined) setLogsSelectedMonth(String(updates.month));
      if (updates.start !== undefined) setLogsCustomStartDate(String(updates.start));
      if (updates.end !== undefined) setLogsCustomEndDate(String(updates.end));
      if (isClientChanging) {
        setLogsSelectedClientMachineId("all");
        setLogsSelectedSite("");
      } else {
        if (updates.site !== undefined) setLogsSelectedSite(updates.site === "all" ? "" : String(updates.site));
        if (targetView === "client" && updates.machine !== undefined) setLogsSelectedClientMachineId(String(updates.machine));
      }
      if (updates.search !== undefined) setCommittedSearch(updates.search ? String(updates.search) : "");

      // 3. Single Normalized Filter Object
      const normalized: NormalizedOperationsFilter = normalizeOperationsFilter({
        viewMode: targetView,
        machineId: targetView === "machine" ? nextMachine : (targetView === "client" ? nextMachine : undefined),
        clientId: targetView === "client" ? nextClient : undefined,
        operatorId: targetView === "operator" ? nextOperator : undefined,
        month: nextMonth,
        customStart: nextStart,
        customEnd: nextEnd,
        site: nextSite,
        locationId: nextSite,
        search: nextSearch,
        sort: nextSort,
        page: nextPg,
        pageSize: nextPgSize,
      });

      // 4. URL Update Silently (window.history.replaceState)
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set("tab", "logs");
      currentParams.set("view", targetView);

      if (targetView === "machine") {
        if (normalized.machineId) currentParams.set("machine", normalized.machineId); else currentParams.delete("machine");
        currentParams.delete("client");
        currentParams.delete("operator");
      } else if (targetView === "client") {
        if (normalized.clientId) currentParams.set("client", normalized.clientId); else currentParams.delete("client");
        if (nextMachine) currentParams.set("machine", nextMachine); else currentParams.delete("machine");
        currentParams.delete("operator");
      } else if (targetView === "operator") {
        if (normalized.operatorId) currentParams.set("operator", normalized.operatorId); else currentParams.delete("operator");
        currentParams.delete("machine");
        currentParams.delete("client");
      }

      if (nextMonth) currentParams.set("month", nextMonth);
      if (nextMonth === "custom") {
        if (normalized.startDate) currentParams.set("start", normalized.startDate);
        if (normalized.endDate) currentParams.set("end", normalized.endDate);
      } else {
        currentParams.delete("start");
        currentParams.delete("end");
      }

      if (normalized.locationId) currentParams.set("site", normalized.locationId); else currentParams.delete("site");
      if (normalized.search) currentParams.set("search", normalized.search); else currentParams.delete("search");
      if (normalized.sort && normalized.sort !== "date-desc") currentParams.set("sort", normalized.sort); else currentParams.delete("sort");
      if (normalized.page > 1) currentParams.set("page", String(normalized.page)); else currentParams.delete("page");
      if (normalized.pageSize !== 20) currentParams.set("pageSize", String(normalized.pageSize)); else currentParams.delete("pageSize");

      window.history.replaceState(null, "", `/operations?${currentParams.toString()}`);

      // 5. Query Cache Lookup (0ms instant hits, zero redundant database roundtrips)
      const cacheKey = serializeNormalizedOperationsFilter(normalized);
      const cached = queryCacheRef.current.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < OPERATIONS_CACHE_TTLS.machineLogs * 1000) {
        setActiveLogs(cached.hourLogs);
        setActiveSummary(cached.logsSummary);
        setActiveTotalCount(cached.totalLogsCount);
        setActiveCurrentPage(cached.currentPage);
        setActiveLogsPageSize(cached.logsPageSize);
        if (cached.machines) setActiveMachinesList(cached.machines);
        if (cached.dbClients) setActiveDbClients(cached.dbClients);
        setIsClientDataLoading(false);
        return;
      }

      // 6. Database query only if cache miss
      setIsClientDataLoading(true);
      try {
        if (targetView === "machine") {
          const res = await getOperationsMachineLogsAction({
            machineId: normalized.machineId,
            site: normalized.locationId,
            month: nextMonth,
            customStart: normalized.startDate,
            customEnd: normalized.endDate,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            search: normalized.search,
            sort: normalized.sort,
            page: normalized.page,
            pageSize: normalized.pageSize,
          });

          if (res.success && res.data) {
            const d = res.data;
            const targetId = d.activeMachineId || (d.machines[0]?.id ?? "");
            setLogsSelectedMachineId(targetId);

            queryCacheRef.current.set(cacheKey, {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              machines: d.machines as any,
              timestamp: Date.now(),
            });

            const newSubCache: SubTabCacheData = {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              machines: d.machines as any,
              selectedId: targetId,
            };
            subTabCacheRef.current["machine"] = newSubCache;

            setActiveLogs(d.hourLogs);
            setActiveSummary(d.logsSummary);
            setActiveTotalCount(d.totalLogsCount);
            setActiveCurrentPage(d.currentPage);
            setActiveLogsPageSize(d.logsPageSize);
            setActiveMachinesList(d.machines as any);
          }
        } else if (targetView === "client") {
          const res = await getOperationsClientLogsAction({
            clientId: normalized.clientId,
            site: normalized.locationId,
            machineId: nextMachine,
            month: nextMonth,
            customStart: normalized.startDate,
            customEnd: normalized.endDate,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            search: normalized.search,
            sort: normalized.sort,
            page: normalized.page,
            pageSize: normalized.pageSize,
            fetchLogs: true,
          });

          if (res.success && res.data) {
            const d = res.data;
            const targetId = d.activeClientId || nextClient || "";
            setLogsSelectedClientId(targetId);

            queryCacheRef.current.set(cacheKey, {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              dbClients: d.dbClients as any,
              machines: d.machines,
              timestamp: Date.now(),
            });

            const newSubCache: SubTabCacheData = {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              dbClients: d.dbClients as any,
              machines: d.machines,
              selectedId: targetId,
            };
            subTabCacheRef.current["client"] = newSubCache;

            setActiveLogs(d.hourLogs);
            setActiveSummary(d.logsSummary);
            setActiveTotalCount(d.totalLogsCount);
            setActiveCurrentPage(d.currentPage);
            setActiveLogsPageSize(d.logsPageSize);
            setActiveDbClients(d.dbClients as any);
            setActiveMachinesList(d.machines);
          }
        } else if (targetView === "operator") {
          const res = await getOperationsOperatorLogsAction({
            operatorId: normalized.operatorId,
            month: nextMonth,
            customStart: normalized.startDate,
            customEnd: normalized.endDate,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            search: normalized.search,
            sort: normalized.sort,
            page: normalized.page,
            pageSize: normalized.pageSize,
          });

          if (res.success && res.data) {
            const d = res.data;
            const targetId = d.activeOperatorId || nextOperator || "";
            if (targetId) setLogsSelectedOperatorId(targetId);

            queryCacheRef.current.set(cacheKey, {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              timestamp: Date.now(),
            });

            const newSubCache: SubTabCacheData = {
              hourLogs: d.hourLogs,
              logsSummary: d.logsSummary,
              totalLogsCount: d.totalLogsCount,
              currentPage: d.currentPage,
              logsPageSize: d.logsPageSize,
              machines: s.activeMachinesList,
              dbClients: s.activeDbClients,
              selectedId: targetId,
            };
            subTabCacheRef.current["operator"] = newSubCache;

            setActiveLogs(d.hourLogs);
            setActiveSummary(d.logsSummary);
            setActiveTotalCount(d.totalLogsCount);
            setActiveCurrentPage(d.currentPage);
            setActiveLogsPageSize(d.logsPageSize);
          }
        }
      } catch (err) {
        console.error("[OperationsLogsTab] Filter error:", err);
      } finally {
        setIsClientDataLoading(false);
      }
    },
    []
  );

  // Unified filter change: always resets page = 1
  const handleFilterChange = useCallback(
    (updates: Record<string, string | number | undefined | boolean>) => {
      handleNormalizedFilterChange(updates, false);
    },
    [handleNormalizedFilterChange]
  );

  // Pagination navigation: preserves newPage
  const handlePageChange = useCallback(
    (newPage: number) => {
      handleNormalizedFilterChange({ page: newPage }, true);
    },
    [handleNormalizedFilterChange]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      handleNormalizedFilterChange({ pageSize: newSize, page: 1 }, false);
    },
    [handleNormalizedFilterChange]
  );

  // Gesture Refresh (Pull-to-Refresh) Integration (AC-08, AC-09, AC-10):
  // When user pulls down to refresh, purge queryCacheRef and subTabCacheRef,
  // then refetch fresh database records for the active tab while strictly preserving filters.
  usePullToRefresh(
    useCallback(async () => {
      queryCacheRef.current.clear();
      subTabCacheRef.current = { machine: null, client: null, operator: null };
      await handleNormalizedFilterChange({ page: 1 });
    }, [handleNormalizedFilterChange])
  );

  const handleSortChange = useCallback(
    (s: string) => {
      setActiveSort(s);
      handleNormalizedFilterChange({ sort: s, page: 1 }, false);
    },
    [handleNormalizedFilterChange]
  );


  // Active operators pool
  const activeOperators = useMemo(() => {
    return operators.filter((u) => u.status === "active");
  }, [operators]);

  // Ordered machines: prioritize machines with logs
  const logMachineIdsInOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    currentLogs.forEach((l) => {
      if (l.machine_id && !seen.has(l.machine_id)) {
        seen.add(l.machine_id);
        order.push(l.machine_id);
      }
    });
    return order;
  }, [currentLogs]);

  const orderedMachines = useMemo(() => {
    const remaining = currentMachines.filter((m) => !logMachineIdsInOrder.includes(m.id));
    return [
      ...logMachineIdsInOrder
        .map((id) => currentMachines.find((m) => m.id === id))
        .filter(Boolean) as Machine[],
      ...remaining,
    ];
  }, [logMachineIdsInOrder, currentMachines]);

  const activeMachineId = useMemo(() =>
    logsSelectedMachineId && logsSelectedMachineId !== "all"
      ? logsSelectedMachineId
      : orderedMachines[0]?.id || "",
    [logsSelectedMachineId, orderedMachines]
  );

  const activeMachineObj = useMemo(() =>
    orderedMachines.find((m) => m.id === activeMachineId) ||
    currentMachines.find((m) => m.id === activeMachineId) ||
    (currentLogs.find((l) => l.machine_id === activeMachineId)?.machine as any),
    [orderedMachines, currentMachines, currentLogs, activeMachineId]
  );

  // Ordered operators
  const logOperatorIdsInOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    currentLogs.forEach((l) => {
      if (l.operator_id && !seen.has(l.operator_id)) {
        seen.add(l.operator_id);
        order.push(l.operator_id);
      }
    });
    return order;
  }, [currentLogs]);

  const orderedOperators = useMemo(() => {
    const remaining = activeOperators.filter((op) => !logOperatorIdsInOrder.includes(op.id));
    return [
      ...logOperatorIdsInOrder
        .map((id) => activeOperators.find((op) => op.id === id))
        .filter(Boolean) as User[],
      ...remaining,
    ];
  }, [logOperatorIdsInOrder, activeOperators]);

  const activeOperatorId = useMemo(() =>
    logsSelectedOperatorId && logsSelectedOperatorId !== "all"
      ? logsSelectedOperatorId
      : orderedOperators[0]?.id || "",
    [logsSelectedOperatorId, orderedOperators]
  );

  const activeOperatorObj = useMemo(() =>
    orderedOperators.find((op) => op.id === activeOperatorId) ||
    operators.find((op) => op.id === activeOperatorId) ||
    (currentLogs.find((l) => l.operator_id === activeOperatorId)?.operator as any),
    [orderedOperators, operators, currentLogs, activeOperatorId]
  );

  const activeOperatorName = useMemo(() =>
    activeOperatorObj?.full_name || activeOperatorObj?.name || "",
    [activeOperatorObj]
  );

  // Comprehensive clients list derived from currentDbClients and currentLogs/currentMachines
  const allClientsList = useMemo(() => {
    const clientsMap = new Map<string, any>();

    (currentDbClients || []).forEach((c) => {
      const name = c.company_name || c.client_name || (c as any).name || "Client";
      const fullAddr = formatClientFullAddress(c);
      clientsMap.set(c.id, {
        ...c,
        street: c.street || "",
        address: fullAddr,
        client_name: name,
        company_name: name,
        name,
      });
    });

    currentLogs.forEach((l) => {
      const c = (l as any).client;
      if (c && c.id && !clientsMap.has(c.id)) {
        const name = c.company_name || c.client_name || "Client";
        const fullAddr = formatClientFullAddress(c);
        clientsMap.set(c.id, {
          id: c.id,
          code: c.code,
          street: c.street || "",
          client_name: name,
          company_name: name,
          name: name,
          city: c.city,
          district: c.district,
          state: c.state,
          pincode: c.pincode,
          address: fullAddr,
          phone: c.phone,
        });
      }
    });

    currentMachines.forEach((m) => {
      const c = (m as any).client;
      if (c && c.id && !clientsMap.has(c.id)) {
        const name = c.company_name || c.client_name || "Client";
        const fullAddr = formatClientFullAddress(c);
        clientsMap.set(c.id, {
          id: c.id,
          code: c.code,
          street: c.street || "",
          client_name: name,
          company_name: name,
          name: name,
          city: c.city,
          district: c.district,
          state: c.state,
          pincode: c.pincode,
          address: fullAddr,
          phone: c.phone,
        });
      }
    });

    return Array.from(clientsMap.values());
  }, [currentDbClients, currentLogs, currentMachines]);

  // Active selected client resolution
  const activeClient = useMemo(() => {
    if (!allClientsList.length) return null;

    if (logsSelectedClientId && logsSelectedClientId !== "all") {
      const found = allClientsList.find(
        (c) =>
          c.id === logsSelectedClientId ||
          c.client_name?.toLowerCase().trim() === logsSelectedClientId.toLowerCase().trim() ||
          c.company_name?.toLowerCase().trim() === logsSelectedClientId.toLowerCase().trim()
      );
      if (found) return found;
    }

    if (mostRecentClientId) {
      const recent = allClientsList.find((c) => c.id === mostRecentClientId);
      if (recent) return recent;
    }

    const clientWithLogs = allClientsList.find((c) =>
      currentLogs.some(
        (l) =>
          l.client_id === c.id ||
          (l.client as any)?.id === c.id ||
          (l.client as any)?.client_name?.toLowerCase().trim() === c.client_name?.toLowerCase().trim() ||
          (l.client as any)?.company_name?.toLowerCase().trim() === c.company_name?.toLowerCase().trim()
      )
    );
    return clientWithLogs || allClientsList[0];
  }, [allClientsList, logsSelectedClientId, mostRecentClientId, currentLogs]);

  const activeClientId = useMemo(() => activeClient?.id || "", [activeClient]);
  const activeClientName = useMemo(() =>
    activeClient?.company_name || activeClient?.client_name || activeClient?.name || "",
    [activeClient]
  );
  const activeDbClient = activeClient;

  // Derived machine IDs associated with active selected client from logs
  const clientMachineIdsFromLogs = useMemo(() => {
    if (!activeClientId && !activeClientName) return [];
    return Array.from(
      new Set(
        currentLogs
          .filter((l) => {
            if (activeClientId && (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId))
              return true;
            const cName =
              (l as any)?.client?.client_name ||
              (l as any)?.client?.company_name ||
              (l.machine as any)?.customer_name ||
              "";
            return (
              activeClientName &&
              cName.toLowerCase().trim() === activeClientName.toLowerCase().trim()
            );
          })
          .map((l) => l.machine_id)
          .filter(Boolean)
      )
    );
  }, [currentLogs, activeClientId, activeClientName]);

  // Derived machines rented by active selected client
  const clientMachines = useMemo(() => {
    if (!activeClientId && !activeClientName) return [];
    return currentMachines.filter((m) => {
      if (activeClientId && m.client_id === activeClientId) return true;
      if (activeClientId && (m as any).client?.id === activeClientId) return true;
      const mClientName =
        (m as any).client?.company_name ||
        (m as any).client?.client_name ||
        (m as any).customer_name ||
        "";
      if (activeClientName && mClientName.toLowerCase().trim() === activeClientName.toLowerCase().trim())
        return true;
      if (clientMachineIdsFromLogs.includes(m.id)) return true;
      return false;
    });
  }, [currentMachines, activeClientId, activeClientName, clientMachineIdsFromLogs]);

  // Derived unique site locations for active selected client
  const clientSites = useMemo(() => {
    const sites = new Set<string>();

    if (activeClient?.sites && Array.isArray(activeClient.sites)) {
      activeClient.sites.forEach((s: string) => {
        if (s && s.trim()) sites.add(s.trim());
      });
    }

    const matchingClients = allClientsList.filter(
      (c) =>
        (activeClientId && c.id === activeClientId) ||
        (activeClientName &&
          ((c.company_name &&
            c.company_name.toLowerCase().trim() === activeClientName.toLowerCase().trim()) ||
            (c.client_name &&
              c.client_name.toLowerCase().trim() === activeClientName.toLowerCase().trim())))
    );

    matchingClients.forEach((c) => {
      const fullAddr = formatClientFullAddress(c);
      if (fullAddr) sites.add(fullAddr);
    });

    if (activeDbClient || activeClient) {
      const primaryAddr = formatClientFullAddress(activeDbClient || activeClient);
      if (primaryAddr) sites.add(primaryAddr);
    }

    currentLogs.forEach((l) => {
      const isClientLog =
        (activeClientId &&
          (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId)) ||
        (activeClientName &&
          ((l as any)?.client?.client_name || (l as any)?.client?.company_name || "")
            .toLowerCase()
            .trim() === activeClientName.toLowerCase().trim()) ||
        clientMachines.some((m) => m.id === l.machine_id);

      if (isClientLog && l.location && l.location.trim()) {
        const loc = l.location.trim();
        const isFragmentOfKnownSite = Array.from(sites).some(
          (site) =>
            site.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(site.toLowerCase())
        );
        if (!isFragmentOfKnownSite) {
          sites.add(loc);
        }
      }
    });

    const normalizedSites: string[] = [];
    Array.from(sites).forEach((s) => {
      const existingIdx = normalizedSites.findIndex(
        (item) =>
          item.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(item.toLowerCase())
      );
      if (existingIdx === -1) {
        normalizedSites.push(s);
      } else if (s.length > normalizedSites[existingIdx].length) {
        normalizedSites[existingIdx] = s;
      }
    });

    return normalizedSites.filter(Boolean);
  }, [
    activeDbClient,
    activeClient,
    clientMachines,
    currentLogs,
    activeClientId,
    activeClientName,
    allClientsList,
  ]);

  const effectiveSelectedSite = useMemo(() => {
    if (!logsSelectedSite || logsSelectedSite === "all") return "all";
    return logsSelectedSite;
  }, [logsSelectedSite]);

  const effectiveSelectedClientMachineId = useMemo(() => {
    if (!logsSelectedClientMachineId || logsSelectedClientMachineId === "all") {
      return "all";
    }
    if (!clientMachines.some((m) => m.id === logsSelectedClientMachineId)) {
      return "all";
    }
    return logsSelectedClientMachineId;
  }, [logsSelectedClientMachineId, clientMachines]);

  // Active selected client details
  const clientMobile = activeDbClient?.phone || "—";
  const clientEmail = activeDbClient?.email || "—";
  const clientAddress = formatClientFullAddress(activeDbClient || activeClient) || "—";

  // Aggregate metrics calculation for filtered logs (memoized to avoid forEach on every render)
  const aggregateMetrics = useMemo(() => {
    let localRun = 0;
    let localOt = 0;
    let localBkd = 0;
    currentLogs.forEach((log) => {
      const startMtr = log.start_meter ?? 0;
      const endMtr = log.end_meter ?? startMtr;
      const diff = endMtr >= startMtr ? (endMtr - startMtr) : 0;
      const safeDiff = diff <= 24 ? diff : 0;
      const rawRun = log.running_hours ?? safeDiff;
      const run = Math.max(0, Math.round((rawRun <= 24 ? rawRun : safeDiff) * 10) / 10);
      localRun += run;
      localOt += log.overtime_hours || 0;
      if (log.is_breakdown) localBkd++;
    });

    return {
      totalFilteredRunHours: currentSummary
        ? currentSummary.totalRunHours
        : Math.round(localRun * 10) / 10,
      totalFilteredOtHours: currentSummary
        ? currentSummary.totalOtHours
        : Math.round(localOt * 10) / 10,
      totalFilteredBreakdowns: currentSummary ? currentSummary.totalBreakdowns : localBkd,
      loggedDaysCount: currentSummary
        ? currentSummary.loggedDaysCount
        : new Set(currentLogs.map((l) => l.log_date)).size,
      totalMatchingLogs: currentTotalLogsCount ?? currentLogs.length,
    };
  }, [currentLogs, currentSummary, currentTotalLogsCount]);

  const { totalFilteredRunHours, totalFilteredOtHours, totalFilteredBreakdowns, loggedDaysCount, totalMatchingLogs } = aggregateMetrics;

  const currentMonthValue = getCurrentMonthValue();
  const selectedMonthLabel = useMemo(() =>
    MONTH_NAMES.find((m) => m.value === logsSelectedMonth)?.label ||
    MONTH_NAMES.find((m) => m.value === currentMonthValue)?.label ||
    "September",
    [logsSelectedMonth, currentMonthValue]
  );
  const displayWorkingDays = loggedDaysCount > 0 ? loggedDaysCount : 26;

  // On-demand lazy loader for expanding client group
  const handleToggleClientExpand = useCallback(async () => {
    const willExpand = !isClientSummaryExpanded;
    setIsClientSummaryExpanded(willExpand);

    // Silent URL state update (preserves shareable/bookmarkable URLs)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (willExpand) {
        url.searchParams.set("expanded", "true");
      } else {
        url.searchParams.delete("expanded");
      }
      window.history.replaceState(null, "", url.toString());
    }

    // If expanding and we don't have records loaded for this client yet
    if (willExpand && activeLogs.length === 0 && activeClientId) {
      const s = filterStateRef.current;
      const clientMachineFilter = (s.logsSelectedClientMachineId && s.logsSelectedClientMachineId !== "all" && clientMachines.some((m) => m.id === s.logsSelectedClientMachineId))
        ? s.logsSelectedClientMachineId
        : undefined;

      // Check queryCacheRef first
      const normalized = normalizeOperationsFilter({
        viewMode: "client",
        clientId: activeClientId,
        month: s.logsSelectedMonth,
        customStart: s.logsCustomStartDate,
        customEnd: s.logsCustomEndDate,
        site: s.logsSelectedSite && s.logsSelectedSite !== "all" ? s.logsSelectedSite : undefined,
        locationId: s.logsSelectedSite && s.logsSelectedSite !== "all" ? s.logsSelectedSite : undefined,
        machineId: clientMachineFilter,
        search: s.committedSearch || undefined,
        sort: activeSort || "date-desc",
        page: activeCurrentPage,
        pageSize: activeLogsPageSize,
      });
      const cacheKey = serializeNormalizedOperationsFilter(normalized);
      const cached = queryCacheRef.current.get(cacheKey);

      if (cached && cached.hourLogs && cached.hourLogs.length > 0) {
        setActiveLogs(cached.hourLogs);
        setActiveTotalCount(cached.totalLogsCount);
        setActiveSummary(cached.logsSummary);
        if (cached.machines) setActiveMachinesList(cached.machines);
        return;
      }

      setIsClientLogsLoading(true);
      try {
        const res = await getOperationsClientLogsAction({
          clientId: activeClientId,
          site: s.logsSelectedSite && s.logsSelectedSite !== "all" ? s.logsSelectedSite : undefined,
          machineId: clientMachineFilter,
          month: s.logsSelectedMonth,
          customStart: s.logsCustomStartDate,
          customEnd: s.logsCustomEndDate,
          search: s.committedSearch || undefined,
          sort: (activeSort as any) || "date-desc",
          page: activeCurrentPage,
          pageSize: activeLogsPageSize,
          fetchLogs: true,
        });

        if (res.success && res.data) {
          const d = res.data;
          setActiveLogs(d.hourLogs);
          setActiveTotalCount(d.totalLogsCount);
          setActiveSummary(d.logsSummary);
          if (d.machines) setActiveMachinesList(d.machines);

          queryCacheRef.current.set(cacheKey, {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            machines: d.machines,
            dbClients: d.dbClients as any,
            timestamp: Date.now(),
          });

          subTabCacheRef.current["client"] = {
            hourLogs: d.hourLogs,
            logsSummary: d.logsSummary,
            totalLogsCount: d.totalLogsCount,
            currentPage: d.currentPage,
            logsPageSize: d.logsPageSize,
            machines: d.machines,
            dbClients: d.dbClients as any,
            selectedId: activeClientId,
          };
        }
      } catch (err) {
        console.error("[handleToggleClientExpand] Error:", err);
      } finally {
        setIsClientLogsLoading(false);
      }
    }
  }, [isClientSummaryExpanded, activeLogs.length, activeClientId, activeSort, activeCurrentPage, activeLogsPageSize]);

  // Sync mobile stream when active dataset or filters change
  useEffect(() => {
    setMobileLogsList(currentLogs);
    setMobilePage(currentCurrentPage || 1);
    setMobileHasMore(currentLogs.length < totalMatchingLogs);
    setLoadMoreMobileError(null);
  }, [currentLogs, totalMatchingLogs, currentCurrentPage]);

  // Mobile Load More Handler for infinite chunk lazy loading
  const handleLoadMoreMobile = useCallback(async () => {
    if (
      !mobileHasMore ||
      isLoadingMoreMobile ||
      isPending ||
      isClientDataLoading ||
      isClientLogsLoading ||
      isFetchingMobileRef.current
    ) {
      return;
    }

    isFetchingMobileRef.current = true;
    setIsLoadingMoreMobile(true);
    setLoadMoreMobileError(null);

    try {
      const nextPage = mobilePage + 1;
      let nextLogs: MachineHourLog[] = [];
      let totalServerCount = totalMatchingLogs;

      if (logsViewMode === "machine") {
        const res = await getOperationsMachineLogsAction({
          machineId: activeMachineId && activeMachineId !== "all" ? activeMachineId : undefined,
          site: effectiveSelectedSite && effectiveSelectedSite !== "all" ? effectiveSelectedSite : undefined,
          month: logsSelectedMonth,
          customStart: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          customEnd: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          startDate: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          endDate: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          search: committedSearch || undefined,
          sort: (activeSort as any) || "date-desc",
          page: nextPage,
          pageSize: currentLogsPageSize || 20,
        });
        if (res.success && res.data) {
          nextLogs = res.data.hourLogs || [];
          totalServerCount = res.data.totalLogsCount || totalMatchingLogs;
        } else {
          throw new Error(res.error || "Failed to load more machine logs.");
        }
      } else if (logsViewMode === "client") {
        const res = await getOperationsClientLogsAction({
          clientId: activeClientId && activeClientId !== "all" ? activeClientId : undefined,
          site: effectiveSelectedSite && effectiveSelectedSite !== "all" ? effectiveSelectedSite : undefined,
          machineId:
            effectiveSelectedClientMachineId && effectiveSelectedClientMachineId !== "all"
              ? effectiveSelectedClientMachineId
              : undefined,
          month: logsSelectedMonth,
          customStart: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          customEnd: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          startDate: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          endDate: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          search: committedSearch || undefined,
          sort: (activeSort as any) || "date-desc",
          page: nextPage,
          pageSize: currentLogsPageSize || 20,
          fetchLogs: true,
        });
        if (res.success && res.data) {
          nextLogs = res.data.hourLogs || [];
          totalServerCount = res.data.totalLogsCount || totalMatchingLogs;
        } else {
          throw new Error(res.error || "Failed to load more client logs.");
        }
      } else if (logsViewMode === "operator") {
        const res = await getOperationsOperatorLogsAction({
          operatorId: activeOperatorId && activeOperatorId !== "all" ? activeOperatorId : undefined,
          month: logsSelectedMonth,
          customStart: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          customEnd: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          startDate: logsSelectedMonth === "custom" ? logsCustomStartDate : undefined,
          endDate: logsSelectedMonth === "custom" ? logsCustomEndDate : undefined,
          search: committedSearch || undefined,
          sort: (activeSort as any) || "date-desc",
          page: nextPage,
          pageSize: currentLogsPageSize || 20,
        });
        if (res.success && res.data) {
          nextLogs = res.data.hourLogs || [];
          totalServerCount = res.data.totalLogsCount || totalMatchingLogs;
        } else {
          throw new Error(res.error || "Failed to load more operator logs.");
        }
      }

      setMobileLogsList((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const fresh = nextLogs.filter((l) => !existingIds.has(l.id));
        const merged = [...prev, ...fresh];
        setMobileHasMore(merged.length < totalServerCount);
        return merged;
      });
      setMobilePage(nextPage);
    } catch (err: any) {
      setLoadMoreMobileError(err?.message || "Failed to load more logs.");
    } finally {
      setIsLoadingMoreMobile(false);
      isFetchingMobileRef.current = false;
    }
  }, [
    mobileHasMore,
    isLoadingMoreMobile,
    isPending,
    isClientDataLoading,
    isClientLogsLoading,
    mobilePage,
    logsViewMode,
    activeMachineId,
    effectiveSelectedSite,
    logsSelectedMonth,
    logsCustomStartDate,
    logsCustomEndDate,
    committedSearch,
    activeSort,
    currentLogsPageSize,
    activeClientId,
    effectiveSelectedClientMachineId,
    activeOperatorId,
    totalMatchingLogs,
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

  const handleOpenConflictModal = useCallback((log: MachineHourLog) => {
    setSelectedConflictLog(log);
    setShowConflictModal(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* FILTER & SEARCH TOOLBAR (PERMANENTLY EXPANDED) */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] shrink-0">
            <button
              type="button"
              onClick={() => handleSubTabClick("machine")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                logsViewMode === "machine"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Machine
            </button>
            <button
              type="button"
              onClick={() => handleSubTabClick("client")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                logsViewMode === "client"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Clients
            </button>
            <button
              type="button"
              onClick={() => handleSubTabClick("operator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                logsViewMode === "operator"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              Operator
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Section (Permanently Expanded) */}
        <div className="pt-3 mt-3 border-t border-[var(--color-hairline)] space-y-3">
                {logsViewMode === "client" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <ClientSelect
                        label="Select Client"
                        count={allClientsList.length}
                        value={activeClientId}
                        onChange={(val, clientObj) => {
                          const nextId = clientObj?.id || val;
                          setLogsSelectedClientId(nextId);
                          setLogsSelectedSite("");
                          setLogsSelectedClientMachineId("all");
                          handleFilterChange({
                            view: "client",
                            client: nextId,
                            machine: undefined,
                            site: undefined,
                            page: 1,
                          });
                        }}
                        clients={allClientsList}
                        placeholder="Select Client..."
                      />
                    </div>

                    <div>
                      <SearchableSelect
                        label="Select Location"
                        count={clientSites.length}
                        value={effectiveSelectedSite}
                        onChange={(val) => {
                          const nextSite = val === "all" ? "" : val;
                          setLogsSelectedSite(nextSite);
                          handleFilterChange({ site: nextSite || undefined, page: 1 });
                        }}
                        options={[
                          { value: "all", label: "All Sites & Locations" },
                          ...clientSites.map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>

                    <div>
                      <MachineSelect
                        label="Select Machine"
                        count={clientMachines.length}
                        value={effectiveSelectedClientMachineId}
                        onChange={(mId) => {
                          const next = mId || "all";
                          setLogsSelectedClientMachineId(next);
                          handleFilterChange({ machine: next === "all" ? undefined : next, page: 1 });
                        }}
                        machines={clientMachines}
                        allowAll={true}
                        allLabel="All Machines"
                      />
                    </div>

                    <div>
                      <SearchableSelect
                        label="Select Month"
                        value={logsSelectedMonth}
                        onChange={(val) => {
                          setLogsSelectedMonth(val);
                          if (val === "custom") {
                            handleFilterChange({
                              month: val,
                              start: logsCustomStartDate,
                              end: logsCustomEndDate,
                              page: 1,
                            });
                          } else {
                            handleFilterChange({
                              month: val,
                              start: undefined,
                              end: undefined,
                              page: 1,
                            });
                          }
                        }}
                        options={MONTH_NAMES.map((m) => ({
                          value: m.value,
                          label: m.label,
                        }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      {logsViewMode === "machine" && (
                        <MachineSelect
                          label="Select Machine"
                          count={orderedMachines.length}
                          value={activeMachineId}
                          onChange={(mId) => {
                            setLogsSelectedMachineId(mId);
                            handleFilterChange({ machine: mId, page: 1 });
                          }}
                          machines={orderedMachines}
                        />
                      )}

                      {logsViewMode === "operator" && (
                        <UserSelect
                          label="Select Operator"
                          count={orderedOperators.length}
                          value={activeOperatorId}
                          onChange={(opId) => {
                            setLogsSelectedOperatorId(opId);
                            handleFilterChange({ operator: opId, page: 1 });
                          }}
                          users={orderedOperators}
                        />
                      )}
                    </div>

                    <div>
                      <SearchableSelect
                        label="Select Month"
                        value={logsSelectedMonth}
                        onChange={(val) => {
                          setLogsSelectedMonth(val);
                          if (val === "custom") {
                            handleFilterChange({
                              month: val,
                              start: logsCustomStartDate,
                              end: logsCustomEndDate,
                              page: 1,
                            });
                          } else {
                            handleFilterChange({
                              month: val,
                              start: undefined,
                              end: undefined,
                              page: 1,
                            });
                          }
                        }}
                        options={MONTH_NAMES.map((m) => ({
                          value: m.value,
                          label: m.label,
                        }))}
                      />
                    </div>
                  </div>
                )}

                {/* Custom Date Range Picker */}
                {logsSelectedMonth === "custom" && (
                  <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="col-span-1 sm:col-span-2">
                      <DateRangePicker
                        label="Select Date Range"
                        value={{
                          startDate: logsCustomStartDate,
                          endDate: logsCustomEndDate,
                        }}
                        onChange={({ startDate, endDate }) => {
                          setLogsCustomStartDate(startDate);
                          setLogsCustomEndDate(endDate);
                          if (startDate && endDate) {
                            handleFilterChange({
                              month: "custom",
                              start: startDate,
                              end: endDate,
                              page: 1,
                            });
                          } else if (!startDate && !endDate) {
                            const curMonth = getCurrentMonthValue();
                            setLogsSelectedMonth(curMonth);
                            handleFilterChange({
                              month: curMonth,
                              start: undefined,
                              end: undefined,
                              page: 1,
                            });
                          }
                        }}
                        allowAnyPast
                        allowAnyFuture
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
        </div>
      </div>

      {/* SUB-VIEW HEADER CARDS (INDEPENDENT LOADING STATES) */}
      {logsViewMode === "machine" && (
        isClientDataLoading && !activeMachineObj ? (
          <OperationsSubViewCardSkeleton />
        ) : activeMachineObj ? (
          <OperationsMachineView
            machine={activeMachineObj}
            isExpanded={isMachineSummaryExpanded}
            onToggleExpand={() => setIsMachineSummaryExpanded((prev) => !prev)}
            totalFilteredRunHours={totalFilteredRunHours}
            totalFilteredBreakdowns={totalFilteredBreakdowns}
            onOpenHistoryModal={handleOpenHistoryModal}
          />
        ) : null
      )}

      {logsViewMode === "client" && (
        isClientDataLoading && !activeClientName ? (
          <OperationsSubViewCardSkeleton />
        ) : activeClientName ? (
          <OperationsClientView
            activeClient={activeClient}
            activeClientName={activeClientName}
            clientMachines={clientMachines}
            clientAddress={clientAddress}
            clientMobile={clientMobile}
            clientEmail={clientEmail}
            displayWorkingDays={displayWorkingDays}
            selectedMonthLabel={selectedMonthLabel}
            isExpanded={isClientSummaryExpanded}
            onToggleExpand={handleToggleClientExpand}
            isLoadingLogs={isClientDataLoading || isClientLogsLoading}
            totalFilteredRunHours={totalFilteredRunHours}
            totalFilteredOtHours={totalFilteredOtHours}
            totalFilteredBreakdowns={totalFilteredBreakdowns}
            totalMatchingLogs={totalMatchingLogs}
          />
        ) : null
      )}

      {logsViewMode === "operator" && (
        isClientDataLoading && !activeOperatorName ? (
          <OperationsSubViewCardSkeleton />
        ) : activeOperatorName ? (
          <OperationsOperatorView
            activeOperatorObj={activeOperatorObj}
            activeOperatorName={activeOperatorName}
            isExpanded={isOperatorSummaryExpanded}
            onToggleExpand={() => setIsOperatorSummaryExpanded((prev) => !prev)}
            totalFilteredRunHours={totalFilteredRunHours}
            totalFilteredOtHours={totalFilteredOtHours}
            totalFilteredBreakdowns={totalFilteredBreakdowns}
            totalMatchingLogs={totalMatchingLogs}
          />
        ) : null
      )}

      {/* DESKTOP LOGS TABLE */}
      <OperationsLogsTable
        logs={currentLogs}
        logsViewMode={logsViewMode}
        isPending={isPending || isClientDataLoading || isClientLogsLoading}
        currentPage={currentCurrentPage}
        logsPageSize={currentLogsPageSize}
        totalMatchingLogs={totalMatchingLogs}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onOpenConflictModal={handleOpenConflictModal}
        onEditLog={handleRequestEditLog}
        canEditLog={canEditLog}
        onDeleteLog={handleRequestDeleteLog}
        canDeleteLog={canDeleteLog}
        currentSort={activeSort}
        onSortChange={handleSortChange}
      />

      {/* MOBILE TOUCH CARDS */}
      <OperationsLogsMobileList
        logs={currentLogs}
        logsViewMode={logsViewMode}
        isPending={isPending || isClientDataLoading || isClientLogsLoading}
        currentPage={currentCurrentPage}
        logsPageSize={currentLogsPageSize}
        totalMatchingLogs={totalMatchingLogs}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onOpenConflictModal={handleOpenConflictModal}
        onEditLog={handleRequestEditLog}
        canEditLog={canEditLog}
        onDeleteLog={handleRequestDeleteLog}
        canDeleteLog={canDeleteLog}
        mobileLogsList={mobileLogsList}
        isLoadingMoreMobile={isLoadingMoreMobile}
        mobileHasMore={mobileHasMore}
        loadMoreMobileError={loadMoreMobileError}
        onMobileRetry={handleMobileRetry}
        mobileSentinelRef={mobileSentinelRef}
      />

      {/* DELETE LOG CONFIRMATION (destructive action guard) */}
      <ConfirmationDialog
        isOpen={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleConfirmDeleteLog}
        title="Delete Daily Running Hour Log"
        description={
          <>
            Permanently delete the{" "}
            <strong>{logToDelete ? formatDate(logToDelete.log_date) : ""}</strong> daily running
            hour log for{" "}
            <strong>
              {logToDelete?.machine
                ? ((logToDelete.machine as any)?.model ||
                  (logToDelete.machine as any)?.machine_code ||
                  "equipment")
                : "equipment"}
            </strong>
            ? The machine hour meter will be recalculated and this action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Log"
        variant="danger"
        loading={isDeletingLog}
      />

      {/* DYNAMIC ON-DEMAND MODALS */}
      {showMachineHistoryModal && activeMachineObj && (
        <MachineHistoryQuickModal
          machine={activeMachineObj as any}
          open={showMachineHistoryModal}
          onClose={() => setShowMachineHistoryModal(false)}
        />
      )}

      {logToEdit && (
        <OperationsEditLogModal
          log={logToEdit}
          isOpen={Boolean(logToEdit)}
          onClose={() => setLogToEdit(null)}
          onSuccess={(updatedLog) => {
            handleLogUpdated(updatedLog);
            setLogToEdit(null);
            startTransition(() => {
              router.refresh();
            });
          }}
          onRequestDelete={(log) => {
            setLogToEdit(null);
            setLogToDelete(log);
          }}
          canDelete={canDeleteLog(logToEdit)}
        />
      )}

      {showSupervisorPrintModal && (
        <PrintableSupervisorLogsModal
          open={true}
          onClose={() => setShowSupervisorPrintModal(false)}
          logs={currentLogs}
          user={user!}
          viewMode={logsViewMode}
          selectedEntityId={
            logsViewMode === "machine"
              ? activeMachineId
              : logsViewMode === "client"
              ? activeClientId
              : activeOperatorId
          }
          selectedEntityName={
            logsViewMode === "machine"
              ? activeMachineObj?.machine_name || "Machine"
              : logsViewMode === "client"
              ? activeClientName
              : activeOperatorName
          }
          selectedClientId={activeClientId}
          selectedClientName={activeClientName}
          selectedMachineId={activeMachineId}
          selectedOperatorId={activeOperatorId}
          selectedMonthValue={logsSelectedMonth}
          selectedSite={effectiveSelectedSite}
          selectedClientMachineId={effectiveSelectedClientMachineId}
          machines={currentMachines}
          clientSites={clientSites}
          clientMachines={clientMachines}
          customStartDate={logsCustomStartDate}
          customEndDate={logsCustomEndDate}
          search={committedSearch}
        />
      )}

      {showConflictModal && selectedConflictLog && (
        <ConflictResolutionModal
          isOpen={true}
          onClose={() => {
            setShowConflictModal(false);
            setSelectedConflictLog(null);
          }}
          onSuccess={(action, adjustedEndTime) => {
            setActiveLogs((prev) =>
              prev.map((l) =>
                  l.id === selectedConflictLog.id
                    ? {
                        ...l,
                        conflict_status: action === "adjust" ? "adjusted" : "acknowledged",
                        ...(action === "adjust" && adjustedEndTime ? { end_time: adjustedEndTime } : {}),
                      }
                    : l
              )
            );
            queryCacheRef.current.clear();
            setShowConflictModal(false);
            setSelectedConflictLog(null);
          }}
          log={selectedConflictLog}
        />
      )}
    </div>
  );
});
