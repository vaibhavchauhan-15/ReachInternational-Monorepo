import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { getMachines } from "@/lib/queries/machines";
import { getClients } from "@/lib/queries/clients";
import type { Machine, MachineWithEngineer, User } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { parseBreakdownString, parseProfileShiftTime, parseTimeToMinutes } from "@reachinternational/utils";

/**
 * Format raw PostgREST / Supabase errors into human-readable strings.
 * Prevents empty `{}` serialization across the Next.js server-client IPC dev boundary.
 */
function formatPostgrestError(error: unknown): string {
  if (!error) return "Unknown database error";
  if (typeof error === "string") return error;
  const e = error as Record<string, unknown>;
  const parts: string[] = [];
  if (e.message) parts.push(String(e.message));
  if (e.code) parts.push(`[Code: ${e.code}]`);
  if (e.details) parts.push(`Details: ${e.details}`);
  if (e.hint) parts.push(`Hint: ${e.hint}`);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(e);
}

// 1. Primary Full Projection (Optimized: embeds active machine, operator, and client relations)
// Note: Omits ambiguous 'supervisor:users!machine_hour_logs_supervisor_id_fkey' to prevent
// PostgREST schema cache relationship resolution failures; supervisors are hydrated in-memory.
const HOUR_LOG_FULL_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  end_date,
  start_datetime,
  end_datetime,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  machine_condition,
  location,
  remarks,
  idempotency_key,
  conflict_flag,
  conflict_reason,
  conflict_status,
  conflict_resolved_by,
  conflict_resolved_at,
  conflict_resolution_notes,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status, manufacturer),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, address, city, state, phone),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
`;

// 2. Safe Baseline Projection (Matches reports.ts & mobile: standard columns without migration 047 conflict extensions)
const HOUR_LOG_BASE_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  machine_condition,
  location,
  remarks,
  idempotency_key,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number),
  client:clients!machine_hour_logs_client_id_fkey(id, company_name),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name)
`;

// 3. Direct Flat Projection (Scalar columns only: 100% immune to PostgREST relationship schema cache issues)
const HOUR_LOG_DIRECT_PROJECTION = `
  id,
  machine_id,
  operator_id,
  supervisor_id,
  client_id,
  log_date,
  start_meter,
  end_meter,
  running_hours,
  start_time,
  end_time,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  shift,
  machine_condition,
  location,
  remarks,
  idempotency_key,
  created_at
`;

/**
 * Resilient multi-tier hour logs fetcher.
 * Automatically recovers if foreign key embeddings or newer conflict columns are pending database migration.
 */
async function fetchHourLogsResiliently(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  options: { operatorId?: string; limit?: number } = {}
): Promise<any[]> {
  const limit = options.limit || 500;

  // Tier 1: Full projection with conflict and relational fields
  try {
    let q1 = supabase
      .from("machine_hour_logs")
      .select(HOUR_LOG_FULL_PROJECTION)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.operatorId) {
      q1 = q1.eq("operator_id", options.operatorId);
    }

    const res1 = await q1;
    if (!res1.error && res1.data) {
      return res1.data;
    }

    console.warn(
      "[operators.ts] Primary hour logs projection failed, falling back to baseline projection:",
      formatPostgrestError(res1.error)
    );
  } catch (err) {
    console.warn(
      "[operators.ts] Exception querying primary hour logs projection:",
      formatPostgrestError(err)
    );
  }

  // Tier 2: Baseline projection (without migration 047 conflict extensions)
  try {
    let q2 = supabase
      .from("machine_hour_logs")
      .select(HOUR_LOG_BASE_PROJECTION)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.operatorId) {
      q2 = q2.eq("operator_id", options.operatorId);
    }

    const res2 = await q2;
    if (!res2.error && res2.data) {
      return res2.data;
    }

    console.warn(
      "[operators.ts] Baseline hour logs projection failed, falling back to direct flat projection:",
      formatPostgrestError(res2.error)
    );
  } catch (err) {
    console.warn(
      "[operators.ts] Exception querying baseline hour logs projection:",
      formatPostgrestError(err)
    );
  }

  // Tier 3: Direct flat projection (immune to relationship & schema cache issues)
  try {
    let q3 = supabase
      .from("machine_hour_logs")
      .select(HOUR_LOG_DIRECT_PROJECTION)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.operatorId) {
      q3 = q3.eq("operator_id", options.operatorId);
    }

    const res3 = await q3;
    if (res3.error) {
      console.error(
        "Error fetching supervisor hour logs (all fallbacks exhausted):",
        formatPostgrestError(res3.error)
      );
      return [];
    }

    return res3.data || [];
  } catch (err) {
    console.error(
      "Fatal exception fetching hour logs (all fallbacks exhausted):",
      formatPostgrestError(err)
    );
    return [];
  }
}

