import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import {
  serializeOperatorLogsFilter,
  resolveOperationsDateRange,
  OPERATIONS_CACHE_TTLS,
} from "@reachinternational/utils";
import {
  getCachedOperationsOperators,
  type OperationsOperatorFilterOption,
} from "./operations-filters";
import { resolveOperationsSearchClause } from "./operations-search";

export interface OperationsOperatorLogsParams {
  operatorId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
}

export interface OperationsOperatorLogsResult {
  machines: any[];
  dbClients: any[];
  operators: OperationsOperatorFilterOption[];
  assignments: any[];
  hourLogs: any[];
  totalLogsCount: number;
  currentPage: number;
  logsPageSize: number;
  logsSummary: {
    totalRunHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    loggedDaysCount: number;
  };
  activeOperatorId: string;
  activeOperator: OperationsOperatorFilterOption | null;
}

/**
 * Exact column projections for operator logs list view.
 * Eliminates redundant operator join by directly attaching activeOperator in memory.
 */
const OPERATOR_LOG_EXACT_PROJECTION = `
  id,
  machine_id,
  operator_id,
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
  location,
  remarks,
  conflict_flag,
  conflict_reason,
  conflict_status,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status, manufacturer),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, street, city, district, state, pincode)
`;

/**
 * High-performance, isolated loader for Operator View (tab=logs&view=operator).
 *
 * Features:
 * - Server pagination: 20 records per page by default.
 * - Server sorting: date, running hours, meter reading.
 * - Server filtering: active operator, month/date range.
 * - Server search: GIN trigram indexes on location and remarks.
 * - Exact columns & Minimal joins: 0 users/operator table join overhead in SQL.
 * - Query caching: Next.js unstable_cache (30s SWR).
 * - Request deduplication: React cache() wrapper.
 * - Strictly scoped: 0 machines and 0 clients queried.
 */
