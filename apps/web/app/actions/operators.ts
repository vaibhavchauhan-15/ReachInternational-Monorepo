"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";

export async function submitOperatorHourLogAction(payload: {
  machineId: string;
  startMeter: number;
  endMeter: number;
  startFuelLevel?: number;
  fuelConsumed?: number;
  shift?: string;
  machineCondition?: "good" | "fair" | "needs_attention" | "breakdown";
  location?: string;
  remarks?: string;
  status?: "submitted" | "draft";
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (payload.endMeter < payload.startMeter) {
    return { success: false, error: "End hour meter reading cannot be less than starting hour meter reading." };
  }

  const supabase = createSupabaseAdminClient();

  // 1. Insert machine hour log
  const { data: logData, error: logError } = await supabase
    .from("machine_hour_logs")
    .insert({
      machine_id: payload.machineId,
      operator_id: user.id,
      log_date: new Date().toISOString().split("T")[0],
      start_meter: payload.startMeter,
      end_meter: payload.endMeter,
      start_fuel_level: payload.startFuelLevel || 0,
      fuel_consumed: payload.fuelConsumed || 0,
      shift: payload.shift || "day",
      machine_condition: payload.machineCondition || "good",
      location: payload.location || null,
      remarks: payload.remarks || null,
      verification_status: "pending",
      status: payload.status || "submitted",
    })
    .select()
    .single();

  if (logError) {
    console.error("Error creating machine hour log:", logError);
    return { success: false, error: logError.message };
  }

  // 2. Update current hour meter & status on machine
  const machineUpdate: Record<string, unknown> = {
    hour_meter: payload.endMeter,
    current_operator_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (payload.machineCondition === "breakdown") {
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
      startMeter: payload.startMeter,
      endMeter: payload.endMeter,
      runningHours: payload.endMeter - payload.startMeter,
      fuelConsumed: payload.fuelConsumed,
      condition: payload.machineCondition,
    },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { success: true, data: logData };
}

export async function updateOperatorHourLogAction(payload: {
  logId: string;
  startMeter: number;
  endMeter: number;
  startFuelLevel?: number;
  fuelConsumed?: number;
  shift?: string;
  machineCondition?: "good" | "fair" | "needs_attention" | "breakdown";
  location?: string;
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (payload.endMeter < payload.startMeter) {
    return { success: false, error: "End hour meter reading cannot be less than starting hour meter reading." };
  }

  const supabase = createSupabaseAdminClient();

  // Fetch existing log to verify ownership and status
  const { data: existingLog } = await supabase
    .from("machine_hour_logs")
    .select("*")
    .eq("id", payload.logId)
    .single();

  if (!existingLog) return { success: false, error: "Log entry not found." };
  if (existingLog.operator_id !== user.id && user.role !== "super_admin" && user.role !== "admin") {
    return { success: false, error: "You can only edit your own meter logs." };
  }
  if (existingLog.verification_status === "approved") {
    return { success: false, error: "Approved historical meter readings cannot be modified directly." };
  }

  const { data, error } = await supabase
    .from("machine_hour_logs")
    .update({
      start_meter: payload.startMeter,
      end_meter: payload.endMeter,
      start_fuel_level: payload.startFuelLevel || 0,
      fuel_consumed: payload.fuelConsumed || 0,
      shift: payload.shift || "day",
      machine_condition: payload.machineCondition || "good",
      location: payload.location || null,
      remarks: payload.remarks || null,
      verification_status: "pending",
      status: "submitted",
    })
    .eq("id", payload.logId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Update machine hour meter
  await supabase
    .from("machines")
    .update({ hour_meter: payload.endMeter, updated_at: new Date().toISOString() })
    .eq("id", existingLog.machine_id);

  await logAudit({
    user_id: user.id,
    action: "operator.log_corrected",
    entity_type: "machine_hour_log",
    entity_id: payload.logId,
    metadata: { endMeter: payload.endMeter },
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

  // 1. End any existing active assignment for this machine
  await supabase
    .from("machine_assignments")
    .update({ status: "ended", unassigned_at: new Date().toISOString() })
    .eq("machine_id", payload.machineId)
    .eq("status", "active");

  // 2. Insert new machine assignment
  const { data, error } = await supabase
    .from("machine_assignments")
    .insert({
      machine_id: payload.machineId,
      operator_id: payload.operatorId,
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      status: "active",
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error assigning operator:", error);
    return { success: false, error: error.message };
  }

  // 3. Update machine operator ID
  await supabase
    .from("machines")
    .update({ current_operator_id: payload.operatorId, updated_at: new Date().toISOString() })
    .eq("id", payload.machineId);

  await logAudit({
    user_id: user.id,
    action: "machine.operator_assigned",
    entity_type: "machine",
    entity_id: payload.machineId,
    metadata: { operatorId: payload.operatorId },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

export async function verifyOperatorHourLogAction(payload: {
  logId: string;
  status: "approved" | "rejected" | "correction_requested";
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (user.role === "operator") {
    return { success: false, error: "Operators cannot verify or approve daily hour logs." };
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("machine_hour_logs")
    .update({
      verification_status: payload.status,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      verification_remarks: payload.remarks || null,
    })
    .eq("id", payload.logId)
    .select()
    .single();

  if (error) {
    console.error("Error verifying hour log:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: user.id,
    action: "operator.log_verified",
    entity_type: "machine_hour_log",
    entity_id: payload.logId,
    metadata: { status: payload.status, remarks: payload.remarks },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

export async function requestOperatorAssignmentChangeAction(payload: {
  machineId: string;
  currentOperatorId?: string;
  reason: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

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
    user.role !== "branch_manager" &&
    user.role !== "admin" &&
    user.role !== "super_admin"
  ) {
    return { success: false, error: "Only Supervisors and Managers can hire operators." };
  }

  const supabase = createSupabaseAdminClient();
  const email = payload.email || `operator_${Date.now()}@reachinternation.co.in`;

  // 1. Create user entry
  const { data: newUser, error: userError } = await supabase
    .from("users")
    .insert({
      full_name: payload.fullName,
      phone: payload.phone,
      email,
      role: "operator",
      status: "active",
      branch_id: user.branch_id,
    })
    .select()
    .single();

  if (userError || !newUser) {
    console.error("Error hiring operator user:", userError);
    return { success: false, error: userError?.message || "Failed to create operator user" };
  }

  // 2. Create employee directory record
  const empCode = `EMP-OP-${Math.floor(1000 + Math.random() * 9000)}`;
  await supabase.from("employees").insert({
    employee_code: empCode,
    full_name: payload.fullName,
    designation: "Machine Operator",
    department: "Operations",
    branch_id: user.branch_id,
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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

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