function formatHourLogsData(
  rawLogs: any[],
  machines: Machine[] = [],
  staffUsers: User[] = [],
  clients: any[] = []
): any[] {
  const machinesMap = new Map((machines || []).map((m: any) => [m.id, m]));
  const staffMap = new Map((staffUsers || []).map((u: any) => [u.id, u]));
  const clientsMap = new Map((clients || []).map((c: any) => [c.id, c]));

  return (rawLogs || []).map((log) => {
    const rawM = log.machine || machinesMap.get(log.machine_id);
    const code = rawM?.machine_id || rawM?.machine_code || rawM?.id || "";
    const startMtr = log.start_meter !== undefined && log.start_meter !== null ? Number(log.start_meter) : 0;
    const endMtr = log.end_meter !== undefined && log.end_meter !== null ? Number(log.end_meter) : startMtr;
    const running = log.running_hours !== undefined && log.running_hours !== null
      ? Number(log.running_hours)
      : Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    const ot = log.overtime_hours !== undefined && log.overtime_hours !== null ? Number(log.overtime_hours) : 0;
    
    // Normal working hours calculation: if stored, use it; otherwise compute from shift duration - ot - 1h break
    let normalWorking = log.normal_working_hours !== undefined && log.normal_working_hours !== null ? Number(log.normal_working_hours) : null;
    if (normalWorking === null && log.start_time && log.end_time) {
      const parseMins = (t: string) => {
        const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
        if (!match) return null;
        let h = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        if (match[3] === "PM" && h < 12) h += 12;
        if (match[3] === "AM" && h === 12) h = 0;
        return h * 60 + mins;
      };
      const s = parseMins(log.start_time);
      const e = parseMins(log.end_time);
      if (s !== null && e !== null) {
        let diff = e - s;
        if (diff < 0) diff += 24 * 60;
        const dur = Math.round((diff / 60) * 10) / 10;
        normalWorking = Math.max(0, Math.round((dur - ot - 1.0) * 10) / 10);
      }
    }

    const rawC = log.client || clientsMap.get(log.client_id);
    const formattedClient = rawC
      ? {
          ...rawC,
          client_name: rawC.company_name || rawC.client_name || "",
        }
      : null;

    const rawOp = log.operator || staffMap.get(log.operator_id);
    const formattedOperator = rawOp
      ? {
          id: rawOp.id,
          full_name: rawOp.full_name,
          phone: rawOp.phone,
          email: rawOp.email,
        }
      : null;

    const rawSup = log.supervisor || (log.supervisor_id ? staffMap.get(log.supervisor_id) : null);
    const formattedSupervisor = rawSup
      ? {
          id: rawSup.id,
          full_name: rawSup.full_name,
          phone: rawSup.phone,
          email: rawSup.email,
        }
      : null;

    const bkdInfo = parseBreakdownString(log.breakdown_duration || log.remarks);
    const breakdownDuration = log.breakdown_duration || (bkdInfo?.fullBreakdownString || null);
    const breakdownStartTime = log.breakdown_start_time || (bkdInfo?.startTime || null);
    const breakdownEndTime = log.breakdown_end_time || (bkdInfo?.endTime || null);

    return {
      ...log,
      start_meter: startMtr,
      end_meter: endMtr,
      running_hours: running,
      overtime_hours: ot,
      normal_working_hours: normalWorking ?? 8,
      breakdown_start_time: breakdownStartTime,
      breakdown_end_time: breakdownEndTime,
      breakdown_duration: breakdownDuration,
      client: formattedClient,
      operator: formattedOperator,
      supervisor: formattedSupervisor,
      machine: rawM
        ? {
            ...rawM,
            machine_id: code,
            machine_code: code,
            machine_name: rawM.model ? `${code} (${rawM.model})` : code,
          }
        : null,
    };
  });
}

