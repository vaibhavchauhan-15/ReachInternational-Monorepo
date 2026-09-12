"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedClock,
  AnimatedMapPin,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedPlus,
  AnimatedBuilding2,
  AnimatedSearch,
  AnimatedUserCheck,
  AnimatedScrollText,
  AnimatedX,
  AnimatedRotateCw,
} from "@/components/ui/animated-icons";
import { Badge, Button, Select, useToast, TooltipWrapper, MachineSelect, ClientSelect, UserSelect, SearchableSelect, CustomTimePicker, Modal, Pagination } from "@/components/ui";
import type { Machine, User, MachineAssignment, OperatorMachineAssignment, MachineHourLog, MachineWithEngineer, CRMClient } from "@/lib/types/database";
import { OperatorDashboard, type OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import {
  assignOperatorToMachineAction,
  requestOperatorAssignmentChangeAction,
} from "@/app/actions/operators";
import {
  createAssignmentAction,
  endAssignmentAction,
  resolveHourLogConflictAction,
  getOperatorProfileShiftAction,
} from "@/app/actions/assignments";
import { PrintableSupervisorLogsModal } from "./PrintableSupervisorLogsModal";
import { MONTH_NAMES, getLogMonthNumber, formatCompactTiming } from "@/lib/utils/operator-logs-export";
import {
  formatDate,
  formatExactTimestamp,
  formatTimeAgo,
  formatTo12Hour,
  parseProfileShiftTime,
  parseTimeToMinutes,
  getISTDateString,
  parseConflictReason,
  calculateAdjustedHours,
  formatShiftTimingRange,
} from "@reachinternational/utils";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Printer, Clock, ShieldAlert, Check, UserPlus, AlertCircle, AlertTriangle, Info, Sun, Moon, Users, Filter, ChevronDown, RefreshCw, Phone, UserCheck, Search, X, User as UserIcon, Truck, Calendar, Building2, MapPin, Mail, Zap, FileText, Loader2 } from "lucide-react";

export interface OperationsClientProps {
  machines: Machine[];
  dbClients?: CRMClient[];
  operators: User[];
  assignments: (OperatorMachineAssignment | MachineAssignment | any)[];
  hourLogs: MachineHourLog[];
  userRole?: string;
  user?: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: MachineWithEngineer[];
  initialTab?: string;
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
  initialSort?: "date-desc" | "date-asc";
}

export function formatMachineSelectLabel(m: {
  machine_id?: string;
  machine_code?: string;
  id?: string;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  machine_name?: string;
}): string {
  if (!m) return "Machine";
  const code = m.machine_id || m.machine_code || m.id || "Machine";
  const model = [m.manufacturer?.trim(), m.model?.trim()].filter(Boolean).join(" ");
  const serial = m.serial_number && m.serial_number !== code ? `S/N: ${m.serial_number}` : null;
  const details = [model, serial].filter(Boolean).join(" — ");
  return details ? `${code} (${details})` : code;
}

/**
 * Format client full address: street + city + district + state + pincode.
 * Treats these 5 fields as the single canonical address of the client site.
 */
export function formatClientFullAddress(c?: any): string {
  if (!c) return "";
  const street = (c.street || "").trim();
  const city = (c.city || "").trim();
  const district = (c.district || "").trim();
  const state = (c.state || "").trim();
  const pincode = (c.pincode || "").trim();
  const parts = [street, city, district, state, pincode].filter(Boolean);
  return parts.join(", ");
}

