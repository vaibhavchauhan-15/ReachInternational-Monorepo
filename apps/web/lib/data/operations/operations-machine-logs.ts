import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import {
  serializeMachineLogsFilter,
  resolveOperationsDateRange,
  OPERATIONS_CACHE_TTLS,
} from "@reachinternational/utils";
import {
  getCachedOperationsMachines,
  getCachedOperationsOperators,
  type OperationsMachineFilterOption,
} from "./operations-filters";
import { resolveOperationsSearchClause } from "./operations-search";

export interface OperationsMachineLogsParams {
  machineId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  startDate?: string;
  endDate?: string;
  site?: string;
  locationId?: string;
  shift?: string;
  breakdownOnly?: boolean;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
}

export interface OperationsMachineLogsResult {
  machines: OperationsMachineFilterOption[];
  dbClients: any[];
  operators: any[];
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
  activeMachineId: string;
  activeMachine: OperationsMachineFilterOption | null;
}

/**
 * Exact column projections for machine logs list view.
 * Eliminates redundant machine join by directly attaching activeMachine in memory.
 */
const MACHINE_LOG_EXACT_PROJECTION = `
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
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, street, city, district, state, pincode),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone)
`;

/**
 * High-performance, isolated data loader for Machine View (tab=logs&view=machine).
 * 
 * Features:
 * - Server pagination: 20 records per page by default.
 * - Server sorting: date, running hours, meter reading.
 * - Server filtering: active machine, date range, site, shift, breakdown.
 * - Server search: GIN trigram indexes on location and remarks + operator matching.
 * - Exact columns & Minimal joins: 0 machine table join overhead.
 * - Query caching: Next.js unstable_cache (30s SWR).
 * - Request deduplication: React cache() wrapper.
 */
export const getOperationsMachineLogsData = cache(
  async (params: OperationsMachineLogsParams = {}): Promise<OperationsMachineLogsResult> => {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Number(params.pageSize) || 20);
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const sort = params.sort || "date-desc";

    // 1. Fetch lightweight cached machine options
    const machines = await getCachedOperationsMachines();

    // 2. Resolve active machine
    const activeMachine = (params.machineId && params.machineId !== "all")
      ? machines.find((m) => m.id === params.machineId) || machines[0] || null
      : machines[0] || null;

    const activeMachineId = activeMachine?.id || "";

    if (!activeMachineId) {
      return {
        machines: [],
        dbClients: [],
        operators: [],
        assignments: [],
        hourLogs: [],
        totalLogsCount: 0,
        currentPage: page,
        logsPageSize: pageSize,
        logsSummary: { totalRunHours: 0, totalOtHours: 0, totalBreakdowns: 0, loggedDaysCount: 0 },
        activeMachineId: "",
        activeMachine: null,
      };
    }

    const { startDate, endDate, endDateInclusive, endOperator } = resolveOperationsDateRange({
      month: params.month,
      customStart: params.customStart,
      customEnd: params.customEnd,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    const effectiveSite = params.locationId || params.site;

    // 3. Serialized cache key for query caching
    const serializedKey = serializeMachineLogsFilter({
      machineId: activeMachineId,
      month: params.month,
      customStart: startDate || params.customStart,
      customEnd: endDate || params.customEnd,
      site: effectiveSite,
      shift: params.shift,
      breakdownOnly: params.breakdownOnly,
      search: params.search,
      sort,
      page,
      pageSize,
    });

    // 4. Cached database execution via Next.js unstable_cache
    const fetchCachedData = unstable_cache(
      async () => {
        const supabase = createSupabaseAdminClient();

        // Single aggregation RPC for KPI metrics
        const rpcPromise = supabase.rpc("get_operations_summary", {
          p_client_id: null,
          p_machine_id: activeMachineId,
          p_operator_id: null,
          p_site: effectiveSite && effectiveSite !== "all" ? effectiveSite : null,
          p_start_date: startDate,
          p_end_date: endDateInclusive || endDate,
        });

        let query = supabase
          .from("machine_hour_logs")
          .select(MACHINE_LOG_EXACT_PROJECTION, { count: "exact" })
          .eq("machine_id", activeMachineId);

        // Date range filters (half-open [2026-09-01, 2026-10-01) for month, exact range for custom)
        if (startDate) query = query.gte("log_date", startDate);
        if (endDate) {
          if (endOperator === "lt") {
            query = query.lt("log_date", endDate);
          } else {
            query = query.lte("log_date", endDate);
          }
        }

        // Site location filter
        if (effectiveSite && effectiveSite !== "all") {
          query = query.ilike("location", `%${effectiveSite.trim()}%`);
        }

        // Shift filter
        if (params.shift && params.shift !== "all") {
          query = query.eq("shift", params.shift.trim());
        }

        // Breakdown filter
        if (params.breakdownOnly) {
          query = query.eq("is_breakdown", true);
        }

        // Server search across location, remarks, operator name, client name, and shift
        if (params.search) {
          const searchOrClause = await resolveOperationsSearchClause(params.search, "machine");
          if (searchOrClause) {
            query = query.or(searchOrClause);
          }
        }

        // Server-side sorting
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
      [`operations-machine-logs-p4-${serializedKey}`],
      {
        tags: [
          TAGS.operationsLogs,
          TAGS.operations,
          TAGS.machineOperations(activeMachineId),
        ],
        revalidate: OPERATIONS_CACHE_TTLS.machineLogs,
      }
    );

    const { rawLogs, totalCount, summary } = await fetchCachedData();

    // Minimal join hydration: attach activeMachine directly in memory
    const code = activeMachine.machine_id;
    const mName = activeMachine.model ? `${code} (${activeMachine.model})` : code;
    const hydratedMachine = {
      ...activeMachine,
      machine_code: code,
      machine_name: mName,
    };

    const hourLogs = rawLogs.map((log: any) => {
      const c = log.client;
      const cName = c?.company_name || "Client";
      const op = log.operator;
      const opName = op?.full_name || "Operator";

      return {
        ...log,
        machine: hydratedMachine,
        client: c ? { ...c, company_name: cName, client_name: cName, name: cName } : null,
        operator: op ? { ...op, full_name: opName, name: opName } : null,
      };
    });

    return {
      machines,
      dbClients: [],
      operators: [],
      assignments: [],
      hourLogs,
      totalLogsCount: totalCount,
      currentPage: page,
      logsPageSize: pageSize,
      logsSummary: summary,
      activeMachineId,
      activeMachine,
    };
  }
);

