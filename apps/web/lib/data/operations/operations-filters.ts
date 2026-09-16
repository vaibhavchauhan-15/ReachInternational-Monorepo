import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import { OPERATIONS_CACHE_TAGS, OPERATIONS_CACHE_TTLS } from "./keys";


export interface OperationsMachineFilterOption {
  id: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  status: string | null;
  client_id?: string | null;
  hour_meter?: number | null;
}

export interface OperationsClientFilterOption {
  id: string;
  code?: string | null;
  company_name: string;
  client_name?: string;
  name?: string;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  sites?: string[];
  machine_count?: number;
}

export interface OperationsOperatorFilterOption {
  id: string;
  full_name: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  role?: string;
  status?: string;
  shift_time?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
}

/**
 * Cached lightweight machines list for operations filter dropdowns.
 * SWR cached for 60s, invalidated via TAGS.operationsFilters or TAGS.machines.
 */
export const getCachedOperationsMachines = cache(async (): Promise<OperationsMachineFilterOption[]> => {
  const fetcher = unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machines")
        .select("id, machine_id, model, serial_number, manufacturer, status, client_id, hour_meter")
        .order("machine_id");

      if (error || !data) {
        console.error("[operations-filters] Failed to fetch machines filter options:", error);
        return [];
      }

      return data.map((m: any) => ({
        ...m,
        machine_code: m.machine_id,
        machine_name: m.model ? `${m.machine_id} (${m.model})` : m.machine_id,
      }));
    },
    ["operations-filter-machines-v1"],
    {
      revalidate: OPERATIONS_CACHE_TTLS.filterMachines,
      tags: [OPERATIONS_CACHE_TAGS.filters, TAGS.machinesList],
    }
  );

  return fetcher();
});

/**
 * Cached lightweight CRM clients list for operations filter dropdowns.
 * SWR cached for 60s, invalidated via TAGS.operationsFilters or TAGS.clients.
 */
export const getCachedOperationsClients = cache(async (): Promise<OperationsClientFilterOption[]> => {
  const fetcher = unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("clients")
        .select("id, code, company_name, phone, street, city, district, state, pincode, status")
        .eq("status", "active")
        .order("company_name");

      if (error || !data) {
        console.error("[operations-filters] Failed to fetch clients filter options:", error);
        return [];
      }

      return data.map((c: any) => {
        const name = c.company_name || c.code || "Client";
        return {
          ...c,
          client_name: name,
          name,
        };
      });
    },
    ["operations-filter-clients-v1"],
    {
      revalidate: OPERATIONS_CACHE_TTLS.filterClients,
      tags: [OPERATIONS_CACHE_TAGS.filters, TAGS.clients],
    }
  );

  return fetcher();
});

/**
 * Cached lightweight operators list for operations filter dropdowns.
 * SWR cached for 600s (10m), invalidated via TAGS.operationsFilters or TAGS.users.
 */
export const getCachedOperationsOperators = cache(async (): Promise<OperationsOperatorFilterOption[]> => {
  const fetcher = unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, phone, email, role, status, shift_time, shift_start_time, shift_end_time")
        .eq("role", "operator")
        .eq("status", "active")
        .order("full_name");

      if (error || !data) {
        console.error("[operations-filters] Failed to fetch operators filter options:", error);
        return [];
      }

      return data.map((u: any) => ({
        ...u,
        name: u.full_name,
      }));
    },
    ["operations-filter-operators-v1"],
    {
      revalidate: OPERATIONS_CACHE_TTLS.filterOperators,
      tags: [OPERATIONS_CACHE_TAGS.filters, TAGS.users],
    }
  );

  return fetcher();
});

export {
  type NormalizedOperationsFilter,
  type RawOperationsFilterInput,
  normalizeOperationsFilter,
  serializeNormalizedOperationsFilter,
} from "@reachinternational/utils";
