"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getTodayShiftMonitorAction } from "@/app/actions/operators";
import { Badge, useToast, Button, EmptyState } from "@/components/ui";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { getISTDateString } from "@reachinternational/utils";
import type { TodayShiftMonitorRow } from "@/lib/data/operations/today-shift-monitor";
import type { User, CRMClient, Machine } from "@/lib/types/database";
import { RefreshCw, UserCheck, Clock, AlertCircle, UserPlus } from "lucide-react";
import { ClipboardCheck } from "@/components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const AssistedShiftEntryModal = dynamic(
  () => import("./AssistedShiftEntryModal").then((mod) => mod.AssistedShiftEntryModal),
  { ssr: false }
);

const AssignOperatorModal = dynamic(
  () => import("./modals/AssignOperatorModal").then((mod) => mod.AssignOperatorModal),
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
  dbClients?: CRMClient[];
  operators?: User[];
  initialRows?: TodayShiftMonitorRow[];
}

export function TodayShiftMonitorTab({
  user,
  userRole,
  machines = [],
  dbClients = [],
  operators = [],
  initialRows,
}: TodayShiftMonitorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<TodayShiftMonitorRow[]>(initialRows || []);
  const [loading, setLoading] = useState(!initialRows);
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "entered" | "unassigned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRowForEntry, setSelectedRowForEntry] = useState<TodayShiftMonitorRow | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalMachineId, setAssignModalMachineId] = useState<string | undefined>();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Permission Guard: Only roles above supervisor (manager, admin, super_admin) can enter logs
  const effectiveRole = userRole || user?.role || "";
  const canEnterLog = ["super_admin", "admin", "manager"].includes(effectiveRole);

  const fetchData = useCallback(async (search?: string, bypassCache: boolean = true) => {
    if (!search && !initialRows) setLoading(true);
    else if (search) setIsSearching(true);
    try {
      const result = await getTodayShiftMonitorAction(undefined, search || undefined, bypassCache);
      if (result.success && result.data) {
        setRows(result.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [initialRows]);

  useEffect(() => {
    if (!initialRows) {
      fetchData();
    }
  }, [fetchData, initialRows]);

  // Auto-refresh every 30 seconds (fallback polling when not searching)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!searchQuery.trim()) fetchData(undefined, true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData, searchQuery]);

  // Real-time broadcast listener for instant roster revalidation
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const rosterChannel = supabase.channel("operations-roster");

    rosterChannel
      .on("broadcast", { event: "assignment_changed" }, () => {
        fetchData(searchQuery.trim() || undefined, true);
      })
      .on("broadcast", { event: "roster_updated" }, () => {
        fetchData(searchQuery.trim() || undefined, true);
      })
      .on("broadcast", { event: "log_entered" }, () => {
        fetchData(searchQuery.trim() || undefined, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(rosterChannel);
    };
  }, [fetchData, searchQuery]);


  // Debounced server-side search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(value.trim() || undefined);
    }, 300);
  }, [fetchData]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleAssignOperator = useCallback((machineId?: string) => {
    setAssignModalMachineId(machineId);
    setIsAssignModalOpen(true);
  }, []);

  // Listen for reach:quick-assign event dispatched from header or other components
  useEffect(() => {
    const handleQuickAssign = (e: any) => {
      const targetMachineId = e.detail?.machineId;
      handleAssignOperator(targetMachineId);
    };
    window.addEventListener("reach:quick-assign", handleQuickAssign);
    return () => window.removeEventListener("reach:quick-assign", handleQuickAssign);
  }, [handleAssignOperator]);

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
          status: "active",
        } as Machine);
      }
    });
    return Array.from(map.values());
  }, [machines, rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((row) => row.status === statusFilter);
    return r;
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const entered = rows.filter((r) => r.status === "entered").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const unassigned = rows.filter((r) => r.status === "unassigned").length;
    return { total, entered, pending, unassigned };
  }, [rows]);

  const handleEnterLog = useCallback((row: TodayShiftMonitorRow) => {
    setSelectedRowForEntry(row);
  }, []);

  const formatTime = (t: string | null) => {
    if (!t) return "—";
    try {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    } catch {
      return t;
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
        );
      }
      // Re-fetch 100% authoritative data directly from DB
      fetchData(searchQuery.trim() || undefined, true);
      router.refresh();
    },
    [fetchData, searchQuery, user, router]
  );

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      fetchData(searchQuery.trim() || undefined, true);
      router.refresh();
    });
  }, [fetchData, searchQuery, router]);


  const handleResetFilters = useCallback(() => {
    setStatusFilter("all");
    setSearchQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchData();
  }, [fetchData]);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {/* KPI skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
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

  if (rows.length === 0 && !searchQuery.trim()) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<ClipboardCheck className="w-10 h-10 text-sky-500" />}
          title="No Shift Roster Found"
          description="No active machines with assigned operators and shift codes found for today."
          action={
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
          }
        />
        <AssignOperatorModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setAssignModalMachineId(undefined);
          }}
          machines={combinedMachines}
          operators={operators}
          initialMachineId={assignModalMachineId}
          onSuccess={() => {
            fetchData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4">
          <div className="text-xs text-muted-foreground font-medium">Total Roster</div>
          <div className="text-2xl font-bold text-[var(--color-ink)] mt-1">{summary.total}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
            <UserCheck size={12} /> Entered
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{summary.entered}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 sm:p-4">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
            <Clock size={12} /> Pending
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{summary.pending}</div>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 sm:p-4">
          <div className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle size={12} /> Unassigned
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{summary.unassigned}</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        placeholder="Search operator name, phone, machine ID, serial, model, client..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        isLoading={isSearching}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="h-11 sm:h-9 w-11 sm:w-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-center justify-center hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Refresh"
            >
              <RefreshCw size={14} className={`text-muted-foreground ${isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      >
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Status</span>
          {(["all", "pending", "entered", "unassigned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === f
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] border-transparent"
                  : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:bg-[var(--color-canvas)]"
              }`}
            >
              {f === "all"
                ? `All (${summary.total})`
                : f === "pending"
                ? `Pending (${summary.pending})`
                : f === "entered"
                ? `Entered (${summary.entered})`
                : `Unassigned (${summary.unassigned})`}
            </button>
          ))}
        </div>
      </FilterToolbar>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Operator</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Machine</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Client</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Shift</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Timing</th>
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

                return (
                  <tr
                    key={row.operator_id ? `${row.operator_id}-${row.machine_id}-${row.shift_code}` : `unassigned-${row.machine_id}-${idx}`}
                    onClick={() => {
                      if (isUnassigned) handleAssignOperator(row.machine_id);
                    }}
                    className={`border-b border-[var(--color-hairline)] last:border-b-0 transition-colors ${
                      isUnassigned
                        ? "bg-amber-500/[0.03] hover:bg-amber-500/10 cursor-pointer"
                        : "hover:bg-[var(--color-canvas)]/50"
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    {/* Operator: name + phone below */}
                    <td className="px-3 py-2">
                      {isUnassigned ? (
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                            <AlertCircle size={12} />
                            <span>Unassigned</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Click to assign operator</div>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-[var(--color-ink)]">{row.operator_name}</div>
                          {row.operator_phone && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.operator_phone}</div>
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
                          handleAssignOperator(row.machine_id);
                        }}
                        className="text-left group cursor-pointer"
                        title={`Assign personnel to ${row.machine_code}`}
                      >
                        <div className="font-mono text-[11px] font-medium text-[var(--color-ink)] group-hover:text-sky-600 transition-colors">
                          {row.machine_serial_number || row.machine_code}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {row.machine_model && <span>{row.machine_model} · </span>}
                          {row.machine_code}
                        </div>
                      </button>
                    </td>
                    {/* Client: name + client_id below */}
                    <td className="px-3 py-2 max-w-[160px]">
                      <div className="text-[var(--color-ink)] truncate">{row.client_name}</div>
                      {(row.client_code || row.client_id) && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{row.client_code || row.client_id}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isUnassigned ? (
                        <span className="text-muted-foreground/60 text-[10px]">—</span>
                      ) : (
                        <div className="flex flex-col">
                          <Badge variant="info" className="text-[10px] px-1.5 py-0.5 font-mono w-fit">
                            Shift {row.shift_code}
                          </Badge>
                          {row.shift_name && (
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[125px] mt-0.5"
                              title={row.shift_name}
                            >
                              {row.shift_name.replace(new RegExp(`^shift\\s*${row.shift_code}\\s*[:\\-•]?\\s*\\(?`, "i"), "").replace(/\)$/, "").trim() || row.shift_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[10px]">
                      {isUnassigned ? "—" : `${formatTime(row.shift_start)} – ${formatTime(row.shift_end)}`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        variant={isEntered ? "success" : isUnassigned ? "warning" : "warning"}
                        dot
                        className={`text-[10px] px-1.5 py-0.5 ${
                          isUnassigned ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : ""
                        }`}
                      >
                        {isEntered ? "Entered" : isUnassigned ? "Unassigned" : "Pending"}
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
                      {isEntered && row.start_meter != null && row.end_meter != null
                        ? `${row.start_meter} → ${row.end_meter}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isUnassigned ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignOperator(row.machine_id);
                          }}
                          className="h-7 px-2.5 text-[10px] font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 cursor-pointer mx-auto"
                        >
                          <UserPlus size={11} />
                          <span>Assign</span>
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
                            Enter Log
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px] font-medium">Pending</span>
                        )
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
          filtered.map((row, idx) => {
            const isUnassigned = row.status === "unassigned" || !row.operator_id;
            const isEntered = row.status === "entered";

            return (
              <div
                key={row.operator_id ? `m-${row.operator_id}-${row.machine_id}-${row.shift_code}` : `m-unassigned-${row.machine_id}-${idx}`}
                className={`rounded-lg border bg-[var(--color-canvas-elevated)] p-3 space-y-2 ${
                  isUnassigned
                    ? "border-amber-500/30 bg-amber-500/[0.02]"
                    : "border-[var(--color-hairline)]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {isUnassigned ? (
                      <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400">
                        <AlertCircle size={16} />
                        <span>Unassigned Machine</span>
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-sm sm:text-base text-[var(--color-ink)] truncate">{row.operator_name}</div>
                        {row.operator_phone && (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{row.operator_phone}</div>
                        )}
                      </>
                    )}
                  </div>
                  <Badge
                    variant={isEntered ? "success" : isUnassigned ? "warning" : "warning"}
                    dot
                    className="text-xs font-semibold px-2 py-0.5 shrink-0"
                  >
                    {isEntered ? "Entered" : isUnassigned ? "Unassigned" : "Pending"}
                  </Badge>
                </div>

                {/* Machine & Client Info — clickable to assign */}
                <button
                  type="button"
                  onClick={() => handleAssignOperator(row.machine_id)}
                  className="w-full text-left space-y-0.5 p-1.5 -m-1 rounded hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                >
                  <div className="text-xs text-[var(--color-ink)] font-mono font-semibold">
                    {row.machine_serial_number || row.machine_code}
                    {row.machine_model && <span className="text-muted-foreground font-normal"> · {row.machine_model}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{row.machine_code}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.client_name}
                    {(row.client_code || row.client_id) && <span className="font-mono font-medium"> · {row.client_code || row.client_id}</span>}
                  </div>
                </button>

                {/* Details */}
                {!isUnassigned && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="info" className="text-xs font-semibold px-2 py-0.5 font-mono">
                      Shift {row.shift_code}
                    </Badge>
                    {row.shift_name && (
                      <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">
                        {row.shift_name.replace(new RegExp(`^shift\\s*${row.shift_code}\\s*[:\\-•]?\\s*\\(?`, "i"), "").replace(/\)$/, "").trim() || row.shift_name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTime(row.shift_start)} – {formatTime(row.shift_end)}
                    </span>
                    {isEntered && row.start_meter != null && row.end_meter != null && (
                      <span className="text-xs text-muted-foreground font-mono">
                        HMR: {row.start_meter} → {row.end_meter}
                      </span>
                    )}
                  </div>
                )}

                {/* Entered By */}
                {isEntered && row.entered_by_name && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <UserCheck size={13} />
                    <span>Entered by {row.entered_by_name}</span>
                    {row.entry_source && row.entry_source !== "operator" && (
                      <Badge variant="info" className="text-xs font-semibold px-1.5 py-0.5">{row.entry_source}</Badge>
                    )}
                  </div>
                )}

                {/* Action */}
                {isUnassigned ? (
                  <Button
                    variant="primary"
                    onClick={() => handleAssignOperator(row.machine_id)}
                    className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                  >
                    <UserPlus size={16} />
                    <span>Assign Operator to {row.machine_code}</span>
                  </Button>
                ) : row.status === "pending" ? (
                  canEnterLog ? (
                    <Button
                      variant="ghost"
                      onClick={() => handleEnterLog(row)}
                      className="w-full h-11 text-sm font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 cursor-pointer"
                    >
                      Enter Log for {row.operator_name}
                    </Button>
                  ) : (
                    <div className="w-full py-1 text-center text-xs text-muted-foreground/60 font-medium">
                      Shift log submission pending
                    </div>
                  )
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* Assisted Shift Entry Modal */}
      <AssistedShiftEntryModal
        open={Boolean(selectedRowForEntry && canEnterLog)}
        onClose={() => setSelectedRowForEntry(null)}
        row={selectedRowForEntry}
        userRole={effectiveRole}
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
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* Today's Shift Logs Export Modal (Excel & PDF) */}
      {isExportModalOpen && (
        <TodayShiftExportModal
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          rows={filtered.length < rows.length && filtered.length > 0 ? filtered : rows}
          user={user}
        />
      )}
    </div>
  );
}
