"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AnimatedGauge,
  AnimatedClock,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedSearch,
  AnimatedX,
  AnimatedCheck,
  AnimatedChevronDown,
} from "@/components/ui/animated-icons";
import {
  Send,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit,
  Search,
  Hash,
  Plus,
  Lock,
  Calendar,
  Info,
  RotateCcw,
  FileCheck,
  FileCheck2,
  AlertOctagon,
  ArrowRight,
  Check,
  Printer,
  Download,
  Building2,
  MapPin,
  Gauge,
  Zap,
  ShieldCheck,
} from "lucide-react";

import type {
  User,
  Machine,
  MachineWithEngineer,
  CRMClient,
} from "@/lib/types/database";
import {
  submitOperatorHourLogAction,
  updateOperatorHourLogAction,
} from "@/app/actions/operators";
import { useToast, CustomTimePicker, CustomDatePicker, Modal, MachineSelect, ClientSelect, SegmentedToggle, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatExactTimestamp,
  splitExactTimestamp,
  formatTimeAgo,
  formatTo12Hour,
  formatShiftTimingRange,
  computeShiftTiming,
  computeBreakdownDuration,
  parseBreakdownString,
  parseDateTimeToDate,
  formatResolvedRange,
  addDaysToDateStr,
  findLatestMachineLogTimeline,
  checkIntervalOverlap,
} from "@reachinternational/utils";
import { PrintableOperatorLogsModal } from "./PrintableOperatorLogsModal";
import { exportOperatorLogsToExcel } from "@/lib/utils/operator-logs-export";
import { handleClipboardPaste } from "@/lib/security/clipboard";
import { HmrSchema, RemarksSchema } from "@reachinternational/validation";

const DRAFT_STORAGE_KEY = "reach_operator_daily_log_draft";


