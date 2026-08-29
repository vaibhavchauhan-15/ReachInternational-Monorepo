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

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
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
    operatorId: string;
    logDate: string;
    startTime?: string;
    endTime?: string;
    shift?: string;
    excludeLogId?: string;
  }
): Promise<{ hasOverlap: boolean; errorMessage?: string }> {
  const { data: existingLogs } = await supabase
    .from("machine_hour_logs")
    .select("id, shift, start_time, end_time, log_date")
    .eq("log_date", params.logDate)
    .or(`machine_id.eq.${params.machineId},operator_id.eq.${params.operatorId}`);

  if (!existingLogs || existingLogs.length === 0) {
    return { hasOverlap: false };
  }

  const newS = parseTimeToMinutes(params.startTime);
  let newE = parseTimeToMinutes(params.endTime);

  if (newS !== null && newE !== null && newE <= newS) {
    newE += 1440;
  }

  for (const log of existingLogs) {
    if (params.excludeLogId && log.id === params.excludeLogId) continue;

    if (newS !== null && newE !== null) {
      const exS = parseTimeToMinutes(log.start_time);
      let exE = parseTimeToMinutes(log.end_time);

      if (exS !== null && exE !== null) {
        if (exE <= exS) exE += 1440;

        if (Math.max(newS, exS) < Math.min(newE, exE)) {
          return {
            hasOverlap: true,
            errorMessage: `Time overlap detected: Selected period (${params.startTime} - ${params.endTime}) overlaps with existing entry (${log.start_time} - ${log.end_time}) on ${params.logDate}. Operating time periods must not overlap.`,
          };
        }
      }
    }
  }

  return { hasOverlap: false };
}

function computeNormalWorkingHours(startStr?: string, endStr?: string, overtimeHours: number = 0): number {
  if (!startStr || !endStr) return 0;
  const parseMins = (t: string) => {
    const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (match[3] === "PM" && h < 12) h += 12;
    if (match[3] === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };
  const s = parseMins(startStr);
  const e = parseMins(endStr);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  const duration = Math.round((diff / 60) * 10) / 10;
  return Math.max(0, Math.round((duration - overtimeHours - 1.0) * 10) / 10);
}

export async function submitOperatorHourLogAction(payload: {
  machineId: string;
  clientId?: string;
  startMeter?: number;
  endMeter?: number;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  isBreakdown?: boolean;
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
    return { success: false, error: "End hour meter reading cannot be less than starting hour meter reading." };
  }

  const supabase = createSupabaseAdminClient();
  const effectiveCondition = payload.isBreakdown ? "breakdown" : (payload.machineCondition || "good");
  const todayDate = new Date().toISOString().split("T")[0];

  // Check shift time overlap prior to database insert
  const overlapCheck = await checkShiftOverlapServer(supabase, {
    machineId: payload.machineId,
    operatorId: user.id,
    logDate: todayDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    shift: payload.shift,
  });

  if (overlapCheck.hasOverlap) {
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: overlapCheck.errorMessage || "Shift time overlap detected." };
  }

  // Use manually entered overtime_hours from payload (or default to 0)
  const manualOvertime = payload.overtimeHours ?? 0;
  const normalWorkingHours = computeNormalWorkingHours(payload.startTime, payload.endTime, manualOvertime);

  // Try atomic PostgreSQL RPC execution first (1 round-trip for log insert + machine update + audit)
  const { data: rpcResult, error: rpcError } = await supabase.rpc("submit_operator_hour_log_atomic", {
    p_machine_id: payload.machineId,
    p_operator_id: user.id,
    p_client_id: payload.clientId || null,
    p_log_date: todayDate,
    p_start_meter: startMtr,
    p_end_meter: endMtr,
    p_start_time: payload.startTime || null,
    p_end_time: payload.endTime || null,
    p_overtime_hours: manualOvertime,
    p_is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
    p_shift: payload.shift || null,
    p_machine_condition: effectiveCondition,
    p_location: payload.location || null,
    p_remarks: payload.remarks || null,
    p_idempotency_key: currentIdempotencyKey,
    p_normal_working_hours: normalWorkingHours,
  });

  if (!rpcError && rpcResult && (rpcResult as { success?: boolean }).success) {
    const responsePayload = { success: true, data: rpcResult };
    await completeIdempotencyKey(currentIdempotencyKey, currentExecutionToken, responsePayload);

    revalidateTag(CACHE_TAGS.machines, "max");
    revalidateTag(CACHE_TAGS.dashboard, "max");
    return responsePayload;
  }

  // Fallback: If RPC is not available in environment or returns a business exception
  if (rpcError && rpcError.code !== "PGRST202" && !rpcError.message?.includes("function public.submit_operator_hour_log_atomic")) {
    console.error("RPC Error in submit_operator_hour_log_atomic:", rpcError);
    await failIdempotencyKey(currentIdempotencyKey);
    return { success: false, error: rpcError.message };
  }

  // 1. Insert machine hour log (Fallback path)
  const { data: logData, error: logError } = await supabase
    .from("machine_hour_logs")
    .insert({
      machine_id: payload.machineId,
      operator_id: user.id,
      client_id: payload.clientId || null,
      log_date: todayDate,
      start_meter: startMtr,
      end_meter: endMtr,
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      overtime_hours: manualOvertime,
      normal_working_hours: normalWorkingHours,
      is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
      shift: payload.shift || null,
      machine_condition: effectiveCondition,
      location: payload.location || null,
      remarks: payload.remarks || null,
      idempotency_key: currentIdempotencyKey,
    })
    .select()
    .single();

  if (logError) {
    console.error("Error creating machine hour log:", logError);
    await failIdempotencyKey(currentIdempotencyKey);
    const errMessage = logError.message.includes("Shift time overlap") || logError.message.includes("Shift overlap")
      ? logError.message
      : logError.message;
    return { success: false, error: errMessage };
  }

  // 2. Update current hour meter & status on machine
  const machineUpdate: Record<string, unknown> = {
    hour_meter: endMtr,
    current_operator_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (effectiveCondition === "breakdown") {
    machineUpdate.status = "under_maintenance";
  }

  const { error: machineError } = await supabase
    .from("machines")
    .update(machineUpdate)
    .eq("id", payload.machineId);

  if (machineError) {
    console.error("Error updating machine hour meter:", machineError);
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
      overtimeHours: payload.overtimeHours,
      isBreakdown: payload.isBreakdown,
      condition: effectiveCondition,
      idempotencyKey: currentIdempotencyKey,
    },
  });

  const responsePayload = { success: true, data: logData };
  await completeIdempotencyKey(currentIdempotencyKey, currentExecutionToken, responsePayload);

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return responsePayload;
}

