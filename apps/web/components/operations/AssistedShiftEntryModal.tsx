"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal, Button, useToast, Badge } from "@/components/ui";
import { HMRInputs } from "@/components/operations/entry/HMRInputs";
import { ShiftInputs } from "@/components/operations/entry/ShiftInputs";
import { BreakdownSection } from "@/components/operations/entry/BreakdownSection";
import { submitOperatorHourLogAction } from "@/app/actions/operators";
import { getClientShiftCodesAction } from "@/app/actions/clients";
import {
  getISTDateString,
  formatTo12Hour,
  computeBreakdownDuration,
  resolveDefaultOperatorShift,
  calculateEffectiveShiftDurationHours,
} from "@reachinternational/utils";
import type { TodayShiftMonitorRow, ClientShiftCode } from "@reachinternational/types";
import { Clock, Send, Building, Truck, AlertTriangle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  getCachedClientShifts,
  setCachedClientShifts,
  CLIENT_SHIFTS_INVALIDATED_EVENT,
} from "@/lib/cache/client-shifts-cache";

export interface AssistedShiftEntrySuccessData {
  machineId: string;
  operatorId?: string;
  startMeter: number;
  endMeter: number;
  runningHours: number;
  shiftCode: string;
  logDate: string;
}

interface AssistedShiftEntryModalProps {
  open: boolean;
  onClose: () => void;
  row: TodayShiftMonitorRow | null;
  userRole?: string;
  onSuccess: (data?: AssistedShiftEntrySuccessData) => void;
}