export const getOperationsOperatorLogsData = cache(
  async (params: OperationsOperatorLogsParams = {}): Promise<OperationsOperatorLogsResult> => {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Number(params.pageSize) || 20);
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const sort = params.sort || "date-desc";

    const supabase = createSupabaseAdminClient();

    // 1. Fetch lightweight cached operator list (60s SWR)
    const operators = await getCachedOperationsOperators();

    // 2. Resolve active operator
    let activeOperatorId = (params.operatorId && params.operatorId !== "all") ? params.operatorId : "";

    if (!activeOperatorId) {
      // Find operator with the most recent operational log
      const recentRes = await supabase
        .from("machine_hour_logs")
        .select("operator_id")
        .not("operator_id", "is", null)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRes.data?.operator_id) {
        activeOperatorId = recentRes.data.operator_id;
      } else {
        activeOperatorId = operators[0]?.id || "";
      }
    }

    const activeOperator = operators.find((op) => op.id === activeOperatorId) || operators[0] || null;
    activeOperatorId = activeOperator?.id || "";

    if (!activeOperatorId) {
      return {
        machines: [],
        dbClients: [],
        operators: operators || [],
        assignments: [],
        hourLogs: [],
        totalLogsCount: 0,
        currentPage: page,
        logsPageSize: pageSize,
        logsSummary: { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 },
        activeOperatorId: "",
        activeOperator: null,
      };
    }

    const { startDate, endDate, endDateInclusive, endOperator } = resolveOperationsDateRange({
      month: params.month,
      customStart: params.customStart,
      customEnd: params.customEnd,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    // 3. Serialized deterministic cache key for query caching
    const serializedKey = serializeOperatorLogsFilter({
      operatorId: activeOperatorId,
      month: params.month,
      customStart: startDate || params.customStart,
      customEnd: endDate || params.customEnd,
      search: params.search,
      sort,
      page,
      pageSize,
    });

    const fetchCachedData = unstable_cache(
      async () => {
        // Run Summary RPC and Paginated Log Query concurrently
        const rpcPromise = supabase.rpc("get_operations_summary", {
          p_client_id: null,
          p_machine_id: null,
          p_operator_id: activeOperatorId,
          p_site: null,
          p_start_date: startDate,
          p_end_date: endDateInclusive || endDate,
        });

        let query = supabase
          .from("machine_hour_logs")
          .select(OPERATOR_LOG_EXACT_PROJECTION, { count: "exact" })
          .eq("operator_id", activeOperatorId);

        // Date range filters (half-open [2026-09-01, 2026-10-01) for month, exact range for custom)
        if (startDate) query = query.gte("log_date", startDate);
        if (endDate) {
          if (endOperator === "lt") {
            query = query.lt("log_date", endDate);
          } else {
            query = query.lte("log_date", endDate);
          }
        }

        // Server search across location, remarks, machine code/model/serial, client name, and shift
        if (params.search) {
          const searchOrClause = await resolveOperationsSearchClause(params.search, "operator");
          if (searchOrClause) {
            query = query.or(searchOrClause);
          }
        }

        switch (sort) {
          case "date-asc":
            query = query
              .order("log_date", { ascending: true })
              .order("created_at", { ascending: true })
              .order("id", { ascending: true });
            break;
          case "hours-desc":
            query = query
              .order("running_hours", { ascending: false, nullsFirst: false })
              .order("log_date", { ascending: false })
              .order("id", { ascending: false });
            break;
          case "hours-asc":
            query = query
              .order("running_hours", { ascending: true, nullsFirst: false })
              .order("log_date", { ascending: false })
              .order("id", { ascending: false });
            break;
          case "meter-desc":
            query = query
              .order("end_meter", { ascending: false, nullsFirst: false })
              .order("log_date", { ascending: false })
              .order("id", { ascending: false });
            break;
          case "meter-asc":
            query = query
              .order("end_meter", { ascending: true, nullsFirst: false })
              .order("log_date", { ascending: false })
              .order("id", { ascending: false });
            break;
          case "date-desc":
          default:
            query = query
              .order("log_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false });
            break;
        }

        query = query.range(fromIndex, toIndex);

        const [summaryRes, logsRes] = await Promise.all([rpcPromise, query]);

        const totalCount = logsRes.count ?? (logsRes.data?.length || 0);
        const rawLogs = logsRes.data || [];

        let summary = {
          totalRunHours: 0,
          totalOtHours: 0,
          totalBreakdowns: 0,
          loggedDaysCount: 0,
        };

        if (summaryRes.data && !summaryRes.error) {
          const s = summaryRes.data;
          summary = {
            totalRunHours: Number(s.total_run_hours) || 0,
            totalOtHours: Number(s.total_ot_hours) || 0,
            totalBreakdowns: Number(s.total_breakdowns) || 0,
            loggedDaysCount: Number(s.logged_days_count) || 0,
          };
        }

        return {
          rawLogs,
          totalCount,
          summary,
        };
      },
      [`operations-operator-logs-p6-${serializedKey}`],
      {
        tags: [
          TAGS.operationsLogs,
          TAGS.operations,
          TAGS.operatorOperations(activeOperatorId),
        ],
        revalidate: OPERATIONS_CACHE_TTLS.operatorLogs,
      }
    );

    const { rawLogs, totalCount, summary } = await fetchCachedData();

    // Hydrate activeOperator and format machine/client links in-memory
    const opName = activeOperator?.full_name || (activeOperator as any)?.name || "Operator";
    const operatorPayload = activeOperator
      ? {
          id: activeOperator.id,
          full_name: opName,
          phone: activeOperator.phone,
          name: opName,
        }
      : null;

    const hourLogs = rawLogs.map((log: any) => {
      const m = log.machine;
      const code = m?.machine_id || log.machine_id;
      const mName = m?.model ? `${code} (${m.model})` : code;
      const c = log.client;
      const cName = c?.company_name || c?.client_name || "Client";

      return {
        ...log,
        machine: m ? { ...m, machine_code: code, machine_name: mName } : null,
        client: c ? { ...c, company_name: cName, client_name: cName, name: cName } : null,
        operator: operatorPayload,
      };
    });

    return {
      machines: [],
      dbClients: [],
      operators,
      assignments: [],
      hourLogs,
      totalLogsCount: totalCount,
      currentPage: page,
      logsPageSize: pageSize,
      logsSummary: summary,
      activeOperatorId,
      activeOperator,
    };
  }
);

// ─── Separate On-Demand Operator Details & History Loader ────────────────────

export interface OperatorHistoryData {
  profile: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
    role: string;
    status: string;
    shift_time?: string | null;
    address?: string | null;
    created_at?: string;
  } | null;
  lifetimeStats: {
    totalRunHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    loggedDaysCount: number;
  };
  recentAssignments: Array<{
    id: string;
    shift_start_time?: string;
    shift_end_time?: string;
    assigned_at?: string;
    is_active?: boolean;
    machine?: {
      id: string;
      machine_id: string;
      model?: string;
    } | null;
  }>;
  recentLogs: Array<{
    id: string;
    log_date: string;
    start_meter: number;
    end_meter: number;
    running_hours: number;
    overtime_hours: number;
    is_breakdown: boolean;
    location?: string;
    shift?: string;
    machine?: {
      id: string;
      machine_id: string;
      model?: string;
    } | null;
    client?: {
      id: string;
      company_name?: string;
    } | null;
  }>;
}

