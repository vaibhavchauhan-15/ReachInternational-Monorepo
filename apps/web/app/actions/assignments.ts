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
  shiftCode?: string | null;
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
        p_shift_code: parsed.data.shiftCode || null,
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
    revalidateTag(TAGS.todayShiftMonitor, "max");
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
    revalidateTag(TAGS.todayShiftMonitor, "max");
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

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function shiftToMinuteRangesLocal(startStr?: string | null, endStr?: string | null): Array<[number, number]> {
  if (!startStr || !endStr) return [];
  const s = parseTimeToMinutes(startStr);
  const e = parseTimeToMinutes(endStr);
  if (s === null || e === null || s === e) return [];
  if (s < e) {
    return [[s, e]];
  }
  return [[s, 1440], [0, e]];
}

function doRangesOverlapLocal(rangesA: Array<[number, number]>, rangesB: Array<[number, number]>): boolean {
  for (const [sA, eA] of rangesA) {
    for (const [sB, eB] of rangesB) {
      if (Math.max(sA, sB) < Math.min(eA, eB)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Loads an operator's active machinery assignments, designated supervisors, and profile data.
 * Used when the operator is fixed in the unified assignment modal.
 */
export async function getOperatorActiveAssignmentsAction(operatorId: string): Promise<{
  success: boolean;
  error?: string;
  operator?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    role: string;
  };
  supervisors?: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  }>;
  assignments?: Array<{
    id: string;
    machineId: string;
    machineCode: string;
    machineName: string;
    model: string;
    serialNumber: string | null;
    clientId: string | null;
    clientName: string | null;
    shiftCode: string;
    shiftStartTime: string | null;
    shiftEndTime: string | null;
    notes: string | null;
  }>;
}> {
  if (!isValidUuid(operatorId)) {
    return { success: false, error: "Invalid operator ID format." };
  }

  try {
    await requireRole("admin", "super_admin", "manager", "supervisor");
    const supabase = createSupabaseAdminClient();

    // 1. Fetch Operator Info
    const { data: opUser, error: opErr } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role")
      .eq("id", operatorId)
      .maybeSingle();

    if (opErr || !opUser) {
      return { success: false, error: opErr?.message || "Operator not found." };
    }

    // 2. Fetch Supervisors from user_supervisors
    const { data: supsData } = await supabase
      .from("user_supervisors")
      .select("supervisor:users!user_supervisors_supervisor_id_fkey(id, full_name, phone, email)")
      .eq("user_id", operatorId);

    const supervisors = (supsData || [])
      .map((item: any) => item.supervisor)
      .filter(Boolean)
      .map((s: any) => ({
        id: s.id,
        full_name: s.full_name || "Supervisor",
        phone: s.phone || null,
        email: s.email || null,
      }));

    // 3. Fetch active machine assignments for this operator
    const { data: rawAssignments, error: assErr } = await supabase
      .from("operator_machine_assignments")
      .select(`
        id,
        machine_id,
        shift_code,
        shift_start_time,
        shift_end_time,
        notes,
        is_active,
        machine:machines(id, machine_id, machine_name, model, serial_number, client_id, client:clients(id, company_name))
      `)
      .eq("operator_id", operatorId)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false });

    if (assErr) {
      return { success: false, error: assErr.message };
    }

    const assignments = (rawAssignments || []).map((row: any) => {
      const m = row.machine || {};
      const cl = m.client || {};
      return {
        id: row.id,
        machineId: row.machine_id,
        machineCode: m.machine_id || "Machine",
        machineName: m.machine_name || m.model || "Equipment",
        model: m.model || "",
        serialNumber: m.serial_number || null,
        clientId: m.client_id || null,
        clientName: cl.company_name || null,
        shiftCode: row.shift_code || "S1",
        shiftStartTime: row.shift_start_time || null,
        shiftEndTime: row.shift_end_time || null,
        notes: row.notes || null,
      };
    });

    return {
      success: true,
      operator: {
        id: opUser.id,
        full_name: opUser.full_name || "Operator",
        phone: opUser.phone || null,
        email: opUser.email || null,
        role: opUser.role || "operator",
      },
      supervisors,
      assignments,
    };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load operator assignments",
    };
  }
}

/**
 * Synchronizes an operator's machine assignments.
 * Relieves removed machines, enforces shift non-overlap rules, and updates active assignments atomically.
 */