export function AssistedShiftEntryModal({
  open,
  onClose,
  row,
  userRole,
  onSuccess,
}: AssistedShiftEntryModalProps) {

  const { toast } = useToast();

  const [logDate, setLogDate] = useState<string>(() => getISTDateString());
  const [startMeter, setStartMeter] = useState<string>("0");
  const [endMeter, setEndMeter] = useState<string>("");
  const [isStartMeterLocked, setIsStartMeterLocked] = useState<boolean>(true);

  const [clientShifts, setClientShifts] = useState<ClientShiftCode[]>([]);
  const [assignedShiftCodes, setAssignedShiftCodes] = useState<string[]>([]);
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>("S1");

  const [startTime, setStartTime] = useState<string>("06:00 AM");
  const [endTime, setEndTime] = useState<string>("12:00 PM");
  const [overtimeHours, setOvertimeHours] = useState<string>("0");

  const [isBreakdown, setIsBreakdown] = useState<boolean>(false);
  const [breakdownStartTime, setBreakdownStartTime] = useState<string>("02:00 PM");
  const [breakdownEndTime, setBreakdownEndTime] = useState<string>("03:00 PM");
  const [breakdownReason, setBreakdownReason] = useState<string>("");

  const [remarks, setRemarks] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const activeShift = useMemo(() => {
    if (!clientShifts || clientShifts.length === 0) return null;
    return (
      clientShifts.find((s) => {
        const sNorm = s.code.replace(/^shift\s+/i, "").trim().toUpperCase();
        const selNorm = (selectedShiftCode || "").replace(/^shift\s+/i, "").trim().toUpperCase();
        return s.code.toUpperCase() === (selectedShiftCode || "").toUpperCase() || sNorm === selNorm;
      }) || null
    );
  }, [clientShifts, selectedShiftCode]);

  // Fetch operator's active assigned shifts on this equipment to verify assigned vs unassigned status
  useEffect(() => {
    if (!open || !row?.machine_id || !row?.operator_id) {
      setAssignedShiftCodes([]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("operator_machine_assignments")
      .select("shift_code")
      .eq("machine_id", row.machine_id)
      .eq("operator_id", row.operator_id)
      .eq("is_active", true)
      .then(({ data }: { data: any }) => {
        const codes = (data || []).map((d: any) => d.shift_code?.trim()).filter(Boolean);
        if (codes.length > 0) {
          setAssignedShiftCodes(codes);
        } else if (row.shift_code) {
          setAssignedShiftCodes([row.shift_code]);
        } else {
          setAssignedShiftCodes([]);
        }
      })
      .catch(() => {
        if (row.shift_code) setAssignedShiftCodes([row.shift_code]);
      });
  }, [open, row?.machine_id, row?.operator_id, row?.shift_code]);

  // Determine if manager is logging for an unassigned shift (Assisted Override)
  const isShiftUnassigned = useMemo(() => {
    if (!selectedShiftCode || assignedShiftCodes.length === 0) return false;
    const selNorm = selectedShiftCode.replace(/^shift\s*/i, "").trim().toUpperCase();
    return !assignedShiftCodes.some(
      (c) => c.replace(/^shift\s*/i, "").trim().toUpperCase() === selNorm
    );
  }, [selectedShiftCode, assignedShiftCodes]);

  const loadShifts = useCallback(async (clientId: string, bypassCache = false) => {
    if (!bypassCache) {
      const cached = getCachedClientShifts(clientId);
      if (cached && cached.length > 0) {
        setClientShifts(cached);
        return;
      }
    }

    try {
      const res = await getClientShiftCodesAction(clientId);
      if (res.success && res.data && res.data.length > 0) {
        const formatted: ClientShiftCode[] = res.data
          .filter((s: any) => s.is_active !== false)
          .map((s: any) => ({
            ...s,
            raw_start_time: formatTo12Hour(s.start_time) || s.start_time,
            raw_end_time: formatTo12Hour(s.end_time) || s.end_time,
            start_time: formatTo12Hour(s.start_time) || s.start_time,
            end_time: formatTo12Hour(s.end_time) || s.end_time,
          }));
        setCachedClientShifts(clientId, formatted);
        setClientShifts(formatted);
      } else {
        setClientShifts([]);
      }
    } catch {
      setClientShifts([]);
    }
  }, []);

  // Initialize/reset form state when a new row is opened
  useEffect(() => {
    if (row && open) {
      setLogDate(row.log_date || getISTDateString());
      const initialHmr = row.current_meter != null ? String(row.current_meter) : "0";
      setStartMeter(initialHmr);
      setEndMeter(initialHmr);
      setIsStartMeterLocked(true);

      const initialShift = row.shift_code || "S1";
      setSelectedShiftCode(initialShift);

      const formattedStart = row.shift_start ? formatTo12Hour(row.shift_start) : "06:00 AM";
      const formattedEnd = row.shift_end ? formatTo12Hour(row.shift_end) : "12:00 PM";
      setStartTime(formattedStart || "06:00 AM");
      setEndTime(formattedEnd || "12:00 PM");
      setOvertimeHours("0");

      setIsBreakdown(false);
      setBreakdownStartTime("02:00 PM");
      setBreakdownEndTime("03:00 PM");
      setBreakdownReason("");
      setRemarks("");
      setSubmitting(false);

      if (row.client_id) {
        loadShifts(row.client_id);
      } else {
        setClientShifts([]);
      }
    }
  }, [row, open, loadShifts]);

  // Synchronize and auto-resolve the operator's exact client-defined shift whenever clientShifts load
  useEffect(() => {
    if (!open || !row) return;

    if (clientShifts && clientShifts.length > 0) {
      const resolved = resolveDefaultOperatorShift(
        {
          assigned_shift_code: row.shift_code,
          operator: {
            shift_code: row.shift_code,
            shift_start: row.shift_start,
            shift_end: row.shift_end,
            raw_shift_start: row.shift_start,
            raw_shift_end: row.shift_end,
          },
        },
        clientShifts
      );

      if (resolved) {
        setSelectedShiftCode(resolved.code);
        const s = formatTo12Hour(resolved.start_time || resolved.raw_start_time);
        const e = formatTo12Hour(resolved.end_time || resolved.raw_end_time);
        if (s) setStartTime(s);
        if (e) setEndTime(e);
        if (resolved.default_ot_minutes && resolved.default_ot_minutes > 0) {
          setOvertimeHours((resolved.default_ot_minutes / 60).toString());
        }
      }
    }
  }, [clientShifts, row, open]);

  // Listen for client shifts cache invalidation events (e.g. shifts added/edited in /clients/[id])
  useEffect(() => {
    const currentClientId = row?.client_id;
    if (!open || !currentClientId) return;

    const handleInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ clientId?: string }>;
      const targetClientId = customEvent.detail?.clientId;
      if (!targetClientId || targetClientId === currentClientId) {
        loadShifts(currentClientId, true);
      }
    };

    window.addEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleInvalidation);
    return () => {
      window.removeEventListener(CLIENT_SHIFTS_INVALIDATED_EVENT, handleInvalidation);
    };
  }, [open, row?.client_id, loadShifts]);

  const handleStartMeterChange = useCallback(
    (val: string) => {
      setEndMeter((prev) => (prev === startMeter || prev === "" ? val : prev));
      setStartMeter(val);
    },
    [startMeter]
  );

  const startNum = parseFloat(startMeter) || 0;
  const endNum = parseFloat(endMeter) || 0;
  const runningHours = useMemo(() => {
    if (endMeter === "" || endNum < startNum) return 0;
    return Math.max(0, Math.round((endNum - startNum) * 10) / 10);
  }, [startNum, endNum, endMeter]);

  const breakdownStats = useMemo(() => {
    if (!isBreakdown || !breakdownStartTime || !breakdownEndTime) return null;
    return computeBreakdownDuration(breakdownStartTime, breakdownEndTime);
  }, [isBreakdown, breakdownStartTime, breakdownEndTime]);

  const shiftDurationHours = useMemo(() => {
    return calculateEffectiveShiftDurationHours({
      startTime,
      endTime,
      scheduledMinutes: activeShift?.scheduled_minutes,
      normalMinutes: activeShift?.normal_minutes,
      overtimeHours,
    });
  }, [startTime, endTime, activeShift, overtimeHours]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row || submitting) return;

    if (userRole && !["super_admin", "admin", "manager"].includes(userRole)) {
      toast("error", "Unauthorized Action", "Only roles above supervisor (manager, admin, super_admin) can enter shift logs.");
      return;
    }

    if (!selectedShiftCode || !selectedShiftCode.trim()) {
      toast("error", "Shift Required", "Please select an operational shift before submitting.");
      return;
    }

    if (!endMeter.trim() || endNum < startNum) {
      toast("error", "Invalid Meter Reading", "End meter reading must be at least equal to start meter.");
      return;
    }

    if (runningHours > 24) {
      toast("error", "Excessive Running Hours", "Running hours cannot exceed 24 hours per shift.");
      return;
    }

    if (isBreakdown) {
      if (!breakdownStartTime || !breakdownEndTime) {
        toast("error", "Breakdown Window Required", "Please enter breakdown start and end times.");
        return;
      }
      const maxAllowedDuration = shiftDurationHours > 0 ? shiftDurationHours : 24;
      if (breakdownStats && breakdownStats.durationDecimalHours > maxAllowedDuration) {
        toast(
          "error",
          "Breakdown Exceeds Shift",
          `Breakdown duration (${breakdownStats.durationDecimalHours}h) cannot exceed total shift duration (${maxAllowedDuration}h).`
        );
        return;
      }
    }

    setSubmitting(true);

    let bkdDurationStr: string | undefined;
    let bkdHours = 0;
    if (isBreakdown && breakdownStats?.isValid) {
      bkdDurationStr = breakdownStats.fullBreakdownString;
      bkdHours = breakdownStats.durationDecimalHours;
    }

    const finalRemarks = [
      remarks.trim(),
      isBreakdown && breakdownReason.trim() ? `[Breakdown: ${breakdownReason.trim()}]` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await submitOperatorHourLogAction({
        machineId: row.machine_id,
        operatorId: row.operator_id || undefined,
        clientId: row.client_id || undefined,
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
        shiftCode: selectedShiftCode || row.shift_code || undefined,
        machineCondition: isBreakdown ? "breakdown" : "good",
        remarks: finalRemarks || undefined,
      });

      if (res.success) {
        toast("success", "Shift Log Recorded", `Successfully entered shift log for ${row.operator_name}.`);

        // Real-time broadcast dispatch to target operator alert channel
        try {
          const supabase = createSupabaseBrowserClient();
          const alertChannel = supabase.channel(`operator-alerts:${row.operator_id}`);
          alertChannel.subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              alertChannel.send({
                type: "broadcast",
                event: "assisted_shift_logged",
                payload: {
                  title: "Shift Logged on Your Behalf",
                  body: `A supervisor recorded your shift on equipment ${row.machine_code} (${runningHours}h).`,
                  operatorId: row.operator_id,
                  operatorName: row.operator_name,
                  machineCode: row.machine_code,
                  runningHours,
                  logDate,
                },
              });
            }
          });
        } catch (bcastErr) {
          console.warn("Failed to dispatch operator alert broadcast:", bcastErr);
        }

        // Real-time broadcast dispatch to operations-roster channel for all supervisors & admins
        try {
          const supabase = createSupabaseBrowserClient();
          const rosterChannel = supabase.channel("operations-roster");
          rosterChannel.subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              rosterChannel.send({
                type: "broadcast",
                event: "log_entered",
                payload: {
                  machineId: row.machine_id,
                  operatorId: row.operator_id,
                  shiftCode: selectedShiftCode || row.shift_code || "S1",
                  startMeter: startNum,
                  endMeter: endNum,
                  runningHours,
                  logDate,
                },
              });
            }
          });
        } catch (rosterErr) {
          console.warn("Failed to dispatch roster broadcast:", rosterErr);
        }

        onSuccess({
          machineId: row.machine_id,
          operatorId: row.operator_id || undefined,
          startMeter: startNum,
          endMeter: endNum,
          runningHours,
          shiftCode: selectedShiftCode || row.shift_code || "S1",
          logDate,
        });
        onClose();
      } else {
        toast("error", "Submission Failed", res.error || "Could not save assisted shift log.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast("error", "Submission Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assisted Shift Entry"
      description={
        row ? (
          <span>
            Logging today&apos;s shift on behalf of{" "}
            <strong className="text-[var(--color-ink)]">{row.operator_name}</strong>
          </span>
        ) : undefined
      }
    >
      {row && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Operator & Machine Context Card */}
          <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-[var(--color-ink)]">
                  {row.operator_name}
                </span>
                <Badge variant={isShiftUnassigned ? "warning" : "info"} className="text-[10px] px-1.5 py-0.5 font-mono">
                  Shift {activeShift?.code || selectedShiftCode || row.shift_code}
                  {activeShift?.name ? (() => {
                    const sub = activeShift.name
                      .replace(new RegExp(`^shift\\s*${activeShift.code}\\s*[:\\-•]?\\s*\\(?`, "i"), "")
                      .replace(/\)$/, "")
                      .trim();
                    return sub && sub.toLowerCase() !== activeShift.code.toLowerCase() ? ` • ${sub}` : "";
                  })() : (row.shift_name ? (() => {
                    const sub = row.shift_name
                      .replace(new RegExp(`^shift\\s*${row.shift_code}\\s*[:\\-•]?\\s*\\(?`, "i"), "")
                      .replace(/\)$/, "")
                      .trim();
                    return sub && sub.toLowerCase() !== row.shift_code.toLowerCase() ? ` • ${sub}` : "";
                  })() : "")}
                </Badge>
                {isShiftUnassigned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-in fade-in duration-200">
                    <AlertTriangle size={11} className="shrink-0 text-amber-500" />
                    Assisted Override
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Clock size={12} className="h-3 w-3 shrink-0" />
                <span>
                  {startTime} – {endTime}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-[var(--color-hairline)]/60">
              <div className="flex items-center gap-1.5 truncate">
                <Truck size={12} className="h-3 w-3 shrink-0 text-sky-500" />
                <span className="font-mono">{row.machine_code}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Building size={12} className="h-3 w-3 shrink-0 text-amber-500" />
                <span className="truncate">{row.client_name}</span>
              </div>
            </div>
          </div>

          {/* HMR Inputs */}
          <HMRInputs
            startMeter={startMeter}
            endMeter={endMeter}
            onStartMeterChange={handleStartMeterChange}
            onEndMeterChange={setEndMeter}
            runningHours={runningHours}
            isStartMeterLocked={isStartMeterLocked}
            onToggleLock={() => setIsStartMeterLocked(!isStartMeterLocked)}
          />

          {/* Shift Timings, Client Shifts & Overtime (Unified Shared Component) */}
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
            shiftCodes={clientShifts.length > 0 ? clientShifts : undefined}
            assignedShiftCodes={assignedShiftCodes}
            selectedShiftCode={selectedShiftCode}
            onSelectShiftCode={setSelectedShiftCode}
          />

          {/* Assisted Override Confirmation Banner when Manager logs for unassigned shift */}
          {isShiftUnassigned && (
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                  <span>Assisted Override Active</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 font-mono">
                    Emergency Substitute
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                  <strong>{row.operator_name}</strong> is rostered for Shift {assignedShiftCodes.join(", ")}, but you are recording for unassigned Shift {selectedShiftCode}. Submitting will record this emergency substitute shift with managerial supervisor override attribution.
                </p>
              </div>
            </div>
          )}

          {/* Breakdown Section */}
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

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)] mb-1 block">
              Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Operational notes, site observations..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-1 focus:ring-[var(--color-link)] resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-hairline)]">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
              className="text-xs font-semibold flex-1 sm:flex-none h-10 sm:h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!endMeter.trim() || endNum < startNum}
              icon={<Send size={14} className="h-3.5 w-3.5" />}
              className="text-xs font-semibold flex-1 sm:flex-none h-10 sm:h-9"
            >
              {isShiftUnassigned ? "Submit Override Log" : "Submit Shift Log"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
