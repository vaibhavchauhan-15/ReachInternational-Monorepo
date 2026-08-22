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
} from "@/lib/types/database";
import {
  submitOperatorHourLogAction,
  updateOperatorHourLogAction,
} from "@/app/actions/operators";
import { useToast, CustomTimePicker, Modal } from "@/components/ui";
import { formatDate } from "@reachinternational/utils";
import { PrintableOperatorLogsModal } from "./PrintableOperatorLogsModal";

const DRAFT_STORAGE_KEY = "reach_operator_daily_log_draft";

// Time string parser (e.g. "08:00 AM", "05:30 PM", "17:00") -> total minutes from midnight
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

// Compute operating duration & overtime (standard shift = 8 hours)
function computeOperatingHours(startStr: string, endStr: string) {
  const startMins = parseTimeToMinutes(startStr);
  const endMins = parseTimeToMinutes(endStr);

  if (startMins === null || endMins === null) {
    return { durationHours: 0, overtimeHours: 0, isValid: false, errorMessage: "Invalid start or end time format." };
  }

  let diffMins = endMins - startMins;
  if (diffMins < 0) {
    // Overnight shift calculation (e.g. 10:00 PM to 12:00 AM, 10:00 PM to 06:00 AM)
    diffMins += 24 * 60;
  }

  if (diffMins === 0) {
    return { durationHours: 0, overtimeHours: 0, isValid: false, errorMessage: "Start time and end time cannot be identical." };
  }

  const durationHours = Math.round((diffMins / 60) * 10) / 10;
  const overtimeHours = Math.max(0, Math.round((durationHours - 8) * 10) / 10);
  return { durationHours, overtimeHours, isValid: true, errorMessage: null };
}

export interface OperatorHourLog {
  id: string;
  machine_id: string;
  operator_id: string;
  log_date: string;
  start_meter?: number;
  end_meter?: number;
  start_time?: string;
  end_time?: string;
  overtime_hours?: number;
  is_breakdown?: boolean;
  running_hours?: number;
  start_fuel_level?: number;
  fuel_consumed?: number;
  shift?: string;
  machine_condition?: string;
  location?: string;
  remarks?: string;
  status?: string;
  created_at?: string;
  machine?: Machine;
}

export interface OperatorDashboardProps {
  user: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: MachineWithEngineer[];
}

