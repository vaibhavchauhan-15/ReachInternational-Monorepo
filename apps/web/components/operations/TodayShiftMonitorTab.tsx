"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { getTodayShiftMonitorAction, activateMachineAction } from "@/app/actions/operators";
import { Badge, useToast, Button, EmptyState, ErrorState, CustomDatePicker, FilterDropdown, type FilterDropdownOption } from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { getISTDateString, formatDate, classifyError, parseTimeToMinutes } from "@reachinternational/utils";
import type { TodayShiftMonitorRow } from "@reachinternational/types";
import { dedupeShiftMonitorRows } from "@/lib/utils/shift-monitor";
import type { User, Machine } from "@/lib/types/database";
import { UserCheck, Clock, AlertCircle, UserPlus, Calendar, Wrench, Edit2, MoreVertical } from "lucide-react";
import { ClipboardCheck } from "@/components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRegisterPageActions } from "@/components/layout/PageActionContext";
import dynamic from "next/dynamic";
import { TodayShiftMonitorKPIStrip } from "./TodayShiftMonitorKPIStrip";
import { TodayShiftMonitorCard } from "./TodayShiftMonitorCard";

import type {
  AssignOperatorModalProps,
  AssignPersonnelSuccessResult,
} from "./modals/AssignOperatorModal";

const AssistedShiftEntryModal = dynamic(
  () => import("./AssistedShiftEntryModal").then((mod) => mod.AssistedShiftEntryModal),
  { ssr: false }
);

const AssignOperatorModal = dynamic<AssignOperatorModalProps>(
  () => import("./modals/AssignOperatorModal").then((mod) => mod.AssignOperatorModal),
  { ssr: false }
);


const MachineStatusWarningDialog = dynamic(
  () =>
    import("./modals/MachineStatusWarningDialog").then(
      (mod) => mod.MachineStatusWarningDialog
    ),
  { ssr: false }
);

const TodayShiftExportModal = dynamic(
  () => import("./TodayShiftExportModal").then((mod) => mod.TodayShiftExportModal),
  { ssr: false }
);

interface TodayShiftMonitorProps {
  user: User;
  userRole?: string;
  machines?: Machine[];
  operators?: User[];
  initialRows?: TodayShiftMonitorRow[];
  initialDate?: string;
}

