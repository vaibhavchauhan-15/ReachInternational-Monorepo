"use client";

import { useState } from "react";
import {
  AnimatedWrench,
  AnimatedAlertTriangle,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedPackage,
} from "@/components/ui/animated-icons";
import { Save } from "lucide-react";

import type { User, ComplaintWithDetails } from "@/lib/types/database";
import { updateComplaintStatusAction } from "@/app/actions/complaints";

export interface MechanicDashboardProps {
  user: User;
  assignedComplaints?: ComplaintWithDetails[];
}

export function MechanicDashboard({ user, assignedComplaints = [] }: MechanicDashboardProps) {
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithDetails | null>(
    assignedComplaints.length > 0 ? assignedComplaints[0] : null
  );

  const [workDone, setWorkDone] = useState<string>(selectedComplaint?.work_done || "");
  const [pendingWork, setPendingWork] = useState<string>(selectedComplaint?.pending_work || "");
  const [requiredPart, setRequiredPart] = useState<string>(selectedComplaint?.required_part || "");
  const [partQty, setPartQty] = useState<number>(selectedComplaint?.part_quantity || 1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelectComplaint = (cmp: ComplaintWithDetails) => {
    setSelectedComplaint(cmp);
    setWorkDone(cmp.work_done || "");
    setPendingWork(cmp.pending_work || "");
    setRequiredPart(cmp.required_part || "");
    setPartQty(cmp.part_quantity || 1);
    setMessage(null);
  };

  const handleStatusUpdate = async (status: "in_progress" | "pending_parts" | "resolved") => {
    if (!selectedComplaint) return;
    setSubmitting(true);
    setMessage(null);

    const res = await updateComplaintStatusAction(selectedComplaint.id, {
      status,
      workDone,
      pendingWork,
      requiredPart,
      partQuantity: partQty,
    });

    setSubmitting(false);
    if (res.success) {
      setMessage(`Job status updated to ${status.replace("_", " ").toUpperCase()} successfully!`);
    } else {
      setMessage(`Failed to update status: ${res.error}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-md">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
          <AnimatedWrench size={14} /> Mechanic Repair Workspace
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--color-ink)]">
          My Assigned Repair Jobs ({assignedComplaints.length})
        </h1>
        <p className="text-xs text-[var(--color-mute)] mt-1">
          Perform machine diagnoses, update repair progress, request spare parts, and resolve breakdowns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Job List */}
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)] px-1">
            Assigned Work Orders
          </h2>

          {assignedComplaints.length === 0 ? (
            <div className="p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-center text-xs text-[var(--color-mute)]">
              No breakdown repair jobs currently assigned to you.
            </div>
          ) : (
            assignedComplaints.map((cmp) => {
              const isSelected = selectedComplaint?.id === cmp.id;
              return (
                <button
                  key={cmp.id}
                  onClick={() => handleSelectComplaint(cmp)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-sky-500 bg-sky-500/10 shadow-sm"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-[var(--color-ink)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                      {cmp.complaint_no}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                      {cmp.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                    {cmp.machine?.machine_name || "Machine Breakdown"}
                  </p>
                  <p className="text-[11px] text-[var(--color-mute)] line-clamp-1 mt-0.5">
                    {cmp.complaint}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Active Job Details & Work Entry */}
        <div className="lg:col-span-2 space-y-4">
          {selectedComplaint ? (
            <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6 shadow-lg space-y-6">
              {/* Job Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-[var(--color-hairline)]">
                <div>
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                    {selectedComplaint.complaint_no}
                  </span>
                  <h2 className="text-lg font-bold text-[var(--color-ink)]">
                    {selectedComplaint.machine?.machine_name} ({selectedComplaint.machine?.serial_number || selectedComplaint.machine?.machine_code})
                  </h2>
                  <p className="text-xs text-[var(--color-mute)]">
                    Reported on {selectedComplaint.complaint_date} • Location: {selectedComplaint.city || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStatusUpdate("in_progress")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all"
                  >
                    Start Job
                  </button>
                  <button
                    onClick={() => handleStatusUpdate("resolved")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                  >
                    <AnimatedCheckCircle size={14} /> Resolve Job
                  </button>
                </div>
              </div>

              {message && (
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-bold text-sky-600 dark:text-sky-400">
                  {message}
                </div>
              )}

              {/* Reported Complaint Problem */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <AnimatedAlertTriangle size={14} /> Reported Issue Details
                </p>
                <p className="text-xs text-[var(--color-ink)] font-medium">
                  {selectedComplaint.complaint}
                </p>
              </div>

              {/* Repair Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Work Done / Diagnosis Notes
                  </label>
                  <textarea
                    rows={3}
                    value={workDone}
                    onChange={(e) => setWorkDone(e.target.value)}
                    placeholder="Describe diagnosis steps, repaired components, or work performed..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[var(--color-ink)] mb-1 flex items-center gap-1">
                      <AnimatedPackage size={14} className="text-[var(--color-mute)]" /> Request Spare Part
                    </label>
                    <input
                      type="text"
                      value={requiredPart}
                      onChange={(e) => setRequiredPart(e.target.value)}
                      placeholder="e.g. Hydraulic Filter, O-Ring Seal Kit"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                      Part Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                    Pending Work (If any)
                  </label>
                  <input
                    type="text"
                    value={pendingWork}
                    onChange={(e) => setPendingWork(e.target.value)}
                    placeholder="Notes on remaining testing or required parts..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleStatusUpdate("in_progress")}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-bold transition-all hover:opacity-90 cursor-pointer"
                >
                  <Save className="h-4 w-4" /> Save Repair Progress
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-center text-xs text-[var(--color-mute)]">
              Select a work order from the left list to view job details and update repair progress.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
