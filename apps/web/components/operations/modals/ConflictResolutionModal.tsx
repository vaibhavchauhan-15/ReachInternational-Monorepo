"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, CustomTimePicker, useToast } from "@/components/ui";
import { AnimatedX } from "@/components/ui/animated-icons";
import { ShieldAlert, AlertTriangle, Check, Clock, Info } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import { resolveHourLogConflictAction } from "@/app/actions/assignments";
import {
  parseConflictReason,
  calculateAdjustedHours,
  formatShiftTimingRange,
} from "@reachinternational/utils";

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: MachineHourLog | null;
  onSuccess?: (action: "acknowledge" | "adjust", adjustedEndTime?: string | null) => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  log,
  onSuccess,
}: ConflictResolutionModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [conflictAction, setConflictAction] = useState<"acknowledge" | "adjust">("acknowledge");
  const [conflictAdjustedEndTime, setConflictAdjustedEndTime] = useState("");
  const [conflictNotes, setConflictNotes] = useState("");
  const [resolvingConflict, setResolvingConflict] = useState(false);

  // Parse structured conflict details for the modal
  const modalConflictDetails = useMemo(() => {
    if (!log) return null;
    const m = log.machine as any;
    const op = log.operator as any;
    const machineCode =
      m?.machine_name ||
      m?.machine_code ||
      m?.machine_id ||
      (log as any).machine_code ||
      "Equipment";
    return parseConflictReason(log.conflict_reason, {
      machineCode,
      machineModel: m?.model,
      operatorName: op?.full_name || op?.name || "Operator",
      startTime: log.start_time,
      endTime: log.end_time,
      runningHours: log.running_hours,
      overtimeHours: log.overtime_hours,
      logDate: log.log_date,
    });
  }, [log]);

  // Live calculation feedback for time adjustment
  const modalAdjustedCalculation = useMemo(() => {
    if (!log?.start_time || !conflictAdjustedEndTime) return null;
    return calculateAdjustedHours(log.start_time, conflictAdjustedEndTime);
  }, [log?.start_time, conflictAdjustedEndTime]);

  const handleResolve = async () => {
    if (!log) return;
    setResolvingConflict(true);
    try {
      const res = await resolveHourLogConflictAction({
        logId: log.id,
        action: conflictAction,
        adjustedEndTime: conflictAction === "adjust" ? conflictAdjustedEndTime : null,
        notes: conflictNotes,
      });
      if (res.success) {
        toast(
          "success",
          `Overtime conflict ${conflictAction === "acknowledge" ? "acknowledged" : "adjusted"} successfully.`
        );
        onClose();
        setConflictNotes("");
        setConflictAdjustedEndTime("");
        if (onSuccess) onSuccess(conflictAction, conflictAdjustedEndTime);
      } else {
        toast("error", res.error || "Failed to resolve conflict");
      }
    } catch (err: any) {
      toast("error", err?.message || "Failed to resolve conflict");
    } finally {
      setResolvingConflict(false);
    }
  };

  if (!isOpen || !log || !modalConflictDetails) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-[var(--color-canvas-elevated)] p-6 rounded-2xl border border-[var(--color-hairline)] max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              Resolve Overtime Conflict
            </h3>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              {(log.machine as any)?.machine_name ||
                (log.machine as any)?.machine_code ||
                "Equipment"}{" "}
              • {(log.operator as any)?.full_name || "Operator"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Target Equipment
              </span>
              <span className="font-bold text-[var(--color-ink)]">
                {(log.machine as any)?.machine_name ||
                  (log.machine as any)?.machine_code ||
                  "Equipment"}
                {(log.machine as any)?.model ? ` (${(log.machine as any).model})` : ""}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Operator
              </span>
              <span className="font-bold text-[var(--color-ink)]">
                {(log.operator as any)?.full_name || "Operator"}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Shift Log Date
              </span>
              <span className="font-bold text-[var(--color-ink)]">{log.log_date}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Recorded Timings
              </span>
              <span className="font-bold font-mono text-[var(--color-ink)]">
                {formatShiftTimingRange(log.start_time, log.end_time)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Total Duration
              </span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {log.running_hours || 0} hrs
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
                Overtime Claimed
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {log.overtime_hours ? `+${log.overtime_hours} hrs OT` : "None"}
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
                <div
                  className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 font-medium ${
                    modalAdjustedCalculation.valid
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                  }`}
                >
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
            onClick={onClose}
            disabled={resolvingConflict}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={resolvingConflict}
            onClick={handleResolve}
            disabled={
              resolvingConflict ||
              (conflictAction === "adjust" &&
                (!conflictAdjustedEndTime || modalAdjustedCalculation?.valid === false))
            }
          >
            Confirm Resolution
          </Button>
        </div>
      </div>
    </div>
  );
}
