"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Modal, Button, Badge } from "@/components/ui";
import { CustomDatePicker, CustomTimePicker } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  Clock,
  Zap,
  AlertTriangle,
  MapPin,
  FileText,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { AnimatedAlertTriangle, AnimatedLoader } from "@/components/ui/animated-icons";
import type { MachineHourLog } from "@/lib/types/database";
import {
  formatDate,
  formatTo12Hour,
  computeShiftTiming,
  computeBreakdownDuration,
  parseBreakdownString,
} from "@reachinternational/utils";
import { updateOperatorHourLogAction } from "@/app/actions/operators";

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

  const initialRemarks = (log.remarks || "")
    .replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "")
    .trim();

  // Form states
  const [logDate, setLogDate] = useState<string>(rawLogDate);
  const [startMeter, setStartMeter] = useState<string>(
    String(log.start_meter ?? 0)
  );
  const [endMeter, setEndMeter] = useState<string>(
    String(log.end_meter ?? log.start_meter ?? 0)
  );
  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [endTime, setEndTime] = useState<string>(initialEndTime);
  const [overtimeHours, setOvertimeHours] = useState<string>(
    String(log.overtime_hours ?? 0)
  );
  const [isBreakdown, setIsBreakdown] = useState<boolean>(isBkdInit);
  const [breakdownStartTime, setBreakdownStartTime] =
    useState<string>(parsedBkdStart);
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>(parsedBkdEnd);
  const [machineCondition, setMachineCondition] = useState<
    "good" | "fair" | "needs_attention" | "breakdown"
  >(
    (log.machine_condition as any) ||
      (isBkdInit ? "breakdown" : "good")
  );
  const [location, setLocation] = useState<string>(log.location || "");
  const [remarks, setRemarks] = useState<string>(initialRemarks);
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

  // Machine info labels
  const mObj = log.machine as any;
  const opObj = log.operator as any;
  const machineModel =
    mObj?.model || mObj?.machine_code || log.machine_id?.slice(0, 8) || "Machine";
  const machineSerial =
    mObj?.serial_number || mObj?.machine_code || "—";
  const operatorName = opObj?.full_name || "Assigned Operator";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!logDate) {
        toast("error", "Validation Error", "Log date is required.");
        return;
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

        let finalRemarks = remarks.trim();
        if (isBreakdown && bkdDurationStr) {
          const durationTag = `[Breakdown Duration: ${bkdDurationStr}]`;
          if (!finalRemarks.includes("[Breakdown Duration:")) {
            finalRemarks = finalRemarks
              ? `${durationTag} ${finalRemarks}`
              : durationTag;
          }
        } else if (!isBreakdown) {
          finalRemarks = finalRemarks
            .replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "")
            .trim();
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
          machineCondition: isBreakdown ? "breakdown" : machineCondition,
          location: location.trim() || undefined,
          remarks: finalRemarks,
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
            machine_condition: isBreakdown ? "breakdown" : machineCondition,
            location: location.trim() || null,
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
      } catch (err: any) {
        toast(
          "error",
          "Update Error",
          err?.message || "An unexpected error occurred while saving."
        );
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
      remarks,
      shiftStats,
      startMtrNum,
      endMtrNum,
      startTime,
      endTime,
      overtimeHours,
      breakdownStartTime,
      breakdownEndTime,
      machineCondition,
      location,
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-[var(--color-ink)] text-sm sm:text-base">
            Edit Daily Running Hour Log
          </span>
          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-xs font-bold border border-sky-500/20">
            {machineModel}
          </span>
        </div>
      }
      description={
        <div className="flex items-center gap-2 text-xs text-[var(--color-mute)] flex-wrap">
          <span>Operator: <strong className="text-[var(--color-ink)]">{operatorName}</strong></span>
          <span>•</span>
          <span>S/N: <span className="font-mono">{machineSerial}</span></span>
          <span>•</span>
          <span>Log ID: <span className="font-mono">{log.id.slice(0, 8)}...</span></span>
        </div>
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
        className="space-y-4 text-xs"
      >
        {/* Date Selection */}
        <div>
          <CustomDatePicker
            label="Log Date"
            required
            value={logDate}
            onChange={(val) => setLogDate(val)}
            allowAnyPast={true}
          />
        </div>

        {/* Hour Meter Section */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
              Hour Meter Readings
            </span>
            <span
              className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-md border ${
                isDecreasedMeter
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
              }`}
            >
              Net Hours: {liveRunningHours} hrs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--color-ink)] mb-1">
                Start Meter (hrs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={startMeter}
                onChange={(e) => setStartMeter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-ink)] mb-1">
                End Meter (hrs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={endMeter}
                onChange={(e) => setEndMeter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          {isDecreasedMeter && (
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
              <AnimatedAlertTriangle size={14} className="shrink-0 text-rose-500" />
              <span>Ending meter cannot be less than starting hour meter.</span>
            </div>
          )}
        </div>

        {/* Shift Timings Section */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
              Shift Timings & Overtime
            </span>
            {shiftStats.durationMinutes > 0 && (
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 font-mono inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {shiftStats.durationFormatted}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomTimePicker
              label="Start Time"
              required
              value={startTime}
              onChange={(val) => setStartTime(val)}
              iconColor="text-emerald-500"
            />
            <CustomTimePicker
              label="End Time"
              required
              value={endTime}
              onChange={(val) => setEndTime(val)}
              iconColor="text-rose-500"
            />
          </div>

          <div className="pt-1">
            <label className="block font-bold text-[var(--color-ink)] mb-1">
              Overtime (Hours)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="16"
              value={overtimeHours}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 16) {
                  setOvertimeHours("16");
                } else {
                  setOvertimeHours(e.target.value);
                }
              }}
              placeholder="0.0"
              className="w-32 px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-mono font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
        </div>

        {/* Breakdown Status Section */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
              Machine Breakdown Status
            </span>
            {isBreakdown && breakdownStats?.isValid && (
              <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {breakdownStats.durationFormatted}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBreakdown(false);
                setMachineCondition("good");
              }}
              className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                !isBreakdown
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
              }`}
            >
              No Breakdown
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBreakdown(true);
                setMachineCondition("breakdown");
              }}
              className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                isBreakdown
                  ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
              }`}
            >
              Breakdown Reported
            </button>
          </div>

          {isBreakdown && (
            <div className="pt-2 border-t border-rose-500/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CustomTimePicker
                  label="Breakdown Start"
                  required
                  value={breakdownStartTime}
                  onChange={setBreakdownStartTime}
                  iconColor="text-amber-500"
                />
                <CustomTimePicker
                  label="Breakdown End"
                  required
                  value={breakdownEndTime}
                  onChange={setBreakdownEndTime}
                  iconColor="text-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--color-ink)] mb-1">
                  Machine Condition
                </label>
                <select
                  value={machineCondition}
                  onChange={(e) => setMachineCondition(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="needs_attention">Needs Attention</option>
                  <option value="breakdown">Breakdown</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Location & Remarks */}
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-[var(--color-ink)] mb-1">
              Site / Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Yard 2, Site Alpha"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block font-bold text-[var(--color-ink)] mb-1">
              Remarks & Log Notes
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes or observations regarding this shift..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
