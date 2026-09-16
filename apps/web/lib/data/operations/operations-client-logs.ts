import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import {
  serializeClientLogsFilter,
  resolveOperationsDateRange,
  OPERATIONS_CACHE_TTLS,
} from "@reachinternational/utils";
import {
  getCachedOperationsClients,
  type OperationsClientFilterOption,
} from "./operations-filters";
import { resolveOperationsSearchClause } from "./operations-search";

export interface OperationsClientLogsParams {
  clientId?: string;
  machineId?: string;
  site?: string;
  locationId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
  fetchLogs?: boolean;
}

export interface OperationsClientLogsResult {
  machines: any[];
  dbClients: OperationsClientFilterOption[];
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
  activeClientId: string;
  activeClient: OperationsClientFilterOption | null;
  mostRecentClientId?: string;
}

/**
 * Exact column projections for client logs list view.
 * Eliminates redundant clients table join by directly attaching activeClient in memory.
 */
const CLIENT_LOG_EXACT_PROJECTION = `
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
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone)
`;

function formatClientCanonicalAddress(c?: any): string {
  if (!c) return "";
  const parts = [c.street, c.city, c.district, c.state, c.pincode].map((s) => (s || "").trim()).filter(Boolean);
  return parts.join(", ");
}

/**
 * High-performance, isolated data loader for Client View (tab=logs&view=client).
 * 
 * Features:
 * - Server pagination: 20 records per page by default.
 * - Server sorting: date, running hours, meter reading.
 * - Server filtering: active client, machine filter, site location, month/date range.
 * - Server search: GIN trigram indexes on location and remarks.
 * - Exact columns & Minimal joins: 0 client table join overhead in SQL.
 * - Query caching: Next.js unstable_cache (30s SWR).
 * - Request deduplication: React cache() wrapper.
 * - Strictly scoped: 0 unrelated fleet machines, 0 operators queried.
 */
