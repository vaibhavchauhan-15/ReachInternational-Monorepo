"use server";

import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import {
  CreateAssignmentSchema,
  UpdateAssignmentSchema,
  EndAssignmentSchema,
  ResolveConflictSchema,
} from "@reachinternational/validation";
import {
  parseProfileShiftTime,
  parseTimeToMinutes,
  minutesTo24HourTime,
} from "@reachinternational/utils";
import type { OperatorMachineAssignment } from "@/lib/types/database";

import {
  getOperationsAssignmentsData,
  getMachineAssignmentHistoryData,
  OPERATIONS_CACHE_TAGS,
} from "@/lib/data/operations";

function normalizeTimeTo24Hour(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  return minutesTo24HourTime(mins);
}

export interface AssignmentActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Assigns an operator to a machine with a recurring daily shift window.
 * Enforces maximum 3 active operators and GiST exclusion overlap prevention atomically.
 */
export async function createAssignmentAction(payload: {
  machineId: string;
  operatorId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  notes?: string | null;
}): Promise<AssignmentActionResult<OperatorMachineAssignment>> {
  try {
    const caller = await requireRole(
      "admin",
      "super_admin",
      "manager",
      "supervisor"
    );

    const parsed = CreateAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Validation failed",
        fieldErrors,
      };
    }

    const start24 = normalizeTimeTo24Hour(parsed.data.shiftStartTime);
    const end24 = normalizeTimeTo24Hour(parsed.data.shiftEndTime);

    if (start24 === end24) {
      return {
        success: false,
        error: "Shift start time and end time cannot be identical.",
        fieldErrors: { shiftEndTime: "Start and end times cannot be equal" },
      };
    }

    const supabase = createSupabaseAdminClient();

    // 1. Invoke atomic assignment RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "assign_operator_machine_atomic",
      {
        p_machine_id: parsed.data.machineId,
        p_operator_id: parsed.data.operatorId,
        p_shift_start: start24,
        p_shift_end: end24,
        p_shift_start_time: start24,
        p_shift_end_time: end24,
        p_assigned_by: caller.id,
        p_notes: parsed.data.notes || null,
      }
    );

    if (rpcError) {
      if (rpcError.message?.includes("MAX_OPERATORS_REACHED") || rpcError.code === "P0001") {
        return {
          success: false,
          code: "MAX_OPERATORS_REACHED",
          error: "This machine already has the maximum capacity of 3 active operators assigned.",
        };
      }
      if (rpcError.message?.includes("23P01") || rpcError.code === "23P01") {
        return {
          success: false,
          code: "SHIFT_OVERLAP_CONFLICT",
          error: "This operator already has an active assignment with an overlapping shift window.",
        };
      }
      return {
        success: false,
        error: rpcError.message || "Failed to assign operator to machine.",
      };
    }

    if (rpcResult && !rpcResult.success) {
      return {
        success: false,
        code: rpcResult.code,
        error: rpcResult.error || "Failed to create assignment.",
      };
    }

    // 2. Revalidate Cache Tags
    revalidateTag(TAGS.operationsAssignments, "max");
    revalidateTag(TAGS.operations, "max");
    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machinesMeta, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machineDetail(parsed.data.machineId), "max");
    revalidateTag(TAGS.operationAssignmentDetail(parsed.data.machineId), "max");

    return {
      success: true,
      data: rpcResult as OperatorMachineAssignment,
    };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to assign operator.";
    return { success: false, error: message };
  }
}

/**
 * Ends an active operator assignment with audit logging and history retention.
 */
export async function endAssignmentAction(payload: {
  assignmentId: string;
  endReason?: "reassigned" | "removed" | "shift_changed" | "migrated";
  notes?: string | null;
}): Promise<AssignmentActionResult<{ success: boolean }>> {
  try {
    const caller = await requireRole(
      "admin",
      "super_admin",
      "manager",
      "supervisor"
    );

    const parsed = EndAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid assignment ID.",
      };
    }

    const supabase = createSupabaseAdminClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "end_operator_machine_assignment_atomic",
      {
        p_assignment_id: parsed.data.assignmentId,
        p_ended_by: caller.id,
        p_end_reason: parsed.data.endReason || "removed",
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to end assignment." };
    }

    if (rpcResult && !rpcResult.success) {
      return { success: false, error: rpcResult.error || "Failed to end assignment." };
    }

    // Revalidate Tags
    revalidateTag(TAGS.operationsAssignments, "max");
    revalidateTag(TAGS.operations, "max");
    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    if (rpcResult?.machine_id) {
      revalidateTag(TAGS.machineDetail(rpcResult.machine_id), "max");
      revalidateTag(TAGS.operationAssignmentDetail(rpcResult.machine_id), "max");
    }

    return { success: true, data: { success: true } };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to end assignment.";
    return { success: false, error: message };
  }
}

/**
 * Resolves a soft-flagged overtime assignment conflict log.
 * Supervisors can 'acknowledge' (accept log as-is) or 'adjust' (manually fix end time).
 */