export async function updateOperatorHourLogAction(payload: {
  logId: string;
  clientId?: string;
  startMeter?: number;
  endMeter?: number;
  startTime?: string;
  endTime?: string;
  overtimeHours?: number;
  isBreakdown?: boolean;
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

  const startMtr = payload.startMeter ?? existingLog.start_meter ?? 0;
  const endMtr = payload.endMeter ?? existingLog.end_meter ?? startMtr;

  if (endMtr < startMtr) {
    return { success: false, error: "End hour meter reading cannot be less than starting hour meter reading." };
  }

  const effectiveCondition = payload.isBreakdown ? "breakdown" : (payload.machineCondition || existingLog.machine_condition || "good");
  const targetStartTime = payload.startTime ?? existingLog.start_time ?? undefined;
  const targetEndTime = payload.endTime ?? existingLog.end_time ?? undefined;

  // Check shift time overlap prior to database update
  const overlapCheck = await checkShiftOverlapServer(supabase, {
    machineId: existingLog.machine_id,
    operatorId: existingLog.operator_id,
    logDate: existingLog.log_date,
    startTime: targetStartTime,
    endTime: targetEndTime,
    shift: payload.shift,
    excludeLogId: payload.logId,
  });

  if (overlapCheck.hasOverlap) {
    return { success: false, error: overlapCheck.errorMessage || "Shift time overlap detected." };
  }

  const manualOvertime = payload.overtimeHours ?? 0;
  const normalWorkingHours = computeNormalWorkingHours(targetStartTime, targetEndTime, manualOvertime);

  const { data, error } = await supabase
    .from("machine_hour_logs")
    .update({
      client_id: payload.clientId ?? existingLog.client_id ?? null,
      start_meter: startMtr,
      end_meter: endMtr,
      start_time: targetStartTime || null,
      end_time: targetEndTime || null,
      overtime_hours: manualOvertime,
      normal_working_hours: normalWorkingHours,
      is_breakdown: payload.isBreakdown ?? (effectiveCondition === "breakdown"),
      shift: payload.shift || existingLog.shift || null,
      machine_condition: effectiveCondition,
      location: payload.location || null,
      remarks: payload.remarks || null,
    })
    .eq("id", payload.logId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Update machine hour meter
  await supabase
    .from("machines")
    .update({ hour_meter: endMtr, updated_at: new Date().toISOString() })
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
      overtimeHours: manualOvertime,
      normalWorkingHours,
    },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { success: true, data };
}

export async function assignOperatorToMachineAction(payload: {
  machineId: string;
  operatorId: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (user.role === "operator") {
    return { success: false, error: "Operators cannot assign or reassign equipment." };
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // 1. End any existing active assignment for this machine
  await supabase
    .from("machine_assignments")
    .update({ status: "ended", unassigned_at: nowIso })
    .eq("machine_id", payload.machineId)
    .eq("status", "active");

  // 2. End any existing active assignment for this operator on ANY other machine
  const { data: previousOperatorAssignments } = await supabase
    .from("machine_assignments")
    .select("machine_id")
    .eq("operator_id", payload.operatorId)
    .eq("status", "active");

  if (previousOperatorAssignments && previousOperatorAssignments.length > 0) {
    await supabase
      .from("machine_assignments")
      .update({ status: "ended", unassigned_at: nowIso })
      .eq("operator_id", payload.operatorId)
      .eq("status", "active");

    for (const prev of previousOperatorAssignments) {
      if (prev.machine_id !== payload.machineId) {
        await supabase
          .from("machines")
          .update({ current_operator_id: null, updated_at: nowIso })
          .eq("id", prev.machine_id)
          .eq("current_operator_id", payload.operatorId);
      }
    }
  }

  // 3. Clear current_operator_id on any machine currently mapped to this operator
  await supabase
    .from("machines")
    .update({ current_operator_id: null, updated_at: nowIso })
    .eq("current_operator_id", payload.operatorId)
    .neq("id", payload.machineId);

  // 4. Insert new active machine assignment
  const { data, error } = await supabase
    .from("machine_assignments")
    .insert({
      machine_id: payload.machineId,
      operator_id: payload.operatorId,
      assigned_by: user.id,
      assigned_at: nowIso,
      status: "active",
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error assigning operator:", error);
    return { success: false, error: error.message };
  }

  // 5. Update target machine current_operator_id
  await supabase
    .from("machines")
    .update({ current_operator_id: payload.operatorId, updated_at: nowIso })
    .eq("id", payload.machineId);

  await logAudit({
    user_id: user.id,
    action: "machine.operator_assigned",
    entity_type: "machine",
    entity_id: payload.machineId,
    metadata: { operatorId: payload.operatorId, notes: payload.notes },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}


export async function requestOperatorAssignmentChangeAction(payload: {
  machineId: string;
  currentOperatorId?: string;
  reason: string;
}) {
  // SECURITY (F04): Require authenticated user with appropriate role for assignment change requests
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["operator", "supervisor", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.from("notifications").insert({
    machine_id: payload.machineId,
    recipient_id: user.id,
    alert_type: "assignment_change_request",
    alert_date: new Date().toISOString().split("T")[0],
    channel: "in_app",
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating assignment change request:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "machine.assignment_change_requested",
    entity_type: "machine",
    entity_id: payload.machineId,
    metadata: { reason: payload.reason, currentOperatorId: payload.currentOperatorId },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
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

  // 3. Create employee directory record
  const empCode = `EMP-OP-${crypto.randomInt(1000, 10000)}`;
  await supabase.from("employees").insert({
    employee_code: empCode,
    full_name: payload.fullName,
    designation: "Machine Operator",
    department: "Operations",
    user_id: newUser.id,
    phone: payload.phone,
    email,
    salary: payload.salary,
    status: "active",
  });

  await logAudit({
    user_id: user.id,
    action: "operator.hired",
    entity_type: "user",
    entity_id: newUser.id,
    metadata: { empCode, salary: payload.salary },
  });

  revalidateTag(CACHE_TAGS.dashboard, "max");
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
  // SECURITY (F04): Require supervisor/admin role for financial payout recording
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["supervisor", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions. Only supervisors and admins can record payouts." };
  }

  const supabase = createSupabaseAdminClient();
  const netPayout = payload.baseSalary + (payload.allowance || 0) - (payload.deductions || 0);

  const { data, error } = await supabase
    .from("operator_payouts")
    .insert({
      operator_id: payload.operatorId,
      supervisor_id: user.id,
      period_month: payload.periodMonth,
      total_running_hours: payload.totalRunningHours,
      base_salary: payload.baseSalary,
      allowance: payload.allowance || 0,
      deductions: payload.deductions || 0,
      net_payout: netPayout,
      payment_status: "paid",
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error recording operator payout:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "operator.payout_recorded",
    entity_type: "operator_payout",
    entity_id: data.id,
    metadata: { operatorId: payload.operatorId, netPayout },
  });

  return { success: true, data };
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
  // SECURITY (F04): Require supervisor/admin role for site movement recording
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!["supervisor", "admin", "super_admin"].includes(user.role)) {
    return { success: false, error: "Insufficient permissions. Only supervisors and admins can record site movements." };
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("machine_site_movements")
    .insert({
      machine_id: payload.machineId,
      client_name: payload.clientName,
      site_address: payload.siteAddress,
      movement_type: payload.movementType,
      transport_vehicle_no: payload.transportVehicleNo || null,
      operator_id: payload.operatorId || null,
      supervisor_id: user.id,
      status: "completed",
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error recording site movement:", error);
    return { success: false, error: error.message };
  }

  // Update machine current site & customer details
  await supabase
    .from("machines")
    .update({
      customer_name: payload.clientName,
      customer_address: payload.siteAddress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.machineId);

  await logAudit({
    user_id: user.id,
    action: "machine.site_movement_logged",
    entity_type: "machine_site_movement",
    entity_id: data.id,
    metadata: { machineId: payload.machineId, movementType: payload.movementType },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

