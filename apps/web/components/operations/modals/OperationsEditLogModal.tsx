"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Modal, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Trash2 } from "lucide-react";
import type { MachineHourLog } from "@/lib/types/database";
import {
  formatTo12Hour,
  computeShiftTiming,
  computeBreakdownDuration,
  parseBreakdownString,
} from "@reachinternational/utils";
import { updateOperatorHourLogAction } from "@/app/actions/operators";

import { HMRInputs } from "../entry/HMRInputs";
import { ShiftInputs } from "../entry/ShiftInputs";
import { BreakdownSection } from "../entry/BreakdownSection";

export interface OperationsEditLogModalProps {
  log: MachineHourLog;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedLog: MachineHourLog) => void;
  onRequestDelete?: (log: MachineHourLog) => void;
  canDelete?: boolean;
}

export function OperationsEditLogModal({
  log,
  isOpen,
  onClose,
  onSuccess,
  onRequestDelete,
  canDelete = false,
}: OperationsEditLogModalProps) {
  const { toast } = useToast();

  const rawLogDate = log.log_date ? log.log_date.split("T")[0] : "";
  const initialStartTime = formatTo12Hour(log.start_time) || "06:00 AM";
  const initialEndTime = formatTo12Hour(log.end_time) || "02:00 PM";
  const isBkdInit = Boolean(
    log.is_breakdown || log.machine_condition === "breakdown"
  );

  let parsedBkdStart = "02:30 PM";
  let parsedBkdEnd = "03:25 PM";
  if (log.breakdown_start_time && log.breakdown_end_time) {
    parsedBkdStart = formatTo12Hour(log.breakdown_start_time) || "02:30 PM";
    parsedBkdEnd = formatTo12Hour(log.breakdown_end_time) || "03:25 PM";
  } else if (log.remarks) {
    const bkdParsed = parseBreakdownString(log.remarks);
    if (bkdParsed?.startTime && bkdParsed?.endTime) {
      parsedBkdStart = bkdParsed.startTime;
      parsedBkdEnd = bkdParsed.endTime;
    }
  }

  const initialReason = (log.remarks || "")
    .replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "")
    .replace(/\[Breakdown:\s*([^\]]+)\]/gi, "$1")
    .trim();

  // Form states
  const [logDate, setLogDate] = useState<string>(rawLogDate);
  const [startMeter, setStartMeter] = useState<string>(
    String(log.start_meter ?? 0)
  );
  const [endMeter, setEndMeter] = useState<string>(
    String(log.end_meter ?? log.start_meter ?? 0)
  );
  const [isStartMeterLocked, setIsStartMeterLocked] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [endTime, setEndTime] = useState<string>(initialEndTime);
  const [overtimeHours, setOvertimeHours] = useState<string>(
    String(log.overtime_hours ?? 0)
  );
  const [isBreakdown, setIsBreakdown] = useState<boolean>(isBkdInit);
  const [breakdownStartTime, setBreakdownStartTime] =
    useState<string>(parsedBkdStart);
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>(parsedBkdEnd);
  const [breakdownReason, setBreakdownReason] = useState<string>(initialReason);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Meter calculation
  const startMtrNum = parseFloat(startMeter) || 0;
  const endMtrNum = parseFloat(endMeter) || 0;
  const isDecreasedMeter = endMtrNum < startMtrNum;
  const liveRunningHours = Math.max(
    0,
    Math.round((endMtrNum - startMtrNum) * 10) / 10
  );

  // Shift timings & live calculations
  const shiftStats = useMemo(() => {
    const otNum = parseFloat(overtimeHours) || 0;
    return computeShiftTiming({
      startDate: logDate,
      startTime,
      endDate: logDate,
      endTime,
      manualOvertime: otNum,
    });
  }, [logDate, startTime, endTime, overtimeHours]);

  // Breakdown duration calculation
  const breakdownStats = useMemo(() => {
    if (!isBreakdown) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!logDate) {
        toast("error", "Validation Error", "Log date is required.");
        return;
      }

      // Check date within allowed 7-day range
      const rawDate = logDate.trim().split("T")[0];
      const parts = rawDate.split("-").map(Number);
      if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const parsedMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        const diffDays = Math.floor((todayMidnight - parsedMidnight) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          toast("error", "Invalid Date", "Cannot set machine log to a future date.");
          return;
        }
        if (diffDays > 7) {
          toast("error", "Invalid Date", "You can only update logs within the previous 7 days.");
          return;
        }
      }

      if (isDecreasedMeter) {
        toast(
          "error",
          "Invalid Hour Meter",
          "Ending hour meter reading cannot be less than starting hour meter reading."
        );
        return;
      }

      if (liveRunningHours > 24) {
        toast(
          "error",
          "Invalid Hour Meter",
          "Machine running hours cannot exceed 24 hours in a single log."
        );
        return;
      }

      if (isBreakdown && breakdownStats && !breakdownStats.isValid) {
        toast(
          "error",
          "Invalid Breakdown Timings",
          breakdownStats.errorMessage ||
            "Please verify the breakdown start and end times."
        );
        return;
      }

      setIsSaving(true);
      try {
        const bkdDurationStr =
          isBreakdown && breakdownStats?.isValid
            ? breakdownStats.fullBreakdownString
            : undefined;
        const bkdDecimalHours =
          isBreakdown && breakdownStats?.isValid
            ? breakdownStats.durationDecimalHours
            : 0;

        let finalRemarks = isBreakdown && breakdownReason.trim() ? `[Breakdown: ${breakdownReason.trim()}]` : "";
        if (isBreakdown && bkdDurationStr) {
          const durationTag = `[Breakdown Duration: ${bkdDurationStr}]`;
          finalRemarks = finalRemarks ? `${durationTag} ${finalRemarks}` : durationTag;
        }

        const res = await updateOperatorHourLogAction({
          logId: log.id,
          clientId: log.client_id || undefined,
          startDate: shiftStats.resolvedStartDate || logDate,
          endDate: shiftStats.resolvedEndDate || logDate,
          startMeter: startMtrNum,
          endMeter: endMtrNum,
          startTime,
          endTime,
          overtimeHours: parseFloat(overtimeHours) || 0,
          isBreakdown,
          breakdownStartTime: isBreakdown ? breakdownStartTime : undefined,
          breakdownEndTime: isBreakdown ? breakdownEndTime : undefined,
          breakdownDuration: bkdDurationStr,
          breakdownHours: bkdDecimalHours,
          machineCondition: isBreakdown ? "breakdown" : "good",
          location: log.location || undefined,
          remarks: finalRemarks || undefined,
        });

        if (res.success) {
          toast(
            "success",
            "Log Updated",
            "The daily running hour log has been successfully updated."
          );
          const updatedRecord: MachineHourLog = {
            ...log,
            ...(res.data || {}),
            log_date: shiftStats.resolvedStartDate || logDate,
            end_date: shiftStats.resolvedEndDate || logDate,
            start_meter: startMtrNum,
            end_meter: endMtrNum,
            running_hours: liveRunningHours,
            start_time: startTime,
            end_time: endTime,
            overtime_hours: parseFloat(overtimeHours) || 0,
            is_breakdown: isBreakdown,
            breakdown_start_time: isBreakdown ? breakdownStartTime : null,
            breakdown_end_time: isBreakdown ? breakdownEndTime : null,
            breakdown_duration: bkdDurationStr || null,
            breakdown_hours: bkdDecimalHours,
            machine_condition: isBreakdown ? "breakdown" : "good",
            location: log.location || null,
            remarks: finalRemarks || null,
          };
          onSuccess(updatedRecord);
          onClose();
        } else {
          toast(
            "error",
            "Update Failed",
            res.error || "Could not update log entry."
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
        toast("error", "Update Error", msg);
      } finally {
        setIsSaving(false);
      }
    },
    [
      log,
      logDate,
      isDecreasedMeter,
      isBreakdown,
      breakdownStats,
      breakdownReason,
      shiftStats,
      startMtrNum,
      endMtrNum,
      startTime,
      endTime,
      overtimeHours,
      breakdownStartTime,
      breakdownEndTime,
      liveRunningHours,
      toast,
      onSuccess,
      onClose,
    ]
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      preventAutoFocus={true}
      size="lg"
      title={
        <span className="font-extrabold text-[var(--color-ink)] text-sm sm:text-base">
          Update Logs
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {canDelete && onRequestDelete ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onRequestDelete(log)}
              disabled={isSaving}
              className="font-bold inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Delete Log</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="operations-edit-log-form"
              variant="primary"
              size="sm"
              loading={isSaving}
              disabled={isDecreasedMeter}
              className="font-bold"
            >
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="operations-edit-log-form"
        onSubmit={handleSubmit}
        className="space-y-3.5 sm:space-y-4"
      >
        {/* Section 1: HMR Meter Inputs (Reused from Log Entry) */}
        <HMRInputs
          startMeter={startMeter}
          endMeter={endMeter}
          onStartMeterChange={setStartMeter}
          onEndMeterChange={setEndMeter}
          runningHours={liveRunningHours}
          isStartMeterLocked={isStartMeterLocked}
          onToggleLock={() => setIsStartMeterLocked(!isStartMeterLocked)}
        />

        {/* Section 2: Shift Timings & Overtime (Reused from Log Entry, strictly 7-day window) */}
        <ShiftInputs
          logDate={logDate}
          onLogDateChange={setLogDate}
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          overtimeHours={overtimeHours}
          onOvertimeChange={setOvertimeHours}
          shiftDurationHours={shiftStats.durationHours}
        />

        {/* Section 3: Machine Breakdown (Reused from Log Entry) */}
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
      </form>
    </Modal>
  );
}
