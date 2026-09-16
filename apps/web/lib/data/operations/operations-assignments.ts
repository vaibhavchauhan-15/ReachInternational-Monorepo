import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import {
  parseProfileShiftTime,
  parseTimeToMinutes,
  OPERATIONS_CACHE_TTLS,
} from "@reachinternational/utils";

export interface OperationsAssignmentsResult {
  machines: any[];
  operators: any[];
  assignments: any[];
  stats: {
    totalMachines: number;
    activeAssignments: number;
    fullyAssigned: number;
    unassigned: number;
  };
}

const MACHINE_EXACT_PROJECTION = `
  id,
  machine_id,
  model,
  serial_number,
  hour_meter,
  status,
  manufacturer,
  current_operator_id,
  current_supervisor_id,
  client_id,
  client:clients!machines_client_id_fkey(id, company_name)
`;

const ASSIGNMENT_EXACT_PROJECTION = `
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
  operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone, email, shift_time, role),
  assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name, phone, role),
  machine:machines!operator_machine_assignments_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status)
`;

const ASSIGNMENT_HISTORY_PROJECTION = `
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
  operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone, email, shift_time, role),
  assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name, phone, role),
  ender:users!operator_machine_assignments_ended_by_fkey(id, full_name)
`;

/**
 * Internal uncached fetcher for operations assignments.
 */
async function fetchOperationsAssignmentsData(): Promise<OperationsAssignmentsResult> {
  const supabase = createSupabaseAdminClient();

  const [machinesRes, operatorsRes, assignmentsRes] = await Promise.all([
    supabase
      .from("machines")
      .select(MACHINE_EXACT_PROJECTION)
      .order("machine_id", { ascending: true })
      .limit(1000),
    supabase
      .from("users")
      .select("id, full_name, email, phone, role, status, shift_time, shift_start_time, shift_end_time")
      .in("role", ["operator", "supervisor", "manager", "admin", "super_admin", "service_manager"])
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("operator_machine_assignments")
      .select(ASSIGNMENT_EXACT_PROJECTION)
      .eq("is_active", true)
      .is("ended_at", null)
      .order("assigned_at", { ascending: false }),
  ]);

  const rawMachines = machinesRes.data || [];
  const rawOperators = (operatorsRes.data || []).filter((u: any) => u.role === "operator");
  const allStaffUsers = operatorsRes.data || [];
  const staffMap = new Map(allStaffUsers.map((u: any) => [u.id, u]));

  // Hydrate assignments
  const rawAssignments = assignmentsRes.data || [];
  const assignments = rawAssignments.map((ass: any) => {
    const matchedOperator = ass.operator || staffMap.get(ass.operator_id) || null;
    const matchedAssigner = ass.assigner || staffMap.get(ass.assigned_by) || null;
    const opShift = matchedOperator?.shift_time ? parseProfileShiftTime(matchedOperator.shift_time) : null;
    const startTime = ass.shift_start_time || opShift?.startTime || "08:00:00";
    const endTime = ass.shift_end_time || opShift?.endTime || "17:00:00";
    const startMins = parseTimeToMinutes(startTime) ?? 480;
    const endMins = parseTimeToMinutes(endTime) ?? 1020;
    const isOvernight = ass.crosses_midnight ?? (endMins <= startMins);

    return {
      ...ass,
      shift_start_time: startTime,
      shift_end_time: endTime,
      crosses_midnight: isOvernight,
      operator: matchedOperator,
      assigner: matchedAssigner,
    };
  });

  // Calculate statistics
  const totalMachines = rawMachines.length;
  const activeAssignments = assignments.length;

  let fullyAssigned = 0;
  let unassigned = 0;

  rawMachines.forEach((m: any) => {
    const machAssCount = assignments.filter(
      (a: any) => a.machine_id === m.id || a.machine?.id === m.id
    ).length;
    if (machAssCount >= 3) fullyAssigned++;
    if (machAssCount === 0) unassigned++;
  });

  return {
    machines: rawMachines,
    operators: rawOperators,
    assignments,
    stats: {
      totalMachines,
      activeAssignments,
      fullyAssigned,
      unassigned,
    },
  };
}

/**
 * Cached fetcher for operations assignments.
 * Tagged for targeted revalidation on assignment creation/ending.
 */
export const getCachedOperationsAssignments = unstable_cache(
  fetchOperationsAssignmentsData,
  ["operations-assignments-data-v1"],
  {
    revalidate: OPERATIONS_CACHE_TTLS.assignmentsList,
    tags: [TAGS.operationsAssignments, TAGS.operations, TAGS.machines],
  }
);

/**
 * Public DAL method for operations assignments with in-flight request deduplication.
 */
export const getOperationsAssignmentsData = cache(async (): Promise<OperationsAssignmentsResult> => {
  return getCachedOperationsAssignments();
});

/**
 * Internal uncached fetcher for machine assignment history.
 */
async function fetchMachineAssignmentHistory(machineId: string): Promise<any[]> {
  if (!machineId) return [];

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("operator_machine_assignments")
    .select(ASSIGNMENT_HISTORY_PROJECTION)
    .eq("machine_id", machineId)
    .order("assigned_at", { ascending: false })
    .limit(30);

  if (error || !data) {
    console.error("[operations-assignments] Failed to query assignment history:", error);
    return [];
  }

  return data;
}

/**
 * Cached fetcher for machine assignment history.
 */
export const getCachedMachineAssignmentHistory = (machineId: string) =>
  unstable_cache(
    () => fetchMachineAssignmentHistory(machineId),
    [`machine-assignment-history-${machineId}`],
    {
      revalidate: OPERATIONS_CACHE_TTLS.assignmentHistory,
      tags: [
        TAGS.operationsAssignments,
        TAGS.operations,
        TAGS.operationAssignmentDetail(machineId),
        TAGS.machineDetail(machineId),
      ],
    }
  )();

/**
 * Public DAL method for machine assignment history with in-flight request deduplication.
 */
export const getMachineAssignmentHistoryData = cache(async (machineId: string): Promise<any[]> => {
  return getCachedMachineAssignmentHistory(machineId);
});
