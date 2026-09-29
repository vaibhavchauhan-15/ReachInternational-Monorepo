import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User } from "@/lib/types/database";
import { hydrateUsersPersonnel } from "./user-list";

/**
 * Complete column projection for single user view, edit modal, and user details page.
 * Includes sensitive and heavy fields: employee_id, aadhaar_number, license_number, address, shift details.
 */
export const USER_DETAIL_COLUMNS =
  "id, employee_id, full_name, email, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, street, shift_start_time, shift_end_time, complete_profile, supervisor_id, monthly_salary, daily_rate, ot_hourly_rate, doj, bank_account_number, bank_ifsc_code, total_pl_quota, pl_used_as_on_date, created_at, updated_at";

export interface UserMachineItem {
  id: string;
  machine_id: string;
  machine_name: string;
  model: string;
  status: string;
  serial_number?: string | null;
  manufacturer?: string | null;
  year_of_mfg?: string | null;
  hour_meter?: number | null;
}

export interface UserRunningLogItem {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  model: string;
  log_date: string;
  start_time: string | null;
  end_time: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number | null;
  overtime_hours: number | null;
  is_breakdown: boolean;
  location: string | null;
  remarks: string | null;
  created_at: string;
}

export interface UserAssignmentItem {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  model: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  is_active: boolean;
  assigned_at: string;
  ended_at: string | null;
}

