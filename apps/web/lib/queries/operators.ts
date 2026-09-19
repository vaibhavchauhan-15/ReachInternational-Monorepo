import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { getMachines } from "@/lib/queries/machines";
import { getClients } from "@/lib/queries/clients";
import type { Machine, MachineWithEngineer, User } from "@reachinternational/types";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { parseBreakdownString, parseProfileShiftTime, parseTimeToMinutes } from "@reachinternational/utils";
import {
  getOperationsMachineLogsData,
  getOperationsClientLogsData,
  getOperationsOperatorLogsData,
  getOperationsAssignmentsData,
} from "@/lib/data/operations";

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
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, street, city, district, state, pincode, phone),
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
  client:clients!machine_hour_logs_client_id_fkey(id, company_name, city, district, state),
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
export async function fetchHourLogsResiliently(
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

export function formatHourLogsData(
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

    const locStr = log.location || (formattedClient?.city ? [formattedClient.city, formattedClient.district, formattedClient.state].filter(Boolean).join(", ") : "—");

    return {
      ...log,
      location: locStr,
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

export function deriveAssignmentsFromMachines(machines: Machine[], operatorsList: User[] = []): any[] {

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
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, street, city, district, state, pincode),
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
  site?: string;
  operatorId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  expanded?: boolean | string;
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

    // Optimize: Pre-compute search relation lookups ONCE instead of duplicating across summaryQuery & dataQuery
    let searchOrClause: string | null = null;
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
        searchOrClause = orClauses.join(",");
      }
    }

    // Helper to apply filters to a query builder
    const applyFilters = (q: any) => {
      let query = q;

      // 1. Entity Filters
      if (params.viewMode === "machine" && params.machineId && params.machineId !== "all") {
        query = query.eq("machine_id", params.machineId);
      } else if (params.viewMode === "client" && params.clientId && params.clientId !== "all") {
        query = query.eq("client_id", params.clientId);
        if (params.machineId && params.machineId !== "all") {
          query = query.eq("machine_id", params.machineId);
        }
        if (params.site && params.site !== "all") {
          // Extract safe alphanumeric search tokens from the selected site
          const siteTokens = params.site
            .split(",")
            .map((t) => t.replace(/[^a-zA-Z0-9\s-]/g, " ").trim())
            .filter((t) => t.length >= 3);

          // Find the most distinctive geographical token (e.g. city or district, avoiding generic words)
          const primaryToken = siteTokens.find(
            (t) =>
              !t.toLowerCase().includes("mill") &&
              !t.toLowerCase().includes("plot") &&
              !t.toLowerCase().includes("centre") &&
              !t.toLowerCase().includes("industrial")
          ) || siteTokens[0];

          if (primaryToken) {
            query = query.ilike("location", `%${primaryToken}%`);
          } else {
            query = query.ilike("location", `%${params.site.replace(/[%_\\]/g, "").trim()}%`);
          }
        }
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
      if (searchOrClause) {
        query = query.or(searchOrClause);
      }

      return query;
    };

    // 1. Concurrent aggregate metrics query — fast-path via database RPC
    let rpcSummaryPromise: Promise<any> | null = null;
    if (!searchOrClause) {
      let rpcStartDate: string | null = null;
      let rpcEndDate: string | null = null;
      if (params.month === "custom") {
        rpcStartDate = params.customStart || null;
        rpcEndDate = params.customEnd || null;
      } else if (params.month && params.month !== "all") {
        const year = new Date().getFullYear();
        const monthNum = parseInt(params.month, 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          const mStr = String(monthNum).padStart(2, "0");
          rpcStartDate = `${year}-${mStr}-01`;
          const lastDay = new Date(year, monthNum, 0).getDate();
          rpcEndDate = `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`;
        }
      }

      rpcSummaryPromise = Promise.resolve(
        supabase.rpc("get_operations_summary", {
          p_client_id: params.viewMode === "client" && params.clientId && params.clientId !== "all" ? params.clientId : null,
          p_machine_id: params.machineId && params.machineId !== "all" ? params.machineId : null,
          p_operator_id: params.viewMode === "operator" && params.operatorId && params.operatorId !== "all" ? params.operatorId : null,
          p_site: params.site && params.site !== "all" ? params.site : null,
          p_start_date: rpcStartDate,
          p_end_date: rpcEndDate,
        })
      );
    }

    let summaryQuery = supabase
      .from("machine_hour_logs")
      .select("running_hours, start_meter, end_meter, overtime_hours, is_breakdown, log_date");
    summaryQuery = applyFilters(summaryQuery);

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
    tier1Query = applyFilters(tier1Query);

    const [rpcSummaryRes, summaryRes, tier1Res] = await Promise.all([
      rpcSummaryPromise,
      rpcSummaryPromise ? Promise.resolve({ data: null, error: null }) : summaryQuery,
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
      tier2Query = applyFilters(tier2Query);
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
        tier3Query = applyFilters(tier3Query);
        const tier3Res = await tier3Query;

        pagedData = tier3Res.data || [];
        totalCount = tier3Res.count ?? (tier3Res.data?.length || 0);
      }
    }

    // Compute aggregate summary metrics (fast-path from RPC or fallback from rows)
    let totalRunHours = 0;
    let totalOtHours = 0;
    let totalBreakdowns = 0;
    let loggedDaysCount = 0;

    if (rpcSummaryRes && !rpcSummaryRes.error && rpcSummaryRes.data) {
      const s = rpcSummaryRes.data;
      totalRunHours = Number(s.total_run_hours) || 0;
      totalOtHours = Number(s.total_ot_hours) || 0;
      totalBreakdowns = Number(s.total_breakdowns) || 0;
      loggedDaysCount = Number(s.logged_days_count) || 0;
    } else {
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
      loggedDaysCount = loggedDates.size;
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
        loggedDaysCount,
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



  // 2. Supervisor Logs Tab: Sub-tab isolated loaders with server-side pagination & GIN trigram indexes
  if (tab === "logs") {
    const viewMode =
      params.viewMode ||
      (params.clientId ? "client" : params.operatorId ? "operator" : "machine");

    if (viewMode === "machine") {
      const res = await getOperationsMachineLogsData({
        machineId: params.machineId,
        month: params.month,
        customStart: params.customStart,
        customEnd: params.customEnd,
        site: params.site,
        search: params.search,
        sort: params.sort,
        page: params.page,
        pageSize: params.pageSize || 20,
      });

      return {
        machines: res.machines as unknown as Machine[],
        dbClients: [],
        operators: [],
        assignments: [],
        hourLogs: res.hourLogs,
        siteMovements: [],
        operatorPayouts: [],
        assignedMachine: null,
        recentLogs: [],
        allMachines: res.machines as unknown as MachineWithEngineer[],
        totalLogsCount: res.totalLogsCount,
        currentPage: res.currentPage,
        logsPageSize: res.logsPageSize,
        logsSummary: res.logsSummary,
        activeMachineId: res.activeMachineId,
      };
    }

    if (viewMode === "client") {
      const res = await getOperationsClientLogsData({
        clientId: params.clientId,
        machineId: params.machineId,
        site: params.site,
        month: params.month,
        customStart: params.customStart,
        customEnd: params.customEnd,
        search: params.search,
        sort: params.sort,
        page: params.page,
        pageSize: params.pageSize || 20,
        fetchLogs: true,
      });

      return {
        machines: res.machines as unknown as Machine[],
        dbClients: res.dbClients as any,
        operators: [],
        assignments: [],
        hourLogs: res.hourLogs,
        siteMovements: [],
        operatorPayouts: [],
        assignedMachine: null,
        recentLogs: [],
        allMachines: res.machines as unknown as MachineWithEngineer[],
        totalLogsCount: res.totalLogsCount,
        currentPage: res.currentPage,
        logsPageSize: res.logsPageSize,
        logsSummary: res.logsSummary,
        activeClientId: res.activeClientId,
        mostRecentClientId: res.mostRecentClientId,
      };
    }

    if (viewMode === "operator") {
      const res = await getOperationsOperatorLogsData({
        operatorId: params.operatorId,
        month: params.month,
        customStart: params.customStart,
        customEnd: params.customEnd,
        search: params.search,
        sort: params.sort,
        page: params.page,
        pageSize: params.pageSize,
      });

      return {
        machines: [],
        dbClients: [],
        operators: res.operators as unknown as User[],
        assignments: [],
        hourLogs: res.hourLogs,
        siteMovements: [],
        operatorPayouts: [],
        assignedMachine: null,
        recentLogs: [],
        allMachines: [],
        totalLogsCount: res.totalLogsCount,
        currentPage: res.currentPage,
        logsPageSize: res.logsPageSize,
        logsSummary: res.logsSummary,
        activeOperatorId: res.activeOperatorId,
      };
    }
  }

  // 3. Supervisor Assignments Tab: Full machines & assignment records (Zero hour logs queried!)
  const [assignmentsData, clientsList] = await Promise.all([
    getOperationsAssignmentsData(),
    getClients(undefined, true),
  ]);

  return {
    machines: assignmentsData.machines,
    dbClients: clientsList,
    operators: assignmentsData.operators,
    assignments: assignmentsData.assignments,
    hourLogs: [],
    siteMovements: [],
    operatorPayouts: [],
    assignedMachine: null,
    recentLogs: [],
    allMachines: assignmentsData.machines as unknown as MachineWithEngineer[],
    totalLogsCount: 0,
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

// Re-export canonical ultra-fast Operator Entry Context read model
export { getOperatorEntryContext } from "@/lib/queries/operator-entry";
