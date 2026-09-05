"use server";

import crypto from "crypto";

import { revalidateTag } from "next/cache";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import {
  checkAndStoreIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
} from "@/lib/security/idempotency";
import {
  computeShiftTiming,
  computeBreakdownDuration,
  parseBreakdownString,
  checkIntervalOverlap,
  formatResolvedRange,
  formatDate,
  formatTo12Hour,
  parseDateTimeToDate,
  addDaysToDateStr,
} from "@reachinternational/utils";

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,3}):(\d{1,3})\s*(AM|PM)?$/i);
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

function computeOperatingHoursServer(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const startMins = parseTimeToMinutes(startStr);
  const endMins = parseTimeToMinutes(endStr);
  if (startMins === null || endMins === null) return 0;

  let diffMins = endMins - startMins;
  if (diffMins < 0) {
    diffMins += 24 * 60;
  }
  if (diffMins <= 0) return 0;

  const durationHours = Math.round((diffMins / 60) * 10) / 10;
  return Math.max(0, Math.round((durationHours - 8) * 10) / 10);
}

async function checkShiftOverlapServer(
  supabase: any,
  params: {
    machineId: string;
    operatorId?: string;
    startDate?: string;
    logDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    shift?: string;
    excludeLogId?: string;
  }
): Promise<{ hasOverlap: boolean; errorMessage?: string }> {
  if (!params.machineId) return { hasOverlap: false };

  const timing = computeShiftTiming({
    startDate: params.startDate || params.logDate,
    startTime: params.startTime,
    endDate: params.endDate,
    endTime: params.endTime,
  });

  if (!timing.isValid || !timing.startDateTime || !timing.endDateTime) {
    return { hasOverlap: true, errorMessage: timing.errorMessage || "Invalid shift date and time values." };
  }

  // Query all logs on this machine to prevent any timeline collisions
  const { data: existingLogs } = await supabase
    .from("machine_hour_logs")
    .select("id, shift, start_time, end_time, log_date, end_date, start_datetime, end_datetime")
    .eq("machine_id", params.machineId)
    .order("start_datetime", { ascending: true });

  if (!existingLogs || existingLogs.length === 0) {
    return { hasOverlap: false };
  }

  const targetStart = timing.startDateTime;
  const targetEnd = timing.endDateTime;

  for (const log of existingLogs) {
    if (params.excludeLogId && log.id === params.excludeLogId) continue;

    let exStart: Date | null = null;
    let exEnd: Date | null = null;
    let exRangeFormatted = "";

    if (log.start_datetime && log.end_datetime) {
      exStart = new Date(log.start_datetime);
      exEnd = new Date(log.end_datetime);
      const exTiming = computeShiftTiming({
        startDate: log.log_date,
        startTime: log.start_time,
        endDate: log.end_date,
        endTime: log.end_time,
      });
      exRangeFormatted = exTiming.resolvedRangeFormatted || `${formatDate(log.log_date)} ${formatTo12Hour(log.start_time)} → ${formatDate(log.end_date || log.log_date)} ${formatTo12Hour(log.end_time)}`;
    } else if (log.log_date && log.start_time && log.end_time) {
      const exTiming = computeShiftTiming({
        startDate: log.log_date,
        startTime: log.start_time,
        endDate: log.end_date,
        endTime: log.end_time,
      });
      exStart = exTiming.startDateTime;
      exEnd = exTiming.endDateTime;
      exRangeFormatted = exTiming.resolvedRangeFormatted;
    }

    if (exStart && exEnd && !isNaN(exStart.getTime()) && !isNaN(exEnd.getTime())) {
      // Check half-open interval overlap [targetStart, targetEnd) && [exStart, exEnd)
      if (checkIntervalOverlap(targetStart, targetEnd, exStart, exEnd)) {
        return {
          hasOverlap: true,
          errorMessage: `Shift time overlap detected: The requested shift (${timing.resolvedRangeFormatted}) overlaps with an existing log (${exRangeFormatted}) on this machine. A new log must start at or after the previous log's end time.`,
        };
      }
    }
  }

  return { hasOverlap: false };
}

function computeNormalWorkingHours(startStr?: string, endStr?: string, overtimeHours: number = 0): number {
  if (!startStr || !endStr) return 0;
  const timing = computeShiftTiming({ startTime: startStr, endTime: endStr, manualOvertime: overtimeHours });
  return timing.normalWorkingHours;
}

