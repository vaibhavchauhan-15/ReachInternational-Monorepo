"use client";

import { useState } from "react";
import {
  AnimatedGauge,
  AnimatedClock,
  AnimatedMapPin,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedPackage,
  AnimatedFileText,
  AnimatedPlus,
} from "@/components/ui/animated-icons";
import {
  Play,
  Square,
  Send,
  Fuel,
  Edit,
  Eye,
  CheckCircle2,
} from "lucide-react";

import type {
  User,
  Machine,
  MachineWithEngineer,
  ComplaintWithDetails,
  InventoryProduct,
  InventoryStock,
  Branch,
} from "@/lib/types/database";
import {
  submitOperatorHourLogAction,
  updateOperatorHourLogAction,
} from "@/app/actions/operators";
import { Modal, Badge, Select, useToast } from "@/components/ui";
import { MachineComplaintModal } from "@/components/complaints/MachineComplaintModal";
import { PurchaseRequestModal } from "@/components/inventory/PurchaseRequestModal";

export interface OperatorHourLog {
  id: string;
  machine_id: string;
  operator_id: string;
  log_date: string;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  start_fuel_level?: number;
  fuel_consumed?: number;
  shift?: string;
  machine_condition?: string;
  location?: string;
  remarks?: string;
  status?: string;
  verification_status?: string;
  verified_by?: string;
  verified_at?: string;
  verification_remarks?: string;
  created_at?: string;
}

export interface OperatorDashboardProps {
  user: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  myComplaints?: ComplaintWithDetails[];
  myPartRequests?: Array<{
    id: string;
    request_no: string;
    priority: string;
    reason: string;
    status: string;
    created_at: string;
  }>;
  engineers?: User[];
  allMachines?: MachineWithEngineer[];
  products?: InventoryProduct[];
  stocks?: InventoryStock[];
  branches?: Branch[];
  managers?: Pick<User, "id" | "full_name" | "email" | "role">[];
}

