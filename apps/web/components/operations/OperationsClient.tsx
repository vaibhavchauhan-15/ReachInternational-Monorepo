"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedUserCheck,
  AnimatedClock,
  AnimatedMapPin,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedFileText,
  AnimatedPlus,
  AnimatedPackage,
  AnimatedBuilding2,
  AnimatedStar,
} from "@/components/ui/animated-icons";
import { Badge, Button, useToast } from "@/components/ui";
import type { Machine, User, MachineAssignment, MachineHourLog } from "@/lib/types/database";
import {
  assignOperatorToMachineAction,
  verifyOperatorHourLogAction,
  requestOperatorAssignmentChangeAction,
  hireOperatorAction,
  recordOperatorPayoutAction,
  recordMachineSiteMovementAction,
} from "@/app/actions/operators";

export interface OperationsClientProps {
  machines: Machine[];
  operators: User[];
  assignments: MachineAssignment[];
  hourLogs: MachineHourLog[];
  siteMovements?: any[];
  operatorPayouts?: any[];
  userRole?: string;
}

export function OperationsClient({
  machines,
  operators,
  assignments,
  hourLogs,
  siteMovements = [],
  operatorPayouts = [],
  userRole,
}: OperationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { toast } = useToast();

  const [activeTabState, setActiveTab] = useState<"logs" | "assignments" | "site-movement" | "operators">("logs");
  const activeTab = (tabParam && ["logs", "assignments", "site-movement", "operators"].includes(tabParam)
    ? tabParam
    : activeTabState) as "logs" | "assignments" | "site-movement" | "operators";

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignRequestModal, setShowReassignRequestModal] = useState(false);
  const [showHireOperatorModal, setShowHireOperatorModal] = useState(false);
  const [showSiteMovementModal, setShowSiteMovementModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [verifyingLog, setVerifyingLog] = useState<MachineHourLog | null>(null);
  const [verificationRemarks, setVerificationRemarks] = useState("");
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

  const canVerifyLogs =
    userRole === "supervisor" ||
    userRole === "service_manager" ||
    userRole === "branch_manager" ||
    userRole === "admin" ||
    userRole === "super_admin";

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

  const handleVerifySubmit = async (status: "approved" | "rejected" | "correction_requested") => {
    if (!verifyingLog) return;
    setSubmitting(true);
    const res = await verifyOperatorHourLogAction({
      logId: verifyingLog.id,
      status,
      remarks: verificationRemarks,
    });
    setSubmitting(false);

    if (res.success) {
      toast("success", `Meter log ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "sent for correction"}`);
      setVerifyingLog(null);
      setVerificationRemarks("");
      router.refresh();
    } else {
      toast("error", `Error verifying log: ${res.error}`);
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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--color-ink)]">
            {activeTab === "site-movement"
              ? "Loading/Unloading Ledger"
              : activeTab === "operators"
              ? "Operator Workforce Directory & Payroll"
              : activeTab === "assignments"
              ? "Operator Equipment Assignments"
              : "Daily Running Hour Logs & Meter Logbook"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {userRole === "supervisor" && (
            <>
              <Button
                variant="secondary"
                onClick={() => setShowHireOperatorModal(true)}
              >
                <AnimatedPlus size={15} /> Hire Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowSiteMovementModal(true)}
              >
                <AnimatedMapPin size={15} /> Log Loading/Unloading
              </Button>
            </>
          )}
          <Button
            variant="primary"
            onClick={() => setShowAssignModal(true)}
          >
            <AnimatedUserCheck size={15} /> Assign Operator
          </Button>
        </div>
      </div>

      {/* TAB 1: Daily Running Hour Logs */}
      {activeTab === "logs" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Start Meter</th>
                <th className="px-4 py-3">End Meter</th>
                <th className="px-4 py-3">Running Hours</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
              {hourLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-mute)]">
                    No daily running hour logs submitted yet.
                  </td>
                </tr>
              ) : (
                hourLogs.map((log) => {
                  const runningHours = log.end_meter - log.start_meter;
                  const isDecreased = log.end_meter < log.start_meter;
                  const isUnusualHigh = runningHours > 18;

                  return (
                    <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3 font-semibold">{log.log_date}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[var(--color-ink)]">
                          {(log.machine as any)?.machine_name || "Machine"}
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono">
                          {(log.machine as any)?.machine_code}
                        </div>
                      </td>
                      <td className="px-4 py-3">{(log.operator as any)?.full_name || "Unassigned"}</td>
                      <td className="px-4 py-3 font-mono">{log.start_meter} hrs</td>
                      <td className="px-4 py-3 font-mono">{log.end_meter} hrs</td>
                      <td className="px-4 py-3 font-bold font-mono">
                        {runningHours} hrs
                        {isDecreased && (
                          <span className="ml-2 inline-flex items-center text-[10px] text-rose-500 font-bold">
                            <AnimatedAlertTriangle size={12} className="mr-0.5" /> Meter Decreased
                          </span>
                        )}
                        {isUnusualHigh && (
                          <span className="ml-2 inline-flex items-center text-[10px] text-amber-500 font-bold">
                            <AnimatedClock size={12} className="mr-0.5" /> High Run
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.verification_status === "approved" ? (
                          <Badge variant="success">Approved</Badge>
                        ) : log.verification_status === "rejected" ? (
                          <Badge variant="error">Rejected</Badge>
                        ) : log.verification_status === "correction_requested" ? (
                          <Badge variant="warning">Correction Requested</Badge>
                        ) : (
                          <Badge variant="default">Pending Review</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canVerifyLogs && log.verification_status === "pending" && (
                          <button
                            onClick={() => setVerifyingLog(log)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 text-[11px] font-bold cursor-pointer"
                          >
                            Verify Log
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Operator Equipment Assignments */}
      {activeTab === "assignments" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
              <tr>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Current Operator</th>
                <th className="px-4 py-3">Operator Contact</th>
                <th className="px-4 py-3">Assigned Date</th>
                <th className="px-4 py-3">Assigned By</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-mute)]">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Site Movement & Loading / Unloading Logsheet */}
      {activeTab === "site-movement" && (
        <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
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

      {/* MODAL: Verify Hour Log */}
      {verifyingLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-[var(--color-ink)]">Verify Operator Hour Meter Log</h3>
            <div className="text-xs space-y-1 text-[var(--color-mute)] bg-[var(--color-canvas)] p-3 rounded-xl border border-[var(--color-hairline)]">
              <div><strong>Machine:</strong> {(verifyingLog.machine as any)?.machine_name}</div>
              <div><strong>Operator:</strong> {(verifyingLog.operator as any)?.full_name}</div>
              <div><strong>Reading:</strong> {verifyingLog.start_meter} hrs $\rightarrow$ {verifyingLog.end_meter} hrs ({verifyingLog.end_meter - verifyingLog.start_meter} total running hrs)</div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Supervisor Remarks</label>
              <textarea
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                placeholder="Enter verification comments or correction instructions..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVerifyingLog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-bold text-[var(--color-mute)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifySubmit("correction_requested")}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Request Correction
              </button>
              <button
                onClick={() => handleVerifySubmit("approved")}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Approve Meter Log
              </button>
            </div>
          </div>
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
              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Select Machine *</label>
                <select
                  value={moveMachineId}
                  onChange={(e) => setMoveMachineId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_name} ({m.machine_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Movement Type *</label>
                <select
                  value={moveType}
                  onChange={(e) => setMoveType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold"
                >
                  <option value="loading_dispatch">Loading & Yard Dispatch</option>
                  <option value="unloading_arrival">Unloading & Arrival at Client Site</option>
                  <option value="relocation">Site-to-Site Relocation</option>
                </select>
              </div>

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

              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Assigned Operator on Site</label>
                <select
                  value={moveOperatorId}
                  onChange={(e) => setMoveOperatorId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold"
                >
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.full_name} ({op.phone || "Operator"})
                    </option>
                  ))}
                </select>
              </div>
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
              <div>
                <label className="text-xs font-bold text-[var(--color-mute)] block mb-1">Select Operator *</label>
                <select
                  value={payoutOperatorId}
                  onChange={(e) => setPayoutOperatorId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-semibold"
                >
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.full_name} ({op.phone || "Operator"})
                    </option>
                  ))}
                </select>
              </div>

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