export function OperatorDashboard({
  user,
  assignedMachine,
  recentLogs = [],
  allMachines = [],
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

  // Custom Searchable Dropdown State for Machine Selector
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close custom dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search filter matching machine name, serial no, model, machine code, engine serial
  const filteredMachines = useMemo(() => {
    if (!searchQuery.trim()) return availableMachines;
    const q = searchQuery.toLowerCase().trim();
    return availableMachines.filter((m) => {
      const nameMatch = m.machine_name?.toLowerCase().includes(q);
      const codeMatch = m.machine_code?.toLowerCase().includes(q);
      const modelMatch = m.model?.toLowerCase().includes(q);
      const serialMatch = m.serial_number?.toLowerCase().includes(q);
      const engineMatch = m.engine_serial_no?.toLowerCase().includes(q);
      return nameMatch || codeMatch || modelMatch || serialMatch || engineMatch;
    });
  }, [availableMachines, searchQuery]);

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
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("");
  const [editOvertime, setEditOvertime] = useState<string>("0");
  const [editBreakdown, setEditBreakdown] = useState<boolean>(false);
  const [editBreakdownHours, setEditBreakdownHours] = useState<string>("0");
  const [editBreakdownMinutes, setEditBreakdownMinutes] = useState<string>("0");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [updatingLog, setUpdatingLog] = useState(false);

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
  };

  // Real-time operating duration & overtime calculation
  const operatingStats = useMemo(() => {
    return computeOperatingHours(startTime, endTime);
  }, [startTime, endTime]);


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

  // Update machine details & auto-fetch latest starting meter reading when selection changes
  const handleSelectMachine = (mId: string) => {
    setSelectedMachineId(mId);
    setIsDropdownOpen(false);
    setSearchQuery("");
    const target = availableMachines.find((m) => m.id === mId);
    if (target) {
      setMachineName(target.machine_name || "");
      setMachineNo(target.machine_code || "");
      setModel(target.model || "");
      const latestMtr = getLatestMeterForMachine(mId);
      setStartMeter(String(latestMtr));
      setEndMeter(String(latestMtr));
    }
  };

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

  // Last submitted log reference
  const lastSubmittedLog = useMemo(() => {
    return recentLogs.length > 0 ? recentLogs[0] : null;
  }, [recentLogs]);

  // Today's logs submitted for selected machine
  const todayLogsForMachine = useMemo(() => {
    if (!selectedMachineId) return [];
    return recentLogs.filter(
      (l) => l.machine_id === selectedMachineId && isLogFromToday(l.log_date)
    );
  }, [selectedMachineId, recentLogs]);

  // Client-side real-time shift time overlap validation
  const shiftOverlapWarning = useMemo(() => {
    if (!selectedMachineId || todayLogsForMachine.length === 0) return null;

    const newS = parseTimeToMinutes(startTime);
    let newE = parseTimeToMinutes(endTime);
    if (newS !== null && newE !== null && newE <= newS) {
      newE += 1440;
    }

    for (const log of todayLogsForMachine) {
      if (newS !== null && newE !== null) {
        const exS = parseTimeToMinutes(log.start_time);
        let exE = parseTimeToMinutes(log.end_time);

        if (exS !== null && exE !== null) {
          if (exE <= exS) exE += 1440;

          if (Math.max(newS, exS) < Math.min(newE, exE)) {
            return `Time overlap detected: The selected period (${startTime} – ${endTime}) overlaps with an existing log (${log.start_time || "08:00 AM"} – ${log.end_time || "05:00 PM"}) logged today. Operating time periods must not overlap.`;
          }
        }
      }
    }

    return null;
  }, [selectedMachineId, todayLogsForMachine, startTime, endTime]);

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

  // Completion status calculation
  const completionStatus = useMemo(() => {
    let completed = 0;
    if (selectedMachineId) completed++;
    if (operatingStats.isValid && !shiftOverlapWarning && !meterValidationWarning) completed++;
    if (!isBreakdown) {
      completed++;
    } else {
      if (parseInt(breakdownHours) > 0 || parseInt(breakdownMinutes) > 0) {
        completed++;
      }
    }
    completed++; // Status ready

    const isReady = completed >= 4 && operatingStats.isValid && !shiftOverlapWarning && !meterValidationWarning && !!selectedMachineId;
    return { completed, total: 4, isReady };
  }, [selectedMachineId, operatingStats.isValid, shiftOverlapWarning, meterValidationWarning, isBreakdown, breakdownHours, breakdownMinutes]);

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
  const handleExecuteSubmit = async (statusOverride: "submitted" | "draft" = "submitted") => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setMessage(null);

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

    const res = await submitOperatorHourLogAction({
      machineId: selectedMachineId,
      startMeter: startMtrNum,
      endMeter: endMtrNum,
      startTime,
      endTime,
      overtimeHours: overtimeNum,
      isBreakdown,
      machineCondition: isBreakdown ? "breakdown" : "good",
      remarks: finalRemarks,
      status: statusOverride,
    });

    setSubmitting(false);

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
  };

  // Real-time operating duration & overtime calculation for Edit Modal
  const editOperatingStats = useMemo(() => {
    return computeOperatingHours(editStartTime, editEndTime);
  }, [editStartTime, editEndTime]);

  // Open Edit Modal for a Log
  const handleOpenEditLog = (log: OperatorHourLog) => {
    setEditingLog(log);
    setEditStartMeter(String(log.start_meter ?? 0));
    setEditEndMeter(String(log.end_meter ?? log.start_meter ?? 0));
    const sTime = log.start_time || "06:00 AM";
    const eTime = log.end_time || "02:00 PM";
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
    <div className="w-full space-y-3 sm:space-y-6 p-0 sm:p-6">
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
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-hairline)] mt-3 sm:mt-4 overflow-x-auto custom-scrollbar flex-nowrap">
          <button
            type="button"
            onClick={() => handleTabSwitch("entry")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap min-h-[38px] ${
              activeTab === "entry"
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs font-extrabold"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            <AnimatedGauge size={16} /> Log Entry
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch("history")}
            className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap min-h-[38px] ${
              activeTab === "history"
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs font-extrabold"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            <AnimatedClock size={16} /> Log History
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-canvas)] text-[10px] border border-[var(--color-hairline)]">
              {recentLogs.length}
            </span>
          </button>
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
            {/* SECTION A: MACHINE INFORMATION               */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-2.5 sm:space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
                {/* Machine Name - Primary Custom Searchable Dropdown */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1.5">
                    Machine Name *
                  </label>

                  {availableMachines.length > 0 ? (
                    <div className="relative w-full" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen((prev) => !prev)}
                        className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] flex items-center justify-between hover:border-sky-500/50 transition-all cursor-pointer shadow-2xs min-h-[42px]"
                      >
                        <span className="truncate flex items-center gap-2">
                          {selectedMachine ? (
                            <>
                              <span className="truncate">{selectedMachine.machine_name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] shrink-0">
                                {selectedMachine.machine_code}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--color-mute)] font-normal">Search or select machine...</span>
                          )}
                        </span>
                        <AnimatedChevronDown
                          size={16}
                          className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                            isDropdownOpen ? "rotate-180 text-sky-500" : ""
                          }`}
                        />
                      </button>

                      {/* Searchable Dropdown Popover */}
                      {isDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)]">
                            <Search className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 ml-1" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search by Machine Name, Code, Model, S/N..."
                              className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)] py-1"
                              autoFocus
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="text-[var(--color-mute)] hover:text-[var(--color-ink)] p-1"
                              >
                                <AnimatedX size={12} />
                              </button>
                            )}
                          </div>

                          <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                            {filteredMachines.length === 0 ? (
                              <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                                No matching machines found
                              </div>
                            ) : (
                              filteredMachines.map((m) => {
                                const isSelected = m.id === selectedMachineId;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleSelectMachine(m.id)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                                      isSelected
                                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                                        : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                                    }`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="font-bold flex items-center gap-2 truncate">
                                        <span className="truncate">{m.machine_name}</span>
                                        <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded shrink-0">
                                          {m.machine_code}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-[var(--color-mute)] font-normal truncate mt-0.5 flex items-center gap-2">
                                        <span>Model: {m.model || "—"}</span>
                                        {m.serial_number && <span>• S/N: {m.serial_number}</span>}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      value={machineName || selectedMachine?.machine_name || "Assigned Machine"}
                      onChange={(e) => setMachineName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                      placeholder="e.g. Godrej Reach Truck"
                    />
                  )}
                </div>

                {/* Machine No / Code (Read-Only Auto-Populated) */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Machine Code / No. *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={machineNo || selectedMachine?.machine_code || ""}
                    placeholder="Auto-populated"
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] cursor-not-allowed opacity-80"
                  />
                </div>

                {/* Model (Read-Only Auto-Populated) */}
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={model || selectedMachine?.model || ""}
                    placeholder="Auto-populated"
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] cursor-not-allowed opacity-80"
                  />
                </div>
              </div>
            </div>

            {/* ============================================ */}
            {/* SECTION B: OPERATING HOURS & HOUR METER       */}
            {/* ============================================ */}
            <div className="p-3 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-2.5 sm:space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
                {/* Starting Hour Meter Reading */}
                <div className="col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[var(--color-ink)]">
                      Starting Meter (hrs) *
                    </label>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold tracking-tight">
                      Auto-fetched
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={startMeter}
                    onChange={(e) => setStartMeter(e.target.value)}
                    placeholder="e.g. 1250.0"
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                {/* Ending Hour Meter Reading */}
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Ending Meter (hrs) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={endMeter}
                    onChange={(e) => setEndMeter(e.target.value)}
                    placeholder="e.g. 1258.0"
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                {/* Start Time */}
                <div className="col-span-1">
                  <CustomTimePicker
                    label="Start Time *"
                    required
                    value={startTime}
                    onChange={handleStartTimeChange}
                    placeholder="e.g. 06:00 AM"
                    iconColor="text-emerald-500"
                  />
                </div>

                {/* End Time */}
                <div className="col-span-1">
                  <CustomTimePicker
                    label="End Time *"
                    required
                    value={endTime}
                    onChange={handleEndTimeChange}
                    placeholder="e.g. 02:00 PM"
                    iconColor="text-rose-500"
                  />
                </div>

                {/* Overtime (Hours) - Manual fill */}
                <div className="col-span-2 lg:col-span-1">
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Overtime (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                    placeholder="e.g. 0.0"
                    className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Meter Validation & Time Overlap Warning Strip */}
              {meterValidationWarning ? (
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                  <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
                  <span>❌ {meterValidationWarning}</span>
                </div>
              ) : shiftOverlapWarning ? (
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                  <AnimatedAlertTriangle size={16} className="shrink-0 text-rose-500" />
                  <span>{shiftOverlapWarning}</span>
                </div>
              ) : !operatingStats.isValid ? (
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                  <AnimatedAlertTriangle size={16} className="shrink-0" />
                  <span>❌ {operatingStats.errorMessage}</span>
                </div>
              ) : null}
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
                        Breakdown Duration (Hours) *
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
                        Breakdown Duration (Minutes) *
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
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleExecuteSubmit("draft")}
                  className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] text-xs font-bold transition-all cursor-pointer disabled:opacity-50 min-h-[44px] flex items-center justify-center"
                >
                  Save Draft
                </button>

                <button
                  type="submit"
                  disabled={submitting || !completionStatus.isReady}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {submitting ? "Submitting..." : "Submit Daily Log →"}
                </button>
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

              <button
                type="button"
                onClick={() => handleTabSwitch("entry")}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> New Log Entry
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
                    : "Click 'New Log Entry' above to submit your daily machine log."}
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
                  const status = log.status || "submitted";
                  const isToday = isLogFromToday(log.log_date);
                  const canEdit = isToday || status === "draft";

                  const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*(\d+h\s*\d+m)[^\]]*\]/);
                  const bkdDurationStr = bkdMatch ? bkdMatch[1] : null;
                  const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "") || "—";

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
                            🔴 Breakdown {bkdDurationStr ? `(${bkdDurationStr})` : ""}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                            🟢 Normal
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
                          <span className="text-[var(--color-mute)] font-medium">Operating Hours:</span>
                          <span className="font-mono font-bold text-[var(--color-ink)]">
                            {log.start_time || "06:00 AM"} — {log.end_time || "02:00 PM"}
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
                            <Edit className="h-3.5 w-3.5" /> Edit Today Log Entry
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--color-mute)] font-bold flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Log Entry Locked
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
                      <th className="p-3.5">Timings</th>
                      <th className="p-3.5">Overtime</th>
                      <th className="p-3.5">Breakdown</th>
                      <th className="p-3.5">Remarks</th>
                      <th className="p-3.5 text-right rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredLogs.map((log) => {
                      const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
                      const status = log.status || "submitted";
                      const isToday = isLogFromToday(log.log_date);
                      const canEdit = isToday || status === "draft";

                      const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*(\d+h\s*\d+m)[^\]]*\]/);
                      const bkdDurationStr = bkdMatch ? bkdMatch[1] : null;
                      const displayRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "") || "—";

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
                          <td className="p-3.5 font-medium text-[var(--color-ink)] whitespace-nowrap font-mono text-[11px]">
                            {log.start_time || "06:00 AM"} — {log.end_time || "02:00 PM"}
                          </td>
                          <td className="p-3.5 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {log.overtime_hours ? `${log.overtime_hours} hrs` : "0 hrs"}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {isBkd ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                                🔴 Breakdown {bkdDurationStr ? `(${bkdDurationStr})` : ""}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                🟢 Normal
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
                                title={isToday ? "Edit today's saved log entry" : "Edit log entry"}
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--color-mute)] font-bold flex items-center justify-end gap-1" title="Log entry locked (previous day record)">
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
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-sky-500" />
            <span className="text-base font-extrabold text-[var(--color-ink)]">Submit Daily Machine Log?</span>
          </div>
        }
        description="Please confirm daily machine log summary details before recording."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-bold text-xs hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleExecuteSubmit("submitted")}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Send className="h-3.5 w-3.5" /> Confirm & Submit Log
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-3">
            <div className="grid grid-cols-2 gap-3 border-b border-[var(--color-hairline)] pb-3">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Machine Name</span>
                <span className="font-bold text-[var(--color-ink)] text-sm">{selectedMachine?.machine_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Machine Code & Model</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{machineNo} · {model}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 border-b border-[var(--color-hairline)] pb-3">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Log Date</span>
                <span className="font-bold text-[var(--color-ink)]">{formatDate(new Date())}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Hour Meter</span>
                <span className="font-mono font-bold text-[var(--color-ink)]">{startMeter} → {endMeter} (+{meterRunningHours}h)</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Timings</span>
                <span className="font-bold text-[var(--color-ink)]">{startTime} → {endTime} ({operatingStats.durationHours}h)</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block">Overtime</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{overtimeHours} hrs</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[var(--color-mute)] font-extrabold uppercase block mb-1">Machine Status</span>
              {isBreakdown ? (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                  🔴 Machine Breakdown ({breakdownHours}h {breakdownMinutes}m duration)
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  🟢 Normal (Machine operated normally today)
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
                  <label className="block font-bold text-[var(--color-ink)] mb-1">Start Meter (hrs) *</label>
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
                  <label className="block font-bold text-[var(--color-ink)] mb-1">End Meter (hrs) *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <CustomTimePicker
                  label="Start Time"
                  required
                  value={editStartTime}
                  onChange={setEditStartTime}
                  placeholder="e.g. 08:00 AM"
                  iconColor="text-emerald-500"
                />
                <CustomTimePicker
                  label="End Time"
                  required
                  value={editEndTime}
                  onChange={setEditEndTime}
                  placeholder="e.g. 05:00 PM"
                  iconColor="text-rose-500"
                />
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
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingLog}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingLog ? "Updating..." : "Resubmit Entry"}
                </button>
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