export const getOperationsClientLogsData = cache(
  async (params: OperationsClientLogsParams = {}): Promise<OperationsClientLogsResult> => {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Number(params.pageSize) || 20);
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const sort = params.sort || "date-desc";

    const supabase = createSupabaseAdminClient();

    // 1. Fetch lightweight cached client list (60s SWR)
    const clients = await getCachedOperationsClients();

    // 2. Resolve active client
    let activeClientId = (params.clientId && params.clientId !== "all") ? params.clientId : "";
    let mostRecentClientId = "";

    if (!activeClientId) {
      // Find client with the most recent operational log
      const recentRes = await supabase
        .from("machine_hour_logs")
        .select("client_id")
        .not("client_id", "is", null)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRes.data?.client_id) {
        activeClientId = recentRes.data.client_id;
        mostRecentClientId = recentRes.data.client_id;
      } else {
        activeClientId = clients[0]?.id || "";
      }
    }

    const activeClient = clients.find((c) => c.id === activeClientId) || clients[0] || null;
    activeClientId = activeClient?.id || "";

    if (!activeClientId) {
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
        activeClientId: "",
        activeClient: null,
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

    const shouldFetchLogs = params.fetchLogs !== false;

    // 3. Serialized deterministic cache key for query caching
    const serializedKey = serializeClientLogsFilter({
      clientId: activeClientId,
      site: effectiveSite,
      clientMachineId: params.machineId,
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
        const clientMachinesPromise = supabase
          .from("machines")
          .select("id, machine_id, model, serial_number, status, manufacturer, client_id, hour_meter")
          .eq("client_id", activeClientId)
          .order("machine_id");

        const clientLocationsPromise = supabase
          .from("machine_hour_logs")
          .select("location")
          .eq("client_id", activeClientId)
          .not("location", "is", null)
          .not("location", "eq", "")
          .order("log_date", { ascending: false })
          .limit(50);

        const rpcPromise = supabase.rpc("get_operations_summary", {
          p_client_id: activeClientId,
          p_machine_id: params.machineId && params.machineId !== "all" ? params.machineId : null,
          p_operator_id: null,
          p_site: effectiveSite && effectiveSite !== "all" ? effectiveSite : null,
          p_start_date: startDate,
          p_end_date: endDateInclusive || endDate,
        });

        let clientMachinesRaw: any[] = [];
        let clientLocationsRaw: any[] = [];
        let rawLogs: any[] = [];
        let totalCount = 0;
        let summary = {
          totalRunHours: 0,
          totalOtHours: 0,
          totalBreakdowns: 0,
          loggedDaysCount: 0,
        };

        if (shouldFetchLogs) {
          let query = supabase
            .from("machine_hour_logs")
            .select(CLIENT_LOG_EXACT_PROJECTION, { count: "exact" })
            .eq("client_id", activeClientId);

          if (params.machineId && params.machineId !== "all") {
            query = query.eq("machine_id", params.machineId);
          }

          if (effectiveSite && effectiveSite !== "all") {
            // Leverages GIN trigram index on location
            query = query.ilike("location", `%${effectiveSite.replace(/[%_\\]/g, "").trim()}%`);
          }

          // Date range filters (half-open [2026-09-01, 2026-10-01) for month, exact range for custom)
          if (startDate) query = query.gte("log_date", startDate);
          if (endDate) {
            if (endOperator === "lt") {
              query = query.lt("log_date", endDate);
            } else {
              query = query.lte("log_date", endDate);
            }
          }

          // Server search across location, remarks, operator name, machine code/model/serial, and shift
          if (params.search) {
            const searchOrClause = await resolveOperationsSearchClause(params.search, "client");
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
                .order("running_hours", { ascending: false })
                .order("log_date", { ascending: false })
                .order("id", { ascending: false });
              break;
            case "hours-asc":
              query = query
                .order("running_hours", { ascending: true })
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

          const [clientMachinesRes, clientLocationsRes, summaryRes, logsRes] = await Promise.all([
            clientMachinesPromise,
            clientLocationsPromise,
            rpcPromise,
            query,
          ]);

          clientMachinesRaw = clientMachinesRes.data || [];
          clientLocationsRaw = clientLocationsRes.data || [];
          rawLogs = logsRes.data || [];
          totalCount = logsRes.count ?? (logsRes.data?.length || 0);

          if (summaryRes.data && !summaryRes.error) {
            const s = summaryRes.data;
            summary = {
              totalRunHours: Number(s.total_run_hours) || 0,
              totalOtHours: Number(s.total_ot_hours) || 0,
              totalBreakdowns: Number(s.total_breakdowns) || 0,
              loggedDaysCount: Number(s.logged_days_count) || 0,
            };
          }
        } else {
          // Summary-only mode: ZERO machine_hour_logs table scans, ZERO user joins
          const [clientMachinesRes, clientLocationsRes, summaryRes] = await Promise.all([
            clientMachinesPromise,
            clientLocationsPromise,
            rpcPromise,
          ]);

          clientMachinesRaw = clientMachinesRes.data || [];
          clientLocationsRaw = clientLocationsRes.data || [];
          rawLogs = [];

          if (summaryRes.data && !summaryRes.error) {
            const s = summaryRes.data;
            summary = {
              totalRunHours: Number(s.total_run_hours) || 0,
              totalOtHours: Number(s.total_ot_hours) || 0,
              totalBreakdowns: Number(s.total_breakdowns) || 0,
              loggedDaysCount: Number(s.logged_days_count) || 0,
            };
            totalCount = Number(s.total_logs) || 0;
          }
        }

        return {
          clientMachinesRaw,
          clientLocationsRaw,
          rawLogs,
          totalCount,
          summary,
        };
      },
      [`operations-client-logs-p6-${serializedKey}:fetch_${shouldFetchLogs ? "1" : "0"}`],
      {
        tags: [
          TAGS.operationsLogs,
          TAGS.operations,
          TAGS.clientOperations(activeClientId),
        ],
        revalidate: OPERATIONS_CACHE_TTLS.clientLogs,
      }
    );

    const { clientMachinesRaw, clientLocationsRaw, rawLogs, totalCount, summary } = await fetchCachedData();

    // Format client machines
    const clientMachines = clientMachinesRaw.map((m: any) => ({
      ...m,
      machine_code: m.machine_id,
      machine_name: m.model ? `${m.machine_id} (${m.model})` : m.machine_id,
    }));

    // Aggregate distinct sites for active client
    const sitesSet = new Set<string>();
    const canonicalAddr = formatClientCanonicalAddress(activeClient);
    if (canonicalAddr) sitesSet.add(canonicalAddr);

    clientLocationsRaw.forEach((row: any) => {
      if (row.location && row.location.trim()) {
        sitesSet.add(row.location.trim());
      }
    });

    const clientSites = Array.from(sitesSet);

    // Enrich active client object with machine count and sites
    const enrichedClients = clients.map((c) => {
      if (c.id === activeClientId) {
        return {
          ...c,
          machine_count: clientMachines.length,
          sites: clientSites,
        };
      }
      return c;
    });

    // Zero redundant SQL join: attach activeClient directly in memory
    const cName = activeClient?.company_name || activeClient?.client_name || "Client";
    const hydratedClient = {
      ...activeClient,
      company_name: cName,
      client_name: cName,
      name: cName,
    };

    const hourLogs = rawLogs.map((log: any) => {
      const m = log.machine;
      const code = m?.machine_id || log.machine_id;
      const mName = m?.model ? `${code} (${m.model})` : code;
      const op = log.operator;
      const opName = op?.full_name || "Operator";

      return {
        ...log,
        machine: m ? { ...m, machine_code: code, machine_name: mName } : null,
        client: hydratedClient,
        operator: op ? { ...op, full_name: opName, name: opName } : null,
      };
    });

    return {
      machines: clientMachines,
      dbClients: enrichedClients,
      operators: [],
      assignments: [],
      hourLogs,
      totalLogsCount: totalCount,
      currentPage: page,
      logsPageSize: pageSize,
      logsSummary: summary,
      activeClientId,
      activeClient: enrichedClients.find((c) => c.id === activeClientId) || activeClient,
      mostRecentClientId,
    };
  }
);