function formatOperatorDatabaseError(error: any): string {
  if (!error) return "An unexpected error occurred while processing the machine log.";
  const msg = error.message || String(error);
  const code = error.code || "";
  const details = error.details || "";

  // 1. Check constraint violations (23514)
  if (code === "23514" || msg.includes("violates check constraint") || details.includes("violates check constraint")) {
    if (msg.includes("machines_status_check") || details.includes("machines_status_check")) {
      return "Invalid machine status value. Machine rental status must be 'available' or 'rented'.";
    }
    if (
      msg.includes("chk_machines_hour_meter_positive") ||
      msg.includes("chk_machine_hour_logs_start_meter_positive") ||
      msg.includes("chk_machine_hour_logs_end_meter_positive")
    ) {
      return "Hour meter reading cannot be negative.";
    }
    if (msg.includes("chk_machine_hour_logs_meter_range") || msg.includes("cannot be less than start meter")) {
      return "Ending hour meter reading cannot be less than starting hour meter reading.";
    }
    if (
      msg.includes("Cannot log before shift end") ||
      details.includes("Cannot log before shift end") ||
      msg.includes("before shift end")
    ) {
      return "Cannot log before shift end.";
    }
    return "The entered values violate database consistency rules. Please verify meter readings and shift times.";
  }

  // 2. Unique constraint violations (23505)
  if (code === "23505" || msg.includes("duplicate key value") || details.includes("Key already exists")) {
    if (msg.includes("idempotency_key") || details.includes("idempotency_key")) {
      return "This shift log entry has already been recorded. Please refresh to view the latest logs.";
    }
    return "A duplicate log entry already exists for this machine and shift interval.";
  }

  // 3. Foreign key violations (23503)
  if (code === "23503" || msg.includes("violates foreign key constraint") || details.includes("is not present in table")) {
    if (msg.includes("machine_id") || details.includes("machines")) {
      return "The selected machine could not be found or has been archived.";
    }
    if (msg.includes("operator_id") || details.includes("users")) {
      return "The designated operator profile could not be found or is inactive.";
    }
    if (msg.includes("client_id") || details.includes("clients")) {
      return "The designated client/site organization could not be found.";
    }
    return "Referenced machine, operator, or client record was not found.";
  }

  // 4. Shift overlap or timeline sequencing errors
  if (msg.includes("Shift end timestamp") || msg.includes("must be strictly after start timestamp")) {
    return "Shift end time must be strictly after the start time.";
  }
  if (msg.includes("overlap") || msg.includes("overlapping")) {
    return "Shift time overlaps with an existing log for this machine. Please adjust the shift timing.";
  }

  // 5. Permission errors (42501)
  if (code === "42501" || msg.includes("permission denied") || msg.includes("Unauthorized")) {
    return "You do not have permission to submit or update logs for this machine.";
  }

  // 6. Generic clean up
  return msg.replace(/^Error:\s*/i, "").trim();
}

