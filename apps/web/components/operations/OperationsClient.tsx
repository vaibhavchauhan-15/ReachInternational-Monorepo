"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "@/components/ui/animated-icons";
import { Badge, Button, Select, useToast, TooltipWrapper, MachineSelect, ClientSelect, UserSelect, SearchableSelect, CustomTimePicker, Modal } from "@/components/ui";
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
import { formatDate, formatExactTimestamp, formatTimeAgo, formatTo12Hour, parseProfileShiftTime, parseTimeToMinutes, getISTDateString } from "@reachinternational/utils";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { Printer, Clock, ShieldAlert, Check, UserPlus, AlertCircle, Sun, Moon, Users, Filter, ChevronDown, RefreshCw, Phone, UserCheck } from "lucide-react";

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
}: OperationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { toast } = useToast();

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

  // Filter states: Assignments Tab
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "assigned" | "unassigned" | "full">("all");

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
  const [logsViewMode, setLogsViewMode] = useState<"machine" | "client" | "operator">("machine");
  const [logsSelectedMachineId, setLogsSelectedMachineId] = useState<string>("");
  const [logsSelectedClientId, setLogsSelectedClientId] = useState<string>("");
  const [logsSelectedSite, setLogsSelectedSite] = useState<string>("all");
  const [logsSelectedClientMachineId, setLogsSelectedClientMachineId] = useState<string>("all");
  const [logsSelectedOperatorId, setLogsSelectedOperatorId] = useState<string>("");
  const [logsSelectedMonth, setLogsSelectedMonth] = useState<string>(getCurrentMonthValue());
  const [logsCustomStartDate, setLogsCustomStartDate] = useState<string>(() => {
    try {
      const today = getISTDateString();
      return today.slice(0, 7) + "-01";
    } catch (e) {
      return "";
    }
  });
  const [logsCustomEndDate, setLogsCustomEndDate] = useState<string>(() => {
    try {
      return getISTDateString();
    } catch (e) {
      return "";
    }
  });
  const [showSupervisorPrintModal, setShowSupervisorPrintModal] = useState(false);

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

  // Comprehensive clients list derived from dbClients and hourLogs/machines
  const allClientsList = useMemo(() => {
    const clientsMap = new Map<string, any>();

    // 1. Seed with database clients
    (dbClients || []).forEach((c) => {
      const name = c.company_name || c.client_name || (c as any).name || "Client";
      clientsMap.set(c.id, {
        ...c,
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
        clientsMap.set(c.id, {
          id: c.id,
          code: c.code,
          client_name: name,
          company_name: name,
          name: name,
          city: c.city,
          state: c.state,
          address: c.address,
          phone: c.phone,
        });
      }
    });

    // 3. Discover any clients in machines that might not be in dbClients
    machines.forEach((m) => {
      const c = (m as any).client;
      if (c && c.id && !clientsMap.has(c.id)) {
        const name = c.company_name || c.client_name || "Client";
        clientsMap.set(c.id, {
          id: c.id,
          code: c.code,
          client_name: name,
          company_name: name,
          name: name,
          city: c.city,
          state: c.state,
          address: c.address,
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
  }, [allClientsList, logsSelectedClientId, hourLogs]);

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

  // Derived unique site locations for active selected client
  const clientSites = useMemo(() => {
    const sites = new Set<string>();
    if (activeClient?.city && activeClient?.state) {
      sites.add(`${activeClient.city}, ${activeClient.state}`);
    } else if (activeClient?.city) {
      sites.add(activeClient.city);
    } else if (activeClient?.address) {
      sites.add(activeClient.address);
    }

    clientMachines.forEach((m) => {
      const addr = (m as any)?.customer_address;
      const city = (m as any)?.city;
      if (addr && city) sites.add(`${addr}, ${city}`);
      else if (addr) sites.add(addr);
      else if (city) sites.add(city);
    });

    hourLogs.forEach((l) => {
      const isClientLog =
        (activeClientId && (l.client_id === activeClientId || (l as any)?.client?.id === activeClientId)) ||
        (activeClientName && ((l as any)?.client?.client_name || (l as any)?.client?.company_name || "").toLowerCase().trim() === activeClientName.toLowerCase().trim()) ||
        clientMachines.some((m) => m.id === l.machine_id);

      if (isClientLog && l.location) {
        sites.add(l.location);
      }
    });

    return Array.from(sites).filter(Boolean);
  }, [activeClient, clientMachines, hourLogs, activeClientId, activeClientName]);

  // Effective selected site location (default to "all")
  const effectiveSelectedSite =
    logsSelectedSite && logsSelectedSite !== "all"
      ? (clientSites.includes(logsSelectedSite) ? logsSelectedSite : "all")
      : "all";

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
  const clientCityState = activeDbClient?.city
    ? `${activeDbClient.city}${activeDbClient.state ? `, ${activeDbClient.state}` : ""}`
    : "—";
  const clientAddress = activeDbClient?.address || "—";
  const clientFleetCount = clientMachines.length;

  // Filtered running hour logs
  let filteredHourLogs = hourLogs;

  // 1. Month / Date Range filter
  if (logsSelectedMonth === "custom") {
    filteredHourLogs = filteredHourLogs.filter((log) => {
      if (!logsCustomStartDate && !logsCustomEndDate) return true;
      const logDate = log.log_date?.split("T")[0] || "";
      if (logsCustomStartDate && logDate < logsCustomStartDate) return false;
      if (logsCustomEndDate && logDate > logsCustomEndDate) return false;
      return true;
    });
  } else if (logsSelectedMonth !== "all") {
    filteredHourLogs = filteredHourLogs.filter(
      (log) => getLogMonthNumber(log.log_date) === logsSelectedMonth
    );
  }

  // 2. View Mode & Entity filter
  if (logsViewMode === "machine") {
    filteredHourLogs = filteredHourLogs.filter(
      (log) => log.machine_id === activeMachineId
    );
  } else if (logsViewMode === "client") {
    filteredHourLogs = filteredHourLogs.filter((log) => {
      // Check if log belongs to the selected client
      const matchesClientId =
        Boolean(activeClientId) &&
        (log.client_id === activeClientId || (log as any)?.client?.id === activeClientId);

      const logClientName =
        (log as any)?.client?.client_name ||
        (log as any)?.client?.company_name ||
        (log.machine as any)?.customer_name ||
        "";
      const matchesClientName =
        Boolean(activeClientName) &&
        logClientName.toLowerCase().trim() === activeClientName.toLowerCase().trim();

      const isClientMachine = clientMachines.some((m) => m.id === log.machine_id);

      const matchesClient = matchesClientId || matchesClientName || isClientMachine;
      if (!matchesClient) return false;

      // Optional Site Location filter
      if (effectiveSelectedSite && effectiveSelectedSite !== "all") {
        const mObj = log.machine as any;
        const siteStr = log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "");
        if (!siteStr.toLowerCase().includes(effectiveSelectedSite.toLowerCase())) return false;
      }

      // Optional Client Machine filter (defaults to "all" to show all client logs)
      if (effectiveSelectedClientMachineId && effectiveSelectedClientMachineId !== "all") {
        if (log.machine_id !== effectiveSelectedClientMachineId) return false;
      }

      return true;
    });
  } else if (logsViewMode === "operator") {
    filteredHourLogs = filteredHourLogs.filter(
      (log) => log.operator_id === activeOperatorId
    );
  }

  // Aggregate metrics calculation for filtered logs
  let totalFilteredRunHours = 0;
  let totalFilteredOtHours = 0;
  let totalFilteredBreakdowns = 0;

  filteredHourLogs.forEach((log) => {
    const startMtr = log.start_meter ?? 0;
    const endMtr = log.end_meter ?? startMtr;
    const run = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    const ot = log.overtime_hours || 0;
    totalFilteredRunHours += run;
    totalFilteredOtHours += ot;
    if (log.is_breakdown) totalFilteredBreakdowns++;
  });

  const selectedMonthLabel = MONTH_NAMES.find((m) => m.value === logsSelectedMonth)?.label || "August";
  const loggedDaysCount = new Set(filteredHourLogs.map((l) => l.log_date)).size;
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-ink)]">
                Fleet Operations
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => handleOpenAssignModal()}
                className="h-9 px-3.5 font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <AnimatedUserCheck size={16} className="shrink-0" />
                <span>Assign Operator</span>
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "logs"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
              }`}
            >
              <span>Daily Running Hours</span>
              {pendingConflicts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {pendingConflicts.length} Alert{pendingConflicts.length > 1 ? "s" : ""}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("assignments");
                router.push("/operations?tab=assignments");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "assignments"
                  ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
              }`}
            >
              <span>Operator Machine Assignments</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                {assignments.filter((a: any) => a.status === "active" || a.is_active).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/operations/audit-logs")}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] whitespace-nowrap"
            >
              <AnimatedScrollText size={14} />
              <span>Assignment Audit Logs</span>
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
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                      <span>{pendingConflicts.length} Realized Overtime Shift Conflict{pendingConflicts.length > 1 ? "s" : ""}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Action Required
                      </span>
                    </h4>
                    <p className="text-xs text-[var(--color-mute)] mt-0.5">
                      Operator running hours exceeded their scheduled shift window and overlapped with another operator's assignment. Review and acknowledge or adjust.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {pendingConflicts.slice(0, 6).map((log) => {
                  const mName = (log.machine as any)?.machine_name || (log.machine as any)?.machine_code || "Equipment";
                  const opName = (log.operator as any)?.full_name || (log.operator as any)?.name || "Operator";
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-amber-500/20 flex items-center justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[var(--color-ink)] truncate">{mName}</div>
                        <div className="text-[11px] text-[var(--color-mute)] truncate">{opName} • {log.log_date}</div>
                        <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 truncate mt-0.5">
                          {log.conflict_reason || "Shift overlap detected"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenConflictModal(log)}
                        className="shrink-0 text-xs font-bold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                      >
                        Review
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* FILTER & EXPORT TOOLBAR */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 space-y-3 shadow-sm">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Left: View Mode Pill Switcher */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setLogsViewMode("machine");
                    if (!logsSelectedMachineId || logsSelectedMachineId === "all") {
                      setLogsSelectedMachineId(orderedMachines[0]?.id || "");
                    }
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
                    if (!logsSelectedClientId || logsSelectedClientId === "all") {
                      if (activeClientId) {
                        setLogsSelectedClientId(activeClientId);
                      }
                    }
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
                    if (!logsSelectedOperatorId || logsSelectedOperatorId === "all") {
                      setLogsSelectedOperatorId(orderedOperators[0]?.id || "");
                    }
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

              {/* Right: Export CTA Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSupervisorPrintModal(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Export / Print
                </button>
              </div>
            </div>

            {/* SECOND ROW: Filter Dropdowns (Horizontally Aligned) */}
            {logsViewMode === "client" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[var(--color-hairline)]">
                <div>
                  <ClientSelect
                    label="Select Client"
                    value={activeClientId}
                    onChange={(val, clientObj) => {
                      const nextId = clientObj?.id || val;
                      setLogsSelectedClientId(nextId);
                      setLogsSelectedSite("all");
                      setLogsSelectedClientMachineId("all");
                    }}
                    clients={allClientsList}
                    placeholder="Select Client..."
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Select Location"
                    value={effectiveSelectedSite}
                    onChange={(val) => setLogsSelectedSite(val)}
                    options={
                      clientSites.length === 1
                        ? clientSites.map((s) => ({ value: s, label: s }))
                        : [
                            { value: "all", label: "All Sites & Locations" },
                            ...clientSites.map((s) => ({ value: s, label: s })),
                          ]
                    }
                  />
                </div>

                <div>
                  <MachineSelect
                    label="Select Machine"
                    value={effectiveSelectedClientMachineId}
                    onChange={(mId) => setLogsSelectedClientMachineId(mId || "all")}
                    machines={clientMachines}
                    allowAll={true}
                    allLabel="All Machines"
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Select Month"
                    value={logsSelectedMonth}
                    onChange={(val) => setLogsSelectedMonth(val)}
                    options={MONTH_NAMES.map((m) => ({
                      value: m.value,
                      label: m.label,
                    }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[var(--color-hairline)]">
                <div>
                  {logsViewMode === "machine" && (
                    <MachineSelect
                      label="Select Machine"
                      value={activeMachineId}
                      onChange={(mId) => setLogsSelectedMachineId(mId)}
                      machines={orderedMachines}
                    />
                  )}

                  {logsViewMode === "operator" && (
                    <UserSelect
                      label="Select Operator"
                      value={activeOperatorId}
                      onChange={(opId) => setLogsSelectedOperatorId(opId)}
                      users={orderedOperators}
                    />
                  )}
                </div>

                <div>
                  <SearchableSelect
                    label="Select Month"
                    value={logsSelectedMonth}
                    onChange={(val) => setLogsSelectedMonth(val)}
                    options={MONTH_NAMES.map((m) => ({
                      value: m.value,
                      label: m.label,
                    }))}
                  />
                </div>
              </div>
            )}

            {/* Custom Date Range Pickers (Collapsible when logsSelectedMonth === 'custom') */}
            {logsSelectedMonth === "custom" && (
              <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Start Date
                  </label>
                  <CustomDatePicker
                    value={logsCustomStartDate}
                    onChange={(val) => setLogsCustomStartDate(val)}
                    allowAnyPast
                    allowAnyFuture
                    showWindowBadge={false}
                    showRelativeBadge={false}
                    placeholder="Select start date"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    End Date
                  </label>
                  <CustomDatePicker
                    value={logsCustomEndDate}
                    onChange={(val) => setLogsCustomEndDate(val)}
                    allowAnyPast
                    allowAnyFuture
                    showWindowBadge={false}
                    showRelativeBadge={false}
                    placeholder="Select end date"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* KPI METRICS SUMMARY STRIP (Operator View Mode Only) */}
            {logsViewMode === "operator" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Total Run Hours</span>
                  <span className="text-base font-extrabold font-mono text-sky-600 dark:text-sky-400">
                    {Math.round(totalFilteredRunHours * 10) / 10} hrs
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Total Overtime</span>
                  <span className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {Math.round(totalFilteredOtHours * 10) / 10} hrs
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Breakdown Events</span>
                  <span className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                    {totalFilteredBreakdowns} Events
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Matching Logs</span>
                  <span className="text-base font-extrabold font-mono text-[var(--color-ink)]">
                    {filteredHourLogs.length} Records
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* MACHINE DETAILS SUMMARY HEADER CARD (By Machine Mode) */}
          {logsViewMode === "machine" && activeMachineObj && (
            <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--color-hairline)] pb-2.5">
                <h3 className="text-base font-extrabold text-[var(--color-ink)]">
                  {activeMachineObj.machine_name}
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[var(--color-mute)]">Current Status:</span>
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
                    className="font-bold"
                  >
                    {activeMachineObj.status ? activeMachineObj.status.replace("_", " ").toUpperCase() : "ACTIVE"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs pt-0.5">
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
          )}

          {/* CLIENT DETAILS SUMMARY HEADER CARD (By Client Mode) */}
          {logsViewMode === "client" && activeClientName && (
            <div className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--color-hairline)] pb-2.5">
                <h3 className="text-base font-extrabold text-[var(--color-ink)]">
                  {activeClientName}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {clientFleetCount > 0 && (
                    <Badge variant="info" className="font-bold">
                      {clientFleetCount} Rented Machine{clientFleetCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {clientSites.length > 0 && (
                    <Badge variant="neutral" className="font-bold">
                      {clientSites.length} Active Site Location{clientSites.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant="info" className="font-bold">
                    Working Hours: 8:00 AM to 8:00 PM
                  </Badge>
                  <Badge variant="success" className="font-bold">
                    Working Days: {displayWorkingDays} Days ({selectedMonthLabel})
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs pt-0.5">
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Customer Phone</span>
                  <span className="font-bold font-mono text-[var(--color-ink)]">{clientMobile}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Email Address</span>
                  <span className="font-bold text-[var(--color-ink)] truncate block" title={clientEmail}>{clientEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">City / State</span>
                  <span className="font-bold text-[var(--color-ink)]">{clientCityState}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Primary Address</span>
                  <span className="font-bold text-[var(--color-ink)] truncate block" title={clientAddress}>{clientAddress}</span>
                </div>
              </div>

              {/* Summary Metrics Cards Grid in Client Detail Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--color-hairline)]">
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Total Run Hours</span>
                  <span className="text-base font-extrabold font-mono text-sky-600 dark:text-sky-400">
                    {Math.round(totalFilteredRunHours * 10) / 10} hrs
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Total Overtime</span>
                  <span className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {Math.round(totalFilteredOtHours * 10) / 10} hrs
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Breakdown Events</span>
                  <span className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                    {totalFilteredBreakdowns} Events
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-[var(--color-mute)] block">Matching Logs</span>
                  <span className="text-base font-extrabold font-mono text-[var(--color-ink)]">
                    {filteredHourLogs.length} Records
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP DATA TABLE (hidden sm:block) */}
          <div className="hidden sm:block rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
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
                  {filteredHourLogs.length === 0 ? (
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
                      const locationStr = log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—");

                      const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                      const bkdDetails = bkdMatch ? bkdMatch[1].trim() : log.is_breakdown ? "Breakdown" : null;
                      const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";
                      let bkdDurationOnly = bkdDetails;
                      if (bkdDurationOnly) {
                        bkdDurationOnly = bkdDurationOnly.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim();
                      }
                      const displayBkdText = log.is_breakdown ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown") : "Normal";

                      return (
                        <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                          <td className="px-3 py-3 text-center font-bold text-xs text-[var(--color-mute)] font-mono">{idx + 1}</td>
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
                                  {log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.city ? `${mObj.city}, ${mObj.state || ""}` : "—")}
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
          </div>

          {/* MOBILE TOUCH CARDS (block sm:hidden) */}
          <div className="block sm:hidden space-y-3">
            {filteredHourLogs.length === 0 ? (
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

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-2xs"
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
                      {log.is_breakdown ? (
                        <Badge variant="error" className="font-extrabold">{displayBkdText}</Badge>
                      ) : (
                        <Badge variant="neutral" className="font-bold font-mono">0</Badge>
                      )}
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
                            {log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—")}
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
                  </div>
                );
              })
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
                ? activeClientName
                : activeOperatorId
            }
            selectedMonthValue={logsSelectedMonth}
            selectedSite={effectiveSelectedSite}
            selectedClientMachineId={effectiveSelectedClientMachineId}
            machines={machines}
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
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    placeholder="Search machines, models, serial numbers, operators..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  {assignmentSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignmentSearch("")}
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
                      onClick={() => setAssignmentFilter("all")}
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
                      onClick={() => setAssignmentFilter("assigned")}
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
                      onClick={() => setAssignmentFilter("full")}
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
                      onClick={() => setAssignmentFilter("unassigned")}
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
                filteredMachines.map((m) => {
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

            {/* LINK TO DEDICATED AUDIT LOGS PAGE */}
            <div className="pt-3 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--color-hairline)] text-xs">
              <span className="text-[var(--color-mute)]">
                Looking for full shift assignment history, closures, and supervisor audit logs?
              </span>
              <button
                type="button"
                onClick={() => router.push("/operations/audit-logs")}
                className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <AnimatedScrollText size={14} />
                <span>View Full Assignment Audit Logs →</span>
              </button>
            </div>
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

            {/* Error Banner if any */}
            {assignmentError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Assignment Conflict / Error</div>
                  <div className="mt-0.5">{assignmentError}</div>
                </div>
              </div>
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
      {showConflictModal && selectedConflictLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                  Resolve Overtime Conflict
                </h3>
                <p className="text-xs text-[var(--color-mute)] mt-0.5">
                  Log Date: <strong className="text-[var(--color-ink)]">{selectedConflictLog.log_date}</strong>
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

            {/* Conflict Summary Card */}
            <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Equipment</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {(selectedConflictLog.machine as any)?.machine_name || (selectedConflictLog.machine as any)?.machine_code || "Equipment"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Operator</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {(selectedConflictLog.operator as any)?.full_name || "Operator"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/15 grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Recorded Times</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {formatCompactTiming(selectedConflictLog.start_time, selectedConflictLog.end_time)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Hours (Run / OT)</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {selectedConflictLog.running_hours || 0} hrs / <span className="text-amber-600">{selectedConflictLog.overtime_hours || 0} OT</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/15 text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Conflict:</strong> {selectedConflictLog.conflict_reason || "Recorded hours exceeded shift window into next assignment."}
              </div>
            </div>

            {/* Resolution Choice */}
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
                  <div className="text-xs flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-sky-500" /> Acknowledge
                  </div>
                  <div className="text-[10px] mt-1 font-normal opacity-80">
                    Keep recorded hours as verified field overtime.
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
                  <div className="text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" /> Adjust Time
                  </div>
                  <div className="text-[10px] mt-1 font-normal opacity-80">
                    Trim end time to eliminate shift overlap.
                  </div>
                </button>
              </div>

              {conflictAction === "adjust" && (
                <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 animate-in fade-in">
                  <CustomTimePicker
                    label="Adjusted End Time *"
                    required
                    value={conflictAdjustedEndTime}
                    onChange={(v) => setConflictAdjustedEndTime(v)}
                    placeholder="e.g. 04:00 PM"
                  />
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
                disabled={resolvingConflict || (conflictAction === "adjust" && !conflictAdjustedEndTime)}
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