function deriveAssignmentsFromMachines(machines: Machine[], operatorsList: User[] = []): any[] {
  return (machines || [])
    .filter((m: any) => m.current_operator_id || m.current_supervisor_id)
    .map((m: any) => {
      const code = m.machine_id || m.machine_code || m.id || "";
      const matchedOperator = m.current_operator || (m.current_operator_id ? operatorsList.find((u: any) => u.id === m.current_operator_id) : null) || null;
      const opShift = matchedOperator?.shift_time ? parseProfileShiftTime(matchedOperator.shift_time) : null;
      const startTime = opShift?.startTime || "08:00:00";
      const endTime = opShift?.endTime || "17:00:00";
      const startMins = parseTimeToMinutes(startTime) ?? 480;
      const endMins = parseTimeToMinutes(endTime) ?? 1020;
      const isOvernight = endMins <= startMins;

      return {
        id: `assign-${m.id}`,
        machine_id: m.id,
        operator_id: m.current_operator_id,
        supervisor_id: m.current_supervisor_id,
        assigned_by: m.current_supervisor_id,
        shift_start_time: startTime,
        shift_end_time: endTime,
        crosses_midnight: isOvernight,
        status: "active",
        assigned_at: m.updated_at || m.created_at || new Date().toISOString(),
        created_at: m.created_at || new Date().toISOString(),
        machine: {
          id: m.id,
          machine_id: code,
          machine_code: code,
          machine_name: m.model ? `${code} (${m.model})` : code,
          model: m.model,
          serial_number: m.serial_number,
          hour_meter: m.hour_meter,
          status: m.status,
        },
        operator: matchedOperator,
        assigner: m.current_supervisor || null,
      };
    });
}

/**
 * High-performance, tab-aware operations hub data loader.
 * Replaces direct inline database queries in operations/page.tsx.
 */