/**
 * On-demand cached loader for Operator History Modal.
 * Completely separate from the main list query, keeping the initial tab load fast.
 */
export const getOperatorHistoryData = cache(
  async (operatorId: string): Promise<OperatorHistoryData> => {
    const supabase = createSupabaseAdminClient();

    const fetcher = unstable_cache(
      async () => {
        const [userRes, lifetimeRpc, assignmentsRes, recentLogsRes] = await Promise.all([
          supabase
            .from("users")
            .select("id, full_name, phone, email, role, status, shift_start_time, shift_end_time, street, created_at")
            .eq("id", operatorId)
            .single(),
          supabase.rpc("get_operations_summary", {
            p_client_id: null,
            p_machine_id: null,
            p_operator_id: operatorId,
            p_site: null,
            p_start_date: null,
            p_end_date: null,
          }),
          supabase
            .from("operator_machine_assignments")
            .select(`
              id,
              shift_start_time,
              shift_end_time,
              crosses_midnight,
              is_active,
              assigned_at,
              ended_at,
              machine:machines!operator_machine_assignments_machine_id_fkey(id, machine_id, model)
            `)
            .eq("operator_id", operatorId)
            .order("assigned_at", { ascending: false })
            .limit(10),
          supabase
            .from("machine_hour_logs")
            .select(`
              id,
              log_date,
              start_meter,
              end_meter,
              running_hours,
              overtime_hours,
              is_breakdown,
              location,
              shift,
              machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model),
              client:clients!machine_hour_logs_client_id_fkey(id, company_name)
            `)
            .eq("operator_id", operatorId)
            .order("log_date", { ascending: false })
            .limit(10),
        ]);

        const rawAssignments = assignmentsRes.data || [];
        const rawLogs = recentLogsRes.data || [];
        const lifetime = lifetimeRpc.data;

        return {
          profile: userRes.data ? { ...userRes.data, address: userRes.data.street || null } : null,
          lifetimeStats: {
            totalRunHours: Number(lifetime?.total_run_hours) || 0,
            totalOtHours: Number(lifetime?.total_ot_hours) || 0,
            totalBreakdowns: Number(lifetime?.total_breakdowns) || 0,
            loggedDaysCount: Number(lifetime?.logged_days_count) || 0,
          },
          recentAssignments: rawAssignments.map((a: any) => ({
            id: a.id,
            shift_start_time: a.shift_start_time,
            shift_end_time: a.shift_end_time,
            assigned_at: a.assigned_at,
            is_active: a.is_active,
            machine: a.machine,
          })),
          recentLogs: rawLogs.map((l: any) => ({
            id: l.id,
            log_date: l.log_date,
            start_meter: l.start_meter,
            end_meter: l.end_meter,
            running_hours: l.running_hours,
            overtime_hours: l.overtime_hours,
            is_breakdown: l.is_breakdown,
            location: l.location,
            shift: l.shift,
            machine: l.machine,
            client: l.client,
          })),
        };
      },
      [`operator-history-p7-${operatorId}`],
      {
        tags: [TAGS.operatorOperations(operatorId), TAGS.hourLogs],
        revalidate: 60,
      }
    );

    return fetcher();
  }
);