export async function updateOperatorMachineAssignmentsAction(
  operatorId: string,
  payload: {
    machineAssignments: Array<{
      machineId: string;
      shiftCode?: string | null;
      shiftStartTime?: string | null;
      shiftEndTime?: string | null;
      notes?: string | null;
    }>;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isValidUuid(operatorId)) {
    return { success: false, error: "Invalid operator ID format." };
  }

  try {
    const caller = await requireRole("admin", "super_admin", "manager", "supervisor");
    const supabase = createSupabaseAdminClient();

    const assignments = Array.isArray(payload.machineAssignments) ? payload.machineAssignments : [];

    // 1. Validation: Ensure no duplicate machines in assignment payload
    const seenMachines = new Set<string>();
    for (const a of assignments) {
      if (!isValidUuid(a.machineId)) {
        return { success: false, error: "One or more machine IDs are invalid." };
      }
      if (seenMachines.has(a.machineId)) {
        return { success: false, error: "Duplicate machine selected for this operator." };
      }
      seenMachines.add(a.machineId);
    }

    // 2. Validation: Ensure shift windows between machines assigned to THIS operator do NOT collide
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const m1 = assignments[i];
        const m2 = assignments[j];
        if (m1.shiftStartTime && m1.shiftEndTime && m2.shiftStartTime && m2.shiftEndTime) {
          const r1 = shiftToMinuteRangesLocal(m1.shiftStartTime, m1.shiftEndTime);
          const r2 = shiftToMinuteRangesLocal(m2.shiftStartTime, m2.shiftEndTime);
          if (doRangesOverlapLocal(r1, r2)) {
            return {
              success: false,
              error: `Shift timing overlap detected: Shift for machine (${m1.shiftCode || "A"}) collides with (${m2.shiftCode || "B"}).`,
            };
          }
        }
      }
    }

    // 3. Query current active assignments for this operator
    const { data: currentActive, error: fetchErr } = await supabase
      .from("operator_machine_assignments")
      .select("id, machine_id, shift_code, shift_start_time, shift_end_time, is_active")
      .eq("operator_id", operatorId)
      .eq("is_active", true);

    if (fetchErr) {
      return { success: false, error: fetchErr.message };
    }

    const currentActiveList = currentActive || [];
    const targetMachineIds = new Set(assignments.map((a) => a.machineId));

    // 4. Relieve any machines that were removed
    const machinesToRelieve = currentActiveList.filter((a) => !targetMachineIds.has(a.machine_id));
    for (const relieved of machinesToRelieve) {
      await supabase.rpc("end_operator_machine_assignment_atomic", {
        p_assignment_id: relieved.id,
        p_ended_by: caller.id,
        p_end_reason: "reassigned",
      });

      // Remove operator from that machine's operator_ids array
      const { data: targetM } = await supabase
        .from("machines")
        .select("id, operator_ids")
        .eq("id", relieved.machine_id)
        .maybeSingle();

      if (targetM && Array.isArray(targetM.operator_ids)) {
        const nextOps = targetM.operator_ids.filter((id: string) => id !== operatorId);
        await supabase
          .from("machines")
          .update({
            operator_ids: nextOps,
            current_operator_id: nextOps[0] || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", relieved.machine_id);
      }
    }

    // 5. Apply / update active assignments
    for (const item of assignments) {
      const start24 = item.shiftStartTime ? normalizeTimeTo24Hour(item.shiftStartTime) : "08:00";
      const end24 = item.shiftEndTime ? normalizeTimeTo24Hour(item.shiftEndTime) : "16:00";

      const { data: rpcRes, error: rpcErr } = await supabase.rpc("assign_operator_machine_atomic", {
        p_machine_id: item.machineId,
        p_operator_id: operatorId,
        p_shift_start: start24,
        p_shift_end: end24,
        p_shift_start_time: start24,
        p_shift_end_time: end24,
        p_assigned_by: caller.id,
        p_notes: item.notes || null,
        p_shift_code: item.shiftCode || null,
      });

      if (rpcErr) {
        return {
          success: false,
          error: rpcErr.message || "Failed to assign machine to operator.",
        };
      }

      if (rpcRes && !(rpcRes as any).success) {
        return {
          success: false,
          error: (rpcRes as any).error || "Failed to assign machine.",
        };
      }

      // Add operator to that machine's operator_ids array if missing
      const { data: targetM } = await supabase
        .from("machines")
        .select("id, operator_ids")
        .eq("id", item.machineId)
        .maybeSingle();

      if (targetM) {
        const currOps = Array.isArray(targetM.operator_ids) ? targetM.operator_ids : [];
        if (!currOps.includes(operatorId)) {
          const nextOps = [...currOps, operatorId].slice(0, 3);
          await supabase
            .from("machines")
            .update({
              operator_ids: nextOps,
              current_operator_id: nextOps[0] || operatorId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.machineId);
        }
      }
    }

    // 6. Evict & revalidate cache tags monorepo-wide
    revalidateTag(TAGS.operationsAssignments, { expire: 0 });
    revalidateTag(TAGS.operations, { expire: 0 });
    revalidateTag(TAGS.todayShiftMonitor, { expire: 0 });
    revalidateTag(TAGS.machines, { expire: 0 });
    revalidateTag(TAGS.machinesList, { expire: 0 });
    revalidateTag(TAGS.dashboardKpis, { expire: 0 });
    for (const mId of targetMachineIds) {
      revalidateTag(TAGS.machineDetail(mId), { expire: 0 });
    }

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update operator assignments",
    };
  }
}

/**
 * Fetches all active fleet machinery for equipment assignment dropdowns.
 */
export async function getAssignableMachinesAction(): Promise<{
  success: boolean;
  machines: Array<{
    id: string;
    machine_id: string;
    model: string;
    serial_number: string | null;
    status: string;
    health_status: string;
    client_id: string | null;
    client_name: string | null;
    operator_ids: string[];
    supervisor_ids: string[];
  }>;
  error?: string;
}> {
  try {
    await requireRole("admin", "super_admin", "manager", "supervisor");
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("machines")
      .select(`
        id,
        machine_id,
        model,
        serial_number,
        status,
        health_status,
        client_id,
        operator_ids,
        supervisor_ids,
        client:clients(id, company_name)
      `)
      .order("machine_id", { ascending: true });

    if (error) {
      return { success: false, machines: [], error: error.message };
    }

    const machines = (data || []).map((m: any) => ({
      id: m.id,
      machine_id: m.machine_id,
      model: m.model || "",
      serial_number: m.serial_number || null,
      status: m.status || "available",
      health_status: m.health_status || "active",
      client_id: m.client_id || null,
      client_name: m.client?.company_name || null,
      operator_ids: Array.isArray(m.operator_ids) ? m.operator_ids : [],
      supervisor_ids: Array.isArray(m.supervisor_ids) ? m.supervisor_ids : [],
    }));

    return { success: true, machines };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    return {
      success: false,
      machines: [],
      error: err instanceof Error ? err.message : "Failed to load machines",
    };
  }
}