export const getOperationsHubData = cache(async (user: User, tab: string = "logs") => {
  const supabase = createSupabaseAdminClient();

  // 1. Operator Entry Tab: Only fetch operator assignment + recent logs
  if (user.role === "operator" || tab === "entry" || tab === "history") {
    const [assignedMachineRes, activeAssignmentRes, rawRecentLogs, clientsList, allMachinesRes] = await Promise.all([
      supabase
        .from("machines")
        .select("id, machine_id, model, serial_number, hour_meter, status, manufacturer, client_id, current_operator_id, operator_ids, current_supervisor_id, supervisor_ids, client:clients(id, code, company_name, address, city, state, phone)")
        .or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("operator_machine_assignments")
        .select("id, machine_id, shift_start_time, shift_end_time, is_active")
        .eq("operator_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      fetchHourLogsResiliently(supabase, { operatorId: user.id, limit: 100 }),
      getClients(undefined, true),
      getMachines({ pageSize: 1000 }),
    ]);

    const formattedAssignedMachine = assignedMachineRes.data
      ? (() => {
          const m = assignedMachineRes.data as any;
          const code = m.machine_id || m.id;
          const activeAssignment = activeAssignmentRes.data;
          return {
            ...m,
            machine_id: code,
            machine_code: code,
            machine_name: m.model ? `${code} (${m.model})` : code,
            shift_start_time: activeAssignment?.shift_start_time || null,
            shift_end_time: activeAssignment?.shift_end_time || null,
          };
        })()
      : null;

    const formattedLogs = formatHourLogsData(
      rawRecentLogs,
      allMachinesRes.machines,
      [user],
      clientsList
    );

    return {
      machines: allMachinesRes.machines,
      dbClients: clientsList,
      operators: [],
      assignments: activeAssignmentRes.data ? [activeAssignmentRes.data] : [],
      hourLogs: formattedLogs,
      siteMovements: [],
      operatorPayouts: [],
      assignedMachine: (formattedAssignedMachine as unknown as Machine) || null,
      recentLogs: formattedLogs as unknown as OperatorHourLog[],
      allMachines: allMachinesRes.machines as unknown as MachineWithEngineer[],
    };
  }

  // 2. Supervisor / Management Hub: Fetch active tab datasets in parallel
  const [
    machinesRes,
    clientsList,
    operatorsRes,
    rawHourLogs,
    assignmentsRes,
  ] = await Promise.all([
    getMachines({ pageSize: 1000 }),
    getClients(undefined, true),
    supabase
      .from("users")
      .select("id, full_name, email, phone, role, status, shift_time, shift_start_time, shift_end_time")
      .in("role", ["operator", "supervisor", "manager", "admin", "super_admin", "service_manager"])
      .eq("status", "active")
      .order("full_name"),
    fetchHourLogsResiliently(supabase, { limit: 500 }),
    supabase
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
        updated_at
      `)
      .eq("is_active", true)
      .order("assigned_at", { ascending: false }),
  ]);

  const allStaffUsers = (operatorsRes.data || []) as User[];
  const operatorsList = allStaffUsers.filter((u) => u.role === "operator");
  const staffUsersMap = new Map(allStaffUsers.map((u) => [u.id, u]));
  const formattedLogs = formatHourLogsData(
    rawHourLogs,
    machinesRes.machines,
    allStaffUsers,
    clientsList
  );

  // Use authoritative operator_machine_assignments if populated, with fallback to derived
  let activeAssignmentsList: any[] = [];
  if (assignmentsRes.data && assignmentsRes.data.length > 0) {
    activeAssignmentsList = assignmentsRes.data.map((ass: any) => {
      const m = machinesRes.machines.find((mach: any) => mach.id === ass.machine_id);
      const op = operatorsList.find((u) => u.id === ass.operator_id);
      const assignerUser = ass.assigned_by ? staffUsersMap.get(ass.assigned_by) : null;
      const code = m?.machine_id || m?.machine_code || ass.machine_id;
      const opShift = op?.shift_time ? parseProfileShiftTime(op.shift_time) : null;
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
        machine: m
          ? {
              id: m.id,
              machine_id: code,
              machine_code: code,
              machine_name: m.model ? `${code} (${m.model})` : code,
              model: m.model,
              serial_number: m.serial_number,
              hour_meter: m.hour_meter,
              status: m.status,
            }
          : { id: ass.machine_id, machine_id: "Machine", machine_name: "Machine" },
        operator: op || null,
        assigner: assignerUser
          ? {
              id: assignerUser.id,
              full_name: assignerUser.full_name,
              phone: assignerUser.phone,
              role: assignerUser.role,
            }
          : null,
        status: ass.is_active ? "active" : "ended",
      };
    });
  } else {
    activeAssignmentsList = deriveAssignmentsFromMachines(machinesRes.machines, operatorsList);
  }

  return {
    machines: machinesRes.machines,
    dbClients: clientsList,
    operators: operatorsList,
    assignments: activeAssignmentsList,
    hourLogs: formattedLogs,
    siteMovements: [],
    operatorPayouts: [],
    assignedMachine: null,
    recentLogs: [],
    allMachines: machinesRes.machines as unknown as MachineWithEngineer[],
  };
});

export const getOperatorEntryContext = cache(async (operatorId: string) => {
  const supabase = createSupabaseAdminClient();
  const { data: machine } = await supabase
    .from("machines")
    .select("id, machine_id, model, serial_number, hour_meter, status, manufacturer, client_id, current_operator_id, operator_ids, current_supervisor_id, supervisor_ids, client:clients(id, code, company_name, address, city, state, phone)")
    .or(`current_operator_id.eq.${operatorId},operator_ids.cs.{${operatorId}}`)
    .limit(1)
    .maybeSingle();

  return { assignedMachine: machine };
});
