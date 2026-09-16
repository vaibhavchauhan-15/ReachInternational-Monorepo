import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import { OPERATIONS_CACHE_TTLS } from "@reachinternational/utils";

export interface OperationLogsParams {
  view?: "machine" | "client" | "operator" | string;
  machineId?: string | null;
  clientId?: string | null;
  operatorId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
  cursor?: string | null;
  limit?: number;
  site?: string | null;
  shift?: string | null;
  breakdownOnly?: boolean;
  page?: number;
}

export interface OperationLogRow {
  id: string;
  machine_id: string;
  client_id?: string | null;
  operator_id?: string | null;
  log_date: string;
  start_time?: string | null;
  end_time?: string | null;
  start_meter: number;
  end_meter: number;
  running_hours: number;
  normal_working_hours?: number | null;
  overtime_hours?: number | null;
  is_breakdown?: boolean | null;
  shift?: string | null;
  location?: string | null;
  remarks?: string | null;
  conflict_flag?: boolean | null;
  conflict_reason?: string | null;
  conflict_status?: "pending" | "acknowledged" | "adjusted" | null;
  created_at: string;
  machine_code?: string;
  machine_model?: string;
  machine_serial?: string;
  client_name?: string;
  operator_name?: string;
  operator_phone?: string;
  machine?: {
    id: string;
    machine_code?: string;
    model?: string;
    serial_number?: string;
  };
  client?: {
    id?: string;
    company_name?: string;
    client_name?: string;
  };
  operator?: {
    id?: string;
    full_name?: string;
    phone?: string;
  };
}

export interface OperationLogsResponse {
  rows: OperationLogRow[];
  nextCursor: string | null;
  total: number;
}

/**
 * Universal serialiser for read model query caching.
 */
function serializeReadModelParams(params: OperationLogsParams): string {
  const parts = [
    `v:${params.view || "machine"}`,
    `m:${params.machineId || "all"}`,
    `c:${params.clientId || "all"}`,
    `op:${params.operatorId || "all"}`,
    `sd:${params.startDate || "all"}`,
    `ed:${params.endDate || "all"}`,
    `q:${params.search ? params.search.trim().toLowerCase() : "all"}`,
    `cur:${params.cursor || "none"}`,
    `lim:${params.limit || 20}`,
    `site:${params.site ? params.site.trim().toLowerCase() : "all"}`,
    `sh:${params.shift || "all"}`,
    `bk:${params.breakdownOnly ? "1" : "0"}`,
    `p:${params.page || 1}`,
  ];
  return parts.join("|");
}

/**
 * High-performance, server-side Read Model RPC fetcher:
 * Calls PostgreSQL public.get_operation_logs(...)
 * 
 * Returns ONLY:
 * {
 *   "rows": [...],
 *   "nextCursor": "...",
 *   "total": 100
 * }
 * 
 * Eliminates redundant nested object bloat and enables sub-millisecond keyset cursor seeks.
 */
export const getOperationLogs = cache(
  async (params: OperationLogsParams = {}): Promise<OperationLogsResponse> => {
    const key = serializeReadModelParams(params);
    const entityId = params.machineId || params.clientId || params.operatorId || "all";

    const fetchCached = unstable_cache(
      async (): Promise<OperationLogsResponse> => {
        const supabase = createSupabaseAdminClient();

        const { data, error } = await supabase.rpc("get_operation_logs", {
          view: params.view || "machine",
          machine_id: params.machineId || null,
          client_id: params.clientId || null,
          operator_id: params.operatorId || null,
          start_date: params.startDate || null,
          end_date: params.endDate || null,
          search: params.search || null,
          cursor: params.cursor || null,
          limit: params.limit || 20,
          site: params.site || null,
          shift: params.shift || null,
          breakdown_only: params.breakdownOnly || false,
          page: params.page || null,
        });

        if (error) {
          console.error("Error executing get_operation_logs RPC:", error);
          throw new Error(`get_operation_logs failed: ${error.message}`);
        }

        const res = (data as OperationLogsResponse) || {
          rows: [],
          nextCursor: null,
          total: 0,
        };

        return {
          rows: res.rows || [],
          nextCursor: res.nextCursor || null,
          total: Number(res.total) || 0,
        };
      },
      [`operations-read-model-${key}`],
      {
        tags: [
          TAGS.operationsLogs,
          TAGS.operations,
          params.machineId ? TAGS.machineOperations(params.machineId) : "",
          params.clientId ? TAGS.clientOperations(params.clientId) : "",
          params.operatorId ? TAGS.operatorOperations(params.operatorId) : "",
        ].filter(Boolean),
        revalidate: OPERATIONS_CACHE_TTLS.machineLogs,
      }
    );

    return fetchCached();
  }
);
