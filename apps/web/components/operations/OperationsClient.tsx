"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedClock,
  AnimatedMapPin,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedPlus,
  AnimatedBuilding2,
  AnimatedStar,
  AnimatedSearch,
  AnimatedUserCheck,
} from "@/components/ui/animated-icons";
import { Badge, Button, Select, useToast } from "@/components/ui";
import type { Machine, User, MachineAssignment, MachineHourLog, MachineWithEngineer } from "@/lib/types/database";
import { OperatorDashboard, type OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import {
  assignOperatorToMachineAction,
  requestOperatorAssignmentChangeAction,
  hireOperatorAction,
  recordOperatorPayoutAction,
  recordMachineSiteMovementAction,
} from "@/app/actions/operators";
import { PrintableSupervisorLogsModal } from "./PrintableSupervisorLogsModal";
import { MONTH_NAMES, getLogMonthNumber, formatCompactTiming } from "@/lib/utils/operator-logs-export";
import { formatDate } from "@reachinternational/utils";
import { Printer } from "lucide-react";

export interface OperationsClientProps {
  machines: Machine[];
  operators: User[];
  assignments: MachineAssignment[];
  hourLogs: MachineHourLog[];
  siteMovements?: any[];
  operatorPayouts?: any[];
  userRole?: string;
  user?: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: MachineWithEngineer[];
  initialTab?: string;
}

export function OperationsClient({
  machines,
  operators,
  assignments,
  hourLogs,
  siteMovements = [],
  operatorPayouts = [],
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
    : ["logs", "assignments", "site-movement", "operators"];
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
  const [showHireOperatorModal, setShowHireOperatorModal] = useState(false);
  const [showSiteMovementModal, setShowSiteMovementModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states: Assignment
  const [selectedMachineId, setSelectedMachineId] = useState(machines[0]?.id || "");
  const [selectedOperatorId, setSelectedOperatorId] = useState(operators[0]?.id || "");
  const [reassignReason, setReassignReason] = useState("");
  const [notes, setNotes] = useState("");

  // Form states: Hire Operator
  const [hireName, setHireName] = useState("");
  const [hirePhone, setHirePhone] = useState("");
  const [hireEmail, setHireEmail] = useState("");
  const [hireSalary, setHireSalary] = useState(35000);

  // Form states: Site Movement
  const [moveMachineId, setMoveMachineId] = useState(machines[0]?.id || "");
  const [moveClientName, setMoveClientName] = useState("");
  const [moveSiteAddress, setMoveSiteAddress] = useState("");
  const [moveType, setMoveType] = useState<"loading_dispatch" | "unloading_arrival" | "relocation">("loading_dispatch");
  const [moveVehicleNo, setMoveVehicleNo] = useState("");
  const [moveOperatorId, setMoveOperatorId] = useState(operators[0]?.id || "");
  const [moveRemarks, setMoveRemarks] = useState("");

  // Form states: Payout
  const [payoutOperatorId, setPayoutOperatorId] = useState(operators[0]?.id || "");
  const [payoutMonth, setPayoutMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payoutRunningHours, setPayoutRunningHours] = useState(180);
  const [payoutBaseSalary, setPayoutBaseSalary] = useState(35000);
  const [payoutAllowance, setPayoutAllowance] = useState(2000);
  const [payoutDeductions, setPayoutDeductions] = useState(0);
  const [payoutNotes, setPayoutNotes] = useState("");

  // Helper for current month value ("01" to "12")
  const getCurrentMonthValue = (): string => {
    const m = new Date().getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  };

  // Supervisor Running Hours Log Filtering & View Mode State
  const [logsViewMode, setLogsViewMode] = useState<"machine" | "client" | "operator">("machine");
  const [logsSelectedMachineId, setLogsSelectedMachineId] = useState<string>("");
  const [logsSelectedClientName, setLogsSelectedClientName] = useState<string>("");
  const [logsSelectedSite, setLogsSelectedSite] = useState<string>("all");
  const [logsSelectedClientMachineId, setLogsSelectedClientMachineId] = useState<string>("all");
  const [logsSelectedOperatorId, setLogsSelectedOperatorId] = useState<string>("");
  const [logsSelectedMonth, setLogsSelectedMonth] = useState<string>(getCurrentMonthValue());
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

  // Derived ordered operators list (ordered by most recent activity in logs)
  const logOperatorIdsInOrder = Array.from(new Set(hourLogs.map((l) => l.operator_id).filter(Boolean)));
  const remainingOperators = operators.filter((op) => !logOperatorIdsInOrder.includes(op.id));
  const orderedOperators: User[] = [
    ...logOperatorIdsInOrder.map((id) => operators.find((op) => op.id === id)).filter(Boolean) as User[],
    ...remainingOperators,
  ];

  const activeOperatorId =
    logsSelectedOperatorId && logsSelectedOperatorId !== "all"
      ? logsSelectedOperatorId
      : orderedOperators[0]?.id || "";

  // Derived unique clients list (ordered by most recent activity in logs)
  const uniqueClients = Array.from(
    new Set(
      [
        ...hourLogs.map((l) => (l.machine as any)?.customer_name),
        ...machines.map((m) => (m as any)?.customer_name),
      ].filter(Boolean)
    )
  ) as string[];

  const activeClientName =
    logsSelectedClientName && logsSelectedClientName !== "all"
      ? logsSelectedClientName
      : uniqueClients[0] || "";

  // Derived machines rented by active selected client
  const clientMachines = machines.filter(
    (m) => ((m as any)?.customer_name || "").toLowerCase() === activeClientName.toLowerCase()
  );

  // Derived unique site locations for active selected client
  const clientSites = Array.from(
    new Set(
      [
        ...clientMachines.map((m) => {
          const addr = (m as any)?.customer_address;
          const city = (m as any)?.city;
          if (addr && city) return `${addr}, ${city}`;
          if (addr) return addr;
          if (city) return city;
          return null;
        }),
        ...hourLogs
          .filter((l) => ((l.machine as any)?.customer_name || "").toLowerCase() === activeClientName.toLowerCase())
          .map((l) => {
            const loc = l.location;
            const addr = (l.machine as any)?.customer_address;
            const city = (l.machine as any)?.city;
            if (loc) return loc;
            if (addr && city) return `${addr}, ${city}`;
            if (addr) return addr;
            if (city) return city;
            return null;
          }),
      ].filter(Boolean)
    )
  ) as string[];

  // Effective selected site location (If client has only 1 site, default to that single site per feedback item 4)
  const effectiveSelectedSite =
    clientSites.length === 1
      ? clientSites[0]
      : logsSelectedSite;

  // Effective selected client machine ID (If client has only 1 rented machine, default to that single machine per feedback item 5)
  const effectiveSelectedClientMachineId =
    clientMachines.length === 1
      ? clientMachines[0].id
      : logsSelectedClientMachineId;

  // Active selected client details object (for Client Header Card)
  const clientMachineObj = (
    hourLogs.find((l) => (l.machine as any)?.customer_name?.toLowerCase() === activeClientName.toLowerCase())?.machine ||
    machines.find((m) => (m as any)?.customer_name?.toLowerCase() === activeClientName.toLowerCase())
  ) as any;

  const clientMobile = clientMachineObj?.customer_mobile || "—";
  const clientEmail = clientMachineObj?.customer_email || "—";
  const clientCityState = clientMachineObj?.city
    ? `${clientMachineObj.city}${clientMachineObj.state ? `, ${clientMachineObj.state}` : ""}`
    : "—";
  const clientAddress = clientMachineObj?.customer_address || "—";
  const clientFleetCount = clientMachines.length || hourLogs.filter(
    (l) => ((l.machine as any)?.customer_name || "").toLowerCase() === activeClientName.toLowerCase()
  ).length;

  // Filtered running hour logs
  let filteredHourLogs = hourLogs;

  // 1. Month filter
  if (logsSelectedMonth !== "all") {
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
      const clientName = (log.machine as any)?.customer_name || "Unassigned Client";
      const matchesClient = clientName.toLowerCase() === activeClientName.toLowerCase();
      if (!matchesClient) return false;

      // Optional Site Location filter
      if (effectiveSelectedSite && effectiveSelectedSite !== "all") {
        const mObj = log.machine as any;
        const siteStr = log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "");
        if (!siteStr.toLowerCase().includes(effectiveSelectedSite.toLowerCase())) return false;
      }

      // Optional Client Machine filter
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

  const handleAssignOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await assignOperatorToMachineAction({
      machineId: selectedMachineId,
      operatorId: selectedOperatorId,
      notes,
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", "Operator assigned to machine successfully");
      setShowAssignModal(false);
      setNotes("");
      router.refresh();
    } else {
      toast("error", `Error assigning operator: ${res.error}`);
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

  const handleHireOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireName || !hirePhone) {
      toast("error", "Operator Name and Phone number are required");
      return;
    }
    setSubmitting(true);
    const res = await hireOperatorAction({
      fullName: hireName,
      phone: hirePhone,
      email: hireEmail,
      salary: Number(hireSalary),
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", `Successfully hired operator ${hireName}`);
      setShowHireOperatorModal(false);
      setHireName("");
      setHirePhone("");
      setHireEmail("");
      router.refresh();
    } else {
      toast("error", `Failed to hire operator: ${res.error}`);
    }
  };

  const handleSiteMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveMachineId || !moveClientName || !moveSiteAddress) {
      toast("error", "Please fill in Machine, Client Name, and Site Address.");
      return;
    }
    setSubmitting(true);
    const res = await recordMachineSiteMovementAction({
      machineId: moveMachineId,
      clientName: moveClientName,
      siteAddress: moveSiteAddress,
      movementType: moveType,
      transportVehicleNo: moveVehicleNo,
      operatorId: moveOperatorId,
      remarks: moveRemarks,
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", `Site movement (${moveType.replace("_", " ")}) logged successfully!`);
      setShowSiteMovementModal(false);
      setMoveClientName("");
      setMoveSiteAddress("");
      setMoveVehicleNo("");
      setMoveRemarks("");
      router.refresh();
    } else {
      toast("error", `Failed to log site movement: ${res.error}`);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutOperatorId || !payoutMonth) {
      toast("error", "Operator and Period Month are required.");
      return;
    }
    setSubmitting(true);
    const res = await recordOperatorPayoutAction({
      operatorId: payoutOperatorId,
      periodMonth: payoutMonth,
      totalRunningHours: Number(payoutRunningHours),
      baseSalary: Number(payoutBaseSalary),
      allowance: Number(payoutAllowance),
      deductions: Number(payoutDeductions),
      notes: payoutNotes,
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", "Operator salary payout recorded successfully!");
      setShowPayoutModal(false);
      setPayoutNotes("");
      router.refresh();
    } else {
      toast("error", `Failed to record salary payout: ${res.error}`);
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
    <div className="space-y-6">
      {/* SUPERVISOR / MANAGEMENT HEADER */}
      {userRole !== "operator" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-ink)]">
              {currentTitle}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setShowAssignModal(true)}>
              <AnimatedUserCheck size={15} /> Assign Operator
            </Button>
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
        />
      )}

      {/* TAB 1: Daily Running Hour Logs (Supervisor Multi-View & Month-Wise Logs) */}
      {activeTab === "logs" && (
        <div className="space-y-3">
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
                    if (!logsSelectedClientName || logsSelectedClientName === "all") {
                      setLogsSelectedClientName(uniqueClients[0] || "");
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
                  <Printer className="h-4 w-4" /> Export/Print
                </button>
              </div>
            </div>

            {/* SECOND ROW: Filter Dropdowns (Horizontally Aligned) */}
            {logsViewMode === "client" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[var(--color-hairline)]">
                <div>
                  <Select
                    label="Select Client"
                    value={activeClientName}
                    onChange={(e) => {
                      setLogsSelectedClientName(e.target.value);
                      setLogsSelectedSite("all");
                      setLogsSelectedClientMachineId("all");
                    }}
                    options={uniqueClients.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                  />
                </div>

                <div>
                  <Select
                    label="Select Location"
                    value={effectiveSelectedSite}
                    onChange={(e) => setLogsSelectedSite(e.target.value)}
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
                  <Select
                    label="Select Machine"
                    value={effectiveSelectedClientMachineId}
                    onChange={(e) => setLogsSelectedClientMachineId(e.target.value)}
                    options={
                      clientMachines.length === 1
                        ? clientMachines.map((m) => ({
                            value: m.id,
                            label: `${m.machine_name} (${m.machine_code})`,
                          }))
                        : [
                            { value: "all", label: "All Client Rented Machines" },
                            ...clientMachines.map((m) => ({
                              value: m.id,
                              label: `${m.machine_name} (${m.machine_code})`,
                            })),
                          ]
                    }
                  />
                </div>

                <div>
                  <Select
                    label="Select Month"
                    value={logsSelectedMonth}
                    onChange={(e) => setLogsSelectedMonth(e.target.value)}
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
                    <Select
                      label="Select Machine"
                      value={activeMachineId}
                      onChange={(e) => setLogsSelectedMachineId(e.target.value)}
                      options={orderedMachines.map((m) => ({
                        value: m.id,
                        label: `${m.machine_name} (${m.machine_code})`,
                      }))}
                    />
                  )}

                  {logsViewMode === "operator" && (
                    <Select
                      label="Select Operator"
                      value={activeOperatorId}
                      onChange={(e) => setLogsSelectedOperatorId(e.target.value)}
                      options={orderedOperators.map((op) => ({
                        value: op.id,
                        label: op.full_name,
                      }))}
                    />
                  )}
                </div>

                <div>
                  <Select
                    label="Select Month"
                    value={logsSelectedMonth}
                    onChange={(e) => setLogsSelectedMonth(e.target.value)}
                    options={MONTH_NAMES.map((m) => ({
                      value: m.value,
                      label: m.label,
                    }))}
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
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Serial No / Code</span>
                  <span className="font-bold font-mono text-[var(--color-ink)]">
                    {activeMachineObj.serial_number || activeMachineObj.machine_code || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Model</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {activeMachineObj.model || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Total Run Hours</span>
                  <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                    {Math.round(totalFilteredRunHours * 10) / 10} hrs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-[var(--color-mute)] block uppercase">Total Services</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {activeMachineObj.service_count ?? 0} Services
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
                    <th className="px-3 py-3 w-[45px] text-center font-mono">S.N</th>
                    <th className="px-4 py-3 whitespace-nowrap font-mono">Date</th>
                    {logsViewMode === "operator" ? (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap">Machine</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">Code</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">Model</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">Timings</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">OP(h)</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">OT(h)</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                      </>
                    ) : logsViewMode === "client" ? (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap">Machine</th>
                        <th className="px-4 py-3 whitespace-nowrap">Site / Location</th>
                        <th className="px-4 py-3 whitespace-nowrap">Operator</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">Timings</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">RT(h)</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">OT(h)</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">Breakdown</th>
                        <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 whitespace-nowrap">Client / Site</th>
                        <th className="px-4 py-3 whitespace-nowrap">Operator</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">MR(h)</th>
                        <th className="px-4 py-3 font-mono text-center whitespace-nowrap">RT(h)</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                  {filteredHourLogs.length === 0 ? (
                    <tr>
                      <td colSpan={logsViewMode === "operator" ? 10 : logsViewMode === "client" ? 10 : 8} className="px-4 py-8 text-center text-[var(--color-mute)]">
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

                      const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/);
                      const bkdDetails = bkdMatch ? bkdMatch[1] : log.is_breakdown ? "Breakdown" : null;
                      const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "").trim() || "—";

                      return (
                        <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                          <td className="px-3 py-3 text-center font-bold text-xs text-[var(--color-mute)] font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">{formatDate(log.log_date)}</td>
                          {logsViewMode === "operator" ? (
                            <>
                              <td className="px-4 py-3 font-semibold">
                                <div className="font-bold text-[var(--color-ink)]">
                                  {mObj?.machine_name || "Machine"}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-center font-semibold text-[var(--color-ink)] whitespace-nowrap">
                                {mObj?.machine_code || "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-center font-semibold text-[var(--color-ink)] whitespace-nowrap">
                                {mObj?.model || "—"}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
                                {formatCompactTiming(log.start_time, log.end_time)}
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-amber-600 dark:text-amber-400">{otHours > 0 ? `${otHours}h` : "0h"}</span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {log.is_breakdown ? (
                                  <span className="inline-flex items-center justify-center gap-1 font-bold text-rose-600 dark:text-rose-400 text-xs">
                                    <AnimatedAlertTriangle size={13} className="shrink-0" /> Breakdown {bkdDetails ? `(${bkdDetails})` : ""}
                                  </span>
                                ) : (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">Normal</span>
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
                              <td className="px-4 py-3">
                                <div className="font-bold text-[var(--color-ink)]">
                                  {mObj?.machine_name || "Machine"}
                                </div>
                                <div className="text-[10px] text-[var(--color-mute)] font-mono">
                                  {mObj?.machine_code || "—"} {mObj?.model ? `(${mObj.model})` : ""}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-[var(--color-ink)]">
                                  {log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—")}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                <div className="font-bold text-[var(--color-ink)]">{opObj?.full_name || "Unassigned"}</div>
                                {opObj?.phone && (
                                  <div className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap">{opObj.phone}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-center text-[var(--color-ink)] whitespace-nowrap">
                                {formatCompactTiming(log.start_time, log.end_time)}
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-sky-600 dark:text-sky-400">{runningHours}h</span>
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-center whitespace-nowrap">
                                <span className="text-amber-600 dark:text-amber-400">{otHours > 0 ? `${otHours}h` : "0h"}</span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {log.is_breakdown ? (
                                  <span className="inline-flex items-center justify-center gap-1 font-bold text-rose-600 dark:text-rose-400 text-xs">
                                    <AnimatedAlertTriangle size={13} className="shrink-0" /> Breakdown {bkdDetails ? `(${bkdDetails})` : ""}
                                  </span>
                                ) : (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">Normal</span>
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
                                  {mObj?.customer_name || "Unassigned Client"}
                                </div>
                                <div className="text-[10px] text-[var(--color-mute)]">
                                  {mObj?.city ? `${mObj.city}, ${mObj.state || ""}` : "—"}
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
                                  <span className="inline-flex items-center justify-center gap-1 font-bold text-rose-600 dark:text-rose-400 text-xs">
                                    <AnimatedAlertTriangle size={13} className="shrink-0" /> Breakdown
                                  </span>
                                ) : (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">Normal</span>
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

                const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/);
                const bkdDetails = bkdMatch ? bkdMatch[1] : log.is_breakdown ? "Breakdown" : null;
                const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "").trim() || "—";

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-[var(--color-mute)] block font-bold">{log.log_date}</span>
                        <h4 className="font-extrabold text-sm text-[var(--color-ink)]">{mObj?.machine_name || "Machine"}</h4>
                        <span className="text-[11px] font-mono text-[var(--color-mute)]">{mObj?.machine_code}</span>
                      </div>
                      {log.is_breakdown ? (
                        <Badge variant="error" className="font-bold">Breakdown</Badge>
                      ) : (
                        <Badge variant="success" className="font-bold">Normal</Badge>
                      )}
                    </div>

                    {logsViewMode === "operator" ? (
                      <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Model / Code:</span>
                            <span className="font-bold text-[var(--color-ink)]">
                              {mObj?.model || "—"} ({mObj?.machine_code || "—"})
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
                          <span className="text-[10px] text-[var(--color-mute)] font-semibold">Status:</span>
                          {log.is_breakdown ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 text-[11px]">
                              <AnimatedAlertTriangle size={12} /> Breakdown {bkdDetails ? `(${bkdDetails})` : ""}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                              Normal
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
                            <span className="font-bold text-[var(--color-ink)]">{mObj?.customer_name || "Unassigned"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--color-mute)] block">Operator:</span>
                            <span className="font-bold text-[var(--color-ink)]">{opObj?.full_name || "Unassigned"}</span>
                          </div>
                        </div>

                        {logsViewMode === "client" ? (
                          <div className="p-2.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-hairline)] pb-1.5">
                              <span className="text-[10px] text-[var(--color-mute)] font-semibold uppercase">Site / Location:</span>
                              <span className="font-bold text-[var(--color-ink)] truncate">
                                {log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—")}
                              </span>
                            </div>
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
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Run / Overtime:</span>
                                <span className="font-extrabold font-mono text-sky-600 dark:text-sky-400">
                                  {runningHours}h {otHours > 0 && `(+${otHours}h OT)`}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-[var(--color-mute)] block font-semibold">Breakdown Status:</span>
                                {log.is_breakdown ? (
                                  <span className="font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 text-[11px]">
                                    <AnimatedAlertTriangle size={12} /> Yes (Breakdown)
                                  </span>
                                ) : (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                    No Breakdown
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
          />
        </div>
      )}

      {/* TAB 2: Operator Equipment Assignments */}
      {activeTab === "assignments" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Current Operator</th>
                  <th className="px-4 py-3">Operator Contact</th>
                  <th className="px-4 py-3">Assigned Date</th>
                  <th className="px-4 py-3">Assigned By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No active operator assignments found.
                    </td>
                  </tr>
                ) : (
                  assignments.map((ass) => (
                    <tr key={ass.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--color-ink)]">
                          {(ass.machine as any)?.machine_name}
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono">
                          {(ass.machine as any)?.machine_code} (Serial: {(ass.machine as any)?.serial_number})
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {(ass.operator as any)?.full_name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-mute)]">
                        {(ass.operator as any)?.phone || "N/A"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {new Date(ass.assigned_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3">{(ass.assigner as any)?.full_name || "System"}</td>
                      <td className="px-4 py-3">
                        {ass.status === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="inactive">Ended</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {userRole !== "operator" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMachineId(ass.machine_id);
                              if (ass.operator_id) setSelectedOperatorId(ass.operator_id);
                              setShowAssignModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-[11px] font-bold cursor-pointer"
                          >
                            Reassign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Site Movement & Loading / Unloading Logsheet */}
      {activeTab === "site-movement" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Client Name</th>
                  <th className="px-4 py-3">Site Location</th>
                  <th className="px-4 py-3">Movement Type</th>
                  <th className="px-4 py-3">Transport Vehicle</th>
                  <th className="px-4 py-3">Assigned Operator</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {siteMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No machine loading/unloading movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  siteMovements.map((move: any) => (
                    <tr key={move.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3 font-mono">
                        {new Date(move.movement_date || move.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {move.machine?.machine_name || "Machine"}
                        <div className="text-[10px] text-[var(--color-mute)] font-mono">{move.machine?.machine_code}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{move.client_name}</td>
                      <td className="px-4 py-3 text-[var(--color-mute)]">{move.site_address}</td>
                      <td className="px-4 py-3">
                        <Badge variant={move.movement_type === "loading_dispatch" ? "warning" : "info"}>
                          {move.movement_type === "loading_dispatch"
                            ? "Loading / Dispatch"
                            : move.movement_type === "unloading_arrival"
                            ? "Unloading / Site Arrival"
                            : "Site Relocation"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--color-mute)]">{move.transport_vehicle_no || "N/A"}</td>
                      <td className="px-4 py-3 font-medium">{move.operator?.full_name || "Unassigned"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="success">{move.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Operator Roster & Salary Management */}
      {activeTab === "operators" && (
        <div className="space-y-4">

          {/* Operators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators
              .filter((op) => op.role === "operator" || op.role === "mechanic")
              .map((op) => (
                <div key={op.id} className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center justify-center text-sm">
                        {op.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--color-ink)]">{op.full_name}</div>
                        <div className="text-[11px] text-[var(--color-mute)]">{op.phone || "No Phone"}</div>
                      </div>
                    </div>
                    <Badge variant="success">Active Operator</Badge>
                  </div>

                  <div className="text-xs text-[var(--color-mute)] border-t border-[var(--color-hairline)] pt-2.5 flex justify-between items-center">
                    <span>Email: {op.email}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">₹35,000 / mo</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Payout History Ledger */}
          {operatorPayouts.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
              <div className="p-3 bg-[var(--color-canvas)] font-extrabold text-xs text-[var(--color-ink)] border-b border-[var(--color-hairline)]">
                Operator Salary Payout History Log
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                  <tr>
                    <th className="px-4 py-2.5">Period</th>
                    <th className="px-4 py-2.5">Operator</th>
                    <th className="px-4 py-2.5">Running Hours</th>
                    <th className="px-4 py-2.5">Base Salary</th>
                    <th className="px-4 py-2.5">Allowance</th>
                    <th className="px-4 py-2.5">Deductions</th>
                    <th className="px-4 py-2.5">Net Payout</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                  {operatorPayouts.map((pay: any) => (
                    <tr key={pay.id}>
                      <td className="px-4 py-2.5 font-bold font-mono">{pay.period_month}</td>
                      <td className="px-4 py-2.5 font-semibold">{pay.operator?.full_name || "Operator"}</td>
                      <td className="px-4 py-2.5 font-mono">{pay.total_running_hours} hrs</td>
                      <td className="px-4 py-2.5 font-mono">₹{pay.base_salary?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-600">+₹{pay.allowance?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-rose-500">-₹{pay.deductions?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{pay.net_payout?.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="success">{pay.payment_status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* MODAL: Assign / Reassign Machine Operator */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAssignOperator}
            className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl"
          >
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedUserCheck size={18} className="text-sky-500" /> Assign / Reassign Machine Operator
            </h3>

            <p className="text-xs text-[var(--color-mute)]">
              Assign an operator to equipment. If the operator is currently operating another machine, their assignment will be automatically updated here.
            </p>

            <div className="space-y-3">
              {/* Select Machine */}
              <Select
                label="Select Target Machine *"
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                options={machines.map((m) => {
                  const currentOpId = m.current_operator_id;
                  const currentOp = operators.find((op) => op.id === currentOpId);
                  return {
                    value: m.id,
                    label: `${m.machine_name} (${m.machine_code})${currentOp ? ` — Current: ${currentOp.full_name}` : ""}`,
                  };
                })}
              />

              {/* Select Operator */}
              <Select
                label="Select Machine Operator *"
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                options={operators.map((op) => {
                  const activeAss = assignments.find((a) => a.operator_id === op.id && a.status === "active");
                  const assignedMach = activeAss
                    ? machines.find((m) => m.id === activeAss.machine_id)
                    : machines.find((m) => m.current_operator_id === op.id);
                  return {
                    value: op.id,
                    label: `${op.full_name}${assignedMach ? ` (Operating: ${assignedMach.machine_name} - ${assignedMach.machine_code})` : " (Unassigned / Available)"}`,
                  };
                })}
              />

              {/* Reassignment Notice Banner */}
              {(() => {
                const selectedOp = operators.find((op) => op.id === selectedOperatorId);
                const activeAss = assignments.find((a) => a.operator_id === selectedOperatorId && a.status === "active");
                const currentMach = activeAss
                  ? machines.find((m) => m.id === activeAss.machine_id)
                  : machines.find((m) => m.current_operator_id === selectedOperatorId);

                if (currentMach && currentMach.id !== selectedMachineId) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AnimatedAlertTriangle size={14} className="text-amber-500 shrink-0" />
                        Operator Reassignment Notice
                      </div>
                      <div>
                        <strong>{selectedOp?.full_name || "Selected Operator"}</strong> is currently assigned to{" "}
                        <strong>{currentMach.machine_name} ({currentMach.machine_code})</strong>. Assigning them here will transfer their assignment to the target machine.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">
                  Assignment Notes / Site Instructions (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any shift details, site location, or assignment notes..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-link-soft)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-bold text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {submitting ? "Assigning..." : "Confirm & Assign Operator"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Hire New Operator */}
      {showHireOperatorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleHireOperator} className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedPlus size={18} className="text-emerald-500" /> Onboard & Hire Machine Operator
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Operator Full Name *</label>
                <input
                  type="text"
                  required
                  value={hireName}
                  onChange={(e) => setHireName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Mobile Phone Number *</label>
                <input
                  type="text"
                  required
                  value={hirePhone}
                  onChange={(e) => setHirePhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Monthly Operator Salary (₹) *</label>
                <input
                  type="number"
                  required
                  value={hireSalary}
                  onChange={(e) => setHireSalary(Number(e.target.value))}
                  placeholder="35000"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={hireEmail}
                  onChange={(e) => setHireEmail(e.target.value)}
                  placeholder="ramesh@reachinternation.co.in"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHireOperatorModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-bold text-[var(--color-mute)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? "Hiring..." : "Hire & Register Operator"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Log Machine Site Movement */}
      {showSiteMovementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSiteMovementSubmit} className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedMapPin size={18} className="text-indigo-500" /> Log Machine Loading / Unloading at Site
            </h3>

            <div className="space-y-3">
              <Select
                label="Select Machine *"
                value={moveMachineId}
                onChange={(e) => setMoveMachineId(e.target.value)}
                options={machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} (${m.machine_code})`,
                }))}
              />

              <Select
                label="Movement Type *"
                value={moveType}
                onChange={(e) => setMoveType(e.target.value as any)}
                options={[
                  { value: "loading_dispatch", label: "Loading & Yard Dispatch" },
                  { value: "unloading_arrival", label: "Unloading & Arrival at Client Site" },
                  { value: "relocation", label: "Site-to-Site Relocation" },
                ]}
              />

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Rental Client Name *</label>
                <input
                  type="text"
                  required
                  value={moveClientName}
                  onChange={(e) => setMoveClientName(e.target.value)}
                  placeholder="e.g. L&T Construction Ltd"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Site Address & Location *</label>
                <input
                  type="text"
                  required
                  value={moveSiteAddress}
                  onChange={(e) => setMoveSiteAddress(e.target.value)}
                  placeholder="e.g. Metro Rail Site Sector 62, Noida"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Transport Trailer / Vehicle No</label>
                <input
                  type="text"
                  value={moveVehicleNo}
                  onChange={(e) => setMoveVehicleNo(e.target.value)}
                  placeholder="e.g. HR-55-AB-1234"
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                />
              </div>

              <Select
                label="Assigned Operator on Site"
                value={moveOperatorId}
                onChange={(e) => setMoveOperatorId(e.target.value)}
                options={operators.map((op) => ({
                  value: op.id,
                  label: `${op.full_name} (${op.phone || "Operator"})`,
                }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSiteMovementModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-bold text-[var(--color-mute)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? "Saving..." : "Record Site Movement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Record Operator Salary Payout */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePayoutSubmit} className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={18} className="text-amber-500" /> Record Operator Salary Payout
            </h3>

            <div className="space-y-3">
              <Select
                label="Select Operator *"
                value={payoutOperatorId}
                onChange={(e) => setPayoutOperatorId(e.target.value)}
                options={operators.map((op) => ({
                  value: op.id,
                  label: `${op.full_name} (${op.phone || "Operator"})`,
                }))}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Period Month *</label>
                  <input
                    type="month"
                    required
                    value={payoutMonth}
                    onChange={(e) => setPayoutMonth(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Total Running Hrs</label>
                  <input
                    type="number"
                    value={payoutRunningHours}
                    onChange={(e) => setPayoutRunningHours(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Base Salary (₹)</label>
                  <input
                    type="number"
                    value={payoutBaseSalary}
                    onChange={(e) => setPayoutBaseSalary(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Allowance (₹)</label>
                  <input
                    type="number"
                    value={payoutAllowance}
                    onChange={(e) => setPayoutAllowance(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    value={payoutDeductions}
                    onChange={(e) => setPayoutDeductions(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] flex justify-between items-center text-xs">
                <span className="font-bold text-[var(--color-mute)]">Calculated Net Payout:</span>
                <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{(payoutBaseSalary + payoutAllowance - payoutDeductions).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-bold text-[var(--color-mute)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? "Saving..." : "Record Salary Payout"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