export function OperatorDashboard({
  user,
  assignedMachine,
  recentLogs = [],
  myComplaints = [],
  myPartRequests = [],
  engineers = [],
  allMachines = [],
  products = [],
  stocks = [],
  branches = [],
  managers = [],
}: OperatorDashboardProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"shift" | "logs" | "complaints" | "part_requests">("shift");
  const [shiftActive, setShiftActive] = useState<boolean>(false);

  // Form State for Today's Meter & Shift Logging
  const lastApprovedLog = recentLogs.find((l) => l.verification_status === "approved");
  const previousApprovedMeter = lastApprovedLog ? lastApprovedLog.end_meter : assignedMachine?.hour_meter || 0;

  const [startMeter, setStartMeter] = useState<number>(assignedMachine?.hour_meter || 0);
  const [endMeter, setEndMeter] = useState<string>("");
  const [startFuelLevel, setStartFuelLevel] = useState<string>("0");
  const [fuelConsumed, setFuelConsumed] = useState<string>("0");
  const [shiftType, setShiftType] = useState<"day" | "night">("day");
  const [machineCondition, setMachineCondition] = useState<"good" | "fair" | "needs_attention" | "breakdown">("good");
  const [location, setLocation] = useState<string>(assignedMachine?.city ? `${assignedMachine.city}, ${assignedMachine.state || ""}` : "");
  const [remarks, setRemarks] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal States
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [partRequestModalOpen, setPartRequestModalOpen] = useState(false);
  const [machineDetailsOpen, setMachineDetailsOpen] = useState(false);

  // Log Edit / Correction Modal State
  const [editingLog, setEditingLog] = useState<OperatorHourLog | null>(null);
  const [editStartMeter, setEditStartMeter] = useState<number>(0);
  const [editEndMeter, setEditEndMeter] = useState<string>("");
  const [editFuelConsumed, setEditFuelConsumed] = useState<string>("0");
  const [editShift, setEditShift] = useState<string>("day");
  const [editCondition, setEditCondition] = useState<string>("good");
  const [editLocation, setEditLocation] = useState<string>("");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [updatingLog, setUpdatingLog] = useState(false);

  const runningHours = endMeter && parseFloat(endMeter) >= startMeter ? parseFloat(endMeter) - startMeter : 0;
  const isMeterBelowPreviousApproved = endMeter ? parseFloat(endMeter) < previousApprovedMeter : false;

  // Open Edit Modal for a Log
  const handleOpenEditLog = (log: OperatorHourLog) => {
    setEditingLog(log);
    setEditStartMeter(log.start_meter);
    setEditEndMeter(String(log.end_meter));
    setEditFuelConsumed(String(log.fuel_consumed || 0));
    setEditShift(log.shift || "day");
    setEditCondition(log.machine_condition || "good");
    setEditLocation(log.location || "");
    setEditRemarks(log.remarks || "");
  };

  // Submit Shift / Meter Log
  const handleSubmitShiftLog = async (e: React.FormEvent, statusOverride: "submitted" | "draft" = "submitted") => {
    e.preventDefault();
    if (!assignedMachine) {
      toast("error", "No Machine Assigned", "Please contact your Branch Manager for machine assignment.");
      return;
    }

    const end = parseFloat(endMeter);
    if (isNaN(end) || end < startMeter) {
      setMessage({ type: "error", text: "Ending meter reading cannot be less than starting meter reading." });
      toast("error", "Invalid Meter Reading", "Ending meter must be greater than or equal to start meter.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await submitOperatorHourLogAction({
      machineId: assignedMachine.id,
      startMeter,
      endMeter: end,
      startFuelLevel: parseFloat(startFuelLevel) || 0,
      fuelConsumed: parseFloat(fuelConsumed) || 0,
      shift: shiftType,
      machineCondition,
      location,
      remarks,
      status: statusOverride,
    });

    setSubmitting(false);
    if (res.success) {
      toast("success", "Daily Log Submitted", `Hour meter ${end} hrs recorded successfully.`);
      setMessage({ type: "success", text: "Daily machine log submitted successfully for verification." });
      setStartMeter(end);
      setEndMeter("");
      setFuelConsumed("0");
      setRemarks("");
      if (statusOverride === "submitted") {
        setShiftActive(false);
      }
    } else {
      setMessage({ type: "error", text: res.error || "Failed to submit log." });
      toast("error", "Submission Failed", res.error || "Could not record meter reading.");
    }
  };

  // Submit Correction for Rejected/Draft Log
  const handleResubmitLogCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const end = parseFloat(editEndMeter);
    if (isNaN(end) || end < editStartMeter) {
      toast("error", "Invalid Reading", "End meter cannot be less than start meter.");
      return;
    }

    setUpdatingLog(true);
    const res = await updateOperatorHourLogAction({
      logId: editingLog.id,
      startMeter: editStartMeter,
      endMeter: end,
      fuelConsumed: parseFloat(editFuelConsumed) || 0,
      shift: editShift,
      machineCondition: editCondition as "good" | "fair" | "needs_attention" | "breakdown",
      location: editLocation,
      remarks: editRemarks,
    });

    setUpdatingLog(false);
    if (res.success) {
      toast("success", "Log Resubmitted", "Your corrected meter log has been resubmitted for verification.");
      setEditingLog(null);
    } else {
      toast("error", "Update Failed", res.error || "Could not update log entry.");
    }
  };

  const openComplaintsCount = myComplaints.filter((c) => c.status !== "closed" && c.status !== "resolved").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* ============================================ */}
      {/* 1. TOP HEADER BANNER & SHIFT STATUS          */}
      {/* ============================================ */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-2">
              <AnimatedGauge size={14} /> Operator Control Portal
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              Welcome, {user.full_name || "Operator"}
            </h1>
            <p className="text-xs text-[var(--color-mute)] mt-1">
              Operate assigned machine, log daily start/end meters, fuel consumption, and report machine issues.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${
                shiftActive
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                  : "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${shiftActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {shiftActive ? "Shift Active" : "No Active Shift"}
            </span>

            {!shiftActive ? (
              <button
                onClick={() => {
                  setShiftActive(true);
                  setActiveTab("shift");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="h-4 w-4" /> Start Shift
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("shift")}
                className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="h-4 w-4" /> End Shift
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* 2. QUICK ACTIONS BAR                         */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => {
            setShiftActive(true);
            setActiveTab("shift");
          }}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <Play className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-[var(--color-ink)]">Start Shift</p>
          <p className="text-[10px] text-[var(--color-mute)]">Record initial meter</p>
        </button>

        <button
          onClick={() => setActiveTab("shift")}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <Square className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-[var(--color-ink)]">End Shift</p>
          <p className="text-[10px] text-[var(--color-mute)]">Submit daily log</p>
        </button>

        <button
          onClick={() => setActiveTab("shift")}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <AnimatedGauge size={16} />
          </div>
          <p className="text-xs font-bold text-[var(--color-ink)]">Enter Meter</p>
          <p className="text-[10px] text-[var(--color-mute)]">Log current reading</p>
        </button>

        <button
          onClick={() => setActiveTab("shift")}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <Fuel className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-[var(--color-ink)]">Enter Fuel</p>
          <p className="text-[10px] text-[var(--color-mute)]">Record diesel (L)</p>
        </button>

        <button
          onClick={() => setComplaintModalOpen(true)}
          className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500 hover:bg-rose-500/10 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <AnimatedAlertTriangle size={16} />
          </div>
          <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400">Report Issue</p>
          <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70">Breakdown complaint</p>
        </button>

        <button
          onClick={() => setMachineDetailsOpen(true)}
          className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-left group shadow-xs cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit mb-2 group-hover:scale-110 transition-transform">
            <Eye className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-[var(--color-ink)]">My Machine</p>
          <p className="text-[10px] text-[var(--color-mute)]">View specs & alerts</p>
        </button>
      </div>

      {/* ============================================ */}
      {/* 3. ASSIGNED MACHINE & KPI CARDS STRIP        */}
      {/* ============================================ */}
      {assignedMachine ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Assigned Machine Details */}
          <div className="md:col-span-2 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Assigned Equipment
                </p>
                <h2 className="text-lg font-extrabold text-[var(--color-ink)]">
                  {assignedMachine.machine_name} ({assignedMachine.machine_code})
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80">
                ● {assignedMachine.status?.toUpperCase() || "ACTIVE"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <div>
                <p className="text-[10px] text-[var(--color-mute)]">Model</p>
                <p className="text-xs font-bold text-[var(--color-ink)]">{assignedMachine.model || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-mute)]">Serial No</p>
                <p className="text-xs font-mono font-bold text-[var(--color-ink)]">{assignedMachine.serial_number || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-mute)]">Manufacturer</p>
                <p className="text-xs font-bold text-[var(--color-ink)]">{assignedMachine.manufacturer || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-mute)]">Current Meter</p>
                <p className="text-xs font-extrabold text-sky-600 dark:text-sky-400">{assignedMachine.hour_meter} hrs</p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Service Indicator */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--color-mute)] font-medium">Service Indicator</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">Due Soon</span>
              </div>
              <p className="text-xs font-bold text-[var(--color-ink)]">
                Next Service: {assignedMachine.next_service_due_date || "As Scheduled"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-hairline)] text-center">
              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] text-[var(--color-mute)]">Open Complaints</p>
                <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">{openComplaintsCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] text-[var(--color-mute)]">Prev Approved</p>
                <p className="text-base font-extrabold text-sky-600 dark:text-sky-400">{previousApprovedMeter} hrs</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-center text-xs text-amber-700 dark:text-amber-300">
          <AnimatedAlertTriangle size={24} className="mx-auto mb-2 text-amber-600" />
          No machine assigned to your operator account currently. Contact your Branch Manager to assign an equipment.
        </div>
      )}

      {/* ============================================ */}
      {/* 4. MAIN INTERFACE NAVIGATION TABS            */}
      {/* ============================================ */}
      <div className="flex items-center border-b border-[var(--color-hairline)] overflow-x-auto no-scrollbar gap-2">
        <button
          onClick={() => setActiveTab("shift")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "shift"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AnimatedClock size={16} /> Daily Shift Log
          </span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "logs"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AnimatedFileText size={16} /> Meter Log History ({recentLogs.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("complaints")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "complaints"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AnimatedAlertTriangle size={16} /> My Reported Complaints ({myComplaints.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("part_requests")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "part_requests"
              ? "border-sky-600 text-sky-600 dark:text-sky-400"
              : "border-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AnimatedPackage size={16} /> My Part Requests ({myPartRequests.length})
          </span>
        </button>
      </div>

      {/* ============================================ */}
      {/* TAB 1: DAILY SHIFT LOG FORM                  */}
      {/* ============================================ */}
      {activeTab === "shift" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AnimatedClock size={20} className="text-sky-600 dark:text-sky-400" />
              <h2 className="text-base font-bold text-[var(--color-ink)]">Submit Today's Hour Meter & Shift Log</h2>
            </div>
            <span className="text-xs text-[var(--color-mute)] font-mono">Date: {new Date().toISOString().split("T")[0]}</span>
          </div>

          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
              }`}
            >
              {message.type === "success" ? <AnimatedCheckCircle size={16} /> : <AnimatedAlertTriangle size={16} />}
              {message.text}
            </div>
          )}

          {isMeterBelowPreviousApproved && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
              <AnimatedAlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>Warning:</strong> Entered meter reading ({endMeter}) is less than the previous approved meter reading ({previousApprovedMeter} hrs). Please verify accuracy.
              </span>
            </div>
          )}

          <form onSubmit={(e) => handleSubmitShiftLog(e, "submitted")} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                  Start Hour Meter (Hours)
                </label>
                <input
                  type="number"
                  disabled
                  value={startMeter}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-bold text-[var(--color-ink)] opacity-75"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                  Current Hour Meter Reading *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder={`e.g. ${(startMeter + 8).toFixed(1)}`}
                  value={endMeter}
                  onChange={(e) => setEndMeter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <Select
                label="Shift Type"
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as "day" | "night")}
                options={[
                  { value: "day", label: "Day Shift ☀️" },
                  { value: "night", label: "Night Shift 🌙" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1">
                  <Fuel size={14} className="text-amber-500" /> Start Fuel Level (Liters)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={startFuelLevel}
                  onChange={(e) => setStartFuelLevel(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-bold text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1">
                  <Fuel size={14} className="text-amber-500" /> Fuel Consumed (Liters)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fuelConsumed}
                  onChange={(e) => setFuelConsumed(e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-bold text-[var(--color-ink)]"
                />
              </div>

              <Select
                label="Machine Condition"
                value={machineCondition}
                onChange={(e) => setMachineCondition(e.target.value as "good" | "fair" | "needs_attention" | "breakdown")}
                options={[
                  { value: "good", label: "Good Condition 🟢" },
                  { value: "fair", label: "Fair / Minor Wear 🟡" },
                  { value: "needs_attention", label: "Needs Attention 🟠" },
                  { value: "breakdown", label: "Breakdown Reported 🔴" },
                ]}
              />
            </div>

            {/* Calculated Hours Banner */}
            {runningHours > 0 && (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
                <span>Calculated Shift Operating Hours:</span>
                <span className="text-sm font-extrabold">{runningHours.toFixed(1)} Hours</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1">
                <AnimatedMapPin size={14} className="text-[var(--color-mute)]" /> Operating Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Yard / Warehouse A / Project Site location"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                Operational Notes / Remarks
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional operational notes regarding diesel refilling, site activity, hydraulic oil level..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleSubmitShiftLog(e, "draft")}
                className="flex-1 py-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting Log..." : "Submit Daily Shift Log"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 2: METER LOGS HISTORY & CORRECTIONS       */}
      {/* ============================================ */}
      {activeTab === "logs" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={18} /> My Daily Meter & Shift Logs History
            </h2>
            <span className="text-xs text-[var(--color-mute)] font-medium">Total: {recentLogs.length} entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-[var(--color-mute)] uppercase text-[10px] font-bold">
                  <th className="p-3">Date & Shift</th>
                  <th className="p-3">Start Meter</th>
                  <th className="p-3">End Meter</th>
                  <th className="p-3">Run Hours</th>
                  <th className="p-3">Fuel</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-xs text-[var(--color-mute)]">
                      No daily hour logs submitted yet.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => {
                    const status = log.verification_status || log.status || "submitted";
                    const isRejectedOrDraft = status === "rejected" || status === "correction_requested" || status === "draft";
                    const isApproved = status === "approved";

                    return (
                      <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="p-3 font-semibold text-[var(--color-ink)]">
                          <div>{log.log_date}</div>
                          <span className="text-[10px] text-[var(--color-mute)] uppercase">{log.shift || "day"} shift</span>
                        </td>
                        <td className="p-3 text-[var(--color-mute)]">{log.start_meter} hrs</td>
                        <td className="p-3 font-bold text-sky-600 dark:text-sky-400">{log.end_meter} hrs</td>
                        <td className="p-3 font-extrabold text-[var(--color-ink)]">
                          {(log.end_meter - log.start_meter).toFixed(1)} hrs
                        </td>
                        <td className="p-3 text-[var(--color-mute)]">{log.fuel_consumed || 0} L</td>
                        <td className="p-3">
                          <span className="capitalize font-medium text-[var(--color-ink)]">
                            {log.machine_condition || "good"}
                          </span>
                        </td>
                        <td className="p-3">
                          {isApproved && <Badge variant="active">Approved</Badge>}
                          {status === "pending" && <Badge variant="today">Under Verification</Badge>}
                          {status === "submitted" && <Badge variant="today">Submitted</Badge>}
                          {status === "draft" && <Badge variant="inactive">Draft</Badge>}
                          {(status === "rejected" || status === "correction_requested") && (
                            <Badge variant="overdue">Correction Required</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isRejectedOrDraft ? (
                            <button
                              onClick={() => handleOpenEditLog(log)}
                              className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <Edit className="h-3 w-3" /> Edit & Resubmit
                            </button>
                          ) : isApproved ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--color-mute)]">Pending Review</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 3: MY REPORTED BREAKDOWN COMPLAINTS       */}
      {/* ============================================ */}
      {activeTab === "complaints" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedAlertTriangle size={18} /> Breakdown Complaints Reported by Me
            </h2>
            <button
              onClick={() => setComplaintModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <AnimatedPlus size={14} /> Report New Issue
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-[var(--color-mute)] uppercase text-[10px] font-bold">
                  <th className="p-3">Complaint #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned Engineer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {myComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-[var(--color-mute)]">
                      No breakdown complaints reported yet.
                    </td>
                  </tr>
                ) : (
                  myComplaints.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                      <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{c.complaint_no}</td>
                      <td className="p-3 text-[var(--color-mute)]">{c.complaint_date}</td>
                      <td className="p-3 font-bold text-[var(--color-ink)]">
                        {c.machine?.machine_name || c.machine?.machine_code}
                      </td>
                      <td className="p-3 max-w-xs truncate text-[var(--color-ink)]">{c.complaint}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            c.status === "open"
                              ? "overdue"
                              : c.status === "in_progress"
                              ? "today"
                              : c.status === "resolved"
                              ? "active"
                              : "inactive"
                          }
                        >
                          {c.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-[var(--color-mute)]">{c.engineer?.full_name || "Unassigned"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB 4: MY PART REQUESTS                      */}
      {/* ============================================ */}
      {activeTab === "part_requests" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedPackage size={18} /> My Consumable & Part Requests
            </h2>
            <button
              onClick={() => setPartRequestModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <AnimatedPlus size={14} /> Request Part / Oil
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-[var(--color-mute)] uppercase text-[10px] font-bold">
                  <th className="p-3">Request #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {myPartRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-[var(--color-mute)]">
                      No part requests created yet.
                    </td>
                  </tr>
                ) : (
                  myPartRequests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                      <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{pr.request_no}</td>
                      <td className="p-3 text-[var(--color-mute)]">
                        {new Date(pr.created_at).toISOString().split("T")[0]}
                      </td>
                      <td className="p-3 font-medium text-[var(--color-ink)]">{pr.reason}</td>
                      <td className="p-3">
                        <Badge variant={pr.priority === "urgent" ? "overdue" : "inactive"}>
                          {pr.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={pr.status === "approved" ? "active" : "today"}>
                          {pr.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL 1: EDIT & RESUBMIT REJECTED/DRAFT LOG  */}
      {/* ============================================ */}
      <Modal open={!!editingLog} onClose={() => setEditingLog(null)} title="Correct & Resubmit Daily Log" size="md">
        {editingLog && (
          <form onSubmit={handleResubmitLogCorrection} className="space-y-4 pt-2">
            {editingLog.verification_remarks && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                <strong>Supervisor Feedback:</strong> {editingLog.verification_remarks}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">Start Meter</label>
                <input
                  type="number"
                  disabled
                  value={editStartMeter}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold opacity-75"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">Ending Meter *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editEndMeter}
                  onChange={(e) => setEditEndMeter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">Fuel Consumed (L)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editFuelConsumed}
                  onChange={(e) => setEditFuelConsumed(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                />
              </div>

              <Select
                label="Shift"
                value={editShift}
                onChange={(e) => setEditShift(e.target.value)}
                options={[
                  { value: "day", label: "Day Shift" },
                  { value: "night", label: "Night Shift" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">Remarks</label>
              <textarea
                rows={2}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-[var(--color-ink)] text-xs font-bold hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingLog}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> {updatingLog ? "Resubmitting..." : "Resubmit Log"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL 2: VIEW MY MACHINE SPECS               */}
      {/* ============================================ */}
      <Modal open={machineDetailsOpen} onClose={() => setMachineDetailsOpen(false)} title="Assigned Equipment Specifications" size="md">
        {assignedMachine ? (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-sm text-[var(--color-ink)]">{assignedMachine.machine_name}</p>
                <p className="font-mono text-sky-600 dark:text-sky-400 font-bold">{assignedMachine.machine_code}</p>
              </div>
              <Badge variant="active">{assignedMachine.status?.toUpperCase()}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
              <div>
                <span className="text-[var(--color-mute)]">Category:</span>
                <p className="font-bold text-[var(--color-ink)]">{assignedMachine.category_name || "Forklift"}</p>
              </div>
              <div>
                <span className="text-[var(--color-mute)]">Model:</span>
                <p className="font-bold text-[var(--color-ink)]">{assignedMachine.model || "N/A"}</p>
              </div>
              <div>
                <span className="text-[var(--color-mute)]">Serial Number:</span>
                <p className="font-mono font-bold text-[var(--color-ink)]">{assignedMachine.serial_number || "N/A"}</p>
              </div>
              <div>
                <span className="text-[var(--color-mute)]">Manufacturer:</span>
                <p className="font-bold text-[var(--color-ink)]">{assignedMachine.manufacturer || "N/A"}</p>
              </div>
              <div>
                <span className="text-[var(--color-mute)]">Current Meter:</span>
                <p className="font-extrabold text-sky-600 dark:text-sky-400">{assignedMachine.hour_meter} hrs</p>
              </div>
              <div>
                <span className="text-[var(--color-mute)]">Location:</span>
                <p className="font-bold text-[var(--color-ink)]">{assignedMachine.city}, {assignedMachine.state}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <p className="font-bold mb-1">Service & Maintenance Alert</p>
              <p className="text-[11px]">
                Next service due date: <strong>{assignedMachine.next_service_due_date || "N/A"}</strong>
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setMachineDetailsOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-[var(--color-ink)] text-xs font-bold hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-mute)]">No machine assigned.</p>
        )}
      </Modal>

      {/* ============================================ */}
      {/* MODAL 3 & 4: BREAKDOWN & PART REQUEST MODALS */}
      {/* ============================================ */}
      <MachineComplaintModal
        open={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        machines={allMachines}
        engineers={engineers}
      />

      <PurchaseRequestModal
        open={partRequestModalOpen}
        onClose={() => setPartRequestModalOpen(false)}
        products={products}
        stocks={stocks}
        branches={branches}
        managers={managers}
      />
    </div>
  );
}