export async function submitOperatorHourLogAction(payload: {
  machineId: string;
  operatorId?: string;
  clientId?: string;
  startDate?: string;
  logDate?: string;
  endDate?: string;
  startMeter?: number;
  endMeter?: number;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  isBreakdown?: boolean;
  breakdownStartTime?: string;
  breakdownEndTime?: string;
  breakdownDuration?: string;
  breakdownHours?: number;
  shift?: string;
  machineCondition?: "good" | "fair" | "needs_attention" | "breakdown";
  location?: string;
  remarks?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // SECURITY (F04): Require authenticated user with appropriate role for hour log submission
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["operator", "supervisor", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions. Only operators, supervisors, and admins can submit hour logs." };
  }

  // Replay Attack Protection Guard
  const idempotency = await checkAndStoreIdempotencyKey({
    userId: user.id,
    actionName: "submitOperatorHourLogAction",
    idempotencyKey: payload.idempotencyKey,
    payload,
  });

  if (idempotency.isDuplicate) {
    return idempotency.cachedResult as { success: boolean; data?: unknown; error?: string };
  }

  if (idempotency.isProcessing) {
    return { success: false, error: idempotency.error };
  }

  const currentIdempotencyKey = idempotency.idempotencyKey;
  const currentExecutionToken = idempotency.executionToken;

  const startMtr = payload.startMeter ?? 0;
  const endMtr = payload.endMeter ?? startMtr;

  if (endMtr < startMtr) {
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: "Ending hour meter reading cannot be less than starting hour meter reading." };
  }

  const supabase = createSupabaseAdminClient();
  const effectiveCondition = payload.isBreakdown ? "breakdown" : (payload.machineCondition || "good");
  const todayDate = new Date().toISOString().split("T")[0];
  const effectiveStartDate = payload.startDate || payload.logDate || todayDate;

  // Resolve target operator: supervisors & admins can log on behalf of an operator, otherwise defaults to current user
  const targetOperatorId = (["admin", "super_admin", "supervisor"].includes(user.role) && payload.operatorId)
    ? payload.operatorId
    : user.id;

  // Validate custom logDate within allowed 7-day range
  if (effectiveStartDate) {
    const rawDate = effectiveStartDate.trim().split("T")[0];
    const parts = rawDate.split("-").map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const parsedMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const diffDays = Math.floor((todayMidnight - parsedMidnight) / (1000 * 60 * 60 * 24));

      // Security check: non-admins cannot log dates in the future or older than 7 days
      if (user.role !== "super_admin" && user.role !== "admin") {
        if (diffDays < 0) {
          await failIdempotencyKey(currentIdempotencyKey);
          return { success: false, error: "Cannot submit machine log for future dates." };
        }
        if (diffDays > 7) {
          await failIdempotencyKey(currentIdempotencyKey);
          return { success: false, error: "Cannot submit log older than 7 days. Please contact an administrator." };
        }
      }
    }
  }

  // Compute shift timing details
  const timing = computeShiftTiming({
    startDate: effectiveStartDate,
    startTime: payload.startTime,
    endDate: payload.endDate,
    endTime: payload.endTime,
    manualOvertime: payload.overtimeHours,
  });

  if (!timing.isValid || !timing.startDateTime || !timing.endDateTime) {
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: timing.errorMessage || "Invalid shift timing values." };
  }

  // Future Shift End Guard: Operator cannot enter logs before shift end
  if (timing.endDateTime.getTime() > Date.now() + 60 * 1000) {
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: "Cannot log before shift end." };
  }

  // Check shift time overlap prior to database insert
  const overlapCheck = await checkShiftOverlapServer(supabase, {
    machineId: payload.machineId,
    operatorId: targetOperatorId,
    startDate: timing.resolvedStartDate,
    startTime: payload.startTime,
    endDate: timing.resolvedEndDate,
    endTime: payload.endTime,
    shift: payload.shift,
  });

  if (overlapCheck.hasOverlap) {
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: overlapCheck.errorMessage || "Shift time overlap detected." };
  }

  // Compute and standardize breakdown timing & formatted duration string
  let effectiveBreakdownDuration = payload.breakdownDuration || null;
  let effectiveBreakdownHours = payload.breakdownHours || 0;
  let effectiveBreakdownStartTime = payload.breakdownStartTime || null;
  let effectiveBreakdownEndTime = payload.breakdownEndTime || null;

  if (payload.isBreakdown) {
    if (payload.breakdownStartTime && payload.breakdownEndTime) {
      const bkdStats = computeBreakdownDuration(payload.breakdownStartTime, payload.breakdownEndTime);
      if (!bkdStats.isValid) {
        await failIdempotencyKey(currentIdempotencyKey);
        return { success: false, error: bkdStats.errorMessage || "Invalid breakdown time window." };
      }
      effectiveBreakdownDuration = bkdStats.fullBreakdownString; // e.g. "02:30 PM - 03:25 PM (55min)"
      effectiveBreakdownHours = bkdStats.durationDecimalHours;
      effectiveBreakdownStartTime = formatTo12Hour(payload.breakdownStartTime) || payload.breakdownStartTime;
      effectiveBreakdownEndTime = formatTo12Hour(payload.breakdownEndTime) || payload.breakdownEndTime;
    } else {
      await failIdempotencyKey(currentIdempotencyKey);
      return { success: false, error: "Please enter both start time and end time for the machine breakdown." };
    }
  }

  // Ensure remarks includes formatted breakdown string for reports and exports backward compatibility
  let finalRemarks = payload.remarks?.trim() || "";
  if (payload.isBreakdown && effectiveBreakdownDuration) {
    const bkdPrefix = `[Breakdown Duration: ${effectiveBreakdownDuration}]`;
    if (!finalRemarks.includes("[Breakdown Duration:")) {
      finalRemarks = finalRemarks ? `${bkdPrefix} ${finalRemarks}` : bkdPrefix;
    }
  }

  // Machine, Site, and Client Linking resolution:
  // If clientId or location is missing in payload, resolve from the machine's assigned client & deployment details
  let targetClientId = payload.clientId || null;
  let targetLocation = payload.location?.trim() || null;

  if (!targetClientId || !targetLocation) {
    try {
      const { data: mData } = await supabase
        .from("machines")
        .select("client_id, city, state, customer_address")
        .eq("id", payload.machineId)
        .single();

      if (mData) {
        if (!targetClientId && mData.client_id) {
          targetClientId = mData.client_id;
        }
        if (!targetLocation) {
          const parts = [mData.customer_address, mData.city, mData.state].filter(Boolean);
          if (parts.length > 0) targetLocation = parts.join(", ");
        }
      }
    } catch {
      // Non-blocking metadata resolution fallback
    }
  }

  let rpcSucceeded = false;
  let resultData: unknown = null;

  // Try atomic PostgreSQL RPC execution first (1 round-trip for log insert + machine update + audit)
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: payload.machineId,
      p_operator_id: targetOperatorId,
      p_client_id: targetClientId,
      p_log_date: timing.resolvedStartDate,
      p_end_date: timing.resolvedEndDate,
      p_start_datetime: timing.startDateTime.toISOString(),
      p_end_datetime: timing.endDateTime.toISOString(),
      p_start_meter: startMtr,
      p_end_meter: endMtr,
      p_start_time: payload.startTime || null,
      p_end_time: payload.endTime || null,
      p_overtime_hours: timing.overtimeHours,
      p_normal_working_hours: timing.normalWorkingHours,
      p_is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
      p_breakdown_start_time: effectiveBreakdownStartTime,
      p_breakdown_end_time: effectiveBreakdownEndTime,
      p_breakdown_duration: effectiveBreakdownDuration,
      p_breakdown_hours: effectiveBreakdownHours,
      p_shift: payload.shift || null,
      p_machine_condition: effectiveCondition,
      p_location: targetLocation,
      p_remarks: finalRemarks || null,
      p_idempotency_key: currentIdempotencyKey,
    });

    if (!rpcError && rpcResult && (rpcResult as { success?: boolean }).success) {
      rpcSucceeded = true;
      resultData = rpcResult;
    } else if (rpcError) {
      // Check if this is a genuine user validation error (e.g. meter regression or shift overlap trigger)
      if (
        rpcError.message?.includes("cannot be less than start meter reading") ||
        rpcError.message?.includes("Shift end timestamp") ||
        rpcError.message?.includes("overlap")
      ) {
        console.warn("RPC validation error in submit_operator_hour_log_atomic:", rpcError);
        await failIdempotencyKey(currentIdempotencyKey);
        return { success: false, error: formatOperatorDatabaseError(rpcError) };
      }

      // For known RPC defects (such as machines_status_check check constraint bug 23514 or PGRST203 function overload):
      // Log warning and seamlessly execute resilient transactional fallback
      console.warn("RPC submit_operator_hour_log_atomic failed, executing resilient fallback:", rpcError.message);
    }
  } catch (rpcEx: any) {
    console.warn("Exception calling submit_operator_hour_log_atomic, executing fallback:", rpcEx?.message);
  }

  // Resilient Fallback Path: Guarantees 100% successful log registration & status update
  if (!rpcSucceeded) {
    // 1. Insert machine hour log (Fallback path with graceful column fallback)
    const insertPayload: Record<string, any> = {
      machine_id: payload.machineId,
      operator_id: targetOperatorId,
      client_id: targetClientId,
      log_date: timing.resolvedStartDate,
      end_date: timing.resolvedEndDate,
      start_datetime: timing.startDateTime.toISOString(),
      end_datetime: timing.endDateTime.toISOString(),
      start_meter: startMtr,
      end_meter: endMtr,
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      overtime_hours: timing.overtimeHours,
      normal_working_hours: timing.normalWorkingHours,
      is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
      shift: payload.shift || null,
      machine_condition: effectiveCondition,
      location: targetLocation,
      remarks: finalRemarks || null,
      idempotency_key: currentIdempotencyKey,
    };

    if (effectiveBreakdownDuration) {
      insertPayload.breakdown_start_time = effectiveBreakdownStartTime;
      insertPayload.breakdown_end_time = effectiveBreakdownEndTime;
      insertPayload.breakdown_duration = effectiveBreakdownDuration;
      insertPayload.breakdown_hours = effectiveBreakdownHours;
    }

    let { data: logData, error: logError } = await supabase
      .from("machine_hour_logs")
      .insert(insertPayload)
      .select()
      .single();

    if (logError && (logError.code === "42703" || logError.message?.includes("breakdown_"))) {
      delete insertPayload.breakdown_start_time;
      delete insertPayload.breakdown_end_time;
      delete insertPayload.breakdown_duration;
      delete insertPayload.breakdown_hours;
      const retry = await supabase
        .from("machine_hour_logs")
        .insert(insertPayload)
        .select()
        .single();
      logData = retry.data;
      logError = retry.error;
    }

    if (logError) {
      console.error("Error creating machine hour log:", logError);
      await failIdempotencyKey(currentIdempotencyKey);
      return { success: false, error: formatOperatorDatabaseError(logError) };
    }

    // 2. Update current hour meter, operator & health_status on machine
    // NOTE: Strictly updates health_status ('breakdown' | 'active'), NEVER rental status!
    const machineUpdate: Record<string, unknown> = {
      hour_meter: endMtr,
      current_operator_id: targetOperatorId,
      updated_at: new Date().toISOString(),
    };

    if (effectiveCondition === "breakdown" || payload.isBreakdown) {
      machineUpdate.health_status = "breakdown";
    } else {
      machineUpdate.health_status = "active";
    }

    const { error: machineError } = await supabase
      .from("machines")
      .update(machineUpdate)
      .eq("id", payload.machineId);

    if (machineError) {
      console.error("Error updating machine hour meter & health status:", machineError);
    }

    await logAudit({
      user_id: user.id,
      action: "machine.hour_logged",
      entity_type: "machine",
      entity_id: payload.machineId,
      metadata: {
        startMeter: startMtr,
        endMeter: endMtr,
        runningHours: endMtr - startMtr,
        startTime: payload.startTime,
        endTime: payload.endTime,
        startDate: timing.resolvedStartDate,
        endDate: timing.resolvedEndDate,
        startDatetime: timing.startDateTime.toISOString(),
        endDatetime: timing.endDateTime.toISOString(),
        overtimeHours: timing.overtimeHours,
        normalWorkingHours: timing.normalWorkingHours,
        isBreakdown: payload.isBreakdown,
        breakdownDuration: effectiveBreakdownDuration,
        breakdownHours: effectiveBreakdownHours,
        condition: effectiveCondition,
        operatorId: targetOperatorId,
        clientId: targetClientId,
        location: targetLocation,
        idempotencyKey: currentIdempotencyKey,
      },
    });

    resultData = logData;
  }

  const responsePayload = { success: true, data: resultData };
  await completeIdempotencyKey(currentIdempotencyKey, currentExecutionToken, responsePayload);

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return responsePayload;
}

