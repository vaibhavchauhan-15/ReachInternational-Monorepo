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

// 4. Paged Hour Logs Projection (Optimized: minimal fields for high-density tables)
const PAGED_LOG_FULL_PROJECTION = `
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
  conflict_flag,
  conflict_status,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone)
`;

const PAGED_LOG_BASE_PROJECTION = `
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
  conflict_flag,
  conflict_status,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number),
  client:clients!machine_hour_logs_client_id_fkey(id, company_name),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name)
`;

const PAGED_LOG_DIRECT_PROJECTION = `
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
  created_at
`;

export interface OperationsLogsPageParams {
  page?: number;
  pageSize?: number;
  viewMode?: "machine" | "client" | "operator";
  machineId?: string;
  clientId?: string;
  operatorId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  search?: string;
  sort?: "date-desc" | "date-asc";
}

export interface OperationsLogsPageResult {
  logs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalRunHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    loggedDaysCount: number;
  };
}

/**
 * Server-side paginated and filtered machine hour logs query.
 * Optimized with exact counts, minimal embedded projections, and aggregate summary metrics.
 */
export const getOperationsLogsPage = cache(
  async (
    params: OperationsLogsPageParams = {},
    options?: { machines?: Machine[]; staffUsers?: User[]; clients?: any[] }
  ): Promise<OperationsLogsPageResult> => {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Number(params.pageSize) || 10);
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const sortAsc = params.sort === "date-asc";

    const supabase = createSupabaseAdminClient();

    // Helper to apply filters to a query builder
    const applyFilters = async (q: any) => {
      let query = q;

      // 1. Entity Filters
      if (params.viewMode === "machine" && params.machineId && params.machineId !== "all") {
        query = query.eq("machine_id", params.machineId);
      } else if (params.viewMode === "client" && params.clientId && params.clientId !== "all") {
        query = query.eq("client_id", params.clientId);
      } else if (params.viewMode === "operator" && params.operatorId && params.operatorId !== "all") {
        query = query.eq("operator_id", params.operatorId);
      }

      // 2. Month / Custom Date Range Filters
      if (params.month === "custom") {
        if (params.customStart) query = query.gte("log_date", params.customStart);
        if (params.customEnd) query = query.lte("log_date", params.customEnd);
      } else if (params.month && params.month !== "all") {
        const year = new Date().getFullYear();
        const monthNum = parseInt(params.month, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          const mStr = String(monthNum).padStart(2, "0");
          const startDate = `${year}-${mStr}-01`;
          const lastDay = new Date(year, monthNum, 0).getDate();
          const endDate = `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`;
          query = query.gte("log_date", startDate).lte("log_date", endDate);
        }
      }

      // 3. Search Filter across entire dataset
      if (params.search) {
        const s = params.search.replace(/[,()"\n\r\\]/g, "").trim();
        if (s) {
          const [machRes, opRes, clientRes] = await Promise.all([
            supabase
              .from("machines")
              .select("id")
              .or(`machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`)
              .limit(50),
            supabase.from("users").select("id").ilike("full_name", `%${s}%`).limit(50),
            supabase.from("clients").select("id").ilike("company_name", `%${s}%`).limit(50),
          ]);

          const orClauses: string[] = [
            `remarks.ilike.%${s}%`,
            `location.ilike.%${s}%`,
          ];
          if (machRes.data && machRes.data.length > 0) {
            orClauses.push(`machine_id.in.(${machRes.data.map((m) => m.id).join(",")})`);
          }
          if (opRes.data && opRes.data.length > 0) {
            orClauses.push(`operator_id.in.(${opRes.data.map((u) => u.id).join(",")})`);
          }
          if (clientRes.data && clientRes.data.length > 0) {
            orClauses.push(`client_id.in.(${clientRes.data.map((c) => c.id).join(",")})`);
          }

          query = query.or(orClauses.join(","));
        }
      }

      return query;
    };

    // 1. Concurrent aggregate metrics query (scalar columns only)
    let summaryQuery = supabase
      .from("machine_hour_logs")
      .select("running_hours, start_meter, end_meter, overtime_hours, is_breakdown, log_date");
    summaryQuery = await applyFilters(summaryQuery);

    // 2. Primary paginated query
    let pagedData: any[] = [];
    let totalCount = 0;

    let tier1Query = supabase
      .from("machine_hour_logs")
      .select(PAGED_LOG_FULL_PROJECTION, { count: "exact" })
      .order("log_date", { ascending: sortAsc })
      .order("created_at", { ascending: sortAsc })
      .order("id", { ascending: sortAsc })
      .range(fromIndex, toIndex);
    tier1Query = await applyFilters(tier1Query);

    const [summaryRes, tier1Res] = await Promise.all([
      summaryQuery,
      tier1Query,
    ]);

    if (!tier1Res.error && tier1Res.data) {
      pagedData = tier1Res.data;
      totalCount = tier1Res.count ?? tier1Res.data.length;
    } else {
      console.warn(
        "[operators.ts] Paged logs Tier 1 projection failed, trying Tier 2 fallback:",
        formatPostgrestError(tier1Res.error)
      );
      // Tier 2 Fallback
      let tier2Query = supabase
        .from("machine_hour_logs")
        .select(PAGED_LOG_BASE_PROJECTION, { count: "exact" })
        .order("log_date", { ascending: sortAsc })
        .order("created_at", { ascending: sortAsc })
        .order("id", { ascending: sortAsc })
        .range(fromIndex, toIndex);
      tier2Query = await applyFilters(tier2Query);
      const tier2Res = await tier2Query;

      if (!tier2Res.error && tier2Res.data) {
        pagedData = tier2Res.data;
        totalCount = tier2Res.count ?? tier2Res.data.length;
      } else {
        console.warn(
          "[operators.ts] Paged logs Tier 2 projection failed, trying Tier 3 flat fallback:",
          formatPostgrestError(tier2Res.error)
        );
        // Tier 3 Flat Fallback
        let tier3Query = supabase
          .from("machine_hour_logs")
          .select(PAGED_LOG_DIRECT_PROJECTION, { count: "exact" })
          .order("log_date", { ascending: sortAsc })
          .order("created_at", { ascending: sortAsc })
          .order("id", { ascending: sortAsc })
          .range(fromIndex, toIndex);
        tier3Query = await applyFilters(tier3Query);
        const tier3Res = await tier3Query;

        pagedData = tier3Res.data || [];
        totalCount = tier3Res.count ?? (tier3Res.data?.length || 0);
      }
    }

    // Compute aggregate summary metrics
    let totalRunHours = 0;
    let totalOtHours = 0;
    let totalBreakdowns = 0;
    const loggedDates = new Set<string>();

    for (const row of summaryRes.data || []) {
      const startMtr = row.start_meter ?? 0;
      const endMtr = row.end_meter ?? startMtr;
      const run = row.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
      totalRunHours += run;
      totalOtHours += row.overtime_hours || 0;
      if (row.is_breakdown) totalBreakdowns++;
      if (row.log_date) loggedDates.add(row.log_date);
    }

    const formatted = formatHourLogsData(
      pagedData,
      options?.machines || [],
      options?.staffUsers || [],
      options?.clients || []
    );

    return {
      logs: formatted,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      summary: {
        totalRunHours: Math.round(totalRunHours * 10) / 10,
        totalOtHours: Math.round(totalOtHours * 10) / 10,
        totalBreakdowns,
        loggedDaysCount: loggedDates.size,
      },
    };
  }
);

/**
 * High-performance, tab-aware operations hub data loader.
 * Replaces direct inline database queries in operations/page.tsx.
 */
export const getOperationsHubData = cache(async (
  user: User,
  tab: string = "logs",
  params: OperationsLogsPageParams = {}
) => {
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
      totalLogsCount: formattedLogs.length,
      currentPage: 1,
      logsPageSize: 10,
      logsSummary: {
        totalRunHours: 0,
        totalOtHours: 0,
        totalBreakdowns: 0,
        loggedDaysCount: 0,
      },
    };
  }

  // 2. Supervisor Logs Tab: Slim loader with server-side pagination & lightweight machines
  if (tab === "logs") {
    const [machinesRes, clientsList, operatorsRes] = await Promise.all([
      supabase
        .from("machines")
        .select("id, machine_id, model, serial_number, status, client_id, current_operator_id")
        .order("machine_id"),
      getClients(undefined, true),
      supabase
        .from("users")
        .select("id, full_name, email, phone, role, status, shift_time, shift_start_time, shift_end_time")
        .in("role", ["operator", "supervisor", "manager", "admin", "super_admin", "service_manager"])
        .eq("status", "active")
        .order("full_name"),
    ]);

    const allStaffUsers = (operatorsRes.data || []) as User[];
    const operatorsList = allStaffUsers.filter((u) => u.role === "operator");
    const machineOptions = (machinesRes.data || []).map((m: any) => ({
      ...m,
      machine_code: m.machine_id,
      machine_name: m.model ? `${m.machine_id} (${m.model})` : m.machine_id,
    })) as Machine[];

    const pagedResult = await getOperationsLogsPage(params, {
      machines: machineOptions,
      staffUsers: allStaffUsers,
      clients: clientsList,
    });

    return {
      machines: machineOptions,
      dbClients: clientsList,
      operators: operatorsList,
      assignments: [],
      hourLogs: pagedResult.logs,
      siteMovements: [],
      operatorPayouts: [],
      assignedMachine: null,
      recentLogs: [],
      allMachines: machineOptions as unknown as MachineWithEngineer[],
      totalLogsCount: pagedResult.total,
      currentPage: pagedResult.page,
      logsPageSize: pagedResult.pageSize,
      logsSummary: pagedResult.summary,
      pagedResult,
    };
  }

  // 3. Supervisor Assignments Tab: Full machines & assignment records
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
    totalLogsCount: formattedLogs.length,
    currentPage: 1,
    logsPageSize: 10,
    logsSummary: {
      totalRunHours: 0,
      totalOtHours: 0,
      totalBreakdowns: 0,
      loggedDaysCount: 0,
    },
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
