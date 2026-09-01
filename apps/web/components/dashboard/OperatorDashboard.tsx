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
  AlertOctagon,
  ArrowRight,
  Check,
  Printer,
  Download,
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
import {
  formatDate,
  formatTo12Hour,
  formatShiftTimingRange,
  computeShiftTiming,
  parseDateTimeToDate,
  formatResolvedRange,
  addDaysToDateStr,
  findLatestMachineLogTimeline,
  checkIntervalOverlap,
} from "@reachinternational/utils";
import { PrintableOperatorLogsModal } from "./PrintableOperatorLogsModal";
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
      const dateStr = log.log_date ? formatDate(log.log_date).toLowerCase() : "";
      const remarksStr = log.remarks?.toLowerCase() || "";
      return mName.includes(q) || mCode.includes(q) || dateStr.includes(q) || remarksStr.includes(q);
    });
  }, [recentLogs, historyDateFilter, historySearch]);

  // PDF Print Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const handleExportPdfClick = () => {
    if (filteredLogs.length === 0) {
      toast("error", "No Logs Available", "There are no machine logs matching current filters to export.");
      return;
    }
    setShowPrintModal(true);
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

  // Helper to find associated client for a machine from recent logs or dbClients
  const findClientForMachine = useCallback(
    (mId: string, machineObj?: Machine | null) => {
      if (!mId) return dbClients.length > 0 ? dbClients[0] : null;
      // 1. Look in recent logs for this specific machine
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
      // 2. Look in any recent logs
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
      // 3. Fallback to first client in DB
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
  const [editBreakdownHours, setEditBreakdownHours] = useState<string>("0");
  const [editBreakdownMinutes, setEditBreakdownMinutes] = useState<string>("0");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [updatingLog, setUpdatingLog] = useState(false);

  // Real-time operating duration, normal working hours & overtime calculation
  const operatingStats = useMemo(() => {
    const ot = parseFloat(overtimeHours);
    return computeShiftTiming({
      logDate: selectedLogDate,
      startTime,
      endTime,
      manualOvertime: isNaN(ot) ? undefined : ot,
    });
  }, [selectedLogDate, startTime, endTime, overtimeHours]);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const stats = computeShiftTiming({
      logDate: selectedLogDate,
      startTime: val,
      endTime,
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
      return "Ending hour meter reading cannot be less than starting hour meter reading.";
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
        message: `Start time (${formatTo12Hour(startTime)}) cannot precede previous log end time (${machineTimeline.formattedEndDate}, ${machineTimeline.formattedEndTime}).`,
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
          return `Time overlap detected: The requested period (${operatingStats.resolvedRangeFormatted}) overlaps with an existing log (${exRangeFormatted}) on this machine. Operating time periods must not overlap.`;
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
      if (parseInt(breakdownHours) > 0 || parseInt(breakdownMinutes) > 0) {
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
      !!selectedMachineId;
    return { completed, total: 4, isReady };
  }, [
    selectedMachineId,
    operatingStats.isValid,
    shiftOverlapWarning,
    sequencingValidation,
    meterValidationWarning,
    isBreakdown,
    breakdownHours,
    breakdownMinutes,
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

    if (!operatingStats.isValid) {
      toast("error", "Invalid Operating Hours", operatingStats.errorMessage || "Please verify start and end times.");
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

    if (isBreakdown && (parseInt(breakdownHours) || 0) === 0 && (parseInt(breakdownMinutes) || 0) === 0) {
      toast("error", "Breakdown Duration Required", "Please enter breakdown duration hours or minutes.");
      return;
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

      // Build breakdown details string
      let finalRemarks = remarks.trim();
      if (isBreakdown) {
        const bkdH = parseInt(breakdownHours) || 0;
        const bkdM = parseInt(breakdownMinutes) || 0;
        const bkdDetails = `[Breakdown Duration: ${bkdH}h ${bkdM}m]`;
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
        machineCondition: isBreakdown ? "breakdown" : "good",
        remarks: finalRemarks,
        idempotencyKey,
      });

      if (res.success) {
        toast("success", "Daily Machine Log Submitted", "Your daily log entry has been recorded directly in the database.");
        setMessage({ type: "success", text: "Daily machine log submitted and stored directly in database successfully." });
        setRemarks("");
        setIsBreakdown(false);
        setBreakdownHours("0");
        setBreakdownMinutes("0");
        setBreakdownReason("");
        setActionTaken("");
        setOvertimeHours("0");
        setIsManualOvertime(false);
        setStartMeter(String(endMtrNum));
        setEndMeter(String(endMtrNum));
        clearDraft();
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
    });
  }, [editLogDate, editStartTime, editEndTime, editOvertime]);

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
    const bkdMatch = rawRemarks.match(/\[Breakdown Duration:\s*(\d+)h\s*(\d+)m\]/);
    if (bkdMatch) {
      setEditBreakdownHours(bkdMatch[1] || "0");
      setEditBreakdownMinutes(bkdMatch[2] || "0");
      rawRemarks = rawRemarks.replace(/\[Breakdown Duration:\s*\d+h\s*\d+m\]\s*/, "");
    } else {
      setEditBreakdownHours("0");
      setEditBreakdownMinutes("0");
    }
    setEditRemarks(rawRemarks);
  };

  // Submit Correction for Log
  const handleResubmitLogCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    if (!editOperatingStats.isValid) {
      toast("error", "Invalid Shift Timings", editOperatingStats.errorMessage || "Please verify start and end date and time.");
      return;
    }

    if (editShiftOverlapWarning) {
      toast("error", "Shift Overlap Error", editShiftOverlapWarning);
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

    let finalRemarks = editRemarks.trim();
    if (editBreakdown) {
      const bkdH = parseInt(editBreakdownHours) || 0;
      const bkdM = parseInt(editBreakdownMinutes) || 0;
      const durationStr = `[Breakdown Duration: ${bkdH}h ${bkdM}m]`;
      if (!finalRemarks.includes("[Breakdown Duration:")) {
        finalRemarks = finalRemarks ? `${durationStr} ${finalRemarks}` : durationStr;
      }
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
      machineCondition: editBreakdown ? "breakdown" : "good",
      remarks: finalRemarks,
    });

    setUpdatingLog(false);
    if (res.success) {
      toast("success", "Log Resubmitted", "Your updated daily machine log has been resubmitted.");
      setEditingLog(null);
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
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 inline-flex items-center gap-1.5 shadow-2xs font-mono">
                        🌙 Overnight · {operatingStats.durationFormatted}
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] text-rose-500 font-semibold">
                      {operatingStats.errorMessage || "Enter shift times"}
                    </span>
                  )}
                </div>

                {/* Machine Timeline Context Banner */}
                {machineTimeline?.latestLog && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] sm:text-xs text-sky-700 dark:text-sky-300">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Clock size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>
                        <strong className="font-bold">Last shift ended:</strong>{" "}
                        <span className="font-mono font-semibold">{machineTimeline.formattedEndDate}, {machineTimeline.formattedEndTime}</span>
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-md self-start sm:self-auto">
                      Handover from {machineTimeline.formattedEndTime}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 items-start">
                  {/* Log Date */}
                  <div className="col-span-2 sm:col-span-1 lg:col-span-1">
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
                  <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                    <CustomTimePicker
                      label="Start Time"
                      required
                      value={startTime}
                      onChange={handleStartTimeChange}
                      iconColor="text-emerald-500"
                    />
                  </div>

                  {/* End Time */}
                  <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                    <CustomTimePicker
                      label="End Time"
                      required
                      value={endTime}
                      onChange={handleEndTimeChange}
                      iconColor="text-rose-500"
                    />
                  </div>

                  {/* Overtime (Hours) */}
                  <div className="col-span-2 sm:col-span-2 lg:col-span-1">
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
                      className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[42px]"
                    />
                  </div>
                </div>

                {/* Validation & Warning Strip */}
                {meterValidationWarning ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
                    <span>{meterValidationWarning}</span>
                  </div>
                ) : sequencingValidation?.isInvalid ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
                      <span>{sequencingValidation.message}</span>
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
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto whitespace-nowrap"
                      >
                        Align Start to {sequencingValidation.recommendedStartTime} (Handover)
                      </button>
                    )}
                  </div>
                ) : shiftOverlapWarning ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
                    <span>{shiftOverlapWarning}</span>
                  </div>
                ) : !operatingStats.isValid ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
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
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsBreakdown(false)}
                  className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-h-[42px] ${
                    !isBreakdown
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 shadow-2xs"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <CheckCircle2 size={16} /> Normal
                </button>

                <button
                  type="button"
                  onClick={() => setIsBreakdown(true)}
                  className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-h-[42px] ${
                    isBreakdown
                      ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20 shadow-2xs"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <AnimatedAlertTriangle size={16} /> Machine Breakdown
                </button>
              </div>

              {/* Progressive Disclosure Breakdown Details Container */}
              {isBreakdown && (
                <div className="p-3 sm:p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Breakdown Duration Inputs */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink)] mb-1">
                        Breakdown Duration (Hours) <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        required={isBreakdown}
                        value={breakdownHours}
                        onChange={(e) => setBreakdownHours(e.target.value)}
                        placeholder="e.g. 2"
                        className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-rose-500/30 bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink)] mb-1">
                        Breakdown Duration (Minutes) <span className="text-rose-500 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        required={isBreakdown}
                        value={breakdownMinutes}
                        onChange={(e) => setBreakdownMinutes(e.target.value)}
                        placeholder="e.g. 30"
                        className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-rose-500/30 bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>
                  </div>
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

                  const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*(\d+h\s*\d+m)[^\]]*\]/);
                  const bkdDurationStr = bkdMatch ? bkdMatch[1] : null;
                  const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "") || "—";
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

                  return (
                    <div
                      key={log.id}
                      className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5 shadow-2xs hover:border-sky-500/30 transition-all"
                    >
                      {/* Mobile Card Header */}
                      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                            {formatDate(log.log_date)}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                            {log.machine?.machine_code || machineNo || "MCH-001"}
                          </span>
                        </div>
                        {isBkd ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                            🔴 {bkdDurationStr || "Breakdown"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border border-[var(--color-hairline)] inline-flex items-center gap-1 font-mono">
                            0
                          </span>
                        )}
                      </div>

                      {/* Mobile Card Content */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[var(--color-ink)]">
                            {log.machine?.machine_name || machineName || "Machine"}
                          </span>
                          <span className="text-[11px] text-[var(--color-mute)] font-medium">
                            {log.machine?.model || model || "Standard"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-[var(--color-mute)] font-medium">Hour Meter Reading:</span>
                          <span className="font-mono font-bold text-[var(--color-ink)]">
                            {log.start_meter ?? 0} → {log.end_meter ?? 0} ({log.running_hours ?? Math.max(0, (log.end_meter ?? 0) - (log.start_meter ?? 0))} hrs)
                          </span>
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
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {log.overtime_hours} hrs OT
                            </span>
                          </div>
                        ) : null}

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
                      <th className="p-3.5 rounded-l-lg">Date</th>
                      <th className="p-3.5">Machine Name</th>
                      <th className="p-3.5">Machine No</th>
                      <th className="p-3.5">Model</th>
                      <th className="p-3.5">Hour Meter (hrs)</th>
                      <th className="p-3.5">Timings / Working Time</th>
                      <th className="p-3.5">Overtime</th>
                      <th className="p-3.5">Breakdown</th>
                      <th className="p-3.5">Remarks</th>
                      <th className="p-3.5 text-right rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredLogs.map((log) => {
                      const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
                      const isToday = isLogFromToday(log.log_date);
                      const canEdit = isLogEditable(log.log_date);

                      const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*(\d+h\s*\d+m)[^\]]*\]/);
                      const bkdDurationStr = bkdMatch ? bkdMatch[1] : null;
                      const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "") || "—";
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

                      return (
                        <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                          <td className="p-3.5 font-semibold text-[var(--color-ink)] whitespace-nowrap font-mono text-[11px]">
                            {formatDate(log.log_date)}
                          </td>
                          <td className="p-3.5 font-bold text-[var(--color-ink)] whitespace-nowrap">
                            {log.machine?.machine_name || machineName || "Machine"}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                            {log.machine?.machine_code || machineNo || "MCH-001"}
                          </td>
                          <td className="p-3.5 text-[var(--color-ink)] whitespace-nowrap">
                            {log.machine?.model || model || "Standard"}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-[var(--color-ink)] whitespace-nowrap text-[11px]">
                            {log.start_meter ?? 0} → {log.end_meter ?? 0} <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">(+{log.running_hours ?? Math.max(0, (log.end_meter ?? 0) - (log.start_meter ?? 0))}h)</span>
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
                          <td className="p-3.5 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {log.overtime_hours ? `${log.overtime_hours} hrs` : "0 hrs"}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isBkd ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                                🔴 {bkdDurationStr || "Breakdown"}
                              </span>
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
        title="Submit Daily Machine Log?"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full pt-2">
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
              Confirm & Submit Log
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-3">
            <div className="grid grid-cols-2 gap-3 border-b border-[var(--color-hairline)] pb-3">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Machine Model</span>
                <span className="font-bold text-[var(--color-ink)] text-sm">{selectedMachine?.model || selectedMachine?.machine_name || "Machine"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Machine Serial No.</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{selectedMachine?.serial_number || machineNo || "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-[var(--color-hairline)] pb-3">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Client Name</span>
                <span className="font-bold text-[var(--color-ink)]">{selectedClient?.client_name || selectedMachine?.customer_name || "Unassigned Client"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Site Location</span>
                <span className="font-bold text-[var(--color-ink)]">{clientLocation || "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 border-b border-[var(--color-hairline)] pb-3">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Log Date</span>
                <span className="font-bold text-[var(--color-ink)]">{formatDate(selectedLogDate)}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Hour Meter</span>
                <span className="font-mono font-bold text-[var(--color-ink)]">{startMeter} → {endMeter} (+{meterRunningHours}h)</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Shift Timing</span>
                <span className="font-bold text-[var(--color-ink)] block text-[11px] font-mono">
                  {operatingStats.resolvedRangeFormatted || `${startTime} → ${endTime}`}
                </span>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono">
                  {operatingStats.isOvernight ? "🌙 Overnight · " : "☀️ Day · "}{operatingStats.durationFormatted} ({operatingStats.normalWorkingHours.toFixed(1)}h work)
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-0.5">Overtime</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{overtimeHours || "0"} hrs OT</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[var(--color-mute)] font-mono font-bold uppercase tracking-wider block mb-1">Machine Status</span>
              {isBreakdown ? (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                  🔴 Machine Breakdown ({breakdownHours}h {breakdownMinutes}m duration)
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  🟢 Normal (0 breakdown hours)
                </div>
              )}
            </div>

            {remarks.trim() && (
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block mb-0.5">Remarks / Notes</span>
                <p className="text-[var(--color-ink)] font-medium italic bg-[var(--color-canvas-elevated)] p-2 rounded-lg border border-[var(--color-hairline)]">
                  "{remarks}"
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[var(--color-mute)] font-medium flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            Once submitted, this daily machine log entry will be saved directly into the database.
          </p>
        </div>
      </Modal>

      {/* ============================================ */}
      {/* 5. EDIT LOG MODAL FOR CORRECTIONS            */}
      {/* ============================================ */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Edit className="h-4 w-4 text-amber-500" /> Edit Daily Machine Log Entry
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleResubmitLogCorrection} className="space-y-4 text-xs">
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
              <div className="space-y-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CustomTimePicker
                      label="Start Time"
                      required
                      value={editStartTime}
                      onChange={(val) => setEditStartTime(val)}
                      iconColor="text-emerald-500"
                    />
                  </div>

                  <div>
                    <CustomTimePicker
                      label="End Time"
                      required
                      value={editEndTime}
                      onChange={(val) => setEditEndTime(val)}
                      iconColor="text-rose-500"
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
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                  <span className="block text-[11px] font-bold text-rose-600 dark:text-rose-400">Breakdown Duration</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[var(--color-mute)] font-medium">Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={editBreakdownHours}
                        onChange={(e) => setEditBreakdownHours(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--color-mute)] font-medium">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={editBreakdownMinutes}
                        onChange={(e) => setEditBreakdownMinutes(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                      />
                    </div>
                  </div>
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

              <div className="flex items-center gap-2 pt-2">
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
                  variant="primary"
                  size="md"
                  loading={updatingLog}
                  className="flex-1"
                >
                  Resubmit Entry
                </Button>
              </div>
            </form>
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