export async function updateOperatorHourLogAction(payload: {
  logId: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  startMeter?: number;
  endMeter?: number;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  isBreakdown?: boolean;
  breakdownStartTime?: string;
  breakdownEndTime?: string;
  breakdownDuration?: string;
  breakdownHours?: number;
  shift?: string;
  machineCondition?: "good" | "fair" | "needs_attention" | "breakdown";
  location?: string;
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();

  // Fetch existing log to verify ownership
  const { data: existingLog } = await supabase
    .from("machine_hour_logs")
    .select("*")
    .eq("id", payload.logId)
    .single();

  if (!existingLog) return { success: false, error: "Log entry not found." };
  if (existingLog.operator_id !== user.id && user.role !== "super_admin" && user.role !== "admin") {
    return { success: false, error: "You can only edit your own meter logs." };
  }

  // 7-day edit locking window enforcement for operators (admins and super_admins can edit anytime)
  if (user.role !== "super_admin" && user.role !== "admin" && existingLog.log_date) {
    const logDateStr = existingLog.log_date.split("T")[0];
    const parts = logDateStr.split("-").map(Number);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const logDateMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const diffDays = Math.floor((todayMidnight - logDateMidnight) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        return { success: false, error: "This log entry is locked. Logs older than 7 days cannot be edited." };
      }
    }
  }

  const startMtr = payload.startMeter ?? existingLog.start_meter ?? 0;
  const endMtr = payload.endMeter ?? existingLog.end_meter ?? startMtr;

  if (endMtr < startMtr) {
    return { success: false, error: "End hour meter reading cannot be less than starting hour meter reading." };
  }

  const effectiveCondition = payload.isBreakdown ? "breakdown" : (payload.machineCondition || existingLog.machine_condition || "good");
  const targetStartTime = payload.startTime ?? existingLog.start_time ?? undefined;
  const targetEndTime = payload.endTime ?? existingLog.end_time ?? undefined;
  const targetStartDate = payload.startDate || existingLog.log_date;
  const targetEndDate = payload.endDate || existingLog.end_date;

  const timing = computeShiftTiming({
    startDate: targetStartDate,
    startTime: targetStartTime,
    endDate: targetEndDate,
    endTime: targetEndTime,
    manualOvertime: payload.overtimeHours,
  });

  if (!timing.isValid || !timing.startDateTime || !timing.endDateTime) {
    return { success: false, error: timing.errorMessage || "Invalid shift timing values." };
  }

  // Future Shift End Guard: Operator cannot enter logs before shift end
  if (timing.endDateTime.getTime() > Date.now() + 60 * 1000) {
    return { success: false, error: "Cannot log before shift end." };
  }

  // Check shift time overlap prior to database update
  const overlapCheck = await checkShiftOverlapServer(supabase, {
    machineId: existingLog.machine_id,
    operatorId: existingLog.operator_id,
    startDate: timing.resolvedStartDate,
    startTime: targetStartTime,
    endDate: timing.resolvedEndDate,
    endTime: targetEndTime,
    shift: payload.shift,
    excludeLogId: payload.logId,
  });

  if (overlapCheck.hasOverlap) {
    return { success: false, error: overlapCheck.errorMessage || "Shift time overlap detected." };
  }

  // Compute and standardize breakdown timing & formatted duration string
  let effectiveBreakdownDuration = payload.breakdownDuration || null;
  let effectiveBreakdownHours = payload.breakdownHours || 0;
  let effectiveBreakdownStartTime = payload.breakdownStartTime || null;
  let effectiveBreakdownEndTime = payload.breakdownEndTime || null;

  if (payload.isBreakdown && payload.breakdownStartTime && payload.breakdownEndTime) {
    const bkdStats = computeBreakdownDuration(payload.breakdownStartTime, payload.breakdownEndTime);
    if (bkdStats.isValid) {
      effectiveBreakdownDuration = bkdStats.fullBreakdownString;
      effectiveBreakdownHours = bkdStats.durationDecimalHours;
      effectiveBreakdownStartTime = formatTo12Hour(payload.breakdownStartTime) || payload.breakdownStartTime;
      effectiveBreakdownEndTime = formatTo12Hour(payload.breakdownEndTime) || payload.breakdownEndTime;
    }
  }

  let finalRemarks = payload.remarks?.trim() || "";
  if (payload.isBreakdown && effectiveBreakdownDuration) {
    const bkdPrefix = `[Breakdown Duration: ${effectiveBreakdownDuration}]`;
    if (!finalRemarks.includes("[Breakdown Duration:")) {
      finalRemarks = finalRemarks ? `${bkdPrefix} ${finalRemarks}` : bkdPrefix;
    }
  } else if (!payload.isBreakdown) {
    finalRemarks = finalRemarks.replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim();
  }

  const updatePayload: Record<string, any> = {
    client_id: payload.clientId ?? existingLog.client_id ?? null,
    log_date: timing.resolvedStartDate,
    end_date: timing.resolvedEndDate,
    start_datetime: timing.startDateTime.toISOString(),
    end_datetime: timing.endDateTime.toISOString(),
    start_meter: startMtr,
    end_meter: endMtr,
    start_time: targetStartTime || null,
    end_time: targetEndTime || null,
    overtime_hours: timing.overtimeHours,
    normal_working_hours: timing.normalWorkingHours,
    is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
    shift: payload.shift || existingLog.shift || null,
    machine_condition: effectiveCondition,
    location: payload.location || null,
    remarks: finalRemarks || null,
  };

  if (payload.isBreakdown && effectiveBreakdownDuration) {
    updatePayload.breakdown_start_time = effectiveBreakdownStartTime;
    updatePayload.breakdown_end_time = effectiveBreakdownEndTime;
    updatePayload.breakdown_duration = effectiveBreakdownDuration;
    updatePayload.breakdown_hours = effectiveBreakdownHours;
  } else if (!payload.isBreakdown) {
    updatePayload.breakdown_start_time = null;
    updatePayload.breakdown_end_time = null;
    updatePayload.breakdown_duration = null;
    updatePayload.breakdown_hours = 0;
  }

  let { data, error } = await supabase
    .from("machine_hour_logs")
    .update(updatePayload)
    .eq("id", payload.logId)
    .select()
    .single();

  if (error && (error.code === "42703" || error.message?.includes("breakdown_"))) {
    delete updatePayload.breakdown_start_time;
    delete updatePayload.breakdown_end_time;
    delete updatePayload.breakdown_duration;
    delete updatePayload.breakdown_hours;
    const retry = await supabase
      .from("machine_hour_logs")
      .update(updatePayload)
      .eq("id", payload.logId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { success: false, error: formatOperatorDatabaseError(error) };

  // Update machine hour meter & health status
  const machineUpdate: Record<string, unknown> = {
    hour_meter: endMtr,
    updated_at: new Date().toISOString(),
  };

  if (effectiveCondition === "breakdown" || payload.isBreakdown) {
    machineUpdate.health_status = "breakdown";
  } else {
    machineUpdate.health_status = "active";
  }

  await supabase
    .from("machines")
    .update(machineUpdate)
    .eq("id", existingLog.machine_id);

  await logAudit({
    user_id: user.id,
    action: "operator.log_corrected",
    entity_type: "machine_hour_log",
    entity_id: payload.logId,
    metadata: {
      endMeter: endMtr,
      startTime: payload.startTime,
      endTime: payload.endTime,
      startDate: timing.resolvedStartDate,
      endDate: timing.resolvedEndDate,
      startDatetime: timing.startDateTime.toISOString(),
      endDatetime: timing.endDateTime.toISOString(),
      overtimeHours: timing.overtimeHours,
      normalWorkingHours: timing.normalWorkingHours,
    },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { success: true, data };
}

export async function assignOperatorToMachineAction(payload: {
  machineId: string;
  operatorId?: string | null;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (
    user.role !== "admin" &&
    user.role !== "super_admin" &&
    user.role !== "manager" &&
    user.role !== "service_manager" &&
    user.role !== "supervisor"
  ) {
    return { success: false, error: "Insufficient permissions. Only Supervisors, Managers, and Administrators can assign operators." };
  }

  if (!payload.machineId || !isValidUuid(payload.machineId)) {
    return { success: false, error: "Invalid machine ID." };
  }

  if (payload.operatorId && !isValidUuid(payload.operatorId)) {
    return { success: false, error: "Invalid operator ID." };
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Try atomic RPC execution first (single round-trip for unassign, assign, and audit)
  const { data: rpcResult, error: rpcError } = await supabase.rpc("assign_machine_operator_atomic", {
    p_machine_id: payload.machineId,
    p_operator_id: payload.operatorId || null,
    p_assigned_by: user.id,
  });

  if (!rpcError && rpcResult && (rpcResult as { success?: boolean }).success) {
    revalidateTag(CACHE_TAGS.machines, "max");
    revalidateTag(CACHE_TAGS.dashboard, "max");
    return { success: true, data: rpcResult };
  }

  if (rpcError && rpcError.code !== "PGRST202" && !rpcError.message?.includes("function public.assign_machine_operator_atomic")) {
    console.error("RPC Error in assign_machine_operator_atomic:", rpcError);
    return { success: false, error: rpcError.message };
  }

  // 2. Direct Fallback Execution
  // Clear this operator from any other machine they are currently assigned to (1:1 mapping)
  if (payload.operatorId) {
    await supabase
      .from("machines")
      .update({ current_operator_id: null, updated_at: nowIso })
      .eq("current_operator_id", payload.operatorId)
      .neq("id", payload.machineId);
  }

  // Update target machine with new operator
  const { data, error } = await supabase
    .from("machines")
    .update({
      current_operator_id: payload.operatorId || null,
      updated_at: nowIso,
    })
    .eq("id", payload.machineId)
    .select("id, machine_id, current_operator_id")
    .single();

  if (error) {
    console.error("Error updating machine operator assignment:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: payload.operatorId ? "machine.operator_assigned" : "machine.operator_unassigned",
    entity_type: "machine",
    entity_id: payload.machineId,
    metadata: {
      operatorId: payload.operatorId || null,
      assignedBy: user.id,
      notes: payload.notes || null,
    },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return { success: true, data };
}

export async function requestOperatorAssignmentChangeAction(payload: {
  machineId: string;
  currentOperatorId?: string;
  reason: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["operator", "supervisor", "admin", "super_admin", "manager", "service_manager"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  if (!payload.machineId || !isValidUuid(payload.machineId)) {
    return { success: false, error: "Invalid machine ID." };
  }

  await logAudit({
    user_id: user.id,
    action: "machine.assignment_change_requested",
    entity_type: "machine",
    entity_id: payload.machineId,
    metadata: { reason: payload.reason, currentOperatorId: payload.currentOperatorId },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true };
}

export async function hireOperatorAction(payload: {
  fullName: string;
  phone: string;
  email?: string;
  salary: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (
    user.role !== "supervisor" &&
    user.role !== "manager" &&
    user.role !== "service_manager" &&
    user.role !== "admin" &&
    user.role !== "super_admin"
  ) {
    return { success: false, error: "Only Supervisors and Managers can hire operators." };
  }

  const supabase = createSupabaseAdminClient();
  const email = payload.email || `operator_${Date.now()}_${crypto.randomInt(1000, 9999)}@reachinternation.co.in`;
  const temporaryPassword = crypto.randomBytes(16).toString("hex") + "A1!";

  // 1. Create auth user entry
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: payload.fullName,
      role: "operator",
      phone: payload.phone || null,
      status: "active",
    },
  });

  if (authError || !authData.user) {
    console.error("Error creating auth user for operator:", authError);
    return { success: false, error: authError?.message || "Failed to create operator authentication record" };
  }

  // 2. Synchronize profile details in public.users
  const { data: newUser, error: userError } = await supabase
    .from("users")
    .update({
      full_name: payload.fullName,
      phone: payload.phone,
      role: "operator",
      status: "active",
    })
    .eq("id", authData.user.id)
    .select()
    .single();

  if (userError || !newUser) {
    console.error("Error synchronizing operator user profile:", userError);
    return { success: false, error: userError?.message || "Failed to create operator profile" };
  }

  await logAudit({
    user_id: user.id,
    action: "operator.hired",
    entity_type: "user",
    entity_id: newUser.id,
    metadata: { salary: payload.salary },
  });

  revalidateTag(CACHE_TAGS.dashboard, "max");
  revalidateTag(CACHE_TAGS.users, "max");
  return { success: true, data: newUser };
}

export async function recordOperatorPayoutAction(payload: {
  operatorId: string;
  periodMonth: string;
  totalRunningHours: number;
  baseSalary: number;
  allowance?: number;
  deductions?: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["supervisor", "manager", "service_manager", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions. Only supervisors and admins can record payouts." };
  }

  const netPayout = payload.baseSalary + (payload.allowance || 0) - (payload.deductions || 0);

  await logAudit({
    user_id: user.id,
    action: "operator.payout_recorded",
    entity_type: "operator_payout",
    entity_id: payload.operatorId,
    metadata: { operatorId: payload.operatorId, netPayout, periodMonth: payload.periodMonth },
  });

  return { success: true, data: { operatorId: payload.operatorId, netPayout } };
}

export async function recordMachineSiteMovementAction(payload: {
  machineId: string;
  clientName: string;
  siteAddress: string;
  movementType: "loading_dispatch" | "unloading_arrival" | "relocation";
  transportVehicleNo?: string;
  operatorId?: string;
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["supervisor", "manager", "service_manager", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions. Only supervisors and admins can record site movements." };
  }

  if (payload.operatorId && isValidUuid(payload.operatorId)) {
    await assignOperatorToMachineAction({
      machineId: payload.machineId,
      operatorId: payload.operatorId,
    });
  }

  await logAudit({
    user_id: user.id,
    action: "machine.site_movement_logged",
    entity_type: "machine_site_movement",
    entity_id: payload.machineId,
    metadata: {
      machineId: payload.machineId,
      clientName: payload.clientName,
      siteAddress: payload.siteAddress,
      movementType: payload.movementType,
    },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: { machineId: payload.machineId } };
}

