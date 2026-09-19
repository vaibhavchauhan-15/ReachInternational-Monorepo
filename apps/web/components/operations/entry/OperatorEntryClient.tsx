"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { useToast, Button } from "@/components/ui";
import { getISTDateString, computeBreakdownDuration } from "@reachinternational/utils";
import type { User, OperatorEntryContext, Machine, OperatorLastLogSummary } from "@reachinternational/types";
import { submitOperatorHourLogAction } from "@/app/actions/operators";

import { EntryHeader } from "./EntryHeader";
import { OperatorMachineInfo } from "./OperatorMachineInfo";
import { LastMachineLogCard } from "./LastMachineLogCard";
import { HMRInputs } from "./HMRInputs";
import { ShiftInputs } from "./ShiftInputs";

// Dynamic code-split secondary / heavy features
const BreakdownSection = dynamic(
  () => import("./BreakdownSection").then((mod) => mod.BreakdownSection),
  { ssr: false }
);

const SubmitConfirmModal = dynamic(
  () => import("./SubmitConfirmModal").then((mod) => mod.SubmitConfirmModal),
  { ssr: false }
);

const OperatorHistoryTab = dynamic(
  () => import("./OperatorHistoryTab").then((mod) => mod.OperatorHistoryTab),
  { ssr: false }
);

const DRAFT_KEY = "reach_operator_log_draft";

interface OperatorEntryClientProps {
  initialContext: OperatorEntryContext;
  user: User;
  initialTab?: "entry" | "history";
}