export function TodayShiftMonitorTab({
  user,
  userRole,
  machines = [],
  operators = [],
  initialRows,
  initialDate,
}: TodayShiftMonitorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<TodayShiftMonitorRow[]>(() => dedupeShiftMonitorRows(initialRows || []));
  const [loading, setLoading] = useState(!initialRows);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "entered" | "unassigned" | "breakdown" | "maintenance">("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time_asc" | "time_desc">("time_asc");
  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || getISTDateString());
  const [searchQuery, setSearchQuery] = useState("");
  // Search runs entirely against the in-memory day roster: `useDeferredValue` keeps
  // typing instant on large rosters without a single network round-trip.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearching = searchQuery !== deferredSearchQuery;
  const [selectedRowForEntry, setSelectedRowForEntry] = useState<TodayShiftMonitorRow | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalMachineId, setAssignModalMachineId] = useState<string | undefined>();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [warningMachine, setWarningMachine] = useState<{
    id: string;
    code: string;
    serialNumber?: string | null;
    model?: string | null;
    healthStatus?: string | null;
    status?: string | null;
    clientName?: string | null;
  } | null>(null);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [activeMenuCardKey, setActiveMenuCardKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const broadcastDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastOptimisticEditRef = useRef<number>(0);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const assignMachineIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    assignMachineIdRef.current = assignModalMachineId;
  }, [assignModalMachineId]);

  // Request coalescing: a newer roster request always supersedes an older in-flight one,
  // so rapid date/filter/realtime changes can never apply a stale response.
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastFetchedAtRef = useRef(0);
  const hasLoadedOnceRef = useRef<boolean>(Boolean(initialRows));
  // Date whose roster was already streamed from the server (SSR) — avoids a duplicate fetch.
  const serverPayloadDateRef = useRef<string | null>(initialRows ? initialDate ?? selectedDate : null);

  // Close card 3-dot actions menu on click outside or escape key
  useEffect(() => {
    if (!activeMenuCardKey) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuCardKey(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuCardKey(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuCardKey]);

  // Sync selectedDate with the server-provided date (URL driven navigation)
  useEffect(() => {
    if (initialDate && initialDate !== selectedDateRef.current) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // Adopt server-streamed rows (initial render + every router.refresh)
  useEffect(() => {
    if (!initialRows) return;
    setRows(dedupeShiftMonitorRows(initialRows));
    hasLoadedOnceRef.current = true;
    lastFetchedAtRef.current = Date.now();
    serverPayloadDateRef.current = initialDate ?? selectedDateRef.current;
    setLoading(false);
  }, [initialRows, initialDate]);

  // Permission Guard: Only roles above supervisor (manager, admin, super_admin) can enter logs
  const effectiveRole = userRole || user?.role || "";
  const canEnterLog = ["super_admin", "admin", "manager", "supervisor"].includes(effectiveRole);

  /**
   * Single roster loader. Search, client, shift and sort filtering all happen in memory
   * (see the `filtered` memo below), so this runs only when the DATE changes or when a
   * realtime / poll / manual refresh asks for authoritative data.
   */
  const fetchRoster = useCallback(
    async (dateToFetch: string, bypassCache: boolean) => {
      const requestId = ++requestSeqRef.current;
      inFlightRef.current = true;
      setFetchError(null);

      try {
        const result = await getTodayShiftMonitorAction(dateToFetch, undefined, bypassCache);
        // Discard stale responses (a newer request already started).
        if (requestId !== requestSeqRef.current) return;

        if (result.success && result.data) {
          const freshRows = dedupeShiftMonitorRows(result.data);
          setRows((prev) => {
            // Preserve a just-applied optimistic edit for the machine being reassigned.
            const timeSinceEdit = Date.now() - lastOptimisticEditRef.current;
            const optimisticMachineId = assignMachineIdRef.current;
            if (timeSinceEdit < 1500 && optimisticMachineId) {
              const editingMachineRows = prev.filter((r) => r.machine_id === optimisticMachineId);
              const otherFreshRows = freshRows.filter((r) => r.machine_id !== optimisticMachineId);
              return dedupeShiftMonitorRows([...otherFreshRows, ...editingMachineRows]);
            }
            return freshRows;
          });
          setFetchError(null);
          hasLoadedOnceRef.current = true;
        } else {
          const errInfo = classifyError(result.error || "Failed to load shift monitor data.");
          setFetchError(errInfo.message);
          toast("error", errInfo.title, errInfo.message);
        }
      } catch (err) {
        if (requestId !== requestSeqRef.current) return;
        const errInfo = classifyError(err);
        setFetchError(errInfo.message);
        toast("error", errInfo.title, errInfo.message);
      } finally {
        if (requestId === requestSeqRef.current) {
          inFlightRef.current = false;
          lastFetchedAtRef.current = Date.now();
          setLoading(false);
        }
      }
    },
    [toast]
  );

  const refreshRoster = useCallback(
    (bypassCache: boolean = true) => fetchRoster(selectedDateRef.current, bypassCache),
    [fetchRoster]
  );
  const refreshRosterRef = useRef(refreshRoster);

  useEffect(() => {
    refreshRosterRef.current = refreshRoster;
  }, [refreshRoster]);

  // ONE fetch per date. Skipped when the server already streamed that exact date's roster.
  useEffect(() => {
    if (serverPayloadDateRef.current === selectedDate) {
      serverPayloadDateRef.current = null;
      return;
    }
    if (!hasLoadedOnceRef.current) setLoading(true);
    // Navigation uses the shared cache tier (the SSR page and the URL-driven RSC payload read
    // the same entry), so switching dates can never cost a second database computation.
    fetchRoster(selectedDate, false);
  }, [selectedDate, fetchRoster]);

  // Background poll: authority fallback when realtime channels are unavailable.
  // Skipped while the tab is hidden and when a refresh already happened recently.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;
      if (Date.now() - lastFetchedAtRef.current < 20_000) return;
      refreshRosterRef.current(false);
    }, 30_000);

    // Re-sync immediately when the user returns to the tab after a long absence.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;
      if (Date.now() - lastFetchedAtRef.current < 15_000) return;
      refreshRosterRef.current(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Real-time broadcast listener for instant roster revalidation.
  // Subscribed once on mount to prevent teardown/reconnect churn.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const rosterChannel = supabase.channel("operations-roster");

    const triggerDebouncedRefresh = () => {
      if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
      broadcastDebounceRef.current = setTimeout(() => {
        refreshRosterRef.current(true);
      }, 400);
    };

    rosterChannel
      .on("broadcast", { event: "assignment_changed" }, triggerDebouncedRefresh)
      .on("broadcast", { event: "roster_updated" }, triggerDebouncedRefresh)
      .on("broadcast", { event: "log_entered" }, triggerDebouncedRefresh)
      .subscribe();

    return () => {
      if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
      supabase.removeChannel(rosterChannel);
    };
  }, []);

  // Search is resolved against the already-loaded day roster: zero network round-trips
  // and zero database work per keystroke.
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (broadcastDebounceRef.current) clearTimeout(broadcastDebounceRef.current);
      if (backgroundSyncTimeoutRef.current) clearTimeout(backgroundSyncTimeoutRef.current);
    };
  }, []);

  const handleAssignOperator = useCallback((machineId?: string) => {
    setAssignModalMachineId(machineId);
    setIsAssignModalOpen(true);
  }, []);

  const handleInitiateAssign = useCallback(
    (rowOrMachineId: TodayShiftMonitorRow | string) => {
      let targetRow: TodayShiftMonitorRow | undefined;
      let targetMachineId: string | undefined;

      if (typeof rowOrMachineId === "string") {
        targetMachineId = rowOrMachineId;
        targetRow = rows.find((r) => r.machine_id === rowOrMachineId);
      } else {
        targetRow = rowOrMachineId;
        targetMachineId = rowOrMachineId.machine_id;
      }

      if (targetRow) {
        const isBreakdown = targetRow.machine_health_status === "breakdown";
        const isMaintenance =
          targetRow.machine_health_status === "under_maintenance" ||
          targetRow.machine_status === "under_maintenance";
        if (isBreakdown || isMaintenance) {
          setWarningMachine({
            id: targetRow.machine_id,
            code: targetRow.machine_code,
            serialNumber: targetRow.machine_serial_number,
            model: targetRow.machine_model,
            healthStatus: targetRow.machine_health_status,
            status: targetRow.machine_status,
            clientName: targetRow.client_name,
          });
          setIsWarningDialogOpen(true);
          return;
        }
      }

      handleAssignOperator(targetMachineId);
    },
    [rows, handleAssignOperator]
  );

  const handleConfirmActiveAndAssign = useCallback(
    async (machineId: string) => {
      try {
        const res = await activateMachineAction(machineId);
        if (res.success) {
          toast(
            "success",
            "Machine Activated",
            `Machine ${warningMachine?.code || ""} has been set to Active.`
          );
          setRows((prev) =>
            prev.map((r) =>
              r.machine_id === machineId
                ? {
                  ...r,
                  machine_health_status: "active",
                  machine_status: r.client_id ? "rented" : "active",
                }
                : r
            )
          );
          setIsWarningDialogOpen(false);
          setWarningMachine(null);
          handleAssignOperator(machineId);
        } else {
          const errInfo = classifyError(res.error || "Failed to set machine to active.");
          toast("error", "Activation Failed", errInfo.message);
        }
      } catch (err) {
        const errInfo = classifyError(err);
        toast("error", "Activation Error", errInfo.message);
      }
    },
    [warningMachine, toast, handleAssignOperator]
  );

  // Listen for reach:quick-assign event dispatched from header or other components
  useEffect(() => {
    const handleQuickAssign = (e: any) => {
      const targetMachineId = e.detail?.machineId;
      if (targetMachineId) {
        handleInitiateAssign(targetMachineId);
      } else {
        handleAssignOperator(undefined);
      }
    };
    window.addEventListener("reach:quick-assign", handleQuickAssign);
    return () => window.removeEventListener("reach:quick-assign", handleQuickAssign);
  }, [handleInitiateAssign, handleAssignOperator]);

  // Merge prop machines with any unique machines present in today shift rows to guarantee 100% modal option coverage
  const combinedMachines = useMemo(() => {
    const map = new Map<string, Machine>();
    machines.forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    rows.forEach((r) => {
      if (r.machine_id && !map.has(r.machine_id)) {
        map.set(r.machine_id, {
          id: r.machine_id,
          machine_id: r.machine_code,
          serial_number: r.machine_serial_number,
          model: r.machine_model,
          client_id: r.client_id,
          client: r.client_name ? { company_name: r.client_name, code: r.client_code } : undefined,
          status: (r.machine_status as any) || "active",
          health_status: (r.machine_health_status as any) || "active",
        } as Machine);
      }
    });
    return Array.from(map.values());
  }, [machines, rows]);

  const clientOptions: FilterDropdownOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    const clientNames = new Map<string, string>();

    rows.forEach((r) => {
      const key = r.client_id || (r.client_name ? `name:${r.client_name}` : "unassigned");
      counts.set(key, (counts.get(key) || 0) + 1);
      if (r.client_name && !clientNames.has(key)) {
        clientNames.set(key, r.client_name);
      }
    });

    const list: FilterDropdownOption[] = [
      { value: "all", label: "All Clients", count: rows.length },
    ];

    const clientEntries = Array.from(clientNames.entries())
      .filter(([id]) => (counts.get(id) || 0) > 0)
      .sort((a, b) => a[1].localeCompare(b[1]));

    clientEntries.forEach(([id, name]) => {
      list.push({
        value: id,
        label: name,
        count: counts.get(id) || 0,
      });
    });

    return list;
  }, [rows]);

  const shiftOptions: FilterDropdownOption[] = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const rawCode = (r.shift_code || "S1").trim();
      const norm = rawCode.toUpperCase().replace(/^SHIFT\s*/i, "") || "S1";
      counts.set(norm, (counts.get(norm) || 0) + 1);
    });
    const list: FilterDropdownOption[] = [{ value: "all", label: "All Shifts", count: rows.length }];
    Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, count]) => {
        list.push({ value: code, label: `Shift ${code}`, count });
      });
    return list;
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") {
      if (statusFilter === "breakdown") {
        r = r.filter((row) => row.machine_health_status === "breakdown");
      } else if (statusFilter === "maintenance") {
        r = r.filter(
          (row) =>
            row.machine_health_status === "under_maintenance" ||
            row.machine_status === "under_maintenance"
        );
      } else {
        r = r.filter((row) => row.status === statusFilter);
      }
    }
    if (selectedClient !== "all") {
      r = r.filter((row) => {
        if (selectedClient === "unassigned") {
          return !row.client_id && (!row.client_name || row.client_name === "Available / Unassigned");
        }
        if (selectedClient.startsWith("name:")) {
          return row.client_name === selectedClient.replace("name:", "");
        }
        return row.client_id === selectedClient;
      });
    }
    if (shiftFilter !== "all") {
      const target = shiftFilter.toUpperCase().replace(/^SHIFT\s*/i, "");
      r = r.filter((row) => {
        const rowShift = (row.shift_code || "S1").toUpperCase().replace(/^SHIFT\s*/i, "");
        return rowShift === target;
      });
    }
    const search = deferredSearchQuery.trim().toLowerCase();
    if (search) {
      r = r.filter((row) =>
        [
          row.operator_name,
          row.operator_phone,
          row.operator_employee_id,
          row.machine_code,
          row.machine_serial_number,
          row.machine_model,
          row.client_name,
          row.client_code,
          row.client_city,
          row.site_name,
        ].some((value) => typeof value === "string" && value.toLowerCase().includes(search))
      );
    }

    // Always sort all rows by shift timing
    r = [...r].sort((a, b) => {
      const ta = parseTimeToMinutes(a.shift_start) ?? 9999;
      const tb = parseTimeToMinutes(b.shift_start) ?? 9999;
      if (ta !== tb) {
        return sortBy === "time_desc" ? tb - ta : ta - tb;
      }
      const mComp = (a.machine_code || "").localeCompare(b.machine_code || "");
      if (mComp !== 0) return mComp;
      return (a.shift_code || "").localeCompare(b.shift_code || "");
    });

    return r;
  }, [rows, statusFilter, selectedClient, shiftFilter, sortBy, deferredSearchQuery]);

  const summary = useMemo(() => {
    const total = rows.length;
    const entered = rows.filter((r) => r.status === "entered").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const unassigned = rows.filter((r) => r.status === "unassigned").length;
    const breakdown = rows.filter((r) => r.machine_health_status === "breakdown").length;
    const maintenance = rows.filter(
      (r) =>
        r.machine_health_status === "under_maintenance" ||
        r.machine_status === "under_maintenance"
    ).length;
    return { total, entered, pending, unassigned, breakdown, maintenance };
  }, [rows]);

  const statusOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: "all", label: "All", count: summary.total },
      { value: "pending", label: "Pending", dotColor: "bg-amber-500", count: summary.pending },
      { value: "entered", label: "Entered", dotColor: "bg-emerald-500", count: summary.entered },
      { value: "unassigned", label: "Unassigned", dotColor: "bg-rose-500", count: summary.unassigned },
      ...(summary.breakdown > 0
        ? [
          {
            value: "breakdown",
            label: "Breakdown",
            dotColor: "bg-rose-600",
            count: summary.breakdown,
          },
        ]
        : []),
      ...(summary.maintenance > 0
        ? [
          {
            value: "maintenance",
            label: "Maintenance",
            dotColor: "bg-amber-600",
            count: summary.maintenance,
          },
        ]
        : []),
    ],
    [summary]
  );

  const handleEnterLog = useCallback((row: TodayShiftMonitorRow) => {
    setSelectedRowForEntry(row);
  }, []);

  const formatTime = (t: string | null | undefined): string => {
    if (!t) return "—";
    const str = t.trim();
    if (str === "—" || str === "-" || str === "") return "—";
    if (str.includes("AM") || str.includes("PM")) return str;
    try {
      const [hStr, mStr] = str.split(":");
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10) || 0;
      if (isNaN(h)) return str;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    } catch {
      return str;
    }
  };

  // Export report listener when on Today tab: opens TodayShiftExportModal for both Excel and PDF exports
  useEffect(() => {
    const handleExport = (e: Event) => {
      e.preventDefault();
      if (rows.length === 0) {
        toast("info", "No Data", "No shifts to export for today.");
        return;
      }
      setIsExportModalOpen(true);
    };

    window.addEventListener("reach:export-print", handleExport);
    window.addEventListener("reach:quick-print", handleExport);
    window.addEventListener("reach:quick-export-excel", handleExport);
    window.addEventListener("reach:quick-export", handleExport);
    return () => {
      window.removeEventListener("reach:export-print", handleExport);
      window.removeEventListener("reach:quick-print", handleExport);
      window.removeEventListener("reach:quick-export-excel", handleExport);
      window.removeEventListener("reach:quick-export", handleExport);
    };
  }, [rows.length, toast]);

  // Quick-assign listener for desktop header and mobile 3-dot menu
  useEffect(() => {
    const handleQuickAssign = () => {
      setAssignModalMachineId(undefined);
      setIsAssignModalOpen(true);
    };
    window.addEventListener("reach:quick-assign", handleQuickAssign);
    return () => window.removeEventListener("reach:quick-assign", handleQuickAssign);
  }, []);

  // Register typed page actions for layout header
  useRegisterPageActions(
    useMemo(
      () => ({
        onQuickAssign: () => {
          setAssignModalMachineId(undefined);
          setIsAssignModalOpen(true);
        },
        onPrint: () => {
          if (rows.length === 0) {
            toast("info", "No Data", "No shifts to export for today.");
            return;
          }
          setIsExportModalOpen(true);
        },
        onExportExcel: () => {
          if (rows.length === 0) {
            toast("info", "No Data", "No shifts to export for today.");
            return;
          }
          setIsExportModalOpen(true);
        },
      }),
      [rows.length, toast]
    )
  );

  const handleEnterLogSuccess = useCallback(
    (entryData?: {
      machineId: string;
      operatorId?: string;
      startMeter: number;
      endMeter: number;
      runningHours: number;
      shiftCode: string;
      logDate: string;
    }) => {
      if (entryData) {
        // 0ms Optimistic UI update: immediately switch row to 'entered' and update meters
        setRows((prev) =>
          dedupeShiftMonitorRows(
            prev.map((r) => {
              const isMatch =
                r.machine_id === entryData.machineId &&
                (!entryData.operatorId || r.operator_id === entryData.operatorId || !r.operator_id);
              if (isMatch) {
                return {
                  ...r,
                  status: "entered",
                  start_meter: entryData.startMeter,
                  end_meter: entryData.endMeter,
                  running_hours: entryData.runningHours,
                  shift_code: entryData.shiftCode || r.shift_code,
                  entered_by_name: user?.full_name || "Supervisor",
                  entry_source: user?.role === "operator" ? "operator" : (user?.role || "supervisor"),
                };
              }
              return r;
            })
          )
        );
      }
      // Refresh authoritative data for the affected date only (no full-page reload)
      refreshRoster(true);
    },
    [refreshRoster, user]
  );

  const handleDateChange = useCallback(
    (newDate: string) => {
      if (!newDate || newDate === selectedDateRef.current) return;
      // The date effect owns the fetch — setting the date triggers exactly ONE request.
      setSelectedDate(newDate);

      try {
        const url = new URL(window.location.href);
        if (newDate === getISTDateString()) {
          url.searchParams.delete("date");
        } else {
          url.searchParams.set("date", newDate);
        }
        router.replace(url.pathname + url.search, { scroll: false });
      } catch {
        // fallback
      }
    },
    [router]
  );

  const handleResetFilters = useCallback(() => {
    // Every filter below is resolved in memory, so resetting them costs zero requests.
    setStatusFilter("all");
    setSelectedClient("all");
    setShiftFilter("all");
    setSortBy("time_asc");
    setSearchQuery("");
    const todayStr = getISTDateString();
    const dateChanged = todayStr !== selectedDateRef.current;
    if (dateChanged) {
      setSelectedDate(todayStr);
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("date");
      router.replace(url.pathname + url.search, { scroll: false });
    } catch {
      // fallback
    }
    // Only the date part needs a database read.
    if (!dateChanged) refreshRoster(true);
  }, [refreshRoster, router]);

  const isDateFiltered = selectedDate !== getISTDateString();
  const isClientFiltered = selectedClient !== "all";
  const isShiftFiltered = shiftFilter !== "all";
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (isDateFiltered ? 1 : 0) +
    (isClientFiltered ? 1 : 0) +
    (isShiftFiltered ? 1 : 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {/* KPI skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] animate-pulse" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 border-b border-[var(--color-hairline)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Historical Date Banner */}
      {isDateFiltered && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border border-sky-500/25 bg-sky-500/10 text-xs">
          <div className="flex items-center gap-2 text-sky-800 dark:text-sky-200 font-medium">
            <Calendar size={14} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <span>
              Viewing shift logs for <strong>{formatDate(selectedDate)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleDateChange(getISTDateString())}
            className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer self-start sm:self-auto"
          >
            Return to Today
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <TodayShiftMonitorKPIStrip summary={summary} />

      {/* Search & Filter Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        placeholder="Search operator name, phone, machine ID, serial, model, client..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        isLoading={isSearching}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full">
          {/* Date Picker Filter (Kept only CustomDatePicker as requested) */}
          <div className="w-full sm:w-60 md:w-64 min-w-0">
            <CustomDatePicker
              value={selectedDate}
              onChange={handleDateChange}
              allowAnyPast={true}
              allowFutureDays={0}
              showRelativeBadge={true}
              placeholder="Select date..."
            />
          </div>

          {/* Status Dropdown Filter */}
          <div className="w-full sm:w-52 min-w-0">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={statusOptions}
              className="w-full"
              dropdownClassName="w-full sm:w-56"
            />
          </div>

          {/* Client Dropdown Filter */}
          <div className="w-full sm:w-60 md:w-64 min-w-0">
            <FilterDropdown
              label="Client"
              value={selectedClient}
              onChange={(val) => setSelectedClient(val)}
              options={clientOptions}
              className="w-full"
              dropdownClassName="w-full sm:w-64"
              searchable={true}
              searchPlaceholder="Search client..."
            />
          </div>

          {/* Shift Dropdown Filter */}
          <div className="w-full sm:w-52 min-w-0">
            <FilterDropdown
              label="Shift"
              value={shiftFilter}
              onChange={(val) => setShiftFilter(val)}
              options={shiftOptions}
              className="w-full"
              dropdownClassName="w-full sm:w-56"
            />
          </div>
        </div>
      </FilterToolbar>

      {/* Inline ambient error banner when we have existing cached rows but latest refresh failed */}
      {fetchError && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate">{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshRoster(true)}
            className="font-semibold underline hover:no-underline cursor-pointer text-xs shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content: ErrorState when fetch failed and 0 rows, Empty State when 0 rows, otherwise Table and Cards */}
      {fetchError && rows.length === 0 ? (
        <div className="py-6">
          <ErrorState
            title="Failed to Load Shift Roster"
            description={fetchError}
            onRetry={() => refreshRoster(true)}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-6">
          <EmptyState
            icon={<ClipboardCheck className="w-10 h-10 text-sky-500" />}
            title={isDateFiltered ? `No Shift Logs for ${formatDate(selectedDate)}` : "No Shift Roster Found"}
            description={
              isDateFiltered
                ? `No shift logs were recorded or rostered for ${formatDate(selectedDate)}.`
                : "No active machines with assigned operators and shift codes found for today."
            }
            action={
              isDateFiltered ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateChange(getISTDateString())}
                  className="mt-2 flex items-center gap-1.5 h-10 px-4 text-xs font-semibold cursor-pointer"
                >
                  <Calendar size={14} />
                  <span>Return to Today</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setAssignModalMachineId(undefined);
                    setIsAssignModalOpen(true);
                  }}
                  className="mt-2 flex items-center gap-1.5 h-10 px-4 text-xs font-semibold cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Assign Personnel</span>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Operator</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Machine</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Client</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Shift</th>
                  <th
                    className="px-3 py-2 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                    onClick={() => setSortBy((prev) => (prev === "time_asc" ? "time_desc" : "time_asc"))}
                    title="Click to sort by shift timing"
                  >
                    <div className="flex items-center gap-1">
                      <span>Timing</span>
                      <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">
                        {sortBy === "time_asc" ? "↑" : "↓"}
                      </span>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Entered By</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">HMR</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                      No matching shifts found
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => {
                    const isUnassigned = row.status === "unassigned" || !row.operator_id;
                    const isEntered = row.status === "entered";
                    const isBreakdown = row.machine_health_status === "breakdown";
                    const isMaintenance =
                      row.machine_health_status === "under_maintenance" ||
                      row.machine_status === "under_maintenance";

                    return (
                      <tr
                        key={`${row.machine_id}-${(row.shift_code || "S1").toUpperCase()}-${row.operator_id || "unassigned"}-${row.log_id || idx}`}
                        onClick={() => {
                          if (isUnassigned) handleInitiateAssign(row);
                        }}
                        className={`border-b border-[var(--color-hairline)] last:border-b-0 transition-colors ${isBreakdown
                          ? "bg-rose-500/[0.04] hover:bg-rose-500/10 cursor-pointer"
                          : isMaintenance
                            ? "bg-amber-500/[0.04] hover:bg-amber-500/10 cursor-pointer"
                            : isUnassigned
                              ? "bg-amber-500/[0.03] hover:bg-amber-500/10 cursor-pointer"
                              : "hover:bg-[var(--color-canvas)]/50"
                          }`}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        {/* Operator: name + phone below */}
                        <td className="px-3 py-2">
                          {isUnassigned ? (
                            <div>
                              {isBreakdown ? (
                                <div className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                                  <AlertCircle size={12} />
                                  <span>Unassigned (Breakdown)</span>
                                </div>
                              ) : isMaintenance ? (
                                <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                                  <Wrench size={12} />
                                  <span>Unassigned (Maintenance)</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                                  <AlertCircle size={12} />
                                  <span>Unassigned</span>
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {isBreakdown
                                  ? "Machine in breakdown · Click to activate"
                                  : isMaintenance
                                    ? "Under maintenance · Click to activate"
                                    : "Click to assign operator"}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium text-[var(--color-ink)]"><Highlight text={row.operator_name} query={searchQuery} /></div>
                              {row.operator_employee_id && (
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  <span className="font-semibold text-sky-700 dark:text-sky-300">
                                    <Highlight text={row.operator_employee_id} query={searchQuery} />
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {/* Machine: serial number + model & machine_id below — clickable to preselect */}
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateAssign(row);
                            }}
                            className="text-left group cursor-pointer"
                            title={
                              isBreakdown || isMaintenance
                                ? `Reactivate & assign ${row.machine_code}`
                                : `Assign personnel to ${row.machine_code}`
                            }
                          >
                            <div className="font-mono text-[11px] font-medium text-[var(--color-ink)] group-hover:text-sky-600 transition-colors">
                              <Highlight text={row.machine_serial_number || row.machine_code} query={searchQuery} />
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {row.machine_model && <span><Highlight text={row.machine_model} query={searchQuery} /> · </span>}
                              <Highlight text={row.machine_code} query={searchQuery} />
                            </div>
                            {isBreakdown ? (
                              <Badge variant="error" dot className="text-[9px] px-1 py-0 mt-0.5 w-fit">
                                Breakdown
                              </Badge>
                            ) : isMaintenance ? (
                              <Badge variant="warning" dot className="text-[9px] px-1 py-0 mt-0.5 w-fit">
                                Maintenance
                              </Badge>
                            ) : null}
                          </button>
                        </td>
                        {/* Client: name + client_id below */}
                        <td className="px-3 py-2 max-w-[160px]">
                          <div className="text-[var(--color-ink)] truncate"><Highlight text={row.client_name} query={searchQuery} /></div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate flex items-center gap-1">
                            {(row.client_code || row.client_id) && (
                              <span><Highlight text={row.client_code || row.client_id} query={searchQuery} /></span>
                            )}
                            {(row.client_code || row.client_id) && (row.client_city || row.site_name) && <span>·</span>}
                            {(row.client_city || row.site_name) && (
                              <span className="text-[var(--color-ink)] font-sans font-medium"><Highlight text={row.client_city || row.site_name} query={searchQuery} /></span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isUnassigned ? (
                            <span className="text-muted-foreground/60 text-[10px]">—</span>
                          ) : (
                            <div className="flex items-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap shrink-0">
                                {row.shift_code ? (row.shift_code.trim().toUpperCase().startsWith("SHIFT") ? row.shift_code.trim() : `Shift ${row.shift_code.trim()}`) : "—"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px]">
                          {isUnassigned ? "—" : `${formatTime(row.shift_start)} – ${formatTime(row.shift_end)}`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant={
                              isEntered
                                ? "success"
                                : isBreakdown
                                  ? "error"
                                  : isMaintenance
                                    ? "warning"
                                    : isUnassigned
                                      ? "warning"
                                      : "warning"
                            }
                            dot
                            className={`text-[10px] px-1.5 py-0.5 ${isBreakdown
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : isMaintenance
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : isUnassigned
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : ""
                              }`}
                          >
                            {isEntered
                              ? "Entered"
                              : isBreakdown
                                ? "Breakdown"
                                : isMaintenance
                                  ? "Maintenance"
                                  : isUnassigned
                                    ? "Unassigned"
                                    : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {isEntered && row.entered_by_name ? (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">{row.entered_by_name}</span>
                              {row.entry_source && row.entry_source !== "operator" && (
                                <Badge variant="info" className="text-[9px] px-1 py-0">
                                  {row.entry_source}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                          {row.start_meter != null && row.end_meter != null
                            ? `${row.start_meter} → ${row.end_meter}`
                            : row.start_meter != null
                              ? `${row.start_meter} → —`
                              : row.current_meter != null
                                ? `${row.current_meter}`
                                : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isUnassigned ? (
                            <Button
                              variant={isBreakdown ? "outline" : "primary"}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInitiateAssign(row);
                              }}
                              className={`h-7 px-2.5 text-[10px] font-semibold flex items-center gap-1 cursor-pointer mx-auto ${isBreakdown
                                ? "border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                                : isMaintenance
                                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                                  : "bg-sky-600 hover:bg-sky-500 text-white"
                                }`}
                            >
                              {isBreakdown || isMaintenance ? <Wrench size={11} /> : <UserPlus size={11} />}
                              <span>{isBreakdown || isMaintenance ? "Activate" : "Assign"}</span>
                            </Button>
                          ) : row.status === "pending" ? (
                            canEnterLog ? (
                              <Button
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnterLog(row);
                                }}
                                className="h-7 px-2.5 text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 cursor-pointer"
                              >
                                Enter Shift
                              </Button>
                            ) : (
                              <span className="text-muted-foreground/60 text-[10px] font-medium">Pending</span>
                            )
                          ) : canEnterLog ? (
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEnterLog(row);
                              }}
                              className="h-7 px-2.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/25 cursor-pointer inline-flex items-center gap-1 mx-auto"
                            >
                              <Edit2 size={11} className="shrink-0 text-sky-600 dark:text-sky-400" />
                              <span>Edit Log</span>
                            </Button>
                          ) : (
                            <span className="text-emerald-600 text-[10px] font-semibold">✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8">No matching shifts found</div>
            ) : (
              filtered.map((row, idx) => (
                <TodayShiftMonitorCard
                  key={`m-${row.machine_id}-${(row.shift_code || "S1").toUpperCase()}-${row.operator_id || "unassigned"}-${row.log_id || idx}`}
                  row={row}
                  idx={idx}
                  searchQuery={searchQuery}
                  canEnterLog={canEnterLog}
                  onInitiateAssign={handleInitiateAssign}
                  onEnterLog={handleEnterLog}
                  activeMenuCardKey={activeMenuCardKey}
                  setActiveMenuCardKey={setActiveMenuCardKey}
                  menuRef={menuRef}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Assisted Shift Entry Modal */}
      <AssistedShiftEntryModal
        open={Boolean(selectedRowForEntry && canEnterLog)}
        onClose={() => setSelectedRowForEntry(null)}
        row={selectedRowForEntry}
        userRole={effectiveRole}
        selectedDate={selectedDate}
        onSuccess={handleEnterLogSuccess}
      />

      {/* Assign Operator Modal */}
      <AssignOperatorModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setAssignModalMachineId(undefined);
        }}
        machines={combinedMachines}
        operators={operators}
        initialMachineId={assignModalMachineId}
        userRole={effectiveRole}
        userId={user.id}
        initialAssignmentDate={selectedDate}
        onSuccess={(result?: AssignPersonnelSuccessResult) => {
          if (!result?.machineId) return;

          // The roster was saved for the date picked inside the dialog (7 past days + today +
          // tomorrow). Only the visible day may be patched optimistically — a back-dated or
          // tomorrow plan must never rewrite the roster currently on screen.
          const savedDate = result.assignmentDate || getISTDateString();
          if (savedDate !== selectedDateRef.current) return;

          const machineId = result.machineId;
          const newOps = result.operators || [];
          lastOptimisticEditRef.current = Date.now();

          // Fine-grained optimistic update: update affected machine row values immediately
          setRows((prevRows) => {
            const otherMachinesRows = prevRows.filter((r) => r.machine_id !== machineId);
            const existingMachineRows = prevRows.filter((r) => r.machine_id === machineId);

            const matchedMachine = combinedMachines.find((m) => m.id === machineId);
            const templateRow = existingMachineRows[0] || (matchedMachine ? ({
              machine_id: matchedMachine.id,
              machine_code: matchedMachine.machine_id,
              machine_serial_number: matchedMachine.serial_number || null,
              machine_model: matchedMachine.model || null,
              client_id: matchedMachine.client_id || null,
              client_name: matchedMachine.client?.company_name || "Direct Client",
              client_code: matchedMachine.client?.code || null,
              client_city: matchedMachine.city || null,
              site_name: null,
              current_meter: matchedMachine.hour_meter || null,
              machine_status: matchedMachine.status || "active",
              machine_health_status: matchedMachine.health_status || "active",
              shift_code: "S1",
              shift_name: "Shift S1",
              shift_start: "06:00:00",
              shift_end: "14:00:00",
              status: "unassigned",
              log_id: null,
              log_date: selectedDate,
              operator_id: null,
              operator_name: "Unassigned",
              operator_phone: null,
              operator_employee_id: null,
              entered_by: null,
              entered_by_name: null,
              entry_source: null,
              start_meter: null,
              end_meter: null,
              running_hours: null,
              remarks: null,
            } as TodayShiftMonitorRow) : null);

            if (!templateRow) return prevRows;

            // Preserve any existing rows that already have entered shift logs
            const enteredLogRows = existingMachineRows.filter((r) => Boolean(r.log_id));

            // 1. If 0 operators (all unassigned from this machine)
            if (newOps.length === 0) {
              if (enteredLogRows.length > 0) {
                return dedupeShiftMonitorRows([...otherMachinesRows, ...enteredLogRows]);
              }
              const unassignedRow: TodayShiftMonitorRow = {
                ...templateRow,
                operator_id: null,
                operator_name: "Unassigned",
                operator_phone: null,
                operator_employee_id: null,
                shift_code: templateRow.shift_code || "S1",
                shift_name: templateRow.shift_name || "Shift S1",
                status: "unassigned",
                log_id: null,
                start_meter: null,
                end_meter: null,
                running_hours: null,
                remarks: null,
              };
              return dedupeShiftMonitorRows([...otherMachinesRows, unassignedRow]);
            }

            // 2. If 1 or more operators assigned to shifts on this machine
            const updatedMachineRows: TodayShiftMonitorRow[] = [...enteredLogRows];

            newOps.forEach((op) => {
              const rawCode = (op.shift_code || "S1").trim();
              const normCode = rawCode.toUpperCase().replace(/^SHIFT\s*/i, "");

              const existingEntered = enteredLogRows.find(
                (r) => r.operator_id === op.id && (r.shift_code || "").toUpperCase().replace(/^SHIFT\s*/i, "") === normCode
              );
              if (existingEntered) return;

              const existingForShift = existingMachineRows.find(
                (r) => (r.shift_code || "").toUpperCase().replace(/^SHIFT\s*/i, "") === normCode
              );

              const row: TodayShiftMonitorRow = {
                ...(existingForShift || templateRow),
                operator_id: op.id,
                operator_name: op.full_name || "Operator",
                operator_phone: op.phone || null,
                operator_employee_id: op.employee_id || null,
                shift_code: rawCode,
                shift_name: op.shift_name || (rawCode.toUpperCase().startsWith("SHIFT") ? rawCode : `Shift ${rawCode}`),
                shift_start: op.shift_start_time || existingForShift?.shift_start || templateRow.shift_start || null,
                shift_end: op.shift_end_time || existingForShift?.shift_end || templateRow.shift_end || null,
                status: "pending",
                log_id: null,
                start_meter: null,
                end_meter: null,
                running_hours: null,
                remarks: null,
                log_date: selectedDate,
              };
              updatedMachineRows.push(row);
            });

            return dedupeShiftMonitorRows([...otherMachinesRows, ...updatedMachineRows]);
          });

          // Soft background sync after 800ms to allow DB transaction to fully settle
          if (backgroundSyncTimeoutRef.current) clearTimeout(backgroundSyncTimeoutRef.current);
          backgroundSyncTimeoutRef.current = setTimeout(() => {
            refreshRoster(false);
          }, 800);
        }}
      />

      {/* Machine Status Warning Dialog (Breakdown / Maintenance) */}
      {warningMachine && (
        <MachineStatusWarningDialog
          isOpen={isWarningDialogOpen}
          onClose={() => {
            setIsWarningDialogOpen(false);
            setWarningMachine(null);
          }}
          machine={warningMachine}
          onConfirmActiveAndAssign={handleConfirmActiveAndAssign}
        />
      )}

      {/* Shift Logs Export Modal (Excel & PDF) */}
      {isExportModalOpen && (
        <TodayShiftExportModal
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          rows={filtered.length < rows.length && filtered.length > 0 ? filtered : rows}
          user={user}
          dateStr={selectedDate}
        />
      )}
    </div>
  );
}