function OperationsLogTableSkeletonRows({ colSpan = 8, count = 5 }: { colSpan?: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={`op-log-skel-${i}`} className="animate-pulse">
          <td className="px-3 py-3 text-center">
            <div className="h-4 w-6 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-20 rounded bg-[var(--color-hairline)] mb-1" />
            <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/70" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-28 rounded bg-[var(--color-hairline)] mb-1" />
            <div className="h-3 w-24 rounded bg-[var(--color-hairline)]/70" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-[var(--color-hairline)]" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-4 w-16 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3 text-center">
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)] mx-auto" />
          </td>
          <td className="px-4 py-3">
            <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]/70" />
          </td>
          {colSpan > 8 && (
            <td className="px-4 py-3 text-center">
              <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
            </td>
          )}
          {colSpan > 9 && (
            <td className="px-4 py-3 text-center">
              <div className="h-4 w-12 rounded bg-[var(--color-hairline)] mx-auto" />
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

function MobileOperationsLogCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading logs...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`op-card-skel-${i}`}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="h-3.5 w-24 rounded bg-[var(--color-hairline)]" />
              <div className="h-4 w-32 rounded bg-[var(--color-hairline)]" />
              <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="h-5 w-16 rounded-full bg-[var(--color-hairline)] shrink-0" />
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]/70" />
              <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]/70" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-hairline)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationsClient({
  machines,
  dbClients = [],
  operators,
  assignments,
  hourLogs,
  userRole,
  user,
  assignedMachine,
  recentLogs = [],
  allMachines = [],
  initialTab,
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
}: OperationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const validTabs = userRole === "operator"
    ? ["entry", "history"]
    : ["logs", "assignments"]; // Soft-removed "site-movement" and "operators" per user request
  const defaultTab = userRole === "operator" ? "entry" : "logs";
  const initialSelectedTab = (tabParam && validTabs.includes(tabParam))
    ? tabParam
    : (initialTab && validTabs.includes(initialTab) ? initialTab : defaultTab);

  const [activeTabState, setActiveTab] = useState<"entry" | "history" | "logs" | "assignments" | "site-movement" | "operators">(
    initialSelectedTab as any
  );

  const activeTab = (tabParam && validTabs.includes(tabParam)
    ? tabParam
    : (userRole === "operator" ? "entry" : (validTabs.includes(activeTabState) ? activeTabState : "logs"))) as
    | "entry"
    | "history"
    | "logs"
    | "assignments"
    | "site-movement"
    | "operators";

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignRequestModal, setShowReassignRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states: Assignment
  const [selectedMachineId, setSelectedMachineId] = useState(machines[0]?.id || "");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("08:00 AM");
  const [shiftEndTime, setShiftEndTime] = useState("04:00 PM");
  const [hasProfileShift, setHasProfileShift] = useState<boolean | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [loadingProfileShift, setLoadingProfileShift] = useState(false);
  const [reassignReason, setReassignReason] = useState("");
  const [notes, setNotes] = useState("");

  // Conflict Resolution States
  const [selectedConflictLog, setSelectedConflictLog] = useState<MachineHourLog | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictAction, setConflictAction] = useState<"acknowledge" | "adjust">("acknowledge");
  const [conflictAdjustedEndTime, setConflictAdjustedEndTime] = useState("");
  const [conflictNotes, setConflictNotes] = useState("");
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [showAllConflictsWeb, setShowAllConflictsWeb] = useState(false);

  // Filter states: Assignments Tab
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "assigned" | "unassigned" | "full">("all");
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsPageSize, setAssignmentsPageSize] = useState(20);

  // Collapsible Machine Cards: default is CLOSED condition (empty Set)
  const [expandedMachineIds, setExpandedMachineIds] = useState<Set<string>>(() => new Set());

  const toggleMachineExpanded = (machineId: string) => {
    setExpandedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  };

  const handleToggleExpandAll = (allIds: string[]) => {
    if (expandedMachineIds.size === allIds.length) {
      setExpandedMachineIds(new Set());
    } else {
      setExpandedMachineIds(new Set(allIds));
    }
  };


  // Helper for current month value ("01" to "12")
  const getCurrentMonthValue = (): string => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  };

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
  const [searchInput, setSearchInput] = useState<string>(initialSearch || "");
  const [showSupervisorPrintModal, setShowSupervisorPrintModal] = useState(false);

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
      setLogsSelectedClientMachineId(initialMachineId);
    } else {
      setLogsSelectedClientMachineId("all");
    }
  }, [initialMachineId]);

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

  // Collapsible section states (Default: COLLAPSED condition per user feedback)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isClientSummaryExpanded, setIsClientSummaryExpanded] = useState(false);
  const [isMachineSummaryExpanded, setIsMachineSummaryExpanded] = useState(false);
  const [isOperatorSummaryExpanded, setIsOperatorSummaryExpanded] = useState(false);

  // URL-driven query param synchronizer
  const handleFilterChange = (updates: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (!current.has("tab")) {
      current.set("tab", "logs");
    }

    Object.entries(updates).forEach(([key, val]) => {
      if (
        val === undefined ||
        val === "" ||
        (key !== "tab" && key !== "month" && val === "all")
      ) {
        current.delete(key);
      } else {
        current.set(key, String(val));
      }
    });

    // Reset pagination when modifying filters, unless page was explicitly passed
    if (!("page" in updates)) {
      current.delete("page");
    }

    startTransition(() => {
      router.push(`/operations?${current.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    handleFilterChange({ page: newPage });
  };

  // Search loading & debounce state
  const [isSearchPending, setIsSearchPending] = useState(false);

  // Debounced search effect (300ms)
  useEffect(() => {
    if (searchInput !== (initialSearch || "")) {
      setIsSearchPending(true);
      const timer = setTimeout(() => {
        handleFilterChange({ search: searchInput || undefined, page: 1 });
      }, 300);
      return () => clearTimeout(timer);
    } else if (!isPending) {
      setIsSearchPending(false);
    }
  }, [searchInput]);

  useEffect(() => {
    if (!isPending && searchInput === (initialSearch || "")) {
      setIsSearchPending(false);
    }
  }, [isPending, initialSearch]);

  const isSearching = isSearchPending || searchInput !== (initialSearch || "");

  // Derived ordered machines list (ordered by most recent activity in logs)
  const logMachineIdsInOrder = Array.from(new Set(hourLogs.map((l) => l.machine_id).filter(Boolean)));
  const remainingMachines = machines.filter((m) => !logMachineIdsInOrder.includes(m.id));
  const orderedMachines: Machine[] = [
    ...logMachineIdsInOrder.map((id) => machines.find((m) => m.id === id)).filter(Boolean) as Machine[],
    ...remainingMachines,
  ];

  const activeMachineId =
    logsSelectedMachineId && logsSelectedMachineId !== "all"
      ? logsSelectedMachineId
      : orderedMachines[0]?.id || "";

  const activeMachineObj =
    machines.find((m) => m.id === activeMachineId) ||
    (hourLogs.find((l) => l.machine_id === activeMachineId)?.machine as any) ||
    orderedMachines[0];

  const activeMachineName =
    activeMachineObj?.machine_name ||
    activeMachineObj?.model ||
    activeMachineObj?.machine_code ||
    "";

  // Derived active operators list (strictly role=operator and status=active)
  const activeOperators = useMemo(
    () => operators.filter((op) => op.role === "operator" && (op.status === "active" || !op.status)),
    [operators]
  );
  const logOperatorIdsInOrder = Array.from(new Set(hourLogs.map((l) => l.operator_id).filter(Boolean)));
  const remainingOperators = activeOperators.filter((op) => !logOperatorIdsInOrder.includes(op.id));
  const orderedOperators: User[] = [
    ...logOperatorIdsInOrder.map((id) => activeOperators.find((op) => op.id === id)).filter(Boolean) as User[],
    ...remainingOperators,
  ];

  const activeOperatorId =
    logsSelectedOperatorId && logsSelectedOperatorId !== "all"
      ? logsSelectedOperatorId
      : orderedOperators[0]?.id || "";

  const activeOperatorObj =
    orderedOperators.find((op) => op.id === activeOperatorId) ||
    operators.find((op) => op.id === activeOperatorId) ||
    (hourLogs.find((l) => l.operator_id === activeOperatorId)?.operator as any);

  const activeOperatorName =
    activeOperatorObj?.full_name ||
    activeOperatorObj?.name ||
    "";

  // Comprehensive clients list derived from dbClients and hourLogs/machines
  const allClientsList = useMemo(() => {
    const clientsMap = new Map<string, any>();

    // 1. Seed with database clients
    (dbClients || []).forEach((c) => {
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

    // 2. Discover any clients in logs that might not be in dbClients
    hourLogs.forEach((l) => {
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

    // 3. Discover any clients in machines that might not be in dbClients
    machines.forEach((m) => {
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
  }, [dbClients, hourLogs, machines]);

  // Active selected client resolution
  const activeClient = useMemo(() => {
    if (!allClientsList.length) return null;

    // If explicitly selected by ID or Name
    if (logsSelectedClientId && logsSelectedClientId !== "all") {
      const found = allClientsList.find(
        (c) =>
          c.id === logsSelectedClientId ||
          c.client_name?.toLowerCase().trim() === logsSelectedClientId.toLowerCase().trim() ||
          c.company_name?.toLowerCase().trim() === logsSelectedClientId.toLowerCase().trim()
      );
      if (found) return found;
    }

    // Default to the most recent used client
    if (mostRecentClientId) {
      const recent = allClientsList.find((c) => c.id === mostRecentClientId);
      if (recent) return recent;
    }

    // Default to the client that has active hour logs, so supervisor immediately sees records
    const clientWithLogs = allClientsList.find((c) =>
      hourLogs.some(
        (l) =>
          l.client_id === c.id ||
          (l.client as any)?.id === c.id ||
          (l.client as any)?.client_name?.toLowerCase().trim() === c.client_name?.toLowerCase().trim() ||
          (l.client as any)?.company_name?.toLowerCase().trim() === c.company_name?.toLowerCase().trim()
      )
    );
    return clientWithLogs || allClientsList[0];
  }, [allClientsList, logsSelectedClientId, mostRecentClientId, hourLogs]);

  const activeClientId = activeClient?.id || "";
  const activeClientName = activeClient?.company_name || activeClient?.client_name || activeClient?.name || "";
  const activeDbClient = activeClient;

  // Derived machine IDs associated with active selected client from logs
  const clientMachineIdsFromLogs = useMemo(() => {
    if (!activeClientId && !activeClientName) return [];
    return Array.from(
      new Set(
        hourLogs
          .filter((l) => {
            if (activeClientId && (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId)) return true;
            const cName = (l as any)?.client?.client_name || (l as any)?.client?.company_name || (l.machine as any)?.customer_name || "";
            return activeClientName && cName.toLowerCase().trim() === activeClientName.toLowerCase().trim();
          })
          .map((l) => l.machine_id)
          .filter(Boolean)
      )
    );
  }, [hourLogs, activeClientId, activeClientName]);

  // Derived machines rented by active selected client (assigned via client_id, client relation, or logs)
  const clientMachines = useMemo(() => {
    if (!activeClientId && !activeClientName) return [];
    return machines.filter((m) => {
      if (activeClientId && m.client_id === activeClientId) return true;
      if (activeClientId && (m as any).client?.id === activeClientId) return true;
      const mClientName =
        (m as any).client?.company_name ||
        (m as any).client?.client_name ||
        (m as any).customer_name ||
        "";
      if (activeClientName && mClientName.toLowerCase().trim() === activeClientName.toLowerCase().trim()) return true;
      if (clientMachineIdsFromLogs.includes(m.id)) return true;
      return false;
    });
  }, [machines, activeClientId, activeClientName, clientMachineIdsFromLogs]);

  // Derived unique site locations for active selected client (Unified Address: Street + City + District + State + Pincode)
  const clientSites = useMemo(() => {
    const sites = new Set<string>();

    // 0. Include precomputed distinct sites for this client from database and logs
    if (activeClient?.sites && Array.isArray(activeClient.sites)) {
      activeClient.sites.forEach((s: string) => {
        if (s && s.trim()) sites.add(s.trim());
      });
    }

    // 1. Gather all site locations from all client records matching this company name
    // (Supports multi-site architecture: same client company, distinct site location per client record)
    const matchingClients = allClientsList.filter(
      (c) =>
        (activeClientId && c.id === activeClientId) ||
        (activeClientName &&
          ((c.company_name && c.company_name.toLowerCase().trim() === activeClientName.toLowerCase().trim()) ||
           (c.client_name && c.client_name.toLowerCase().trim() === activeClientName.toLowerCase().trim())))
    );

    matchingClients.forEach((c) => {
      const fullAddr = formatClientFullAddress(c);
      if (fullAddr) sites.add(fullAddr);
    });

    if (activeDbClient || activeClient) {
      const primaryAddr = formatClientFullAddress(activeDbClient || activeClient);
      if (primaryAddr) sites.add(primaryAddr);
    }

    // 2. Locations from matching client logs
    hourLogs.forEach((l) => {
      const isClientLog =
        (activeClientId && (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId)) ||
        (activeClientName && ((l as any)?.client?.client_name || (l as any)?.client?.company_name || "").toLowerCase().trim() === activeClientName.toLowerCase().trim()) ||
        clientMachines.some((m) => m.id === l.machine_id);

      if (isClientLog && l.location && l.location.trim()) {
        const loc = l.location.trim();
        // Do not add raw partial fragments if already covered by known canonical site addresses
        const isFragmentOfKnownSite = Array.from(sites).some(
          (site) => site.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(site.toLowerCase())
        );
        if (!isFragmentOfKnownSite) {
          sites.add(loc);
        }
      }
    });

    // 3. Deduplicate and collapse partial sub-fragments into the full canonical address
    const normalizedSites: string[] = [];
    Array.from(sites).forEach((s) => {
      const existingIdx = normalizedSites.findIndex((item) =>
        item.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(item.toLowerCase())
      );
      if (existingIdx === -1) {
        normalizedSites.push(s);
      } else if (s.length > normalizedSites[existingIdx].length) {
        normalizedSites[existingIdx] = s;
      }
    });

    return normalizedSites.filter(Boolean);
  }, [activeDbClient, activeClient, clientMachines, hourLogs, activeClientId, activeClientName, allClientsList]);

  // Most recent used location for active client from logs, fallback to primary client site
  const mostRecentClientLocation = useMemo(() => {
    // 1. Look for the latest log of this client with a valid location
    const recentLog = hourLogs.find((l) => {
      const isClient =
        (activeClientId && (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId)) ||
        (activeClientName && ((l as any)?.client?.client_name || (l as any)?.client?.company_name || "").toLowerCase().trim() === activeClientName.toLowerCase().trim()) ||
        clientMachines.some((m) => m.id === l.machine_id);
      return isClient && l.location && l.location.trim();
    });

    const recentLoc = recentLog?.location?.trim();
    if (recentLoc) {
      const matched = clientSites.find(
        (s) => s.toLowerCase().trim() === recentLoc.toLowerCase() ||
               s.toLowerCase().includes(recentLoc.toLowerCase()) ||
               recentLoc.toLowerCase().includes(s.toLowerCase().trim())
      );
      if (matched) return matched;
      return recentLoc;
    }

    return clientSites.length > 0 ? clientSites[0] : "";
  }, [hourLogs, activeClientId, activeClientName, clientMachines, clientSites]);

  // Effective selected site location (defaults to "all" so all logs across client sites are visible unless a specific site is chosen)
  const effectiveSelectedSite = useMemo(() => {
    if (!logsSelectedSite || logsSelectedSite === "all") return "all";
    if (clientSites.includes(logsSelectedSite)) {
      return logsSelectedSite;
    }
    return logsSelectedSite;
  }, [logsSelectedSite, clientSites]);

  // Effective selected client machine ID (By default select "all" per feedback #2)
  const effectiveSelectedClientMachineId = useMemo(() => {
    if (!logsSelectedClientMachineId || logsSelectedClientMachineId === "all") {
      return "all";
    }
    if (!clientMachines.some((m) => m.id === logsSelectedClientMachineId)) {
      return "all";
    }
    return logsSelectedClientMachineId;
  }, [logsSelectedClientMachineId, clientMachines]);

  // Active selected client details (for Client Header Card)
  const clientMobile = activeDbClient?.phone || "—";
  const clientEmail = activeDbClient?.email || "—";
  const clientAddress = formatClientFullAddress(activeDbClient || activeClient) || "—";
  const clientFleetCount = clientMachines.length;

  // On server-paginated logs tab, hourLogs is the paged slice from server
  const filteredHourLogs = hourLogs;

  // Aggregate metrics calculation for filtered logs (from server-provided logsSummary with fallback)
  let localRun = 0;
  let localOt = 0;
  let localBkd = 0;
  filteredHourLogs.forEach((log) => {
    const startMtr = log.start_meter ?? 0;
    const endMtr = log.end_meter ?? startMtr;
    const run = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    localRun += run;
    localOt += log.overtime_hours || 0;
    if (log.is_breakdown) localBkd++;
  });

  const totalFilteredRunHours = logsSummary ? logsSummary.totalRunHours : Math.round(localRun * 10) / 10;
  const totalFilteredOtHours = logsSummary ? logsSummary.totalOtHours : Math.round(localOt * 10) / 10;
  const totalFilteredBreakdowns = logsSummary ? logsSummary.totalBreakdowns : localBkd;
  const loggedDaysCount = logsSummary ? logsSummary.loggedDaysCount : new Set(filteredHourLogs.map((l) => l.log_date)).size;
  const totalMatchingLogs = totalLogsCount ?? hourLogs.length;

  const currentMonthValue = getCurrentMonthValue();
  const selectedMonthLabel =
    MONTH_NAMES.find((m) => m.value === logsSelectedMonth)?.label ||
    MONTH_NAMES.find((m) => m.value === currentMonthValue)?.label ||
    "September";
  const displayWorkingDays = loggedDaysCount > 0 ? loggedDaysCount : 26;

  const currentSelectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId),
    [machines, selectedMachineId]
  );

  const currentRegisteredOperator = useMemo(() => {
    if (!currentSelectedMachine) return null;

    // 1. Direct joined current_operator on machine object
    if ((currentSelectedMachine as any).current_operator) {
      return (currentSelectedMachine as any).current_operator;
    }

    // 2. Direct current_operator_id on machine object
    const opId = currentSelectedMachine.current_operator_id || (currentSelectedMachine as any).operator_id;
    if (opId) {
      const fromOps = operators.find((u) => u.id === opId);
      if (fromOps) return fromOps;
    }

    // 3. Active assignments list
    const activeAss = assignments.find(
      (a) => a.machine_id === currentSelectedMachine.id && a.status === "active" && a.operator_id
    );
    if (activeAss) {
      if ((activeAss as any).operator) return (activeAss as any).operator;
      const fromOps = operators.find((u) => u.id === activeAss.operator_id);
      if (fromOps) return fromOps;
    }

    // 4. operators array or operator_ids array on machine
    if (Array.isArray((currentSelectedMachine as any).operators) && (currentSelectedMachine as any).operators.length > 0) {
      return (currentSelectedMachine as any).operators[0];
    }
    if (Array.isArray((currentSelectedMachine as any).operator_ids) && (currentSelectedMachine as any).operator_ids.length > 0) {
      const fromOps = operators.find((u) => u.id === (currentSelectedMachine as any).operator_ids[0]);
      if (fromOps) return fromOps;
    }

    return null;
  }, [currentSelectedMachine, operators, assignments]);

  const activeAssignmentsOnSelectedMachine = useMemo(() => {
    if (!selectedMachineId) return [];
    return assignments.filter(
      (a: any) =>
        (a.machine_id === selectedMachineId || a.machine?.id === selectedMachineId) &&
        (a.status === "active" || a.is_active === true)
    );
  }, [selectedMachineId, assignments]);

  const pendingConflicts = useMemo(() => {
    return hourLogs.filter(
      (l) => l.conflict_flag && (!l.conflict_status || l.conflict_status === "pending")
    );
  }, [hourLogs]);

  // Parse structured conflict information for selected log in modal
  const modalConflictDetails = useMemo(() => {
    if (!selectedConflictLog) return null;
    const m = selectedConflictLog.machine as any;
    const op = selectedConflictLog.operator as any;
    const machineCode = m?.machine_name || m?.machine_code || m?.machine_id || (selectedConflictLog as any).machine_code || "Equipment";
    return parseConflictReason(selectedConflictLog.conflict_reason, {
      machineCode,
      machineModel: m?.model,
      operatorName: op?.full_name || op?.name || "Operator",
      startTime: selectedConflictLog.start_time,
      endTime: selectedConflictLog.end_time,
      runningHours: selectedConflictLog.running_hours,
      overtimeHours: selectedConflictLog.overtime_hours,
      logDate: selectedConflictLog.log_date,
    });
  }, [selectedConflictLog]);

  // Live calculation feedback for conflict modal time adjustment
  const modalAdjustedCalculation = useMemo(() => {
    if (!selectedConflictLog?.start_time || !conflictAdjustedEndTime) return null;
    return calculateAdjustedHours(selectedConflictLog.start_time, conflictAdjustedEndTime);
  }, [selectedConflictLog?.start_time, conflictAdjustedEndTime]);

  // Structured assignment conflict parsing
  const isAssignmentConflict = useMemo(() => {
    if (!assignmentError) return false;
    const lower = assignmentError.toLowerCase();
    return (
      lower.includes("conflict") ||
      lower.includes("overlap") ||
      lower.includes("23p01") ||
      lower.includes("custody") ||
      lower.includes("shift_overlap_conflict")
    );
  }, [assignmentError]);

  const parsedAssignmentConflict = useMemo(() => {
    if (!isAssignmentConflict || !assignmentError) return null;
    const op = operators.find((u) => u.id === selectedOperatorId);
    const mach = machines.find((m) => m.id === selectedMachineId);
    return parseConflictReason(assignmentError, {
      machineCode: mach ? formatMachineSelectLabel(mach) : undefined,
      machineModel: mach?.model || undefined,
      operatorName: op?.full_name || undefined,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [isAssignmentConflict, assignmentError, operators, selectedOperatorId, machines, selectedMachineId, shiftStartTime, shiftEndTime]);

  const isOvernightShift = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return false;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return false;
    return e <= s;
  }, [shiftStartTime, shiftEndTime]);

  const shiftDurationHours = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    const s = parseTimeToMinutes(shiftStartTime);
    const e = parseTimeToMinutes(shiftEndTime);
    if (s === null || e === null) return null;
    let diff = e - s;
    if (diff <= 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  }, [shiftStartTime, shiftEndTime]);

  const handleOperatorSelect = async (opId: string) => {
    setSelectedOperatorId(opId);
    setAssignmentError(null);
    if (!opId) {
      setHasProfileShift(null);
      return;
    }
    setLoadingProfileShift(true);
    try {
      const res = await getOperatorProfileShiftAction(opId);
      if (res.profileShift) {
        const parts = res.profileShift.displayString.split(" - ");
        setShiftStartTime(parts[0] || "08:00 AM");
        setShiftEndTime(parts[1] || "04:00 PM");
        setHasProfileShift(true);
      } else {
        setShiftStartTime("");
        setShiftEndTime("");
        setHasProfileShift(false);
      }
    } catch {
      setHasProfileShift(false);
    } finally {
      setLoadingProfileShift(false);
    }
  };

  const handleOpenAssignModal = (targetMachineId?: string, targetOperatorId?: string) => {
    const mId = targetMachineId || (activeMachineId && machines.some((m) => m.id === activeMachineId) ? activeMachineId : machines[0]?.id || "");
    setSelectedMachineId(mId);
    setAssignmentError(null);
    if (targetOperatorId) {
      handleOperatorSelect(targetOperatorId);
    } else {
      setSelectedOperatorId("");
      setShiftStartTime("08:00 AM");
      setShiftEndTime("04:00 PM");
      setHasProfileShift(null);
    }
    setShowAssignModal(true);
  };

  const handleAssignOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignmentError(null);
    if (!selectedMachineId || !selectedOperatorId) {
      toast("error", "Please select both a target machine and an active operator.");
      return;
    }
    if (!shiftStartTime || !shiftEndTime) {
      setAssignmentError("Please specify both shift start time and end time.");
      toast("error", "Shift start time and end time are required.");
      return;
    }

    if (activeAssignmentsOnSelectedMachine.length >= 3) {
      setAssignmentError("This machine has reached its maximum capacity of 3 active operators.");
      toast("error", "Maximum capacity of 3 active operators reached.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAssignmentAction({
        machineId: selectedMachineId,
        operatorId: selectedOperatorId,
        shiftStartTime,
        shiftEndTime,
        notes,
      });

      if (res.success) {
        toast("success", "Operator assigned with shift window successfully.");
        setShowAssignModal(false);
        setNotes("");
        setSelectedOperatorId("");
        setShiftStartTime("08:00 AM");
        setShiftEndTime("04:00 PM");
        setHasProfileShift(null);
        router.refresh();
      } else {
        setAssignmentError(res.error || "Failed to assign operator");
        toast("error", res.error || "Failed to assign operator");
      }
    } catch (err: any) {
      setAssignmentError(err?.message || "Failed to assign operator");
      toast("error", err?.message || "Failed to assign operator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndAssignment = async (
    assignmentId: string,
    opName: string,
    machName: string,
    endReason: "removed" | "shift_changed" = "removed"
  ) => {
    const actionLabel = endReason === "shift_changed" ? "end the active shift for" : "unassign";
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${opName} from ${machName}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await endAssignmentAction({
        assignmentId,
        endReason,
      });
      if (res.success) {
        toast("success", endReason === "shift_changed" ? `Shift ended for ${opName}.` : `Operator ${opName} unassigned successfully.`);
        router.refresh();
      } else {
        toast("error", res.error || "Failed to end assignment");
      }
    } catch (err: any) {
      toast("error", err?.message || "Failed to end assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenConflictModal = (log: MachineHourLog) => {
    setSelectedConflictLog(log);
    setConflictAction("acknowledge");
    setConflictAdjustedEndTime(log.end_time || "");
    setConflictNotes("");
    setShowConflictModal(true);
  };

  const handleResolveConflict = async () => {
    if (!selectedConflictLog) return;
    setResolvingConflict(true);
    try {
      const res = await resolveHourLogConflictAction({
        logId: selectedConflictLog.id,
        action: conflictAction,
        adjustedEndTime: conflictAction === "adjust" ? conflictAdjustedEndTime : null,
        notes: conflictNotes,
      });
      if (res.success) {
        toast("success", `Overtime conflict ${conflictAction === "acknowledge" ? "acknowledged" : "adjusted"} successfully.`);
        setShowConflictModal(false);
        setSelectedConflictLog(null);
        setConflictNotes("");
        router.refresh();
      } else {
        toast("error", res.error || "Failed to resolve conflict");
      }
    } catch (err: any) {
      toast("error", err?.message || "Failed to resolve conflict");
    } finally {
      setResolvingConflict(false);
    }
  };

  const handleUnassignOperator = async () => {
    if (!selectedMachineId) return;
    const opName = currentRegisteredOperator?.full_name || currentRegisteredOperator?.name || "the current operator";
    const machLabel = currentSelectedMachine ? formatMachineSelectLabel(currentSelectedMachine) : "this machine";
    if (!window.confirm(`Are you sure you want to unassign ${opName} from ${machLabel}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await assignOperatorToMachineAction({
        machineId: selectedMachineId,
        operatorId: null,
        notes: "Unassigned operator via Operations Hub",
      });

      if (res.success) {
        toast("success", "Operator unassigned from equipment successfully.");
        setShowAssignModal(false);
        setSelectedOperatorId("");
        router.refresh();
      } else {
        toast("error", `Error unassigning operator: ${res.error || "Failed to unassign operator"}`);
      }
    } catch (err: any) {
      toast("error", `Error unassigning operator: ${err?.message || "Failed to unassign operator"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await requestOperatorAssignmentChangeAction({
      machineId: selectedMachineId,
      reason: reassignReason,
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", "Reassignment request submitted to Branch Manager");
      setShowReassignRequestModal(false);
      setReassignReason("");
      router.refresh();
    } else {
      toast("error", `Error requesting reassignment: ${res.error}`);
    }
  };


  const TAB_TITLES: Record<string, string> = {
    logs: "Daily Machine Running Hours",
    assignments: "Operator Machine Assignments",
    "site-movement": "Site Movement Logsheet",
    operators: "Operator Directory & Payroll",
    entry: "Daily Machine Log Entry",
    history: "Daily Machine Log History",
  };

  const currentTitle = TAB_TITLES[activeTab] || "Operations & Fleet Management";

  return (
    <div className="w-full space-y-6">
      {/* SUPERVISOR / MANAGEMENT HEADER */}
      {userRole !== "operator" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-ink)]">
                Fleet Operations
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                onClick={() => handleOpenAssignModal()}
                className="h-9 px-2.5 sm:px-3.5 font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap cursor-pointer shadow-xs"
                title="Assign Operator"
                aria-label="Assign Operator"
              >
                <AnimatedUserCheck size={16} className="shrink-0" />
                <span className="hidden sm:inline">Assign Operator</span>
              </Button>
            </div>
          </div>

          {/* Supervisor Top Tab Bar */}
          <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] pb-2 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setActiveTab("logs");
                router.push("/operations?tab=logs");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center cursor-pointer ${
                activeTab === "logs"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
              }`}
            >
              <span>Daily Running Hours</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("assignments");
                router.push("/operations?tab=assignments");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center cursor-pointer ${
                activeTab === "assignments"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
              }`}
            >
              <span>Machine Assignments</span>
            </button>

          </div>
        </div>
      )}

      {/* TAB 0: Operator Log Entry or History Dashboard (Operators Only) */}
      {userRole === "operator" && (activeTab === "entry" || activeTab === "history") && user && (
        <OperatorDashboard
          user={user}
          assignedMachine={assignedMachine}
          recentLogs={recentLogs}
          allMachines={allMachines}
          dbClients={dbClients}
        />
      )}

      {/* TAB 1: Daily Running Hour Logs (Supervisor Multi-View & Month-Wise Logs) */}
      {activeTab === "logs" && (
        <div className="space-y-3">
          {/* OVERTIME CONFLICT ALERT BANNER */}
          {pendingConflicts.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                    <span>{pendingConflicts.length} Overtime Shift Conflict{pendingConflicts.length > 1 ? "s" : ""}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Action Required
                    </span>
                  </h4>
                </div>

                {pendingConflicts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllConflictsWeb((prev) => !prev)}
                    className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    {showAllConflictsWeb ? "Show Fewer Conflicts" : `View All ${pendingConflicts.length} Conflicts (${pendingConflicts.length - 3} more)`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {(showAllConflictsWeb ? pendingConflicts : pendingConflicts.slice(0, 3)).map((log) => {
                  const mObj = log.machine as any;
                  const opObj = log.operator as any;
                  const mName = mObj?.machine_name || mObj?.machine_code || mObj?.machine_id || (log as any).machine_code || "Equipment";
                  const opName = opObj?.full_name || opObj?.name || "Operator";
                  const parsed = parseConflictReason(log.conflict_reason, {
                    machineCode: mName,
                    machineModel: mObj?.model,
                    operatorName: opName,
                    startTime: log.start_time,
                    endTime: log.end_time,
                    runningHours: log.running_hours,
                    overtimeHours: log.overtime_hours,
                    logDate: log.log_date,
                  });

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-amber-500/30 border-l-4 border-l-amber-500 flex flex-col justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      {/* Top Tier: Machine (Left) | Conflict Badge & Review Button (Right) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="p-1 rounded bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] shrink-0">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-bold text-[var(--color-ink)] truncate text-xs font-mono">
                            {mName}
                          </span>
                          {mObj?.model ? (
                            <span className="text-[11px] text-[var(--color-mute)] truncate">
                              ({mObj.model})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            {parsed.badgeText || "DUAL MACHINE CONFLICT"}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenConflictModal(log)}
                            className="text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 py-1 h-7 flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                            Review
                          </Button>
                        </div>
                      </div>

                      {/* Bottom Tier: 4-Column Structured Info Strip */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-hairline)] text-[11px]">
                        {/* 1. Operator */}
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-extrabold tracking-wider text-[var(--color-mute)] uppercase">OPERATOR</div>
                          <div className="flex items-center gap-1 font-semibold text-[var(--color-ink)] truncate">
                            <UserIcon className="w-3 h-3 text-[var(--color-mute)] shrink-0" />
                            <span className="truncate">{opName}</span>
                          </div>
                        </div>

                        {/* 2. Shift Date */}
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-extrabold tracking-wider text-[var(--color-mute)] uppercase">SHIFT DATE</div>
                          <div className="flex items-center gap-1 font-semibold text-[var(--color-ink)]">
                            <Calendar className="w-3 h-3 text-[var(--color-mute)] shrink-0" />
                            <span>{formatDate(log.log_date)}</span>
                          </div>
                        </div>

                        {/* 3. Shift Time & Overtime */}
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-extrabold tracking-wider text-[var(--color-mute)] uppercase">SHIFT & OVERTIME</div>
                          <div className="flex items-center gap-1 font-mono font-medium text-[var(--color-ink)]">
                            <Clock className="w-3 h-3 text-[var(--color-mute)] shrink-0" />
                            <span>{formatShiftTimingRange(log.start_time, log.end_time)}</span>
                            {log.overtime_hours ? (
                              <span className="px-1 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                +{log.overtime_hours}h
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* 4. Conflict With */}
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-extrabold tracking-wider text-rose-600 dark:text-rose-400 uppercase">CONFLICTS WITH</div>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 truncate">
                              {parsed.conflictingEntity ? parsed.conflictingEntity : "Subsequent Shift Roster"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* FILTER & EXPORT TOOLBAR */}
          <div
            onClick={() => {
              if (!isFiltersExpanded) {
                setIsFiltersExpanded(true);
              }
            }}
            className={`rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-sm transition-all duration-200 ${
              !isFiltersExpanded ? "cursor-pointer" : ""
            }`}
          >
            {/* Header: Mode Switcher (Left) | Search Input (Desktop Center) | Action Controls (Right) */}
            <div
              onClick={() => setIsFiltersExpanded((prev) => !prev)}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 shrink-0">
                {/* Left: View Mode Pill Switcher */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 overflow-x-auto custom-scrollbar p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLogsViewMode("machine");
                      const targetMachine = logsSelectedMachineId && logsSelectedMachineId !== "all" ? logsSelectedMachineId : (orderedMachines[0]?.id || "");
                      setLogsSelectedMachineId(targetMachine);
                      handleFilterChange({ view: "machine", machine: targetMachine, client: undefined, operator: undefined, page: 1 });
                    }}
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
                    onClick={() => {
                      setLogsViewMode("client");
                      const targetClient = logsSelectedClientId && logsSelectedClientId !== "all" ? logsSelectedClientId : (activeClientId || "");
                      setLogsSelectedClientId(targetClient);
                      handleFilterChange({ view: "client", client: targetClient, machine: undefined, operator: undefined, page: 1 });
                    }}
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
                    onClick={() => {
                      setLogsViewMode("operator");
                      const targetOperator = logsSelectedOperatorId && logsSelectedOperatorId !== "all" ? logsSelectedOperatorId : (orderedOperators[0]?.id || "");
                      setLogsSelectedOperatorId(targetOperator);
                      handleFilterChange({ view: "operator", operator: targetOperator, machine: undefined, client: undefined, page: 1 });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      logsViewMode === "operator"
                        ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    Operator
                  </button>
                </div>

                {/* Mobile-only action triggers (Print + Arrow) on top right */}
                <div className="flex sm:hidden items-center gap-1.5 shrink-0 ml-auto">
                  <TooltipWrapper content="Export / Print Report">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSupervisorPrintModal(true);
                      }}
                      className="h-8.5 w-8.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-all flex items-center justify-center cursor-pointer shrink-0"
                      aria-label="Export / Print Report"
                    >
                      <Printer className="h-4 w-4 shrink-0" />
                    </button>
                  </TooltipWrapper>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFiltersExpanded((prev) => !prev);
                    }}
                    className="h-8.5 w-8.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-subtle)] text-[var(--color-ink)] transition-colors flex items-center justify-center cursor-pointer shrink-0"
                    aria-label={isFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
                  >
                    <ChevronDown className={`h-4 w-4 text-[var(--color-mute)] transition-transform duration-300 ${isFiltersExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Middle: Debounced Search Input (In Header on Web/Tablet/Desktop, Full-Width below on Mobile) */}
              <div
                onClick={(e) => {
                  if (!isFiltersExpanded) {
                    setIsFiltersExpanded(true);
                  }
                }}
                className="relative flex-1 min-w-[200px] max-w-none sm:max-w-md lg:max-w-xl mx-0 sm:mx-2"
              >
                {isSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-600 dark:text-sky-400 animate-spin pointer-events-none" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)] pointer-events-none" />
                )}
                <input
                  type="text"
                  placeholder="Search machine, operator, remarks, location..."
                  value={searchInput}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (searchInput !== (initialSearch || "")) {
                        setIsSearchPending(true);
                        handleFilterChange({ search: searchInput || undefined, page: 1 });
                      }
                    }
                  }}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-hidden focus:border-sky-500 transition-colors h-8.5"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchInput("");
                      setIsSearchPending(true);
                      handleFilterChange({ search: undefined, page: 1 });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--color-canvas-subtle)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Desktop-only action triggers (Print + Arrow) on top right */}
              <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-auto">
                <TooltipWrapper content="Export / Print Report">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSupervisorPrintModal(true);
                    }}
                    className="h-8.5 w-8.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-all flex items-center justify-center cursor-pointer shrink-0"
                    aria-label="Export / Print Report"
                  >
                    <Printer className="h-4 w-4 shrink-0" />
                  </button>
                </TooltipWrapper>

                <TooltipWrapper content={isFiltersExpanded ? "Collapse Filters" : "Expand Filters"}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFiltersExpanded((prev) => !prev);
                    }}
                    className="h-8.5 w-8.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-subtle)] text-[var(--color-ink)] transition-colors flex items-center justify-center cursor-pointer shrink-0"
                    aria-label={isFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
                  >
                    <ChevronDown className={`h-4 w-4 text-[var(--color-mute)] transition-transform duration-300 ${isFiltersExpanded ? "rotate-180" : ""}`} />
                  </button>
                </TooltipWrapper>
              </div>
            </div>

            {/* Collapsible Filter Dropdowns Section */}
            <AnimatePresence initial={false}>
              {isFiltersExpanded && (
                <motion.div
                  key="operations-filters"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="pt-3 mt-3 border-t border-[var(--color-hairline)] space-y-3">
                    {/* SECOND ROW: Filter Dropdowns (Horizontally Aligned) */}
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
                              handleFilterChange({ view: "client", client: nextId, machine: undefined, site: undefined, page: 1 });
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
                                handleFilterChange({ month: val, start: logsCustomStartDate, end: logsCustomEndDate, page: 1 });
                              } else {
                                handleFilterChange({ month: val, start: undefined, end: undefined, page: 1 });
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
                                handleFilterChange({ month: val, start: logsCustomStartDate, end: logsCustomEndDate, page: 1 });
                              } else {
                                handleFilterChange({ month: val, start: undefined, end: undefined, page: 1 });
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

                    {/* Custom Date Range Picker (Collapsible when logsSelectedMonth === 'custom') */}
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
                </motion.div>
              )}
            </AnimatePresence>
      </div>

          {/* MACHINE DETAILS SUMMARY HEADER CARD (By Machine Mode) */}
          {logsViewMode === "machine" && activeMachineObj && (
            <div
              onClick={() => {
                if (!isMachineSummaryExpanded) {
                  setIsMachineSummaryExpanded(true);
                }
              }}
              className={`p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs transition-all duration-200 ${
                !isMachineSummaryExpanded ? "cursor-pointer" : ""
              }`}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMachineSummaryExpanded((prev) => !prev);
                }}
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-[var(--color-ink)]">
                    {activeMachineObj.machine_name}
                  </h3>
                  <Badge
                    variant={
                      activeMachineObj.status === "active"
                        ? "success"
                        : activeMachineObj.status === "on_rent"
                        ? "info"
                        : activeMachineObj.status === "under_maintenance"
                        ? "warning"
                        : "neutral"
                    }
                    className="font-bold text-[10px]"
                  >
                    {activeMachineObj.status ? activeMachineObj.status.replace("_", " ").toUpperCase() : "ACTIVE"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <div className="p-1 rounded-lg hover:bg-[var(--color-canvas)] text-[var(--color-mute)] transition-colors">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMachineSummaryExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isMachineSummaryExpanded && (
                  <motion.div
                    key="machine-summary-details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pt-2.5 mt-2.5 border-t border-[var(--color-hairline)]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Manufacturer</span>
                          <span className="font-bold text-[var(--color-ink)]">
                            {activeMachineObj.manufacturer || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Model</span>
                          <span className="font-bold text-[var(--color-ink)]">
                            {activeMachineObj.model || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Serial No / Code</span>
                          <span className="font-bold font-mono text-[var(--color-ink)]">
                            {activeMachineObj.serial_number || activeMachineObj.machine_code || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Total Run Hours</span>
                          <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                            {Math.round(totalFilteredRunHours * 10) / 10} hrs
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Breakdown Events</span>
                          <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                            {totalFilteredBreakdowns} Events
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* CLIENT DETAILS SUMMARY HEADER CARD (By Client Mode) */}
          {logsViewMode === "client" && activeClientName && (
            <div
              onClick={() => {
                if (!isClientSummaryExpanded) {
                  setIsClientSummaryExpanded(true);
                }
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-sm transition-all duration-200 ${
                !isClientSummaryExpanded ? "cursor-pointer" : ""
              }`}
            >
              {/* Header (always visible & clickable to toggle) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsClientSummaryExpanded((prev) => !prev);
                }}
                className="flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-ink)] tracking-tight truncate max-w-full">
                      {activeClientName}
                    </h3>
                    {activeClient?.code && (
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-hairline)] font-mono text-[10px] sm:text-[11px] font-bold shrink-0">
                        {activeClient.code}
                      </span>
                    )}
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] sm:text-[11px] font-bold border border-sky-500/20 shrink-0">
                      {clientMachines.length} {clientMachines.length === 1 ? "Machine" : "Machines"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:block">
                    <Badge variant="success" className="font-bold flex items-center gap-1.5 py-0.5 px-2.5 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{displayWorkingDays} Days ({selectedMonthLabel})</span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-lg hover:bg-[var(--color-canvas)] text-[var(--color-mute)] transition-colors">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isClientSummaryExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible details & KPI grid */}
              <AnimatePresence initial={false}>
                {isClientSummaryExpanded && (
                  <motion.div
                    key="client-summary-details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-3 pt-3 border-t border-[var(--color-hairline)] space-y-3">
                      {/* Clean Location & Contact Meta Strip */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-x-4 gap-y-1 text-xs text-[var(--color-mute)] flex-wrap">
                          {clientAddress && clientAddress !== "—" && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              <span className="text-[var(--color-ink)] font-medium">
                                {clientAddress}
                              </span>
                            </div>
                          )}
                          {clientMobile && clientMobile !== "—" && (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-[var(--color-ink)]">{clientMobile}</span>
                            </div>
                          )}
                          {clientEmail && clientEmail !== "—" && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="text-[var(--color-ink)]">{clientEmail}</span>
                            </div>
                          )}
                        </div>

                        {/* Mobile Working Days Badge */}
                        <div className="sm:hidden">
                          <Badge variant="success" className="font-bold flex items-center gap-1.5 py-0.5 px-2 text-[10px]">
                            <Calendar className="h-3 w-3" />
                            <span>{displayWorkingDays} Days ({selectedMonthLabel})</span>
                          </Badge>
                        </div>
                      </div>

                      {/* 4 Summary Metrics Cards Grid in Client Detail Box */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <Clock className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">Run</span>
                              <span className="hidden sm:inline">Run Hours</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-sky-600 dark:text-sky-400">
                            {Math.round(totalFilteredRunHours * 10) / 10} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">hrs</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">OT</span>
                              <span className="hidden sm:inline">Overtime</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">
                            {Math.round(totalFilteredOtHours * 10) / 10} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">hrs</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">Breakdown</span>
                              <span className="hidden sm:inline">Breakdowns</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400">
                            {totalFilteredBreakdowns} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">{totalFilteredBreakdowns === 1 ? "Event" : "Events"}</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <FileText className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              Logs
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-[var(--color-ink)]">
                            {totalMatchingLogs} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">{totalMatchingLogs === 1 ? "Record" : "Records"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* OPERATOR DETAILS SUMMARY HEADER CARD (By Operator Mode) */}
          {logsViewMode === "operator" && activeOperatorName && (
            <div
              onClick={() => {
                if (!isOperatorSummaryExpanded) {
                  setIsOperatorSummaryExpanded(true);
                }
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-sm transition-all duration-200 ${
                !isOperatorSummaryExpanded ? "cursor-pointer" : ""
              }`}
            >
              {/* Header (always visible & clickable to toggle) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOperatorSummaryExpanded((prev) => !prev);
                }}
                className="flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-ink)] tracking-tight truncate max-w-full">
                      {activeOperatorName}
                    </h3>
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] sm:text-[11px] font-bold border border-sky-500/20 shrink-0">
                      OPERATOR
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-extrabold text-sky-600 dark:text-sky-400 text-xs sm:text-sm">
                      {Math.round(totalFilteredRunHours * 10) / 10} hrs
                    </span>
                    <div className="p-1 rounded-lg hover:bg-[var(--color-canvas)] text-[var(--color-mute)] transition-colors">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOperatorSummaryExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible details & KPI grid */}
              <AnimatePresence initial={false}>
                {isOperatorSummaryExpanded && (
                  <motion.div
                    key="operator-summary-details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-3 pt-3 border-t border-[var(--color-hairline)] space-y-3">
                      {(activeOperatorObj?.phone || activeOperatorObj?.email) && (
                        <div className="flex items-center gap-x-4 gap-y-1 text-xs text-[var(--color-mute)] flex-wrap">
                          {activeOperatorObj?.phone && (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-[var(--color-ink)]">{activeOperatorObj.phone}</span>
                            </div>
                          )}
                          {activeOperatorObj?.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="text-[var(--color-ink)]">{activeOperatorObj.email}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4 Summary Metrics Cards Grid in Operator Detail Box */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <Clock className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">Run</span>
                              <span className="hidden sm:inline">Run Hours</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-sky-600 dark:text-sky-400">
                            {Math.round(totalFilteredRunHours * 10) / 10} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">hrs</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">OT</span>
                              <span className="hidden sm:inline">Overtime</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">
                            {Math.round(totalFilteredOtHours * 10) / 10} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">hrs</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              <span className="sm:hidden">Breakdown</span>
                              <span className="hidden sm:inline">Breakdowns</span>
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400">
                            {totalFilteredBreakdowns} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">{totalFilteredBreakdowns === 1 ? "Event" : "Events"}</span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                          <div className="flex items-center gap-1.5 text-[var(--color-mute)]">
                            <FileText className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                              Logs
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-extrabold font-mono text-[var(--color-ink)]">
                            {totalMatchingLogs} <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-mute)]">{totalMatchingLogs === 1 ? "Record" : "Records"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* DESKTOP DATA TABLE (hidden sm:block) */}
          <div className={`hidden sm:block rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-3 py-3 w-[45px] text-center font-mono">
                      <TooltipWrapper content="Serial Number">
                        <span>S.N</span>
                      </TooltipWrapper>
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap font-mono">
                      <TooltipWrapper content="Log Date">
                        <span>Date</span>
                      </TooltipWrapper>
                    </th>
                    {logsViewMode === "operator" ? (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap font-mono">
                          <TooltipWrapper content="Machine Model">
                            <span>Model</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap font-mono">
                          <TooltipWrapper content="Machine Serial Number / Code">
                            <span>Serial Number</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Client Name & Site Location">
                            <span>Client & Location</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Shift Start Time & End Time">
                            <span>Timings</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Operating Hours (Hours)">
                            <span>OP(h)</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Overtime Hours">
                            <span>OT(h)</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">
                          <TooltipWrapper content="Breakdown Duration & Status">
                            <span>Breakdown</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Log Remarks & Breakdown Notes">
                            <span>Remarks</span>
                          </TooltipWrapper>
                        </th>
                      </>
                    ) : logsViewMode === "client" ? (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap font-mono">
                          <TooltipWrapper content="Machine Model">
                            <span>Model</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap font-mono">
                          <TooltipWrapper content="Machine Serial Number">
                            <span>Serial Number</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Assigned Operator Name & Mobile">
                            <span>Operator</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Shift Start Time & End Time">
                            <span>Timings</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Work Time (Hours)">
                            <span>WT</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">
                          <TooltipWrapper content="Breakdown Duration & Status">
                            <span>Breakdown</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Log Remarks & Notes">
                            <span>Remarks</span>
                          </TooltipWrapper>
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Client Name & Site Location">
                            <span>Client & Location</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Assigned Operator Name & Mobile">
                            <span>Operator</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Hour Meter Reading">
                            <span>HMR</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">
                          <TooltipWrapper content="Running Time (Hours)">
                            <span>RT(h)</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">
                          <TooltipWrapper content="Breakdown Duration & Status">
                            <span>Breakdown</span>
                          </TooltipWrapper>
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap">
                          <TooltipWrapper content="Log Remarks & Notes">
                            <span>Remarks</span>
                          </TooltipWrapper>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                  {isPending ? (
                    <OperationsLogTableSkeletonRows
                      colSpan={logsViewMode === "operator" ? 10 : logsViewMode === "client" ? 9 : 8}
                      count={5}
                    />
                  ) : filteredHourLogs.length === 0 ? (
                    <tr>
                      <td colSpan={logsViewMode === "operator" ? 10 : logsViewMode === "client" ? 9 : 8} className="px-4 py-8 text-center text-[var(--color-mute)]">
                        No daily running hour logs found matching the active filter selection.
                      </td>
                    </tr>
                  ) : (
                    filteredHourLogs.map((log, idx) => {
                      const startMtr = log.start_meter ?? 0;
                      const endMtr = log.end_meter ?? startMtr;
                      const runningHours = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
                      const otHours = log.overtime_hours || 0;
                      const isDecreased = endMtr < startMtr;
                      const isUnusualHigh = runningHours > 18;

                      const mObj = log.machine as any;
                      const opObj = log.operator as any;
                      const clientName = (log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client";
                      const locationStr = log.location || ((log as any)?.client?.city ? [(log as any).client.city, (log as any).client.district, (log as any).client.state].filter(Boolean).join(", ") : "—");

                      const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                      const bkdDetails = bkdMatch ? bkdMatch[1].trim() : log.is_breakdown ? "Breakdown" : null;
                      const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";
                      let bkdDurationOnly = bkdDetails;
                      if (bkdDurationOnly) {
                        bkdDurationOnly = bkdDurationOnly.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim();
                      }
                      const displayBkdText = log.is_breakdown ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown") : "Normal";

                      const hasConflict = Boolean(log.conflict_flag);
                      const isPendingConflict = hasConflict && (!log.conflict_status || log.conflict_status === "pending");
                      const isResolvedConflict = hasConflict && (log.conflict_status === "acknowledged" || log.conflict_status === "adjusted");

                      return (
                        <tr key={log.id} className={`hover:bg-[var(--color-hairline-soft-surface)] ${isPendingConflict ? "bg-amber-500/5 dark:bg-amber-500/10" : ""}`}>
                          <td className="px-3 py-3 text-center font-bold text-xs text-[var(--color-mute)] font-mono">
                            {((currentPage || 1) - 1) * (logsPageSize || 10) + idx + 1}
                          </td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                            <div className="font-semibold text-[var(--color-ink)] text-xs">{formatDate(log.log_date)}</div>
                            {log.created_at ? (
                              <div
                                className="text-[10px] text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1 mt-0.5"
                                title={`Exact log entry timestamp: ${formatExactTimestamp(log.created_at, true)}`}
                              >
                                <Clock size={10} className="text-sky-500 shrink-0" />
                                <span>{formatExactTimestamp(log.created_at, true)}</span>
                              </div>
                            ) : null}
                            {isPendingConflict && (
                              <button
                                type="button"
                                onClick={() => handleOpenConflictModal(log)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer mt-1"
                                title={log.conflict_reason || "Overtime shift conflict detected. Click to review."}
                              >
                                <ShieldAlert size={10} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>Shift Conflict</span>
                              </button>
                            )}
                            {isResolvedConflict && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mt-1"
                                title={`Conflict resolved: ${log.conflict_resolution_notes || log.conflict_status}`}
                              >
                                <Check size={10} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>{log.conflict_status === "adjusted" ? "Adjusted" : "Acknowledged"}</span>
                              </span>
                            )}
                          </td>
                          {logsViewMode === "operator" ? (
                            <>
                              <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
                                <span className="font-bold text-[var(--color-ink)]">{mObj?.model || "—"}</span>
                              </td>
                              <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
                                <span className="font-bold text-[var(--color-ink)]">{mObj?.serial_number || mObj?.machine_code || "—"}</span>
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                <div className="font-bold text-[var(--color-ink)]">
                                  {clientName}
                                </div>
                                <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[180px]" title={locationStr}>
                                  {locationStr}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
                                <div>{formatCompactTiming(log.start_time, log.end_time)}</div>
                                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                                  {(log as any).normal_working_hours ?? 8}h normal
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-amber-600 dark:text-amber-400">{otHours > 0 ? `${otHours}h` : "0h"}</span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {log.is_breakdown ? (
                                  <span className="inline-flex items-center justify-center gap-1 font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                                    <AnimatedAlertTriangle size={13} className="shrink-0 text-rose-600 dark:text-rose-400" /> {displayBkdText}
                                  </span>
                                ) : (
                                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block" title={cleanRemarks}>
                                  {cleanRemarks}
                                </span>
                              </td>
                            </>
                          ) : logsViewMode === "client" ? (
                            <>
                              <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
                                <span className="font-bold text-[var(--color-ink)]">{mObj?.model || "—"}</span>
                              </td>
                              <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">
                                <span className="font-bold text-[var(--color-ink)]">{mObj?.serial_number || mObj?.machine_code || "—"}</span>
                              </td>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                <div className="font-bold text-[var(--color-ink)]">{opObj?.full_name || "Unassigned"}</div>
                                {opObj?.phone && (
                                  <div className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">{opObj.phone}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
                                <div>{formatCompactTiming(log.start_time, log.end_time)}</div>
                                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                                  {(log as any).normal_working_hours ?? 8}h normal
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {log.is_breakdown ? (
                                  <span className="inline-flex items-center justify-center gap-1 font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                                    <AnimatedAlertTriangle size={13} className="shrink-0 text-rose-600 dark:text-rose-400" /> {displayBkdText}
                                  </span>
                                ) : (
                                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block" title={cleanRemarks}>
                                  {cleanRemarks}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[var(--color-ink)]">
                                  {(log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client"}
                                </div>
                                <div className="text-[10px] text-[var(--color-mute)]">
                                  {log.location || ((log as any)?.client?.city ? [(log as any).client.city, (log as any).client.district, (log as any).client.state].filter(Boolean).join(", ") : "—")}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                <div className="font-bold text-[var(--color-ink)]">{opObj?.full_name || "Unassigned"}</div>
                                {opObj?.phone && (
                                  <div className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">{opObj.phone}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-center text-[var(--color-ink)] whitespace-nowrap">
                                {startMtr} → {endMtr}
                                {isDecreased && (
                                  <span className="block text-[10px] text-rose-500 font-bold">
                                    Meter Decreased
                                  </span>
                                )}
                                {isUnusualHigh && (
                                  <span className="block text-[10px] text-amber-500 font-bold">
                                    High Operating Hours
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {log.is_breakdown ? (
                                  <span className="inline-flex items-center justify-center gap-1 font-extrabold text-rose-600 dark:text-rose-400 text-xs font-mono">
                                    <AnimatedAlertTriangle size={13} className="shrink-0 text-rose-600 dark:text-rose-400" /> {displayBkdText}
                                  </span>
                                ) : (
                                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[var(--color-mute)] italic text-xs truncate max-w-[150px] block" title={cleanRemarks}>
                                  {cleanRemarks}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalMatchingLogs > 0 && (
              <div className="px-4 py-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                <Pagination
                  page={currentPage || 1}
                  pageSize={logsPageSize || 10}
                  total={totalMatchingLogs}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>

          {/* MOBILE TOUCH CARDS (block sm:hidden) */}
          <div className="block sm:hidden space-y-3">
            {isPending ? (
              <MobileOperationsLogCardSkeletonList count={4} />
            ) : filteredHourLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--color-mute)] rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                No daily running hour logs found matching active filters.
              </div>
            ) : (
              filteredHourLogs.map((log) => {
                const startMtr = log.start_meter ?? 0;
                const endMtr = log.end_meter ?? startMtr;
                const runningHours = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
                const otHours = log.overtime_hours || 0;
                const mObj = log.machine as any;
                const opObj = log.operator as any;

                const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                const bkdDetails = bkdMatch ? bkdMatch[1].trim() : log.is_breakdown ? "Breakdown" : null;
                const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";
                let bkdDurationOnly = bkdDetails;
                if (bkdDurationOnly) {
                  bkdDurationOnly = bkdDurationOnly.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim();
                }
                const displayBkdText = log.is_breakdown ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown") : "Normal";

                const hasConflict = Boolean(log.conflict_flag);
                const isPendingConflict = hasConflict && (!log.conflict_status || log.conflict_status === "pending");
                const isResolvedConflict = hasConflict && (log.conflict_status === "acknowledged" || log.conflict_status === "adjusted");
                const cardConflict = hasConflict
                  ? parseConflictReason(log.conflict_reason, {
                      machineCode: mObj?.machine_code || mObj?.machine_id || mObj?.model || "Equipment",
                      machineModel: mObj?.model,
                      operatorName: opObj?.full_name || "Operator",
                      startTime: log.start_time,
                      endTime: log.end_time,
                      runningHours: runningHours,
                      overtimeHours: otHours,
                      logDate: log.log_date,
                    })
                  : null;

                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-2xs ${
                      isPendingConflict ? "border-l-4 border-l-amber-500" : isResolvedConflict ? "border-l-4 border-l-emerald-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-[var(--color-mute)] font-bold">{formatDate(log.log_date)}</span>
                          {log.created_at && (
                            <span className="text-[9.5px] font-mono text-sky-600 dark:text-sky-400 font-bold inline-flex items-center gap-1 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                              <Clock size={9} className="text-sky-500 shrink-0" />
                              {formatExactTimestamp(log.created_at, true)}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-sm text-[var(--color-ink)] mt-0.5">{mObj?.model || mObj?.machine_code || "—"}</h4>
                        <span className="text-[11px] font-mono text-[var(--color-mute)]">
                          {mObj?.serial_number ? `S/N: ${mObj.serial_number}` : mObj?.machine_code ? `S/N: ${mObj.machine_code}` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isPendingConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <ShieldAlert size={11} className="text-amber-600 dark:text-amber-400" />
                            Shift Conflict
                          </span>
                        )}
                        {isResolvedConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                            {log.conflict_status === "adjusted" ? "Adjusted" : "Acknowledged"}
                          </span>
                        )}
                        {log.is_breakdown ? (
                          <Badge variant="error" className="font-extrabold">{displayBkdText}</Badge>
                        ) : (
                          <Badge variant="neutral" className="font-bold font-mono">0</Badge>
                        )}
                      </div>
                    </div>

                    {logsViewMode === "operator" ? (
                      <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Model:</span>
                            <span className="font-bold text-[var(--color-ink)]">
                              {mObj?.model || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Serial Number:</span>
                            <span className="font-bold text-[var(--color-ink)] font-mono">
                              {mObj?.serial_number || mObj?.machine_code || "—"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Shift Timings:</span>
                            <span className="font-bold font-mono text-[var(--color-ink)]">
                              {formatCompactTiming(log.start_time, log.end_time)}
                            </span>
                          </div>
                        </div>
                        <div className="pt-1.5 border-t border-[var(--color-hairline)]">
                          <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Client & Location:</span>
                          <span className="font-bold text-[var(--color-ink)] block">
                            {(log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client"}
                          </span>
                          <span className="text-[10px] text-[var(--color-mute)] block truncate">
                            {log.location || ((log as any)?.client?.city ? [(log as any).client.city, (log as any).client.district, (log as any).client.state].filter(Boolean).join(", ") : "—")}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Operating Hrs (OP):</span>
                            <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                              {runningHours} hrs
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Overtime (OT):</span>
                            <span className="font-extrabold font-mono text-amber-600 dark:text-amber-400">
                              {otHours} hrs
                            </span>
                          </div>
                        </div>
                        <div className="pt-1.5 border-t border-[var(--color-hairline)] flex items-center justify-between">
                          <span className="text-[10px] text-[var(--color-mute)] font-semibold">Breakdown:</span>
                          {log.is_breakdown ? (
                            <span className="font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1 text-[11px] font-mono">
                              <AnimatedAlertTriangle size={12} className="text-rose-600 dark:text-rose-400" /> {displayBkdText}
                            </span>
                          ) : (
                            <span className="font-bold text-[var(--color-ink)] font-mono text-[11px]">
                              0
                            </span>
                          )}
                        </div>
                        {cleanRemarks !== "—" && (
                          <div className="pt-1 border-t border-[var(--color-hairline)] text-[11px] text-[var(--color-mute)] italic">
                            Remarks: {cleanRemarks}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--color-hairline)]">
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block">Client / Site:</span>
                            <span className="font-bold text-[var(--color-ink)]">{(log as any)?.client?.client_name || mObj?.customer_name || "Unassigned"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block">Operator:</span>
                            <span className="font-bold text-[var(--color-ink)]">{opObj?.full_name || "Unassigned"}</span>
                          </div>
                        </div>

                        {logsViewMode === "client" ? (
                          <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Operator:</span>
                                <span className="font-bold text-[var(--color-ink)]">
                                  {opObj?.full_name || "Unassigned"}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Shift Timings:</span>
                                <span className="font-bold font-mono text-[var(--color-ink)]">
                                  {formatCompactTiming(log.start_time, log.end_time)}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
                              <div>
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Work Time (WT):</span>
                                <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                                  {runningHours} hrs
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Breakdown:</span>
                                {log.is_breakdown ? (
                                  <span className="font-extrabold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 text-[11px] font-mono">
                                    <AnimatedAlertTriangle size={12} className="text-rose-600 dark:text-rose-400" /> {displayBkdText}
                                  </span>
                                ) : (
                                  <span className="font-bold text-[var(--color-ink)] font-mono text-[11px]">
                                    0
                                  </span>
                                )}
                              </div>
                            </div>
                            {cleanRemarks !== "—" && (
                              <div className="pt-1 border-t border-[var(--color-hairline)] text-[11px] text-[var(--color-mute)] italic">
                                Remarks: {cleanRemarks}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs">
                            <div>
                              <span className="text-[10px] text-[var(--color-mute)] block">Meter Reading:</span>
                              <span className="font-bold font-mono text-[var(--color-ink)]">{startMtr} → {endMtr} hrs</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-[var(--color-mute)] block">Run Hours:</span>
                              <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                                {runningHours} hrs
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Inline Overtime Shift Conflict Detailed Warning Box */}
                    {hasConflict && cardConflict && (
                      <div className={`p-3 rounded-xl border space-y-2 text-xs ${
                        isPendingConflict
                          ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30"
                          : "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert size={14} className={isPendingConflict ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"} />
                            <span className={`font-bold ${isPendingConflict ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                              {isPendingConflict ? cardConflict.title : `Overtime Conflict Resolved (${log.conflict_status || "approved"})`}
                            </span>
                          </div>
                          {isPendingConflict && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenConflictModal(log)}
                              className="text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 py-1 h-7"
                            >
                              Resolve Conflict
                            </Button>
                          )}
                        </div>

                        {/* Clean summary row */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {Number(log.overtime_hours || 0) > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              +{log.overtime_hours}h Overtime
                            </span>
                          ) : null}
                          <span className={`text-[11px] font-medium ${isPendingConflict ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                            {isPendingConflict
                              ? cardConflict.conflictingEntity
                                ? `Collides with active shift on ${cardConflict.conflictingEntity}`
                                : "Overtime overlaps with subsequent shift"
                              : "Approved by supervisor"}
                          </span>
                        </div>

                        {log.conflict_resolution_notes && (
                          <div className="text-[10px] text-[var(--color-mute)] italic pt-1 border-t border-[var(--color-hairline)]">
                            Resolution Note: {log.conflict_resolution_notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {totalMatchingLogs > 0 && (
              <div className="p-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                <Pagination
                  page={currentPage || 1}
                  pageSize={logsPageSize || 10}
                  total={totalMatchingLogs}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>

          {/* PRINTABLE SUPERVISOR LOGS MODAL */}
          <PrintableSupervisorLogsModal
            open={showSupervisorPrintModal}
            onClose={() => setShowSupervisorPrintModal(false)}
            logs={hourLogs}
            user={user!}
            viewMode={logsViewMode}
            selectedEntityId={
              logsViewMode === "machine"
                ? activeMachineId
                : logsViewMode === "client"
                ? activeClientId || activeClientName
                : activeOperatorId
            }
            selectedEntityName={
              logsViewMode === "machine"
                ? activeMachineName
                : logsViewMode === "client"
                ? activeClientName
                : activeOperatorName
            }
            selectedClientId={activeClientId}
            selectedClientName={activeClientName}
            selectedMachineId={activeMachineId}
            selectedOperatorId={activeOperatorId}
            search={searchInput}
            selectedMonthValue={logsSelectedMonth}
            selectedSite={effectiveSelectedSite}
            selectedClientMachineId={effectiveSelectedClientMachineId}
            machines={machines}
            clientSites={clientSites}
            clientMachines={clientMachines}
            customStartDate={logsCustomStartDate}
            customEndDate={logsCustomEndDate}
          />
        </div>
      )}

      {/* TAB 2: Operator Equipment Assignments */}
      {activeTab === "assignments" && (() => {
        // Filter machines and their assignments
        const activeAssList = assignments.filter((a: any) => a.status === "active" || a.is_active);
        
        const filteredMachines = machines.filter((m) => {
          const machAss = activeAssList.filter((a: any) => a.machine_id === m.id || a.machine?.id === m.id);
          
          // Status filter
          if (assignmentFilter === "assigned" && machAss.length === 0) return false;
          if (assignmentFilter === "unassigned" && machAss.length > 0) return false;
          if (assignmentFilter === "full" && machAss.length < 3) return false;

          // Search query
          if (!assignmentSearch.trim()) return true;
          const q = assignmentSearch.toLowerCase().trim();
          const code = (m.machine_id || m.machine_code || "").toLowerCase();
          const model = (m.model || "").toLowerCase();
          const serial = (m.serial_number || "").toLowerCase();
          const hasOpMatch = machAss.some((a: any) => {
            const opName = (a.operator?.full_name || a.operator?.name || "").toLowerCase();
            return opName.includes(q);
          });
          return code.includes(q) || model.includes(q) || serial.includes(q) || hasOpMatch;
        });

        const assignmentsStartIndex = (assignmentsPage - 1) * assignmentsPageSize;
        const paginatedMachines = filteredMachines.slice(assignmentsStartIndex, assignmentsStartIndex + assignmentsPageSize);

        const totalActiveAssignmentsCount = activeAssList.length;
        const totalMachinesCount = machines.length;
        const fullyAssignedCount = machines.filter((m) => {
          const machAss = activeAssList.filter((a: any) => a.machine_id === m.id || a.machine?.id === m.id);
          return machAss.length >= 3;
        }).length;
        const unassignedCount = machines.filter((m) => {
          const machAss = activeAssList.filter((a: any) => a.machine_id === m.id || a.machine?.id === m.id);
          return machAss.length === 0;
        }).length;

        return (
          <div className="space-y-4">
            {/* KPI STATS STRIP */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-0.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Total Equipment</span>
                <span className="text-lg font-extrabold font-mono text-[var(--color-ink)]">{totalMachinesCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-0.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Active Shift Operators</span>
                <span className="text-lg font-extrabold font-mono text-sky-600 dark:text-sky-400">{totalActiveAssignmentsCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-0.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Full Capacity (3/3)</span>
                <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{fullyAssignedCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-0.5 shadow-2xs">
                <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Unassigned (0/3)</span>
                <span className="text-lg font-extrabold font-mono text-amber-600 dark:text-amber-400">{unassignedCount}</span>
              </div>
            </div>

            {/* FILTER & SEARCH TOOLBAR */}
            <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <AnimatedSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
                  <input
                    type="text"
                    value={assignmentSearch}
                    onChange={(e) => {
                      setAssignmentSearch(e.target.value);
                      setAssignmentsPage(1);
                    }}
                    placeholder="Search machines, models, serial numbers, operators..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  {assignmentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentSearch("");
                        setAssignmentsPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Status Filter Buttons & Expand All */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFilter("all");
                        setAssignmentsPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        assignmentFilter === "all"
                          ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      All ({totalMachinesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFilter("assigned");
                        setAssignmentsPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        assignmentFilter === "assigned"
                          ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      Assigned ({totalMachinesCount - unassignedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFilter("full");
                        setAssignmentsPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        assignmentFilter === "full"
                          ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      Full (3/3) ({fullyAssignedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentFilter("unassigned");
                        setAssignmentsPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        assignmentFilter === "unassigned"
                          ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                          : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      Unassigned ({unassignedCount})
                    </button>
                  </div>

                  {/* Expand / Collapse All Cards Toggle */}
                  {filteredMachines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleToggleExpandAll(filteredMachines.map((m) => m.id))}
                      className="px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-elevated)] text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          expandedMachineIds.size === filteredMachines.length && filteredMachines.length > 0
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                      <span>
                        {expandedMachineIds.size === filteredMachines.length && filteredMachines.length > 0
                          ? "Collapse All Cards"
                          : "Expand All Cards"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* EQUIPMENT SHIFT ROSTER CARDS */}
            <div className="space-y-3">
              {filteredMachines.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] text-xs">
                  No equipment matched your filter criteria.
                </div>
              ) : (
                paginatedMachines.map((m) => {
                  const machAss = activeAssList.filter((a: any) => a.machine_id === m.id || a.machine?.id === m.id);
                  const isFull = machAss.length >= 3;
                  const machCode = m.machine_id || m.machine_code || "Machine";
                  const isExpanded = expandedMachineIds.has(m.id);

                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs transition-all duration-200 hover:border-[var(--color-hairline-strong)] overflow-hidden"
                    >
                      {/* Machine Header Strip — Clickable Accordion Header */}
                      <div
                        onClick={() => toggleMachineExpanded(m.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleMachineExpanded(m.id);
                          }
                        }}
                        className="p-3.5 sm:p-4 cursor-pointer select-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:bg-[var(--color-canvas)]/40"
                      >
                        {/* Machine Details & Quick Chips */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-[var(--color-ink)] font-mono">
                              {machCode}
                            </span>
                            {m.model && (
                              <span className="text-xs font-semibold text-[var(--color-mute)]">
                                • {m.model}
                              </span>
                            )}
                            {m.serial_number && (
                              <span className="text-[11px] font-mono text-[var(--color-mute)]">
                                (S/N: {m.serial_number})
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[var(--color-mute)] flex flex-wrap items-center gap-x-3 gap-y-1">
                            {m.hour_meter !== undefined && (
                              <span>Meter: <strong className="font-mono text-[var(--color-ink)]">{m.hour_meter} hrs</strong></span>
                            )}
                            {m.status && (
                              <span className="capitalize">Status: <strong className="text-[var(--color-ink)]">{m.status}</strong></span>
                            )}
                            {machAss.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[var(--color-hairline-strong)]">•</span>
                                {machAss.map((ass: any, aIdx: number) => {
                                  const opObj = activeOperators.find((u) => u.id === ass.operator_id) || (ass.operator as any);
                                  const opFirstName = opObj?.full_name?.split(" ")[0] || opObj?.name?.split(" ")[0] || "Operator";
                                  const parsedShift = opObj?.shift_time ? parseProfileShiftTime(opObj.shift_time) : null;
                                  const effectiveStart = ass.shift_start_time || parsedShift?.startTime || "08:00:00";
                                  const effectiveEnd = ass.shift_end_time || parsedShift?.endTime || "17:00:00";
                                  const startM = parseTimeToMinutes(effectiveStart) ?? 480;
                                  const endM = parseTimeToMinutes(effectiveEnd) ?? 1020;
                                  const isOvernight = ass.crosses_midnight ?? (endM <= startM);
                                  return (
                                    <span
                                      key={ass.id || aIdx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)]"
                                    >
                                      {isOvernight ? "🌙" : "☀️"} {opFirstName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Capacity Pill & Actions */}
                        <div
                          className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${
                              isFull
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : machAss.length > 0
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                                : "bg-[var(--color-canvas)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isFull ? "bg-emerald-500" : machAss.length > 0 ? "bg-sky-500" : "bg-zinc-400"
                              }`}
                            />
                            {machAss.length} / 3 Operators
                          </span>

                          {!isFull && userRole !== "operator" && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenAssignModal(m.id)}
                              className="text-xs font-bold h-8 px-2.5 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <AnimatedPlus size={13} className="text-sky-500 shrink-0" />
                              <span>Assign Operator</span>
                            </Button>
                          )}

                          {/* Accordion Toggle Chevron Button */}
                          <button
                            type="button"
                            onClick={() => toggleMachineExpanded(m.id)}
                            aria-label={isExpanded ? "Close machine card" : "Expand machine card"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer shrink-0"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-180 text-[var(--color-ink)]" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Shift Slots Grid (Only when expanded - default closed) */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/30 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Render active slots */}
                            {machAss.map((ass: any, sIdx: number) => {
                              const opObj = activeOperators.find((u) => u.id === ass.operator_id) || (ass.operator as any);
                              const opName = opObj?.full_name || opObj?.name || "Assigned Operator";
                              const opPhone = opObj?.phone || (ass.operator as any)?.phone;
                              const assignerName = ass.assigner?.full_name || (ass.assigned_by === user?.id ? user?.full_name : null) || "Supervisor";

                              const parsedOpShift = opObj?.shift_time ? parseProfileShiftTime(opObj.shift_time) : null;
                              const effectiveStartTime = ass.shift_start_time || parsedOpShift?.startTime || "08:00:00";
                              const effectiveEndTime = ass.shift_end_time || parsedOpShift?.endTime || "17:00:00";
                              const startMins = parseTimeToMinutes(effectiveStartTime) ?? 480;
                              const endMins = parseTimeToMinutes(effectiveEndTime) ?? 1020;
                              const isOvernight = ass.crosses_midnight ?? (endMins <= startMins);
                              const startDisplay = formatTo12Hour(effectiveStartTime) || "08:00 AM";
                              const endDisplay = formatTo12Hour(effectiveEndTime) || "05:00 PM";

                              return (
                                <div
                                  key={ass.id || sIdx}
                                  className="p-3.5 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] flex flex-col justify-between gap-2.5 text-xs shadow-2xs hover:border-[var(--color-hairline-strong)] transition-all"
                                >
                                  <div className="space-y-2">
                                    {/* Slot Header & Shift Timings */}
                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
                                        Shift Slot #{sIdx + 1}
                                      </span>
                                      {isOvernight ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-mono">
                                          <Moon className="w-3 h-3 text-indigo-500 shrink-0" />
                                          {startDisplay} – {endDisplay}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono">
                                          <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                                          {startDisplay} – {endDisplay}
                                        </span>
                                      )}
                                    </div>

                                    {/* 2-Column Operator & Assignment Details */}
                                    <div className="grid grid-cols-2 gap-3 py-1 items-start">
                                      {/* Column 1: Operator Identity & Phone */}
                                      <div className="space-y-1 min-w-0">
                                        <div className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--color-mute)]">
                                          Operator
                                        </div>
                                        <div className="font-extrabold text-[var(--color-ink)] text-xs truncate flex items-center gap-1.5" title={opName}>
                                          <UserCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                          <span className="truncate">{opName}</span>
                                        </div>
                                        <div className="text-[11px] font-mono text-[var(--color-mute)] flex items-center gap-1.5">
                                          {opPhone ? (
                                            <a
                                              href={`tel:${opPhone}`}
                                              className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline truncate"
                                              title="Call operator"
                                            >
                                              <Phone className="w-3 h-3 text-sky-500 shrink-0" />
                                              <span className="truncate">{opPhone}</span>
                                            </a>
                                          ) : (
                                            <span className="text-[var(--color-mute)] opacity-75 text-[10px]">No contact</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Column 2: Assignment Attribution & Date */}
                                      <div className="space-y-1 min-w-0">
                                        <div className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--color-mute)]">
                                          Assignment
                                        </div>
                                        <div className="text-[11px] text-[var(--color-ink)] truncate flex items-center gap-1">
                                          <span className="text-[var(--color-mute)] text-[10px] shrink-0">By:</span>
                                          <strong className="font-semibold text-[var(--color-ink)] truncate" title={assignerName}>
                                            {assignerName}
                                          </strong>
                                        </div>
                                        {ass.assigned_at && (
                                          <div className="text-[10px] text-[var(--color-mute)] font-mono truncate">
                                            Since {formatDate(ass.assigned_at)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action Button: Change Operator Only */}
                                  {userRole !== "operator" && (
                                    <div className="flex items-center justify-end pt-2 border-t border-[var(--color-hairline)]">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAssignModal(m.id, ass.operator_id)}
                                        className="px-3 py-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 border border-sky-500/20 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap inline-flex items-center gap-1.5 shadow-2xs"
                                        title="Change operator or update shift"
                                      >
                                        Change Operator
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Render empty available slots */}
                            {Array.from({ length: Math.max(0, 3 - machAss.length) }).map((_, emptyIdx) => {
                              const slotNum = machAss.length + emptyIdx + 1;
                              return (
                                <button
                                  key={`empty-${emptyIdx}`}
                                  type="button"
                                  onClick={() => handleOpenAssignModal(m.id)}
                                  className="p-4 rounded-xl border border-dashed border-[var(--color-hairline-strong)] hover:border-sky-500 hover:bg-sky-500/5 transition-all text-left flex flex-col items-center justify-center gap-1.5 cursor-pointer min-h-[130px] group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-mute)] group-hover:text-sky-500 group-hover:border-sky-500/40 transition-colors">
                                    <AnimatedPlus size={15} />
                                  </div>
                                  <span className="text-xs font-bold text-[var(--color-mute)] group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    + Assign Shift #{slotNum}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-mute)] opacity-70">
                                    Open Slot Available
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredMachines.length > 0 && (
              <div className="pt-2">
                <Pagination
                  page={assignmentsPage}
                  pageSize={assignmentsPageSize}
                  total={filteredMachines.length}
                  onPageChange={setAssignmentsPage}
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={(newSize) => {
                    setAssignmentsPageSize(newSize);
                    setAssignmentsPage(1);
                  }}
                />
              </div>
            )}
          </div>
        );
      })()}




      {/* MODAL: Assign Machine Operator to Shift */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <form
            onSubmit={handleAssignOperator}
            className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                  <AnimatedUserCheck size={18} className="text-sky-500 shrink-0" />
                  Assign Operator Shift Window
                </h3>
                <p className="text-xs text-[var(--color-mute)] mt-0.5">
                  Assign an operator to recurring daily shift timings for this equipment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <AnimatedX size={16} />
              </button>
            </div>

            {/* Error Banner / Detailed Conflict Warning */}
            {assignmentError && (
              isAssignmentConflict && parsedAssignmentConflict ? (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-extrabold text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{parsedAssignmentConflict.title}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-600 text-white">
                      {parsedAssignmentConflict.badgeText}
                    </span>
                  </div>

                  <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
                    {parsedAssignmentConflict.description}
                  </p>

                  <ul className="space-y-1 pl-1 pt-0.5">
                    {parsedAssignmentConflict.bulletWarnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="p-2.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-rose-500/20 text-[11px] text-rose-900 dark:text-rose-200 flex items-start gap-2">
                    <span className="font-extrabold text-rose-600 shrink-0">Action Required:</span>
                    <span>{parsedAssignmentConflict.resolutionGuidance.adjustAdvice}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Assignment Error</div>
                    <div className="mt-0.5">{assignmentError}</div>
                  </div>
                </div>
              )
            )}

            <div className="space-y-4">
              {/* Select Machine */}
              <div>
                <MachineSelect
                  label="Target Equipment *"
                  required
                  value={selectedMachineId}
                  onChange={(mId) => {
                    setSelectedMachineId(mId);
                    setAssignmentError(null);
                  }}
                  machines={machines}
                />
              </div>

              {/* Machine Active Shift Roster & Capacity Status */}
              <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                    Machine Shift Roster Capacity
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    activeAssignmentsOnSelectedMachine.length >= 3
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : activeAssignmentsOnSelectedMachine.length > 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                  }`}>
                    {activeAssignmentsOnSelectedMachine.length} / 3 Operators Assigned
                  </span>
                </div>

                {activeAssignmentsOnSelectedMachine.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-mute)] italic">
                    No active operators currently assigned to this equipment.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {activeAssignmentsOnSelectedMachine.map((ass: any, idx: number) => {
                      const opObj = activeOperators.find((u) => u.id === ass.operator_id) || (ass.operator as any);
                      const isOvernight = ass.crosses_midnight || (parseTimeToMinutes(ass.shift_end_time) ?? 0) <= (parseTimeToMinutes(ass.shift_start_time) ?? 0);
                      return (
                        <div
                          key={ass.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-[var(--color-ink)]">
                              {opObj?.full_name || "Operator"}
                            </span>
                            <div className="text-[11px] text-[var(--color-mute)] flex items-center gap-1 mt-0.5">
                              {isOvernight ? (
                                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono">
                                  <Moon className="w-3 h-3" /> {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono">
                                  <Sun className="w-3 h-3" /> {formatTo12Hour(ass.shift_start_time)} – {formatTo12Hour(ass.shift_end_time)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            Active
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeAssignmentsOnSelectedMachine.length >= 3 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Maximum capacity reached (3/3). End an existing assignment before adding another operator.</span>
                  </div>
                )}
              </div>

              {/* Select Operator */}
              <div>
                <UserSelect
                  label="Select Operator to Assign *"
                  required
                  value={selectedOperatorId}
                  onChange={handleOperatorSelect}
                  users={activeOperators}
                  roleFilter={["operator"]}
                  placeholder="Search and select active operator..."
                />

                {/* Profile Shift auto-fill status badge */}
                {selectedOperatorId && (
                  <div className="mt-1.5">
                    {loadingProfileShift ? (
                      <span className="text-[11px] text-[var(--color-mute)] flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Checking profile shift timings...
                      </span>
                    ) : hasProfileShift === true ? (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <span>Timings auto-filled from operator profile ({shiftStartTime} – {shiftEndTime}). You may customize below if needed.</span>
                      </div>
                    ) : hasProfileShift === false ? (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>No default profile shift found for this operator. Please select shift start and end times below.</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Shift Timings: CustomTimePicker for Start and End */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <CustomTimePicker
                      label="Daily Shift Start Time *"
                      required
                      value={shiftStartTime}
                      onChange={(v) => {
                        setShiftStartTime(v);
                        setAssignmentError(null);
                      }}
                      placeholder="08:00 AM"
                    />
                  </div>
                  <div>
                    <CustomTimePicker
                      label="Daily Shift End Time *"
                      required
                      value={shiftEndTime}
                      onChange={(v) => {
                        setShiftEndTime(v);
                        setAssignmentError(null);
                      }}
                      placeholder="04:00 PM"
                    />
                  </div>
                </div>

                {/* Duration & Overnight Helper Pill */}
                {shiftStartTime && shiftEndTime && (
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                    <span className="text-[var(--color-mute)]">Shift Duration: <strong className="text-[var(--color-ink)] font-mono">{shiftDurationHours || "—"}</strong></span>
                    {isOvernightShift ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        <Moon className="w-3 h-3" /> Crosses Midnight (Overnight)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Sun className="w-3 h-3" /> Standard Day Shift
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Assignment Notes */}
              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">
                  Assignment Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Primary morning shift, client site operations"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submitting}
                disabled={
                  submitting ||
                  !selectedMachineId ||
                  !selectedOperatorId ||
                  !shiftStartTime ||
                  !shiftEndTime ||
                  activeAssignmentsOnSelectedMachine.length >= 3
                }
              >
                Confirm & Assign Shift
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Review & Resolve Overtime Conflict */}
      {showConflictModal && selectedConflictLog && modalConflictDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                  Resolve Overtime Conflict
                </h3>
                <p className="text-xs text-[var(--color-mute)] mt-0.5">
                  {(selectedConflictLog.machine as any)?.machine_name || (selectedConflictLog.machine as any)?.machine_code || "Equipment"} • {(selectedConflictLog.operator as any)?.full_name || "Operator"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <AnimatedX size={16} />
              </button>
            </div>

            {/* Severity Tag & Alert Heading Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white">
                  {modalConflictDetails.badgeText}
                </span>
                {modalConflictDetails.overtimeHoursText && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    {modalConflictDetails.overtimeHoursText}
                  </span>
                )}
              </div>
              <h4 className="font-extrabold text-sm text-[var(--color-ink)]">
                {modalConflictDetails.title}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                {modalConflictDetails.description}
              </p>
            </div>

            {/* Structured Incident Breakdown */}
            <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs space-y-2.5">
              <span className="text-[11px] font-bold text-[var(--color-ink)] uppercase tracking-wider block">
                Incident Breakdown
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Target Equipment</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {(selectedConflictLog.machine as any)?.machine_name || (selectedConflictLog.machine as any)?.machine_code || "Equipment"}
                    {(selectedConflictLog.machine as any)?.model ? ` (${(selectedConflictLog.machine as any).model})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Operator</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {(selectedConflictLog.operator as any)?.full_name || "Operator"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Shift Log Date</span>
                  <span className="font-bold text-[var(--color-ink)]">{selectedConflictLog.log_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Recorded Timings</span>
                  <span className="font-bold font-mono text-[var(--color-ink)]">
                    {formatShiftTimingRange(selectedConflictLog.start_time, selectedConflictLog.end_time)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Total Duration</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {selectedConflictLog.running_hours || 0} hrs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Overtime Claimed</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {selectedConflictLog.overtime_hours ? `+${selectedConflictLog.overtime_hours} hrs OT` : "None"}
                  </span>
                </div>
              </div>

              {modalConflictDetails.conflictingEntity && (
                <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Conflicting Equipment: {modalConflictDetails.conflictingEntity}</span>
                </div>
              )}
            </div>

            {/* Operational Risk & Compliance Warning Card */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Operational Risk & Compliance Warning</span>
              </div>
              <ul className="space-y-1 pl-1">
                {modalConflictDetails.bulletWarnings.map((warn, i) => (
                  <li key={i} className="text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-1.5">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Supervisor Action Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-[var(--color-ink)] block">
                Supervisor Action *
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConflictAction("acknowledge")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    conflictAction === "acknowledge"
                      ? "bg-sky-500/10 border-sky-500 text-sky-800 dark:text-sky-300 font-bold"
                      : "bg-[var(--color-canvas)] border-[var(--color-hairline)] text-[var(--color-mute)]"
                  }`}
                >
                  <div className="text-xs flex items-center gap-1.5 font-bold">
                    <Check className="w-3.5 h-3.5 text-sky-500" /> Acknowledge
                  </div>
                  <div className="text-[10px] mt-1 font-normal opacity-80 leading-relaxed">
                    {modalConflictDetails.resolutionGuidance.acknowledgeAdvice}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConflictAction("adjust")}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    conflictAction === "adjust"
                      ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-300 font-bold"
                      : "bg-[var(--color-canvas)] border-[var(--color-hairline)] text-[var(--color-mute)]"
                  }`}
                >
                  <div className="text-xs flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Adjust Time
                  </div>
                  <div className="text-[10px] mt-1 font-normal opacity-80 leading-relaxed">
                    {modalConflictDetails.resolutionGuidance.adjustAdvice}
                  </div>
                </button>
              </div>

              {conflictAction === "adjust" && (
                <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 animate-in fade-in">
                  <CustomTimePicker
                    label="Adjusted End Time *"
                    required
                    value={conflictAdjustedEndTime}
                    onChange={(v) => setConflictAdjustedEndTime(v)}
                    placeholder="e.g. 04:00 PM"
                  />
                  {modalAdjustedCalculation && (
                    <div className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 font-medium ${
                      modalAdjustedCalculation.valid
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                    }`}>
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>{modalAdjustedCalculation.message}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--color-mute)]">
                    Adjusting end time will recompute running and overtime hours automatically.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">
                  Supervisor Notes
                </label>
                <textarea
                  value={conflictNotes}
                  onChange={(e) => setConflictNotes(e.target.value)}
                  placeholder="Provide brief reason for resolution..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowConflictModal(false)}
                disabled={resolvingConflict}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={resolvingConflict}
                onClick={handleResolveConflict}
                disabled={resolvingConflict || (conflictAction === "adjust" && (!conflictAdjustedEndTime || modalAdjustedCalculation?.valid === false))}
              >
                Confirm Resolution
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