export async function resolveHourLogConflictAction(payload: {
  logId: string;
  action: "acknowledge" | "adjust";
  adjustedEndTime?: string | null;
  notes?: string | null;
}): Promise<AssignmentActionResult<{ success: boolean }>> {
  try {
    const caller = await requireRole(
      "admin",
      "super_admin",
      "manager",
      "supervisor"
    );

    const parsed = ResolveConflictSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid conflict resolution input.",
      };
    }

    const normalizedAdjustedEnd = parsed.data.adjustedEndTime
      ? normalizeTimeTo24Hour(parsed.data.adjustedEndTime)
      : null;

    const supabase = createSupabaseAdminClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "resolve_hour_log_conflict_atomic",
      {
        p_log_id: parsed.data.logId,
        p_action: parsed.data.action,
        p_resolved_by: caller.id,
        p_resolver_id: caller.id,
        p_adjusted_end_time: normalizedAdjustedEnd,
        p_notes: parsed.data.notes || null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to resolve conflict." };
    }

    if (rpcResult && !rpcResult.success) {
      return { success: false, error: rpcResult.error || "Failed to resolve conflict." };
    }

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.operationsLogs, "max");
    revalidateTag(TAGS.operations, "max");
    revalidateTag(TAGS.operationLogDetail(parsed.data.logId), "max");
    revalidateTag(OPERATIONS_CACHE_TAGS.logSummary(parsed.data.logId), "max");
    revalidateTag(OPERATIONS_CACHE_TAGS.logDetails(parsed.data.logId), "max");
    revalidateTag(OPERATIONS_CACHE_TAGS.logHistory(parsed.data.logId), "max");
    revalidateTag(OPERATIONS_CACHE_TAGS.logAudit(parsed.data.logId), "max");

    return { success: true, data: { success: true } };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to resolve conflict.";
    return { success: false, error: message };
  }
}

/**
 * Retrieves the profile shift timings for an operator from public.users.shift_time.
 * Returns parsed startTime and endTime in 24-hour format if available, or null.
 */
export async function getOperatorProfileShiftAction(
  operatorId: string
): Promise<{
  profileShift: { startTime: string; endTime: string; displayString: string } | null;
}> {
  try {
    if (!operatorId) return { profileShift: null };

    const supabase = createSupabaseAdminClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, shift_start_time, shift_end_time")
      .eq("id", operatorId)
      .maybeSingle();

    if (!user || !user.shift_start_time || !user.shift_end_time) {
      return { profileShift: null };
    }

    const startTime = String(user.shift_start_time).slice(0, 5);
    const endTime = String(user.shift_end_time).slice(0, 5);
    return {
      profileShift: {
        startTime,
        endTime,
        displayString: `${startTime} - ${endTime}`,
      },
    };
  } catch {
    return { profileShift: null };
  }
}

/**
 * Queries active assignments on a specific machine.
 */
export async function getMachineActiveAssignmentsAction(
  machineId: string
): Promise<{ assignments: OperatorMachineAssignment[] }> {
  try {
    if (!machineId) return { assignments: [] };

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("operator_machine_assignments")
      .select(`
        id,
        machine_id,
        operator_id,
        shift_start_time,
        shift_end_time,
        crosses_midnight,
        is_active,
        assigned_by,
        assigned_at,
        ended_at,
        ended_by,
        end_reason,
        created_at,
        updated_at,
        operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time),
        assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name)
      `)
      .eq("machine_id", machineId)
      .eq("is_active", true)
      .order("shift_start_time", { ascending: true });

    if (error || !data) return { assignments: [] };

    return { assignments: data as unknown as OperatorMachineAssignment[] };
  } catch {
    return { assignments: [] };
  }
}

/**
 * Updates an active operator assignment's shift window and notes.
 * Enforces GiST exclusion overlap prevention atomically.
 */
export async function updateAssignmentAction(payload: {
  assignmentId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  notes?: string | null;
}): Promise<AssignmentActionResult<{ success: boolean; assignmentId: string }>> {
  try {
    const caller = await requireRole(
      "admin",
      "super_admin",
      "manager",
      "supervisor"
    );

    const parsed = UpdateAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid update assignment input.",
      };
    }

    const start24 = normalizeTimeTo24Hour(parsed.data.shiftStartTime);
    const end24 = normalizeTimeTo24Hour(parsed.data.shiftEndTime);

    if (start24 === end24) {
      return {
        success: false,
        error: "Shift start time and end time cannot be identical.",
      };
    }

    const supabase = createSupabaseAdminClient();

    // Verify assignment exists and is active
    const { data: existing, error: fetchErr } = await supabase
      .from("operator_machine_assignments")
      .select("id, machine_id, operator_id, is_active")
      .eq("id", payload.assignmentId)
      .eq("is_active", true)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Active assignment not found." };
    }

    // Update assignment shift times (trigger trg_sync_operator_shift_ranges enforces GiST exclusion)
    const { error: updateErr } = await supabase
      .from("operator_machine_assignments")
      .update({
        shift_start_time: start24,
        shift_end_time: end24,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.assignmentId);

    if (updateErr) {
      if (updateErr.message?.includes("23P01") || updateErr.code === "23P01") {
        return {
          success: false,
          code: "SHIFT_OVERLAP_CONFLICT",
          error: "This shift timing conflicts with another active shift assignment for this operator.",
        };
      }
      return { success: false, error: updateErr.message || "Failed to update assignment shift." };
    }

    // Revalidate tags
    revalidateTag(TAGS.operationsAssignments, "max");
    revalidateTag(TAGS.operations, "max");
    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machineDetail(existing.machine_id), "max");
    revalidateTag(TAGS.operationAssignmentDetail(existing.machine_id), "max");

    return { success: true, data: { success: true, assignmentId: payload.assignmentId } };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to update assignment.";
    return { success: false, error: message };
  }
}

/**
 * On-demand data loader for the Operations Assignments Tab.
 */
export async function getOperationsAssignmentsAction() {
  try {
    await requireRole("admin", "super_admin", "manager", "supervisor", "operator");
    const data = await getOperationsAssignmentsData();
    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to retrieve assignments",
    };
  }
}

/**
 * On-demand history loader for a specific machine's assignment timeline.
 */
export async function getMachineAssignmentHistoryAction(machineId: string) {
  try {
    await requireRole("admin", "super_admin", "manager", "supervisor", "operator");
    const data = await getMachineAssignmentHistoryData(machineId);
    return { success: true, data };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to retrieve assignment history",
    };
  }
}