export function OperatorEntryClient({
  initialContext,
  user,
  initialTab = "entry",
}: OperatorEntryClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");

  const activeTab: "entry" | "history" =
    urlTab === "history" || (initialTab === "history" && !urlTab) ? "history" : "entry";

  const handleTabChange = (tab: "entry" | "history") => {
    router.push(tab === "history" ? "/operations?tab=history" : "/operations?tab=entry", { scroll: false });
  };

  // Form State initialized directly from fast read-model
  const initialHmrStr = initialContext.last_hmr !== undefined && initialContext.last_hmr !== null
    ? String(initialContext.last_hmr)
    : "0";
  const [logDate, setLogDate] = useState<string>(() => getISTDateString());
  const [submittedLastLog, setSubmittedLastLog] = useState<OperatorLastLogSummary | null>(null);
  const activeLastLog = submittedLastLog ?? initialContext.last_log;
  const [startMeter, setStartMeter] = useState<string>(() => initialHmrStr);
  const [endMeter, setEndMeter] = useState<string>(() => initialHmrStr);
  const [isStartMeterLocked, setIsStartMeterLocked] = useState<boolean>(true);

  const handleStartMeterChange = useCallback((val: string) => {
    // If endMeter is equal to startMeter or empty, auto-fill/keep in sync
    setEndMeter((prev) => (prev === startMeter || prev === "" ? val : prev));
    setStartMeter(val);
  }, [startMeter]);

  const [startTime, setStartTime] = useState<string>(
    initialContext.operator?.shift_start || "06:00 AM"
  );
  const [endTime, setEndTime] = useState<string>(
    initialContext.operator?.shift_end || "02:00 PM"
  );
  const [overtimeHours, setOvertimeHours] = useState<string>("0");

  // Breakdown state (Lazy)
  const [isBreakdown, setIsBreakdown] = useState<boolean>(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState<string>("02:00 PM");
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>("03:00 PM");
  const [breakdownReason, setBreakdownReason] = useState<string>("");

  // Submission & Draft State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [lastDraftSave, setLastDraftSave] = useState<string | null>(null);

  // Restore draft from localStorage if available (deferred to avoid cascading render)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.logDate === getISTDateString()) {
            if (parsed.endMeter) setEndMeter(parsed.endMeter);
            if (parsed.startTime) setStartTime(parsed.startTime);
            if (parsed.endTime) setEndTime(parsed.endTime);
            if (parsed.overtimeHours) setOvertimeHours(parsed.overtimeHours);
            if (parsed.isBreakdown !== undefined) setIsBreakdown(parsed.isBreakdown);
            if (parsed.breakdownStartTime) setBreakdownStartTime(parsed.breakdownStartTime);
            if (parsed.breakdownEndTime) setBreakdownEndTime(parsed.breakdownEndTime);
            if (parsed.breakdownReason) setBreakdownReason(parsed.breakdownReason);
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Running Hours Calculation
  const startNum = parseFloat(startMeter) || 0;
  const endNum = parseFloat(endMeter) || 0;
  const runningHours = useMemo(() => {
    if (endMeter === "" || endNum < startNum) return 0;
    return Math.max(0, Math.round((endNum - startNum) * 10) / 10);
  }, [startNum, endNum, endMeter]);

  // Breakdown duration formatting
  const breakdownStats = useMemo(() => {
    if (!isBreakdown || !breakdownStartTime || !breakdownEndTime) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  // Shift duration hours calculation
  const shiftDurationHours = useMemo(() => {
    const parseM = (t: string) => {
      const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (match[3] === "PM" && h < 12) h += 12;
      if (match[3] === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    const s = parseM(startTime);
    const e = parseM(endTime);
    if (s === null || e === null) return 0;
    let diff = e - s;
    if (diff < 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  }, [startTime, endTime]);

  // Save Draft
  const handleSaveDraft = useCallback(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          logDate,
          endMeter,
          startTime,
          endTime,
          overtimeHours,
          isBreakdown,
          breakdownStartTime,
          breakdownEndTime,
          breakdownReason,
          savedAt: new Date().toLocaleTimeString(),
        })
      );
      setLastDraftSave(new Date().toLocaleTimeString());
      toast("success", "Draft Saved", "Shift log draft saved locally.");
    } catch {
      // Storage quota or privacy mode error
    }
  }, [
    logDate,
    endMeter,
    startTime,
    endTime,
    overtimeHours,
    isBreakdown,
    breakdownStartTime,
    breakdownEndTime,
    breakdownReason,
    toast,
  ]);

  // Validation before opening confirm modal
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!initialContext.machine?.id) {
      toast("error", "No Machine Assigned", "You cannot submit a log without an assigned machine.");
      return;
    }

    if (!endMeter.trim() || endNum < startNum) {
      toast("error", "Invalid Meter Reading", "Please enter an end meter reading that is at least equal to start meter.");
      return;
    }

    if (runningHours > 24) {
      toast("error", "Excessive Running Hours", "Running hours cannot exceed 24 hours per shift.");
      return;
    }

    if (isBreakdown) {
      if (!breakdownStartTime || !breakdownEndTime) {
        toast("error", "Breakdown Window Required", "Please enter both breakdown start and end times.");
        return;
      }
      if (breakdownStats && breakdownStats.durationDecimalHours > shiftDurationHours) {
        toast(
          "error",
          "Breakdown Exceeds Shift",
          `Breakdown duration (${breakdownStats.durationDecimalHours}h) cannot exceed total shift duration (${shiftDurationHours}h).`
        );
        return;
      }
    }

    setShowConfirmModal(true);
  };

  // Submit Handler
  const handleConfirmSubmit = async () => {
    if (submitting || !initialContext.machine?.id) return;
    setSubmitting(true);

    let bkdDurationStr: string | undefined;
    let bkdHours = 0;
    if (isBreakdown && breakdownStats?.isValid) {
      bkdDurationStr = breakdownStats.fullBreakdownString;
      bkdHours = breakdownStats.durationDecimalHours;
    }

    const finalRemarks =
      isBreakdown && breakdownReason.trim() ? `[Breakdown: ${breakdownReason.trim()}]` : undefined;

    try {
      const res = await submitOperatorHourLogAction({
        machineId: initialContext.machine.id,
        clientId: initialContext.client?.id || undefined,
        location: initialContext.client?.site || undefined,
        startDate: logDate,
        startMeter: startNum,
        endMeter: endNum,
        startTime,
        endTime,
        overtimeHours: parseFloat(overtimeHours) || 0,
        isBreakdown,
        breakdownStartTime: isBreakdown ? breakdownStartTime : undefined,
        breakdownEndTime: isBreakdown ? breakdownEndTime : undefined,
        breakdownDuration: bkdDurationStr,
        breakdownHours: bkdHours,
        machineCondition: isBreakdown ? "breakdown" : "good",
        remarks: finalRemarks,
      });

      if (res.success) {
        toast("success", "Log Submitted Successfully", "Daily machine running hours recorded.");
        setStartMeter(String(endNum));
        setEndMeter(String(endNum));
        setIsStartMeterLocked(true);
        setIsBreakdown(false);
        setBreakdownReason("");
        setSubmittedLastLog({
          id: "recent",
          log_date: logDate,
          start_meter: startNum,
          end_meter: endNum,
          start_time: startTime,
          end_time: endTime,
          running_hours: runningHours,
          overtime_hours: parseFloat(overtimeHours) || 0,
          is_breakdown: isBreakdown,
          breakdown_duration: bkdDurationStr,
          operator_name: user.full_name || initialContext.operator?.name || "Operator",
        });
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        setShowConfirmModal(false);
      } else {
        toast("error", "Submission Failed", res.error || "Could not save log entry.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast("error", "Submission Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-3.5 sm:space-y-6">
      {/* 1. Operational Subnav Tab Switcher (Entry / History) */}
      <EntryHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* 2. Log Entry Tab (Immediate Critical Form) */}
      {activeTab === "entry" && (
        <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="border-b border-[var(--color-hairline)] pb-3">
            <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
              Daily Machine Log Entry
            </h2>
            <p className="text-[11px] text-[var(--color-mute)]">
              Fill in your shift meters and operational status
            </p>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            {/* Section A: Assigned Machine & Client Info */}
            <OperatorMachineInfo
              machine={initialContext.machine}
              client={initialContext.client}
              operator={initialContext.operator}
            />

            {/* Section B: HMR Meter Inputs & Live RT Calculation */}
            <HMRInputs
              startMeter={startMeter}
              endMeter={endMeter}
              onStartMeterChange={handleStartMeterChange}
              onEndMeterChange={setEndMeter}
              runningHours={runningHours}
              isStartMeterLocked={isStartMeterLocked}
              onToggleLock={() => setIsStartMeterLocked(!isStartMeterLocked)}
            />

            {/* Section C: Previous Shift Log on Assigned Machine */}
            <LastMachineLogCard
              lastLog={activeLastLog}
              machineId={initialContext.machine?.machine_id}
            />

            {/* Section D: Shift Timings & Overtime */}
            <ShiftInputs
              logDate={logDate}
              onLogDateChange={setLogDate}
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              overtimeHours={overtimeHours}
              onOvertimeChange={setOvertimeHours}
              shiftDurationHours={shiftDurationHours}
            />

            {/* Section D: Machine Breakdown (Code-Split / Lazy) */}
            <BreakdownSection
              isBreakdown={isBreakdown}
              onToggleBreakdown={setIsBreakdown}
              breakdownStartTime={breakdownStartTime}
              breakdownEndTime={breakdownEndTime}
              onBreakdownStartTimeChange={setBreakdownStartTime}
              onBreakdownEndTimeChange={setBreakdownEndTime}
              breakdownDurationText={breakdownStats?.fullBreakdownString}
              breakdownReason={breakdownReason}
              onBreakdownReasonChange={setBreakdownReason}
            />


            {/* Form Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--color-hairline)]">
              <div className="text-[11px] text-[var(--color-mute)]">
                {lastDraftSave ? `Draft saved locally at ${lastDraftSave}` : "Draft is auto-saved on this device."}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveDraft}
                  className="flex-1 sm:flex-none text-xs font-semibold"
                >
                  Save Draft
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={!initialContext.machine?.id || !endMeter.trim() || endNum < startNum}
                  icon={<Send className="h-3.5 w-3.5" />}
                  className="flex-1 sm:flex-none text-xs font-semibold"
                >
                  Submit Daily Log
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 3. Log History Tab (Lazy Loaded on Demand) */}
      {activeTab === "history" && (
        <OperatorHistoryTab
          user={user}
          assignedMachine={
            initialContext.machine
              ? ({
                  id: initialContext.machine.id,
                  machine_id: initialContext.machine.machine_id,
                  model: initialContext.machine.model || "",
                  serial_number: initialContext.machine.serial_number || "",
                } as unknown as Machine)
              : null
          }
        />
      )}

      {/* 4. Submission Confirmation Modal (Code-Split / Lazy) */}
      {showConfirmModal && (
        <SubmitConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmSubmit}
          submitting={submitting}
          summary={{
            machineCode: initialContext.machine?.machine_id || "—",
            machineModel: initialContext.machine?.model,
            clientName: initialContext.client?.company_name || "Internal",
            site: initialContext.client?.site || "Base Yard",
            logDate,
            startTime,
            endTime,
            startMeter: startNum,
            endMeter: endNum,
            runningHours,
            overtimeHours: parseFloat(overtimeHours) || 0,
            isBreakdown,
            breakdownDuration: breakdownStats?.fullBreakdownString,
          }}
        />
      )}
    </div>
  );
}