// Helper to format client location string
function getClientFormattedLocation(client?: CRMClient | null, fallbackLocation?: string | null): string {
  if (client) {
    const parts = [client.address, client.city, client.state].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  return fallbackLocation || "";
}


export interface OperatorHourLog {
  id: string;
  machine_id: string;
  operator_id: string;
  client_id?: string | null;
  log_date: string;
  end_date?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  start_meter?: number;
  end_meter?: number;
  start_time?: string;
  end_time?: string;
  overtime_hours?: number;
  normal_working_hours?: number;
  is_breakdown?: boolean;
  breakdown_start_time?: string | null;
  breakdown_end_time?: string | null;
  breakdown_duration?: string | null;
  breakdown_hours?: number | null;
  running_hours?: number;
  shift?: string;
  machine_condition?: string;
  location?: string;
  remarks?: string;
  idempotency_key?: string;
  created_at?: string;
  machine?: Machine;
  client?: CRMClient;
}

export interface OperatorDashboardProps {
  user: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: MachineWithEngineer[];
  dbClients?: CRMClient[];
}

export function OperatorDashboard({
  user,
  assignedMachine,
  recentLogs = [],
  allMachines = [],
  dbClients = [],
}: OperatorDashboardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"entry" | "history">(urlTab === "history" ? "history" : "entry");

  // Interval ticker for real-time validation against current time (e.g. shift conclusion)
  const [currentTick, setCurrentTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (urlTab === "history") {
      setActiveTab("history");
    } else if (urlTab === "entry") {
      setActiveTab("entry");
    }
  }, [urlTab]);

  const handleTabSwitch = (tab: "entry" | "history") => {
    setActiveTab(tab);
    router.push(tab === "history" ? "/operations?tab=history" : "/operations?tab=entry", { scroll: false });
  };

  // Search & Date Filter for Log History Table
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState<string>("all");

  const isLogFromToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr.startsWith(todayStr)) return true;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  // 7-day edit locking window helper (allows editing today + past 7 days)
  const isLogEditable = (dateStr?: string, maxDays = 7) => {
    if (!dateStr) return false;
    const cleanDateStr = dateStr.split("T")[0];
    const parts = cleanDateStr.split("-").map(Number);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
      return diffDays <= maxDays;
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const logDateMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
    return diffDays <= maxDays;
  };

  const filteredLogs = useMemo(() => {
    return recentLogs.filter((log) => {
      // Date / Week / Month / Year Filter
      if (historyDateFilter !== "all" && log.log_date) {
        const now = new Date();
        const logDate = new Date(log.log_date);

        if (historyDateFilter === "today") {
          if (!isLogFromToday(log.log_date)) return false;
        } else if (historyDateFilter === "week") {
          const diffTime = Math.abs(now.getTime() - logDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        } else if (historyDateFilter === "month") {
          if (logDate.getFullYear() !== now.getFullYear() || logDate.getMonth() !== now.getMonth()) {
            return false;
          }
        } else if (historyDateFilter === "year") {
          if (logDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase().trim();
      const mName = log.machine?.machine_name?.toLowerCase() || "";
      const mCode = log.machine?.machine_code?.toLowerCase() || "";
      const mSerial = log.machine?.serial_number?.toLowerCase() || "";
      const mModel = log.machine?.model?.toLowerCase() || "";
      const dateStr = log.log_date ? formatDate(log.log_date).toLowerCase() : "";
      const timestampStr = log.created_at ? formatExactTimestamp(log.created_at, true).toLowerCase() : "";
      const remarksStr = log.remarks?.toLowerCase() || "";
      return (
        mName.includes(q) ||
        mCode.includes(q) ||
        mSerial.includes(q) ||
        mModel.includes(q) ||
        dateStr.includes(q) ||
        timestampStr.includes(q) ||
        remarksStr.includes(q)
      );
    });
  }, [recentLogs, historyDateFilter, historySearch]);

  // PDF Print & Excel Export Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const handleExportPdfClick = () => {
    if (filteredLogs.length === 0) {
      toast("error", "No Logs Available", "There are no machine logs matching current filters to export.");
      return;
    }
    setShowPrintModal(true);
  };

  const handleExportExcelClick = () => {
    if (filteredLogs.length === 0) {
      toast("error", "No Logs Available", "There are no machine logs matching current filters to export.");
      return;
    }
    exportOperatorLogsToExcel(filteredLogs, user, selectedMachine, "all");
    toast("success", "Export Successful", "Operator shift log report downloaded as Excel (.xlsx)");
  };

  // Machine Selection (Pre-filled with assigned machine, fallback to first machine if available)
  const availableMachines = useMemo(() => {
    if (assignedMachine) {
      return [assignedMachine, ...allMachines.filter((m) => m.id !== assignedMachine.id)];
    }
    return allMachines;
  }, [assignedMachine, allMachines]);

  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    assignedMachine?.id || (availableMachines.length > 0 ? availableMachines[0].id : "")
  );

  const selectedMachine = useMemo(
    () => availableMachines.find((m) => m.id === selectedMachineId) || assignedMachine,
    [availableMachines, selectedMachineId, assignedMachine]
  );

  // Helper to find associated client for a machine from direct machine relation, recent logs, or dbClients
  const findClientForMachine = useCallback(
    (mId: string, machineObj?: Machine | null) => {
      if (!mId) return dbClients.length > 0 ? dbClients[0] : null;

      // 1. Check direct client object or client_id attached to machine object
      if (machineObj) {
        if ((machineObj as any).client) {
          return (machineObj as any).client as CRMClient;
        }
        if ((machineObj as any).client_id) {
          const matchedClient = dbClients.find((c) => c.id === (machineObj as any).client_id);
          if (matchedClient) return matchedClient;
        }
      }

      // 2. Look in recent logs for this specific machine
      const logForMachine = recentLogs.find((l) => l.machine_id === mId && (l.client_id || (l as any).client));
      if (logForMachine) {
        if (logForMachine.client_id) {
          const found = dbClients.find((c) => c.id === logForMachine.client_id);
          if (found) return found;
        }
        if ((logForMachine as any).client) {
          return (logForMachine as any).client as CRMClient;
        }
      }

      // 3. Look in any recent logs
      const anyLogWithClient = recentLogs.find((l) => l.client_id || (l as any).client);
      if (anyLogWithClient) {
        if (anyLogWithClient.client_id) {
          const found = dbClients.find((c) => c.id === anyLogWithClient.client_id);
          if (found) return found;
        }
        if ((anyLogWithClient as any).client) {
          return (anyLogWithClient as any).client as CRMClient;
        }
      }

      // 4. Fallback to first client in DB
      return dbClients.length > 0 ? dbClients[0] : null;
    },
    [recentLogs, dbClients]
  );

  // Helper to find associated client location for a machine from recent logs or client record in DB
  const findLocationForMachine = useCallback(
    (mId: string, clientObj?: CRMClient | null) => {
      // 1. Look in recent logs for this specific machine
      if (mId) {
        const logForMachine = recentLogs.find((l) => l.machine_id === mId && l.location && l.location.trim() !== "");
        if (logForMachine?.location) return logForMachine.location;
      }
      // 2. Look in any recent logs with location
      const anyLogWithLocation = recentLogs.find((l) => l.location && l.location.trim() !== "");
      if (anyLogWithLocation?.location) return anyLogWithLocation.location;
      // 3. Client address from DB
      if (clientObj) {
        const formatted = getClientFormattedLocation(clientObj);
        if (formatted) return formatted;
      }
      // 4. Fallback to first client in DB
      if (dbClients.length > 0) {
        const formatted = getClientFormattedLocation(dbClients[0]);
        if (formatted) return formatted;
      }
      return "";
    },
    [recentLogs, dbClients]
  );

  const initialMachineId = assignedMachine?.id || (availableMachines.length > 0 ? availableMachines[0].id : "");
  const initialClient = useMemo(() => {
    return findClientForMachine(initialMachineId, assignedMachine || (availableMachines.length > 0 ? availableMachines[0] : null));
  }, [findClientForMachine, initialMachineId, assignedMachine, availableMachines]);

  const initialLocation = useMemo(() => {
    return findLocationForMachine(initialMachineId, initialClient);
  }, [findLocationForMachine, initialMachineId, initialClient]);

  // Client Selection State & Dropdown
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClient?.id || (dbClients.length > 0 ? dbClients[0].id : "")
  );
  const [clientLocation, setClientLocation] = useState<string>(initialLocation);
  // Selected Client derived object
  const selectedClient = useMemo(
    () => dbClients.find((c) => c.id === selectedClientId) || null,
    [dbClients, selectedClientId]
  );

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const targetClient = dbClients.find((c) => c.id === clientId);
    if (targetClient) {
      const loc = getClientFormattedLocation(targetClient);
      setClientLocation(loc);
    }
  };

  // Helper to fetch the latest ending meter reading recorded for a machine from DB / logs
  const getLatestMeterForMachine = useCallback(
    (mId: string) => {
      if (!mId) return 0;
      // 1. Look for the most recent log recorded for this machine (recentLogs is ordered log_date DESC, created_at DESC)
      const logForMachine = recentLogs.find(
        (l) => l.machine_id === mId && l.end_meter !== undefined && l.end_meter !== null
      );
      if (logForMachine && typeof logForMachine.end_meter === "number") {
        return logForMachine.end_meter;
      }
      // 2. Fall back to current machine hour_meter stored in database
      const machine = availableMachines.find((m) => m.id === mId) || assignedMachine;
      return machine?.hour_meter ?? 0;
    },
    [recentLogs, availableMachines, assignedMachine]
  );

  const initialMeter = getLatestMeterForMachine(
    assignedMachine?.id || (availableMachines.length > 0 ? availableMachines[0].id : "")
  );

  // Daily Machine Log Form State
  const [selectedLogDate, setSelectedLogDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [machineName, setMachineName] = useState<string>(selectedMachine?.machine_name || "");
  const [machineNo, setMachineNo] = useState<string>(selectedMachine?.machine_code || "");
  const [model, setModel] = useState<string>(selectedMachine?.model || "");
  const [startMeter, setStartMeter] = useState<string>(String(initialMeter));
  const [endMeter, setEndMeter] = useState<string>(String(initialMeter));
  const [startTime, setStartTime] = useState<string>("06:00 AM");
  const [endTime, setEndTime] = useState<string>("02:00 PM");
  const [overtimeHours, setOvertimeHours] = useState<string>("0");
  const [isManualOvertime, setIsManualOvertime] = useState<boolean>(false);
  const [isBreakdown, setIsBreakdown] = useState<boolean>(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState<string>("02:30 PM");
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>("03:25 PM");
  const [breakdownHours, setBreakdownHours] = useState<string>("0");
  const [breakdownMinutes, setBreakdownMinutes] = useState<string>("0");
  const [breakdownReason, setBreakdownReason] = useState<string>("");
  const [actionTaken, setActionTaken] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Submit Confirmation Dialog Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Edit Modal State for Log Correction
  const [editingLog, setEditingLog] = useState<OperatorHourLog | null>(null);
  const [editStartMeter, setEditStartMeter] = useState<string>("0");
  const [editEndMeter, setEditEndMeter] = useState<string>("0");
  const [editLogDate, setEditLogDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("");
  const [editOvertime, setEditOvertime] = useState<string>("0");
  const [editBreakdown, setEditBreakdown] = useState<boolean>(false);
  const [editBreakdownStartTime, setEditBreakdownStartTime] = useState<string>("02:30 PM");
  const [editBreakdownEndTime, setEditBreakdownEndTime] = useState<string>("03:25 PM");
  const [editBreakdownHours, setEditBreakdownHours] = useState<string>("0");
  const [editBreakdownMinutes, setEditBreakdownMinutes] = useState<string>("0");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [updatingLog, setUpdatingLog] = useState(false);

  // Close editing log modal on Escape key
  useEffect(() => {
    if (!editingLog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingLog(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingLog]);

  // Real-time breakdown duration computation
  const breakdownStats = useMemo(() => {
    if (!isBreakdown) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  const editBreakdownStats = useMemo(() => {
    if (!editBreakdown) return null;
    return computeBreakdownDuration(editBreakdownStartTime, editBreakdownEndTime);
  }, [editBreakdown, editBreakdownStartTime, editBreakdownEndTime]);

  // Real-time operating duration, normal working hours & overtime calculation
  const operatingStats = useMemo(() => {
    const ot = parseFloat(overtimeHours);
    return computeShiftTiming({
      logDate: selectedLogDate,
      startTime,
      endTime,
      manualOvertime: isNaN(ot) ? undefined : ot,
      disallowFutureEnd: true,
      currentTimestamp: currentTick,
    });
  }, [selectedLogDate, startTime, endTime, overtimeHours, currentTick]);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const stats = computeShiftTiming({
      logDate: selectedLogDate,
      startTime: val,
      endTime,
      disallowFutureEnd: true,
      currentTimestamp: currentTick,
    });
    if (stats.isValid && !isManualOvertime) {
      setOvertimeHours(String(stats.overtimeHours));
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    const stats = computeShiftTiming({
      logDate: selectedLogDate,
      startTime,
      endTime: val,
      disallowFutureEnd: true,
      currentTimestamp: currentTick,
    });
    if (stats.isValid && !isManualOvertime) {
      setOvertimeHours(String(stats.overtimeHours));
    }
  };

  // Real-time meter running hours & meter validation calculation
  const meterRunningHours = useMemo(() => {
    const s = parseFloat(startMeter);
    const e = parseFloat(endMeter);
    if (isNaN(s) || isNaN(e)) return 0;
    const diff = e - s;
    return diff > 0 ? Math.round(diff * 10) / 10 : 0;
  }, [startMeter, endMeter]);

  const meterValidationWarning = useMemo(() => {
    const s = parseFloat(startMeter);
    const e = parseFloat(endMeter);
    if (!isNaN(s) && !isNaN(e) && e < s) {
      return "End meter cannot be less than start meter.";
    }
    return null;
  }, [startMeter, endMeter]);

  // Update machine details & auto-fetch latest starting meter reading & client when selection changes
  const handleSelectMachine = (mId: string, machineObj?: any) => {
    setSelectedMachineId(mId);
    const target = machineObj || availableMachines.find((m) => m.id === mId);
    if (target) {
      setMachineName(target.machine_name || "");
      setMachineNo(target.machine_code || "");
      setModel(target.model || "");
      const latestMtr = getLatestMeterForMachine(mId);
      setStartMeter(String(latestMtr));
      setEndMeter(String(latestMtr));

      // Auto-detect and pre-fill client & location from database
      const autoClient = findClientForMachine(mId, target);
      if (autoClient) {
        setSelectedClientId(autoClient.id);
        const loc = findLocationForMachine(mId, autoClient);
        setClientLocation(loc);
      } else {
        const loc = findLocationForMachine(mId, null);
        setClientLocation(loc);
      }
    }
  };

  // Auto-fetch client & location from database whenever selected machine changes
  useEffect(() => {
    if (!selectedMachineId) return;
    const targetMachine = availableMachines.find((m) => m.id === selectedMachineId) || assignedMachine;
    const autoClient = findClientForMachine(selectedMachineId, targetMachine);

    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedMachineId === selectedMachineId && parsed.selectedClientId) {
          setSelectedClientId(parsed.selectedClientId);
          if (parsed.clientLocation && parsed.clientLocation.trim() !== "") {
            setClientLocation(parsed.clientLocation);
            return;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    if (autoClient) {
      setSelectedClientId(autoClient.id);
      const loc = findLocationForMachine(selectedMachineId, autoClient);
      setClientLocation(loc);
    } else {
      const loc = findLocationForMachine(selectedMachineId, null);
      setClientLocation(loc);
    }
  }, [selectedMachineId, availableMachines, assignedMachine, findClientForMachine, findLocationForMachine]);

  // Auto-fetch and update starting meter reading from database whenever selected machine or recent logs change
  useEffect(() => {
    if (!selectedMachineId) return;
    const latestMeter = getLatestMeterForMachine(selectedMachineId);
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.selectedMachineId === selectedMachineId &&
          parsed.startMeter !== undefined &&
          parsed.startMeter !== "" &&
          parsed.startMeter !== "0"
        ) {
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    setStartMeter(String(latestMeter));
    setEndMeter(String(latestMeter));
  }, [selectedMachineId, getLatestMeterForMachine]);

  // Machine Timeline: Finds the latest log recorded on this machine and its end time
  const machineTimeline = useMemo(() => {
    if (!selectedMachineId) return null;
    return findLatestMachineLogTimeline(recentLogs, selectedMachineId);
  }, [recentLogs, selectedMachineId]);

  // Real-time sequencing check: New log must start at or after previous log's end time
  const sequencingValidation = useMemo(() => {
    if (!machineTimeline || !machineTimeline.endDateTime || !operatingStats.isValid || !operatingStats.startDateTime) {
      return null;
    }

    const prevEndMs = machineTimeline.endDateTime.getTime();
    const currentStartMs = operatingStats.startDateTime.getTime();

    if (currentStartMs < prevEndMs) {
      return {
        isInvalid: true,
        message: `Start (${formatTo12Hour(startTime)}) cannot precede prev shift end (${machineTimeline.formattedEndDate}, ${machineTimeline.formattedEndTime}).`,
        recommendedStartTime: machineTimeline.formattedEndTime,
        recommendedStartDate: machineTimeline.latestLog?.end_date || machineTimeline.latestLog?.log_date || selectedLogDate,
      };
    }

    return null;
  }, [machineTimeline, operatingStats.isValid, operatingStats.startDateTime, operatingStats.resolvedStartDate, startTime, selectedLogDate]);

  // Client-side real-time shift time interval overlap validation
  const shiftOverlapWarning = useMemo(() => {
    if (!selectedMachineId || recentLogs.length === 0 || !operatingStats.isValid || !operatingStats.startDateTime || !operatingStats.endDateTime) {
      return null;
    }

    const currentStart = operatingStats.startDateTime;
    const currentEnd = operatingStats.endDateTime;

    const machineLogs = recentLogs.filter((l) => l.machine_id === selectedMachineId);

    for (const log of machineLogs) {
      let exStart: Date | null = null;
      let exEnd: Date | null = null;
      let exRangeFormatted = "";

      if (log.start_datetime && log.end_datetime) {
        exStart = new Date(log.start_datetime);
        exEnd = new Date(log.end_datetime);
        exRangeFormatted = `${formatDate(log.log_date)} ${formatTo12Hour(log.start_time)} → ${formatDate(log.end_date || log.log_date)} ${formatTo12Hour(log.end_time)}`;
      } else if (log.log_date && log.start_time && log.end_time) {
        const exTiming = computeShiftTiming({
          startDate: log.log_date,
          startTime: log.start_time,
          endDate: log.end_date,
          endTime: log.end_time,
        });
        exStart = exTiming.startDateTime;
        exEnd = exTiming.endDateTime;
        exRangeFormatted = exTiming.resolvedRangeFormatted;
      }

      if (exStart && exEnd && !isNaN(exStart.getTime()) && !isNaN(exEnd.getTime())) {
        if (checkIntervalOverlap(currentStart, currentEnd, exStart, exEnd)) {
          return `Shift overlaps with existing log (${exRangeFormatted}) on this machine.`;
        }
      }
    }

    return null;
  }, [selectedMachineId, recentLogs, operatingStats.isValid, operatingStats.startDateTime, operatingStats.endDateTime, operatingStats.resolvedRangeFormatted]);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedMachineId && availableMachines.some((m) => m.id === parsed.selectedMachineId)) {
          setSelectedMachineId(parsed.selectedMachineId);
          const target = availableMachines.find((m) => m.id === parsed.selectedMachineId);
          if (target) {
            setMachineName(target.machine_name || "");
            setMachineNo(target.machine_code || "");
            setModel(target.model || "");
          }
        }
        if (parsed.selectedClientId) setSelectedClientId(parsed.selectedClientId);
        if (parsed.selectedLogDate) {
          setSelectedLogDate(parsed.selectedLogDate);
        }
        if (parsed.clientLocation && parsed.clientLocation.trim() !== "") setClientLocation(parsed.clientLocation);
        if (parsed.startMeter !== undefined) setStartMeter(parsed.startMeter);
        if (parsed.endMeter !== undefined) setEndMeter(parsed.endMeter);
        if (parsed.startTime) setStartTime(parsed.startTime);
        if (parsed.endTime) setEndTime(parsed.endTime);
        if (parsed.overtimeHours !== undefined) {
          setOvertimeHours(parsed.overtimeHours);
          setIsManualOvertime(true);
        }
        if (parsed.isBreakdown !== undefined) setIsBreakdown(parsed.isBreakdown);
        if (parsed.breakdownHours !== undefined) setBreakdownHours(parsed.breakdownHours);
        if (parsed.breakdownMinutes !== undefined) setBreakdownMinutes(parsed.breakdownMinutes);
        if (parsed.breakdownReason !== undefined) setBreakdownReason(parsed.breakdownReason);
        if (parsed.actionTaken !== undefined) setActionTaken(parsed.actionTaken);
        if (parsed.remarks !== undefined) setRemarks(parsed.remarks);
        if (parsed.updatedAt) {
          const d = new Date(parsed.updatedAt);
          setLastSavedTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }, [availableMachines]);

  // Auto-save draft to localStorage on change
  useEffect(() => {
    if (activeTab !== "entry") return;
    const draft = {
      selectedMachineId,
      selectedClientId,
      selectedLogDate,
      clientLocation,
      startMeter,
      endMeter,
      startTime,
      endTime,
      overtimeHours,
      isBreakdown,
      breakdownHours,
      breakdownMinutes,
      breakdownReason,
      actionTaken,
      remarks,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      // Ignore storage errors
    }
  }, [
    selectedMachineId,
    selectedClientId,
    selectedLogDate,
    clientLocation,
    startMeter,
    endMeter,
    startTime,
    endTime,
    overtimeHours,
    isBreakdown,
    breakdownHours,
    breakdownMinutes,
    breakdownReason,
    actionTaken,
    remarks,
    activeTab,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setLastSavedTime(null);
    } catch (e) {
      // Ignore
    }
  };

  const handleSaveDraft = () => {
    const draft = {
      selectedMachineId,
      selectedClientId,
      selectedLogDate,
      clientLocation,
      startMeter,
      endMeter,
      startTime,
      endTime,
      overtimeHours,
      isBreakdown,
      breakdownHours,
      breakdownMinutes,
      breakdownReason,
      actionTaken,
      remarks,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      toast("success", "Draft Saved", "Your machine log draft was saved locally.");
    } catch (e) {
      toast("error", "Save Failed", "Could not save draft locally.");
    }
  };

  // Completion status calculation
  const completionStatus = useMemo(() => {
    let completed = 0;
    if (selectedMachineId) completed++;
    if (operatingStats.isValid && !shiftOverlapWarning && !sequencingValidation?.isInvalid && !meterValidationWarning) completed++;
    if (!isBreakdown) {
      completed++;
    } else {
      if (breakdownStats?.isValid) {
        completed++;
      }
    }
    completed++; // Status ready

    const isReady =
      completed >= 4 &&
      operatingStats.isValid &&
      !shiftOverlapWarning &&
      !sequencingValidation?.isInvalid &&
      !meterValidationWarning &&
      !!selectedMachineId &&
      (!isBreakdown || !!breakdownStats?.isValid);
    return { completed, total: 4, isReady };
  }, [
    selectedMachineId,
    operatingStats.isValid,
    shiftOverlapWarning,
    sequencingValidation,
    meterValidationWarning,
    isBreakdown,
    breakdownStats,
  ]);

  // Trigger submission check (opens confirmation modal if valid)
  const handleOpenSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMachineId) {
      toast("error", "No Machine Selected", "Please select a valid machine before submitting daily log.");
      return;
    }

    if (meterValidationWarning) {
      toast("error", "Invalid Meter Reading", meterValidationWarning);
      return;
    }

    if (operatingStats.isFutureEnd || !operatingStats.isValid) {
      toast("error", operatingStats.isFutureEnd ? "Shift In Progress" : "Invalid Operating Hours", operatingStats.errorMessage || "Cannot log before shift end.");
      return;
    }

    if (sequencingValidation?.isInvalid) {
      toast("error", "Shift Sequencing Error", sequencingValidation.message);
      return;
    }

    if (shiftOverlapWarning) {
      toast("error", "Shift Time Overlap Error", shiftOverlapWarning);
      return;
    }

    if (isBreakdown) {
      if (!breakdownStats?.isValid) {
        toast("error", "Invalid Breakdown Time", breakdownStats?.errorMessage || "Please enter valid breakdown start and end times.");
        return;
      }
    }

    setShowConfirmModal(true);
  };

  // Final Submit Action to Server / Database
  const handleExecuteSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setMessage(null);

    try {
      const overtimeNum = parseFloat(overtimeHours) || 0;
      const startMtrNum = parseFloat(startMeter) || 0;
      const endMtrNum = parseFloat(endMeter) || startMtrNum;

      const bkdDurationStr = isBreakdown && breakdownStats?.isValid ? breakdownStats.fullBreakdownString : undefined;
      const bkdDecimalHours = isBreakdown && breakdownStats?.isValid ? breakdownStats.durationDecimalHours : 0;
      const bkdStart = isBreakdown && breakdownStats?.isValid ? breakdownStartTime : undefined;
      const bkdEnd = isBreakdown && breakdownStats?.isValid ? breakdownEndTime : undefined;

      // Build breakdown details string
      let finalRemarks = remarks.trim();
      if (isBreakdown && bkdDurationStr) {
        const bkdDetails = `[Breakdown Duration: ${bkdDurationStr}]`;
        if (!finalRemarks.includes("[Breakdown Duration:")) {
          finalRemarks = finalRemarks ? `${bkdDetails} ${finalRemarks}` : bkdDetails;
        }
      }

      const idempotencyKey = typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : undefined;

      const res = await submitOperatorHourLogAction({
        machineId: selectedMachineId,
        clientId: selectedClientId || undefined,
        startDate: operatingStats.resolvedStartDate,
        logDate: operatingStats.resolvedStartDate,
        endDate: operatingStats.resolvedEndDate,
        location: clientLocation.trim() || undefined,
        startMeter: startMtrNum,
        endMeter: endMtrNum,
        startTime,
        endTime,
        overtimeHours: overtimeNum,
        isBreakdown,
        breakdownStartTime: bkdStart,
        breakdownEndTime: bkdEnd,
        breakdownDuration: bkdDurationStr,
        breakdownHours: bkdDecimalHours,
        machineCondition: isBreakdown ? "breakdown" : "good",
        remarks: finalRemarks,
        idempotencyKey,
      });

      if (res.success) {
        toast("success", "Daily Machine Log Submitted", "Your daily log entry has been recorded directly in the database.");
        setMessage({ type: "success", text: "Daily machine log submitted and stored directly in database successfully." });
        setRemarks("");
        setIsBreakdown(false);
        setBreakdownStartTime("02:30 PM");
        setBreakdownEndTime("03:25 PM");
        setBreakdownHours("0");
        setBreakdownMinutes("0");
        setBreakdownReason("");
        setActionTaken("");
        setOvertimeHours("0");
        setIsManualOvertime(false);
        setStartMeter(String(endMtrNum));
        setEndMeter(String(endMtrNum));
        clearDraft();
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to submit daily machine log." });
        toast("error", "Submission Failed", res.error || "Could not submit daily machine log.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit daily machine log.";
      setMessage({ type: "error", text: msg });
      toast("error", "Submission Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Real-time operating duration, normal working hours & overtime calculation for Edit Modal
  const editOperatingStats = useMemo(() => {
    const ot = parseFloat(editOvertime);
    return computeShiftTiming({
      logDate: editLogDate,
      startTime: editStartTime,
      endTime: editEndTime,
      manualOvertime: isNaN(ot) ? undefined : ot,
      disallowFutureEnd: true,
      currentTimestamp: currentTick,
    });
  }, [editLogDate, editStartTime, editEndTime, editOvertime, currentTick]);

  // Edit Modal Overlap Check against other logs for this machine
  const editShiftOverlapWarning = useMemo(() => {
    if (!editingLog || !editOperatingStats.isValid || !editOperatingStats.startDateTime || !editOperatingStats.endDateTime) {
      return null;
    }
    const currentStart = editOperatingStats.startDateTime;
    const currentEnd = editOperatingStats.endDateTime;
    const machineLogs = recentLogs.filter((l) => l.machine_id === editingLog.machine_id && l.id !== editingLog.id);

    for (const log of machineLogs) {
      let exStart: Date | null = null;
      let exEnd: Date | null = null;
      let exRangeFormatted = "";
      if (log.start_datetime && log.end_datetime) {
        exStart = new Date(log.start_datetime);
        exEnd = new Date(log.end_datetime);
        exRangeFormatted = `${formatDate(log.log_date)} ${formatTo12Hour(log.start_time)} → ${formatDate(log.end_date || log.log_date)} ${formatTo12Hour(log.end_time)}`;
      } else if (log.log_date && log.start_time && log.end_time) {
        const exTiming = computeShiftTiming({
          startDate: log.log_date,
          startTime: log.start_time,
          endDate: log.end_date,
          endTime: log.end_time,
        });
        exStart = exTiming.startDateTime;
        exEnd = exTiming.endDateTime;
        exRangeFormatted = exTiming.resolvedRangeFormatted;
      }

      if (exStart && exEnd && !isNaN(exStart.getTime()) && !isNaN(exEnd.getTime())) {
        if (checkIntervalOverlap(currentStart, currentEnd, exStart, exEnd)) {
          return `Time overlap detected: The modified shift (${editOperatingStats.resolvedRangeFormatted}) overlaps with an existing log (${exRangeFormatted}) on this machine.`;
        }
      }
    }
    return null;
  }, [editingLog, editOperatingStats.isValid, editOperatingStats.startDateTime, editOperatingStats.endDateTime, editOperatingStats.resolvedRangeFormatted, recentLogs]);

  // Open Edit Modal for a Log
  const handleOpenEditLog = (log: OperatorHourLog) => {
    setEditingLog(log);
    setEditStartMeter(String(log.start_meter ?? 0));
    setEditEndMeter(String(log.end_meter ?? log.start_meter ?? 0));
    const rawLogDate = log.log_date ? log.log_date.split("T")[0] : selectedLogDate;
    const sTime = formatTo12Hour(log.start_time) || "06:00 AM";
    const eTime = formatTo12Hour(log.end_time) || "02:00 PM";
    setEditLogDate(rawLogDate);
    setEditStartTime(sTime);
    setEditEndTime(eTime);
    setEditOvertime(String(log.overtime_hours ?? 0));

    const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
    setEditBreakdown(isBkd);

    let rawRemarks = log.remarks || "";
    const bkdParsed = parseBreakdownString(log.breakdown_duration || rawRemarks);
    if (bkdParsed?.startTime && bkdParsed?.endTime) {
      setEditBreakdownStartTime(bkdParsed.startTime);
      setEditBreakdownEndTime(bkdParsed.endTime);
    } else if (log.breakdown_start_time && log.breakdown_end_time) {
      setEditBreakdownStartTime(formatTo12Hour(log.breakdown_start_time) || "02:30 PM");
      setEditBreakdownEndTime(formatTo12Hour(log.breakdown_end_time) || "03:25 PM");
    } else {
      setEditBreakdownStartTime("02:30 PM");
      setEditBreakdownEndTime("03:25 PM");
    }
    rawRemarks = rawRemarks.replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim();
    setEditRemarks(rawRemarks);
  };

  // Submit Correction for Log
  const handleResubmitLogCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    if (editOperatingStats.isFutureEnd || !editOperatingStats.isValid) {
      toast("error", editOperatingStats.isFutureEnd ? "Shift In Progress" : "Invalid Shift Timings", editOperatingStats.errorMessage || "Cannot log before shift end.");
      return;
    }

    if (editShiftOverlapWarning) {
      toast("error", "Shift Overlap Error", editShiftOverlapWarning);
      return;
    }

    if (editBreakdown && !editBreakdownStats?.isValid) {
      toast("error", "Invalid Breakdown Timings", editBreakdownStats?.errorMessage || "Please verify breakdown start and end times.");
      return;
    }

    setUpdatingLog(true);

    const startMtrNum = parseFloat(editStartMeter) || 0;
    const endMtrNum = parseFloat(editEndMeter) || startMtrNum;

    if (endMtrNum < startMtrNum) {
      setUpdatingLog(false);
      toast("error", "Invalid Meter Reading", "Ending hour meter reading cannot be less than starting hour meter reading.");
      return;
    }

    const bkdDurationStr = editBreakdown && editBreakdownStats?.isValid ? editBreakdownStats.fullBreakdownString : undefined;
    const bkdDecimalHours = editBreakdown && editBreakdownStats?.isValid ? editBreakdownStats.durationDecimalHours : 0;
    const bkdStart = editBreakdown && editBreakdownStats?.isValid ? editBreakdownStartTime : undefined;
    const bkdEnd = editBreakdown && editBreakdownStats?.isValid ? editBreakdownEndTime : undefined;

    let finalRemarks = editRemarks.trim();
    if (editBreakdown && bkdDurationStr) {
      const durationStr = `[Breakdown Duration: ${bkdDurationStr}]`;
      if (!finalRemarks.includes("[Breakdown Duration:")) {
        finalRemarks = finalRemarks ? `${durationStr} ${finalRemarks}` : durationStr;
      }
    } else if (!editBreakdown) {
      finalRemarks = finalRemarks.replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim();
    }

    const res = await updateOperatorHourLogAction({
      logId: editingLog.id,
      clientId: selectedClientId || undefined,
      location: clientLocation.trim() || undefined,
      startDate: editOperatingStats.resolvedStartDate,
      endDate: editOperatingStats.resolvedEndDate,
      startMeter: startMtrNum,
      endMeter: endMtrNum,
      startTime: editStartTime,
      endTime: editEndTime,
      overtimeHours: parseFloat(editOvertime) || 0,
      isBreakdown: editBreakdown,
      breakdownStartTime: bkdStart,
      breakdownEndTime: bkdEnd,
      breakdownDuration: bkdDurationStr,
      breakdownHours: bkdDecimalHours,
      machineCondition: editBreakdown ? "breakdown" : "good",
      remarks: finalRemarks,
    });

    setUpdatingLog(false);
    if (res.success) {
      toast("success", "Log Resubmitted", "Your updated daily machine log has been resubmitted.");
      setEditingLog(null);
      router.refresh();
    } else {
      toast("error", "Update Failed", res.error || "Could not update daily log.");
    }
  };

  const todayFormattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full space-y-3 sm:space-y-6">
      {/* ============================================ */}
      {/* 1. HEADER BANNER                             */}
      {/* ============================================ */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-6 shadow-sm">
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base sm:text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">
                Welcome, {user.full_name || "Operator"}
              </h1>
            </div>
          </div>

          <div className="flex items-center px-2.5 py-1 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs sm:text-base font-extrabold text-[var(--color-ink)] shadow-2xs self-auto">
            <span className="font-mono tracking-tight">
              {formatDate(new Date())}
            </span>
          </div>
        </div>

        {/* Operational Subnav Tab Switcher Controls (Mobile, Tablet & Desktop) */}
        <div className="pt-3 border-t border-[var(--color-hairline)] mt-3 sm:mt-4">
          <SegmentedToggle<"entry" | "history">
            value={activeTab}
            onChange={handleTabSwitch}
            layoutIdPrefix="operator-dashboard-tab"
            items={[
              {
                id: "entry",
                label: "Log Entry",
                icon: <AnimatedGauge size={16} />,
              },
              {
                id: "history",
                label: "Log History",
                icon: <AnimatedClock size={16} />,
                count: recentLogs.length,
              },
            ]}
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* 2. DAILY MACHINE LOG ENTRY FORM              */}
      {/* (Rendered ONLY when activeTab === "entry")   */}
      {/* ============================================ */}
      {activeTab === "entry" && (
        <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-6 shadow-md space-y-3 sm:space-y-6 animate-in fade-in duration-200">
          {/* Form Header Context Bar */}
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2.5 sm:pb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-[var(--color-ink)]">
              Daily Machine Log
            </h2>
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
              }`}
            >
              {message.type === "success" ? <AnimatedCheckCircle size={16} /> : <AnimatedAlertTriangle size={16} />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleOpenSubmitModal} className="space-y-3 sm:space-y-6">
            {/* ============================================ */}
            {/* SECTION A: MACHINE & CLIENT DETAILS          */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-3 sm:space-y-4">
              {/* SELECT MACHINE & CLIENT NAME */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                {/* Select Machine - Primary Custom Searchable Dropdown */}
                <div>
                  <MachineSelect
                    label="Select Machine"
                    required
                    machines={availableMachines}
                    value={selectedMachineId}
                    onChange={handleSelectMachine}
                    placeholder="Search or select machine..."
                  />
                </div>

                {/* Client Name - Searchable Dropdown */}
                <div>
                  <ClientSelect
                    label="Client Name"
                    required
                    clients={dbClients}
                    value={selectedClientId}
                    onChange={handleSelectClient}
                    placeholder="Search or select client..."
                  />
                </div>
              </div>
            </div>

            {/* ============================================ */}
            {/* SECTION B: OPERATING HOURS & HOUR METER       */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-3 sm:space-y-4">
              {/* 1. Hour Meter Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                    Hour Meter (HMR)
                  </span>
                  {meterRunningHours > 0 && (
                    <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                      Running: {meterRunningHours.toFixed(1)} hrs
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  {/* Starting Hour Meter Reading */}
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1 truncate">
                      Starting Meter (hrs) <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      required
                      value={startMeter}
                      onChange={(e) => setStartMeter(e.target.value)}
                      onPaste={(e) =>
                        handleClipboardPaste({
                          event: e,
                          schema: HmrSchema as any,
                          onSuccess: (val) => setStartMeter(String(val)),
                          onError: (msg) => toast("error", "Validation Error", msg),
                        })
                      }
                      placeholder="e.g. 1250.0"
                      className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[42px]"
                    />
                  </div>

                  {/* Ending Hour Meter Reading */}
                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1 truncate">
                      Ending Meter (hrs) <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      required
                      value={endMeter}
                      onChange={(e) => setEndMeter(e.target.value)}
                      onPaste={(e) =>
                        handleClipboardPaste({
                          event: e,
                          schema: HmrSchema as any,
                          onSuccess: (val) => setEndMeter(String(val)),
                          onError: (msg) => toast("error", "Validation Error", msg),
                        })
                      }
                      placeholder="e.g. 1258.0"
                      className="w-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[42px]"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Shift Timing Section */}
              <div className="pt-3 border-t border-[var(--color-hairline)]/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider block">
                    Shift Timing
                  </span>
                  {operatingStats.isValid ? (
                    operatingStats.isOvernight && (
                      <span className="text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono inline-flex items-center gap-1">
                        🌙 Overnight · {operatingStats.durationFormatted}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] sm:text-[11px] text-rose-500 font-semibold">
                      {operatingStats.errorMessage || "Enter shift times"}
                    </span>
                  )}
                </div>

                {/* Machine Timeline Context Banner */}
                {machineTimeline?.latestLog && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] sm:text-xs text-sky-700 dark:text-sky-300">
                    <Clock size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>
                      <strong className="font-bold">Handover from</strong>{" "}
                      <span className="font-mono font-semibold">{machineTimeline.formattedEndDate}, {machineTimeline.formattedEndTime}</span>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3.5 items-start">
                  {/* Log Date */}
                  <div className="col-span-2 sm:col-span-1 xl:col-span-1 order-1 min-w-0">
                    <CustomDatePicker
                      label={
                        <span>
                          Log Date <span className="text-rose-500 font-bold ml-0.5">*</span>
                        </span>
                      }
                      required
                      value={selectedLogDate}
                      onChange={(val) => setSelectedLogDate(val)}
                      maxDaysOld={7}
                    />
                  </div>

                  {/* Start Time */}
                  <div className="col-span-1 order-2 sm:order-3 xl:order-2 min-w-0">
                    <CustomTimePicker
                      label="Start Time"
                      required
                      value={startTime}
                      onChange={handleStartTimeChange}
                      iconColor="text-emerald-500"
                    />
                  </div>

                  {/* End Time */}
                  <div className="col-span-1 order-3 sm:order-4 xl:order-3 min-w-0">
                    <CustomTimePicker
                      label="End Time"
                      required
                      value={endTime}
                      onChange={handleEndTimeChange}
                      iconColor="text-rose-500"
                      error={operatingStats.isFutureEnd ? "Cannot log before shift end." : undefined}
                    />
                  </div>

                  {/* Overtime (Hours) */}
                  <div className="col-span-2 sm:col-span-1 xl:col-span-1 order-4 sm:order-2 xl:order-4 min-w-0">
                    <label className="block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1 truncate">
                      Overtime (hrs)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={overtimeHours}
                      onChange={(e) => {
                        setOvertimeHours(e.target.value);
                        setIsManualOvertime(true);
                      }}
                      onPaste={(e) =>
                        handleClipboardPaste({
                          event: e,
                          schema: HmrSchema as any,
                          onSuccess: (val) => {
                            setOvertimeHours(String(val));
                            setIsManualOvertime(true);
                          },
                          onError: (msg) => toast("error", "Validation Error", msg),
                        })
                      }
                      placeholder="e.g. 0.0"
                      className="w-full px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs sm:text-sm font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[38px] sm:min-h-[42px] h-9 sm:h-[42px]"
                    />
                  </div>
                </div>

                {/* Validation & Warning Strip */}
                {meterValidationWarning ? (
                  <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={15} className="shrink-0 text-rose-500" />
                    <span>{meterValidationWarning}</span>
                  </div>
                ) : sequencingValidation?.isInvalid ? (
                  <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AnimatedAlertTriangle size={15} className="shrink-0 text-rose-500" />
                      <span className="truncate">{sequencingValidation.message}</span>
                    </div>
                    {sequencingValidation.recommendedStartTime && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime(sequencingValidation.recommendedStartTime!);
                          if (sequencingValidation.recommendedStartDate) {
                            setSelectedLogDate(sequencingValidation.recommendedStartDate);
                          }
                        }}
                        className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] sm:text-[11px] font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto whitespace-nowrap"
                      >
                        <span className="sm:hidden">Align to {sequencingValidation.recommendedStartTime}</span>
                        <span className="hidden sm:inline">Align Start to {sequencingValidation.recommendedStartTime} (Handover)</span>
                      </button>
                    )}
                  </div>
                ) : shiftOverlapWarning ? (
                  <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={15} className="shrink-0 text-rose-500" />
                    <span>{shiftOverlapWarning}</span>
                  </div>
                ) : !operatingStats.isValid ? (
                  <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={15} className="shrink-0 text-rose-500" />
                    <span>{operatingStats.errorMessage}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ============================================ */}
            {/* SECTION C: MACHINE STATUS                    */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-2.5 sm:space-y-4">
              {/* Segmented Control Switcher */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsBreakdown(false)}
                  className={`py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-h-[38px] sm:min-h-[42px] ${
                    !isBreakdown
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <CheckCircle2 size={15} /> Normal
                </button>

                <button
                  type="button"
                  onClick={() => setIsBreakdown(true)}
                  className={`py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-h-[38px] sm:min-h-[42px] ${
                    isBreakdown
                      ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20 shadow-2xs"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <AnimatedAlertTriangle size={15} /> <span className="hidden xs:inline">Machine </span>Breakdown
                </button>
              </div>

              {/* Progressive Disclosure Breakdown Details Container */}
              {isBreakdown && (
                <div className="p-3 sm:p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                  {/* Breakdown Start & End Time Pickers (Single row on mobile) */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 items-start">
                    <div className="min-w-0">
                      <CustomTimePicker
                        label={<><span className="hidden sm:inline">Breakdown </span>Start Time</>}
                        required
                        value={breakdownStartTime}
                        onChange={setBreakdownStartTime}
                        iconColor="text-amber-500"
                      />
                    </div>
                    <div className="min-w-0">
                      <CustomTimePicker
                        label={<><span className="hidden sm:inline">Breakdown </span>End Time</>}
                        required
                        value={breakdownEndTime}
                        onChange={setBreakdownEndTime}
                        iconColor="text-rose-500"
                      />
                    </div>
                  </div>

                  {/* Real-time Computed Breakdown Duration Badge */}
                  {breakdownStats && (
                    <div className={`p-2 sm:p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 text-xs min-w-0 ${
                      breakdownStats.isValid
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                    }`}>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        <span className="font-semibold truncate text-[11px] sm:text-xs">
                          {breakdownStats.isValid ? (
                            <>
                              <span className="hidden sm:inline">Calculated Breakdown Duration:</span>
                              <span className="sm:hidden">Duration:</span>
                            </>
                          ) : "Breakdown Timing Notice:"}
                        </span>
                        <span className="font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-200 text-[11px] sm:text-xs shrink-0">
                          {breakdownStats.isValid ? breakdownStats.durationFormatted : "Invalid"}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] sm:text-[11px] font-bold opacity-90 truncate sm:shrink-0">
                        {breakdownStats.isValid ? (
                          <>
                            <span className="sm:hidden">{formatTo12Hour(breakdownStartTime)} - {formatTo12Hour(breakdownEndTime)}</span>
                            <span className="hidden sm:inline">{breakdownStats.fullBreakdownString}</span>
                          </>
                        ) : breakdownStats.errorMessage}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ============================================ */}
            {/* SECTION D: REMARKS / OBSERVATIONS            */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-2">
              <label className="block text-xs font-bold text-[var(--color-ink)]">
                Remarks / Observations (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any important observation, fuel refill note, minor defect, or site remark..."
                className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {/* ============================================ */}
            {/* SUBMISSION FOOTER ACTIONS & DRAFT STATUS    */}
            {/* ============================================ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pt-2 border-t border-[var(--color-hairline)]">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-[var(--color-mute)]">
                {lastSavedTime ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Draft saved at {lastSavedTime}
                  </span>
                ) : (
                  <span className="font-medium">Form automatically saves draft locally</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={submitting}
                  onClick={handleSaveDraft}
                  className="flex-1 sm:flex-none h-11 sm:h-12 px-4 sm:px-5 font-bold"
                >
                  Save Draft
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={!completionStatus.isReady}
                  className="flex-1 sm:flex-none h-11 sm:h-12 px-5 sm:px-6 font-bold"
                >
                  Submit
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ============================================ */}
      {/* 3. SUBMITTED DAILY LOGS HISTORY TABLE         */}
      {/* (Rendered ONLY when activeTab === "history") */}
      {/* ============================================ */}
      {activeTab === "history" && (
        <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-6 shadow-md space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
          {/* Section Header & Top Actions */}
          <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 border-b border-[var(--color-hairline)] pb-3 sm:pb-4">
            <div>
              <h2 className="text-base sm:text-xl font-extrabold text-[var(--color-ink)] tracking-tight">
                Logs History
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcelClick}
                className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Export filtered machine logs to Excel (.xlsx)"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdfClick}
                className="px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Print or Save PDF report with Company and Operator details"
              >
                <Printer className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span className="hidden sm:inline">PDF / Print</span>
              </button>
            </div>
          </div>

          {/* Search & Date Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-canvas)]/60 p-2.5 rounded-xl border border-[var(--color-hairline)]">
            {/* Search Input Box */}
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)]" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history by machine name, code, date, remarks..."
                className="w-full pl-9 pr-8 py-1.5 bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] rounded-lg border border-[var(--color-hairline)] focus:outline-none focus:border-sky-500 placeholder:text-[var(--color-mute)]"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
                >
                  <AnimatedX size={12} />
                </button>
              )}
            </div>

            {/* Date / Period Filter Pills */}
            <div className="flex items-center gap-1 bg-[var(--color-canvas)] p-1 rounded-lg border border-[var(--color-hairline)] shrink-0 w-full sm:w-auto">
              <span className="hidden xs:flex text-[10px] font-extrabold text-[var(--color-mute)] px-1 items-center gap-1 shrink-0">
                <Calendar size={11} className="text-sky-500" /> Date:
              </span>
              {[
                { id: "all", label: "All" },
                { id: "today", label: "Today" },
                { id: "week", label: "Week", fullLabel: "This Week" },
                { id: "month", label: "Month", fullLabel: "This Month" },
                { id: "year", label: "Year", fullLabel: "This Year" },
              ].map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setHistoryDateFilter(period.id)}
                  className={`flex-1 sm:flex-none px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer text-center whitespace-nowrap ${
                    historyDateFilter === period.id
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <span className="sm:hidden">{period.label}</span>
                  <span className="hidden sm:inline">{period.fullLabel || period.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Empty State for Both Mobile and Desktop */}
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--color-mute)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40">
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <AnimatedClock size={32} className="text-[var(--color-mute)] opacity-50" />
                <p className="font-semibold text-[var(--color-ink)]">No daily machine logs match criteria.</p>
                <p className="text-[11px]">
                  {historySearch || historyDateFilter !== "all"
                    ? "Try adjusting your search query or date filter selection."
                    : "Switch to the 'Log Entry' tab above to submit your daily machine log."}
                </p>
                {recentLogs.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleTabSwitch("entry")}
                    className="mt-2 px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold transition-all shadow-2xs hover:bg-sky-700 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Submit First Log Entry
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Native Card View (rendered on screens < 640px) */}
              <div className="block sm:hidden space-y-2.5">
                {filteredLogs.map((log) => {
                  const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
                  const isToday = isLogFromToday(log.log_date);
                  const canEdit = isLogEditable(log.log_date);

                  const bkdParsed = parseBreakdownString(log.breakdown_duration || log.remarks);
                  const bkdDurationStr = log.breakdown_duration || (bkdParsed?.fullBreakdownString || null);
                  const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "") || "—";
                  const normalHrs = log.normal_working_hours !== undefined && log.normal_working_hours !== null
                    ? Number(log.normal_working_hours)
                    : (() => {
                        const s = formatTo12Hour(log.start_time) || "06:00 AM";
                        const e = formatTo12Hour(log.end_time) || "02:00 PM";
                        const ot = log.overtime_hours || 0;
                        const d = log.log_date ? log.log_date.split("T")[0] : "2026-01-01";
                        const stats = computeShiftTiming({ logDate: d, startTime: s, endTime: e, manualOvertime: ot });
                        return stats.normalWorkingHours;
                      })();

                  const mSerial = log.machine?.serial_number || allMachines.find((m) => m.id === log.machine_id)?.serial_number || assignedMachine?.serial_number || "—";
                  const mModel = log.machine?.model || allMachines.find((m) => m.id === log.machine_id)?.model || assignedMachine?.model || model || "Standard";

                  const splitTs = splitExactTimestamp(log.created_at, true);
                  const bkdStartTime = log.breakdown_start_time || bkdParsed?.startTime || null;
                  const bkdEndTime = log.breakdown_end_time || bkdParsed?.endTime || null;
                  const bkdDurationOnly = bkdParsed?.durationFormatted || bkdParsed?.durationText || (bkdDurationStr ? bkdDurationStr.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim() : null);

                  return (
                    <div
                      key={log.id}
                      className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5 shadow-2xs hover:border-sky-500/30 transition-all"
                    >
                      {/* Mobile Card Header */}
                      <div className="flex items-start justify-between border-b border-[var(--color-hairline)] pb-2.5 gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                              {formatDate(log.log_date)}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                              S/N: {mSerial}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--color-mute)]">
                              {mModel}
                            </span>
                          </div>
                          {/* Exact Log Entry Timestamp (Time on top, Date below, NO clock icon) */}
                          <div className="text-[10px] font-mono text-[var(--color-mute)]">
                            {splitTs ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-sky-600 dark:text-sky-400">{splitTs.time}</span>
                                <span className="text-[var(--color-mute)] text-[9.5px]">({splitTs.date})</span>
                              </div>
                            ) : (
                              <span>{formatDate(log.log_date)}</span>
                            )}
                          </div>
                        </div>
                        {isBkd ? (
                          <div className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex flex-col items-end shrink-0">
                            {bkdStartTime && bkdEndTime ? (
                              <>
                                <span className="font-mono">{bkdStartTime} - {bkdEndTime}</span>
                                <span className="font-mono text-[9px] opacity-90">({bkdDurationOnly || "Breakdown"})</span>
                              </>
                            ) : (
                              <span>🔴 {bkdDurationStr || "Breakdown"}</span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border border-[var(--color-hairline)] inline-flex items-center gap-1 font-mono shrink-0">
                            0
                          </span>
                        )}
                      </div>

                      {/* Mobile Card Content */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[var(--color-ink)] font-mono">
                            Serial: {mSerial}
                          </span>
                          <span className="text-[11px] text-[var(--color-mute)] font-medium">
                            {mModel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-[var(--color-mute)] font-medium">Hour Meter Reading:</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-[var(--color-ink)] block">
                              {log.start_meter ?? 0} → {log.end_meter ?? 0}
                            </span>
                            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 font-mono block">
                              (+{log.running_hours ?? Math.max(0, (log.end_meter ?? 0) - (log.start_meter ?? 0))} hrs)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--color-mute)] font-medium">Shift Timings:</span>
                          <span className="font-mono font-bold text-[var(--color-ink)]">
                            {formatShiftTimingRange(log.start_time, log.end_time)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--color-mute)] font-medium">Working Time (excl. OT):</span>
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                            {normalHrs} hrs (1h break)
                          </span>
                        </div>

                        {log.overtime_hours ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--color-mute)] font-medium">Overtime:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                              {log.overtime_hours} hrs OT
                            </span>
                          </div>
                        ) : null}

                        {/* Exact Log Entry Timestamp Row (NO Clock icon, Time on top, Date below, NO relative time) */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--color-hairline)]/60">
                          <span className="text-[var(--color-mute)] font-medium">
                            Exact Entry Timestamp:
                          </span>
                          <div className="text-right font-mono">
                            {splitTs ? (
                              <>
                                <span className="font-bold text-sky-600 dark:text-sky-400 text-[10.5px] block">
                                  {splitTs.time}
                                </span>
                                <span className="text-[9.5px] text-[var(--color-mute)] block">
                                  {splitTs.date}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-[var(--color-mute)]">—</span>
                            )}
                          </div>
                        </div>

                        {displayRemarks !== "—" && (
                          <div className="pt-1 text-[11px] text-[var(--color-mute)] line-clamp-2 italic bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]">
                            "{displayRemarks}"
                          </div>
                        )}
                      </div>

                      {/* Mobile Card Footer Action */}
                      <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-end">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditLog(log)}
                            className="w-full py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit Log Entry
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--color-mute)] font-bold flex items-center gap-1" title="Log entry locked (older than 7 days)">
                            <Lock className="h-3 w-3" /> Log Entry Locked (&gt;7d)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Data Table Area (rendered on screens >= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-hairline)] text-[var(--color-mute)] font-mono text-[10px] font-extrabold tracking-wider uppercase bg-[var(--color-canvas)]/40">
                      <th className="p-3.5 rounded-l-lg whitespace-nowrap">Shift Date</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Entry Timestamp</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Serial</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Model</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Hour Meter (hrs)</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Timings / Working Time</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Overtime</th>
                      <th className="p-3.5 whitespace-nowrap font-mono">Breakdown</th>
                      <th className="p-3.5">Remarks</th>
                      <th className="p-3.5 text-right rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredLogs.map((log) => {
                      const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
                      const isToday = isLogFromToday(log.log_date);
                      const canEdit = isLogEditable(log.log_date);

                      const bkdParsed = parseBreakdownString(log.breakdown_duration || log.remarks);
                      const bkdDurationStr = log.breakdown_duration || (bkdParsed?.fullBreakdownString || null);
                      const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "") || "—";
                      const normalHrs = log.normal_working_hours !== undefined && log.normal_working_hours !== null
                        ? Number(log.normal_working_hours)
                        : (() => {
                            const s = formatTo12Hour(log.start_time) || "06:00 AM";
                            const e = formatTo12Hour(log.end_time) || "02:00 PM";
                            const ot = log.overtime_hours || 0;
                            const d = log.log_date ? log.log_date.split("T")[0] : "2026-01-01";
                            const stats = computeShiftTiming({ logDate: d, startTime: s, endTime: e, manualOvertime: ot });
                            return stats.normalWorkingHours;
                          })();

                      const mSerial = log.machine?.serial_number || allMachines.find((m) => m.id === log.machine_id)?.serial_number || assignedMachine?.serial_number || "—";
                      const mModel = log.machine?.model || allMachines.find((m) => m.id === log.machine_id)?.model || assignedMachine?.model || model || "Standard";

                      const splitTs = splitExactTimestamp(log.created_at, true);
                      const bkdStartTime = log.breakdown_start_time || bkdParsed?.startTime || null;
                      const bkdEndTime = log.breakdown_end_time || bkdParsed?.endTime || null;
                      const bkdDurationOnly = bkdParsed?.durationFormatted || bkdParsed?.durationText || (bkdDurationStr ? bkdDurationStr.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim() : null);

                      return (
                        <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                          <td className="p-3.5 font-semibold text-[var(--color-ink)] whitespace-nowrap font-mono text-[11px]">
                            {formatDate(log.log_date)}
                          </td>
                          <td className="p-3.5 whitespace-nowrap font-mono">
                            {splitTs ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-[var(--color-ink)] text-[11px]">{splitTs.time}</span>
                                <span className="text-[10px] text-[var(--color-mute)] font-medium">{splitTs.date}</span>
                              </div>
                            ) : log.created_at ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-[var(--color-ink)] text-[11px]">{formatExactTimestamp(log.created_at, true)}</span>
                              </div>
                            ) : (
                              <span className="text-[var(--color-mute)] italic text-[10px]">—</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap text-[11px]">
                            {mSerial}
                          </td>
                          <td className="p-3.5 text-[var(--color-ink)] font-medium whitespace-nowrap text-xs">
                            {mModel}
                          </td>
                          <td className="p-3.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-[var(--color-ink)] text-[11px]">
                              {log.start_meter ?? 0} → {log.end_meter ?? 0}
                            </div>
                            <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5">
                              (+{log.running_hours ?? Math.max(0, (log.end_meter ?? 0) - (log.start_meter ?? 0))}h)
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-medium text-[var(--color-ink)] font-mono text-[11px]">
                              {formatShiftTimingRange(log.start_time, log.end_time)}
                            </div>
                            <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono flex items-center gap-1 mt-0.5">
                              <span>{normalHrs} hrs working</span>
                              <span className="text-[var(--color-mute)] font-normal text-[9.5px]">(excl. OT)</span>
                            </div>
                          </td>
                          <td className="p-3.5 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap font-mono text-xs">
                            {log.overtime_hours ? `${log.overtime_hours} hrs` : "0 hrs"}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isBkd ? (
                              <div className="inline-flex flex-col px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                                {bkdStartTime && bkdEndTime ? (
                                  <>
                                    <span className="font-mono text-[11px] font-bold leading-tight">
                                      {bkdStartTime} - {bkdEndTime}
                                    </span>
                                    <span className="font-mono text-[10px] font-semibold opacity-90 text-center">
                                      ({bkdDurationOnly || "Breakdown"})
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-mono text-[10.5px] font-bold">
                                    🔴 {bkdDurationStr || "Breakdown"}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] inline-flex items-center gap-1 font-mono">
                                0
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 max-w-xs truncate text-[var(--color-mute)]" title={displayRemarks}>
                            {displayRemarks}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEditLog(log)}
                                className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ml-auto shadow-2xs"
                                title={isToday ? "Edit today's saved log entry" : "Edit log entry (within 7-day window)"}
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--color-mute)] font-bold flex items-center justify-end gap-1" title="Log entry locked (older than 7 days)">
                                <Lock className="h-3 w-3" /> Locked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* 4. SUBMISSION CONFIRMATION MODAL             */}
      {/* ============================================ */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <FileCheck2 size={16} />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base text-[var(--color-ink)]">Submit Daily Machine Log?</span>
              <span className="block text-[11px] text-[var(--color-mute)] font-normal -mt-0.5">
                <span className="hidden sm:inline">Please review your shift parameters before direct database commit</span>
                <span className="sm:hidden">Review shift parameters before commit</span>
              </span>
            </div>
          </div>
        }
        className="sm:max-w-[620px]"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>
                <span className="hidden sm:inline">Direct database commit</span>
                <span className="sm:hidden">Direct commit</span>
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={submitting}
                onClick={() => handleExecuteSubmit()}
              >
                <span className="hidden sm:inline">Confirm & Submit Log</span>
                <span className="sm:hidden">Confirm & Submit</span>
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {/* 1. DEPLOYMENT & MACHINE CONTEXT */}
          <div className="rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] p-3 sm:p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-hairline)]">
            {/* Machine Details */}
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-sky-500 shrink-0" /> Machine Identification
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-bold text-[var(--color-ink)] text-sm">
                  {selectedMachine?.model || selectedMachine?.machine_name || "Machine"}
                </span>
                {(selectedMachine?.machine_code || machineNo) && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-mute)] font-semibold">
                    {selectedMachine?.machine_code || machineNo}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                Serial: {selectedMachine?.serial_number || machineNo || "—"}
              </div>
            </div>

            {/* Client & Deployment Site */}
            <div className="space-y-1 sm:pl-3 pt-2 sm:pt-0">
              <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-emerald-500 shrink-0" /> Deployment Site & Client
              </span>
              <div className="font-bold text-[var(--color-ink)] text-sm truncate pt-0.5">
                {selectedClient?.client_name || selectedMachine?.customer_name || "Unassigned Client"}
              </div>
              <div className="text-xs text-[var(--color-mute)] flex items-start gap-1">
                <MapPin className="h-3 w-3 text-neutral-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-relaxed">{clientLocation || "—"}</span>
              </div>
            </div>
          </div>

          {/* 2. OPERATIONAL SHIFT & METERING CARD */}
          <div className="rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] p-3 sm:p-3.5 space-y-2.5">
            {/* Shift Timing Bar */}
            <div className="bg-[var(--color-canvas-elevated)] p-2.5 rounded-lg border border-[var(--color-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider">Shift Window:</span>
                <span className="font-mono font-bold text-[var(--color-ink)] text-xs sm:text-[13px]">
                  {startTime} → {endTime}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-bold",
                  operatingStats.isOvernight
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                    : "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                )}>
                  {operatingStats.isOvernight ? "🌙 Overnight Shift" : "☀️ Day Shift"}
                </span>
                <span className="text-sky-600 dark:text-sky-400">
                  {operatingStats.durationFormatted} ({operatingStats.normalWorkingHours.toFixed(1)}h work)
                </span>
              </div>
            </div>

            {/* 3 Balanced Stat Tiles (Single row across all viewports) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {/* Log Date */}
              <div className="bg-[var(--color-canvas-elevated)] p-2 sm:p-2.5 rounded-lg border border-[var(--color-hairline)] flex flex-col justify-between">
                <span className="text-[9px] sm:text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-neutral-400 shrink-0" /> <span className="hidden sm:inline">Shift </span>Date
                </span>
                <span className="font-mono font-bold text-[var(--color-ink)] text-[11px] sm:text-[13px] truncate">
                  {formatDate(selectedLogDate)}
                </span>
              </div>

              {/* Hour Meter */}
              <div className="bg-[var(--color-canvas-elevated)] p-2 sm:p-2.5 rounded-lg border border-[var(--color-hairline)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1 gap-1">
                  <span className="text-[9px] sm:text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                    <Gauge className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-sky-500 shrink-0" /> <span className="hidden sm:inline">Hour </span>Meter
                  </span>
                  <span className="font-mono font-bold text-[9px] sm:text-[10px] text-sky-600 dark:text-sky-400 px-1 py-0.2 rounded bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 shrink-0">
                    +{meterRunningHours}h<span className="hidden sm:inline"> run</span>
                  </span>
                </div>
                <span className="font-mono font-bold text-[var(--color-ink)] text-[11px] sm:text-[13px] truncate">
                  {startMeter} → {endMeter}
                </span>
              </div>

              {/* Overtime */}
              <div className="bg-[var(--color-canvas-elevated)] p-2 sm:p-2.5 rounded-lg border border-[var(--color-hairline)] flex flex-col justify-between">
                <span className="text-[9px] sm:text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider flex items-center gap-1 mb-1 truncate">
                  <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 shrink-0" /> Overtime
                </span>
                {parseFloat(overtimeHours) > 0 ? (
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[11px] sm:text-[13px] truncate">
                    {overtimeHours} hrs OT
                  </span>
                ) : (
                  <span className="font-mono font-medium text-[var(--color-mute)] text-[11px] sm:text-[13px] truncate">
                    0h (Std)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. MACHINE HEALTH & BREAKDOWN STATUS */}
          {isBreakdown ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-mono uppercase tracking-wide">Machine Status: Breakdown Reported</span>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-500/20 font-bold border border-rose-500/30">
                  {breakdownStats?.durationFormatted || `${breakdownHours}h ${breakdownMinutes}m`}
                </span>
              </div>
              <div className="text-xs font-mono flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
                <Clock className="h-3 w-3 text-rose-500 shrink-0" />
                <span>Breakdown Timing: {breakdownStats?.fullBreakdownString || `${breakdownStartTime} - ${breakdownEndTime}`}</span>
              </div>
              {breakdownReason && (
                <div className="text-xs font-medium text-[var(--color-ink)] bg-white/60 dark:bg-black/20 p-1.5 rounded border border-rose-500/20">
                  <span className="font-bold text-rose-600 dark:text-rose-400">Reason:</span> {breakdownReason}
                </div>
              )}
              {actionTaken && (
                <div className="text-xs font-medium text-[var(--color-ink)] bg-white/60 dark:bg-black/20 p-1.5 rounded border border-rose-500/20">
                  <span className="font-bold text-rose-600 dark:text-rose-400">Action:</span> {actionTaken}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Machine Status: Normal Operation</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-600/90 dark:text-emerald-400/90 font-mono">
                No Machine Breakdown
              </span>
            </div>
          )}

          {/* 4. REMARKS (IF ANY) */}
          {remarks.trim() && (
            <div className="bg-[var(--color-canvas)] p-2.5 rounded-xl border border-[var(--color-hairline)]">
              <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-1">
                Remarks / Operational Notes
              </span>
              <p className="text-[var(--color-ink)] font-medium italic bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)] leading-relaxed">
                "{remarks}"
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ============================================ */}
      {/* 5. EDIT LOG MODAL FOR CORRECTIONS            */}
      {/* ============================================ */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl max-w-lg sm:max-w-xl w-full shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-hidden">
            {/* Header - Icon removed per feedback */}
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 sm:px-6 py-3.5 shrink-0 bg-[var(--color-canvas-elevated)]">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                Edit Daily Machine Log Entry
              </h3>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <AnimatedX size={16} />
                <span className="sr-only">Close</span>
              </button>
            </div>

            {/* Scrollable Form Body - Isolated inside modal boundaries */}
            <form
              id="edit-log-correction-form"
              onSubmit={handleResubmitLogCorrection}
              className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 text-xs custom-scrollbar min-h-0"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--color-ink)] mb-1">
                    Start Meter (hrs) <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={editStartMeter}
                    onChange={(e) => setEditStartMeter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--color-ink)] mb-1">
                    End Meter (hrs) <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={editEndMeter}
                    onChange={(e) => setEditEndMeter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)]"
                  />
                </div>
              </div>

              {/* Edit Shift Timing */}
              <div className="space-y-3 p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40">
                <CustomDatePicker
                  label={
                    <span>
                      Log Date <span className="text-rose-500 font-bold ml-0.5">*</span>
                    </span>
                  }
                  required
                  value={editLogDate}
                  onChange={(val) => setEditLogDate(val)}
                  maxDaysOld={7}
                />

                <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start">
                  <div className="min-w-0">
                    <CustomTimePicker
                      label="Start Time"
                      required
                      value={editStartTime}
                      onChange={(val) => setEditStartTime(val)}
                      iconColor="text-emerald-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <CustomTimePicker
                      label="End Time"
                      required
                      value={editEndTime}
                      onChange={(val) => setEditEndTime(val)}
                      iconColor="text-rose-500"
                      error={editOperatingStats.isFutureEnd ? "Cannot log before shift end." : undefined}
                    />
                  </div>
                </div>

                {editShiftOverlapWarning ? (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-bold p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    {editShiftOverlapWarning}
                  </div>
                ) : editOperatingStats.isValid ? (
                  editOperatingStats.isOvernight ? (
                    <div className="text-[11px] text-[var(--color-mute)] flex flex-col sm:flex-row sm:items-center justify-between font-mono bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)] gap-1">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        🌙 Overnight · {editOperatingStats.durationFormatted}
                      </span>
                      <span className="text-sky-600 dark:text-sky-400 font-bold">{editOperatingStats.normalWorkingHours.toFixed(1)}h working</span>
                    </div>
                  ) : null
                ) : (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-bold p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    {editOperatingStats.errorMessage}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-[var(--color-ink)] mb-1">Overtime (Hours)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editOvertime}
                  onChange={(e) => setEditOvertime(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--color-ink)] mb-1">Breakdown Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBreakdown(false)}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      !editBreakdown
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
                    }`}
                  >
                    No Breakdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditBreakdown(true)}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      editBreakdown
                        ? "border-rose-500 bg-rose-500/10 text-rose-600"
                        : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
                    }`}
                  >
                    Breakdown
                  </button>
                </div>
              </div>

              {editBreakdown && (
                <div className="p-3 sm:p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
                  <span className="block text-[11px] font-bold text-rose-600 dark:text-rose-400">Breakdown Timing</span>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start">
                    <div className="min-w-0">
                      <CustomTimePicker
                        label="Start Time"
                        required
                        value={editBreakdownStartTime}
                        onChange={setEditBreakdownStartTime}
                        iconColor="text-amber-500"
                      />
                    </div>
                    <div className="min-w-0">
                      <CustomTimePicker
                        label="End Time"
                        required
                        value={editBreakdownEndTime}
                        onChange={setEditBreakdownEndTime}
                        iconColor="text-rose-500"
                      />
                    </div>
                  </div>
                  {editBreakdownStats && (
                    <div className={`p-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 font-mono min-w-0 ${
                      editBreakdownStats.isValid
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    }`}>
                      <span className="font-bold truncate">
                        {editBreakdownStats.isValid ? `Duration: ${editBreakdownStats.durationFormatted}` : editBreakdownStats.errorMessage}
                      </span>
                      {editBreakdownStats.isValid && (
                        <span className="text-[11px] opacity-90 truncate">{editBreakdownStats.fullBreakdownString}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-[var(--color-ink)] mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)]"
                />
              </div>
            </form>

            {/* Sticky Action Footer */}
            <div className="flex items-center gap-2 px-5 sm:px-6 py-3.5 border-t border-[var(--color-hairline)] shrink-0 bg-[var(--color-canvas-elevated)]">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setEditingLog(null)}
                disabled={updatingLog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-log-correction-form"
                variant="primary"
                size="md"
                loading={updatingLog}
                className="flex-1"
              >
                Resubmit Entry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable PDF Report Modal */}
      <PrintableOperatorLogsModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        logs={filteredLogs}
        user={user}
        assignedMachine={assignedMachine}
      />
    </div>
  );
}