export interface UserAuditItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  severity: "info" | "warning" | "critical";
  category: string | null;
  details: Record<string, unknown> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export interface UserSummaryKPIs {
  assignedMachinesCount: number;
  totalRunningHours: number;
  totalDaysWorked: number;
  documentsCount: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Resolves a raw URL parameter (UUID or Employee ID like EMP-0001) to a canonical user UUID.
 */
export async function resolveUserId(idOrCode: string): Promise<string | null> {
  if (!idOrCode || typeof idOrCode !== "string") return null;
  const trimmed = idOrCode.trim();
  if (isValidUuid(trimmed)) return trimmed;

  const fn = unstable_cache(
    async (codeStr: string) => {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("users")
        .select("id")
        .ilike("employee_id", codeStr)
        .maybeSingle();

      return data?.id || null;
    },
    ["resolve_user_id", trimmed.toUpperCase()],
    {
      revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
      tags: [TAGS.users],
    }
  );

  return fn(trimmed);
}

/**
 * Fetches active/assigned machines for an operator or supervisor.
 */
export async function getUserAssignedMachines(userId: string): Promise<UserMachineItem[]> {
  if (!userId) return [];
  try {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient
      .from("machines")
      .select("id, machine_id, machine_name, model, status, serial_number, manufacturer, year_of_mfg, hour_meter")
      .or(`current_operator_id.eq.${userId},operator_ids.cs.{${userId}},current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`)
      .order("machine_id");
    return (data || []).map((m: any) => ({
      id: m.id,
      machine_id: m.machine_id,
      machine_name: m.machine_name,
      model: m.model,
      status: m.status,
      serial_number: m.serial_number,
      manufacturer: m.manufacturer,
      year_of_mfg: m.year_of_mfg,
      hour_meter: m.hour_meter,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches machine running logs logged by or associated with this user.
 */
export async function getUserRunningLogs(userId: string, limit = 50): Promise<UserRunningLogItem[]> {
  if (!userId) return [];
  try {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient
      .from("machine_hour_logs")
      .select(`
        id, machine_id, log_date, start_time, end_time, start_meter, end_meter,
        running_hours, normal_working_hours, overtime_hours, is_breakdown, location, remarks, created_at,
        machines (id, machine_id, machine_name, model)
      `)
      .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
      .order("log_date", { ascending: false })
      .limit(limit);

    if (!data) return [];
    return data.map((log: any) => {
      const machine = Array.isArray(log.machines) ? log.machines[0] : log.machines;
      return {
        id: log.id,
        machine_id: log.machine_id,
        machine_code: machine?.machine_id || "—",
        machine_name: machine?.machine_name || "Machine",
        model: machine?.model || "",
        log_date: log.log_date,
        start_time: log.start_time,
        end_time: log.end_time,
        start_meter: log.start_meter,
        end_meter: log.end_meter,
        running_hours: Number(log.running_hours) || 0,
        normal_working_hours: log.normal_working_hours != null ? Number(log.normal_working_hours) : null,
        overtime_hours: log.overtime_hours != null ? Number(log.overtime_hours) : null,
        is_breakdown: Boolean(log.is_breakdown),
        location: log.location || null,
        remarks: log.remarks || null,
        created_at: log.created_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches machine assignment history for this operator.
 */
export async function getUserAssignments(userId: string): Promise<UserAssignmentItem[]> {
  if (!userId) return [];
  try {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient
      .from("operator_machine_assignments")
      .select(`
        id, machine_id, shift_start_time, shift_end_time, is_active, assigned_at, ended_at,
        machines (id, machine_id, machine_name, model)
      `)
      .eq("operator_id", userId)
      .order("assigned_at", { ascending: false })
      .limit(50);

    if (!data) return [];
    return data.map((item: any) => {
      const machine = Array.isArray(item.machines) ? item.machines[0] : item.machines;
      return {
        id: item.id,
        machine_id: item.machine_id,
        machine_code: machine?.machine_id || "—",
        machine_name: machine?.machine_name || "Machine",
        model: machine?.model || "",
        shift_start_time: item.shift_start_time,
        shift_end_time: item.shift_end_time,
        is_active: Boolean(item.is_active),
        assigned_at: item.assigned_at,
        ended_at: item.ended_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches audit logs relating to this user.
 */
export async function getUserAuditLogs(userId: string, limit = 50): Promise<UserAuditItem[]> {
  if (!userId) return [];
  try {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_name, actor_role, severity, category, details, before_state, after_state, created_at")
      .or(`user_id.eq.${userId},entity_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!data) return [];
    return data.map((log: any) => ({
      id: log.id,
      action: log.action || "User Activity",
      entity_type: log.entity_type || "user",
      entity_id: log.entity_id,
      actor_name: log.actor_name,
      actor_role: log.actor_role,
      severity: (log.severity as any) || "info",
      category: log.category,
      details: log.details,
      before_state: log.before_state,
      after_state: log.after_state,
      created_at: log.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches lightweight KPI metrics for the user details header cards.
 */
export async function getUserSummaryKPIs(userId: string): Promise<UserSummaryKPIs> {
  if (!userId) {
    return {
      assignedMachinesCount: 0,
      totalRunningHours: 0,
      totalDaysWorked: 0,
      documentsCount: 0,
    };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const [machinesRes, logsRes, docsRes] = await Promise.all([
      adminClient
        .from("machines")
        .select("id", { count: "exact", head: true })
        .or(`current_operator_id.eq.${userId},operator_ids.cs.{${userId}},current_supervisor_id.eq.${userId},supervisor_ids.cs.{${userId}}`),
      adminClient
        .from("machine_hour_logs")
        .select("running_hours, log_date")
        .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`),
      adminClient
        .from("user_documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const logs = logsRes.data || [];
    const totalRunningHours = logs.reduce((acc, row) => acc + (Number(row.running_hours) || 0), 0);
    const distinctDates = new Set(logs.map((l) => l.log_date).filter(Boolean));

    return {
      assignedMachinesCount: machinesRes.count || 0,
      totalRunningHours: Math.round(totalRunningHours * 10) / 10,
      totalDaysWorked: distinctDates.size,
      documentsCount: docsRes.count || 0,
    };
  } catch {
    return {
      assignedMachinesCount: 0,
      totalRunningHours: 0,
      totalDaysWorked: 0,
      documentsCount: 0,
    };
  }
}

/**
 * Fetches a single user by ID with full column projection and in-memory relation hydration.
 * Used for detailed inspect and page views.
 */
export async function getUserById(userId: string): Promise<User | null> {
  if (!userId) return null;
  await requireRole("admin", "super_admin", "manager", "hr", "supervisor");

  const adminClient = createSupabaseAdminClient();
  const [{ data, error }, machines] = await Promise.all([
    adminClient
      .from("users")
      .select(USER_DETAIL_COLUMNS)
      .eq("id", userId)
      .single(),
    getUserAssignedMachines(userId),
  ]);

  if (error || !data) {
    return null;
  }

  const hydrated = await hydrateUsersPersonnel([data]);
  const user = hydrated[0] || null;
  if (user) {
    user.assigned_machines = machines;
  }
  return user;
}

/**
 * Fetches a single user record with relation hydration without admin role check.
 * Used for authenticated user self-profile views (/profile).
 */
export async function getUserDetail(userId: string): Promise<User | null> {
  if (!userId) return null;

  const adminClient = createSupabaseAdminClient();
  const [{ data, error }, machines] = await Promise.all([
    adminClient
      .from("users")
      .select(USER_DETAIL_COLUMNS)
      .eq("id", userId)
      .single(),
    getUserAssignedMachines(userId),
  ]);

  if (error || !data) {
    return null;
  }

  const hydrated = await hydrateUsersPersonnel([data]);
  const user = hydrated[0] || null;
  if (user) {
    user.assigned_machines = machines;
  }
  return user;
}

/**
 * Fetches the user's active pending profile change request (if any).
 */
export async function getMyPendingProfileRequest(userId: string) {
  if (!userId) return null;

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("profile_change_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
