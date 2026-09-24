import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { Machine } from "@/lib/types/database";

export interface MachineExportParams {
  search?: string;
  status?: string;
  health_status?: string;
  current_supervisor_id?: string;
  supervisor_id?: string;
  client_id?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  sort?: string;
  ids?: string[];
}

const MACHINE_EXPORT_COLUMNS = `
  id,
  machine_id,
  model,
  serial_number,
  year_of_mfg,
  manufacturer,
  current_supervisor_id,
  supervisor_ids,
  hour_meter,
  current_operator_id,
  operator_ids,
  client_id,
  health_status,
  status,
  created_at,
  updated_at,
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_start_time, shift_end_time),
  client:clients!machines_client_id_fkey(id, code, company_name, city, state)
`;

const ALLOWED_SORTS = {
  machine_id: "machine_id",
  model: "model",
  serial_number: "serial_number",
  year_of_mfg: "year_of_mfg",
  manufacturer: "manufacturer",
  hour_meter: "hour_meter",
  created_at: "created_at",
} as const;

async function hydrateExportPersonnel(machines: any[], supabase: any): Promise<any[]> {
  if (!machines || machines.length === 0) return [];

  const allUserIds = new Set<string>();
  machines.forEach((m) => {
    if (Array.isArray(m.supervisor_ids)) {
      m.supervisor_ids.forEach((id: string) => id && allUserIds.add(id));
    }
    if (m.current_supervisor_id) allUserIds.add(m.current_supervisor_id);
    if (Array.isArray(m.operator_ids)) {
      m.operator_ids.forEach((id: string) => id && allUserIds.add(id));
    }
    if (m.current_operator_id) allUserIds.add(m.current_operator_id);
  });

  const usersRes =
    allUserIds.size > 0
      ? await supabase
          .from("users")
          .select("id, full_name, phone, email, shift_start_time, shift_end_time, role")
          .in("id", Array.from(allUserIds))
      : { data: [] };

  const usersMap = new Map<string, any>();
  (usersRes.data || []).forEach((u: any) => {
    usersMap.set(u.id, u);
  });

  return machines.map((m) => {
    const supIds =
      Array.isArray(m.supervisor_ids)
        ? m.supervisor_ids
        : m.current_supervisor_id
        ? [m.current_supervisor_id]
        : [];
    const opIds =
      Array.isArray(m.operator_ids)
        ? m.operator_ids
        : m.current_operator_id
        ? [m.current_operator_id]
        : [];

    const supervisorsList = supIds
      .map((id: string) => usersMap.get(id) || (m.current_supervisor?.id === id ? m.current_supervisor : null))
      .filter(Boolean);
    const operatorsList = opIds
      .map((id: string) => usersMap.get(id) || (m.current_operator?.id === id ? m.current_operator : null))
      .filter(Boolean);

    const code = m.machine_id || m.id;

    return {
      ...m,
      machine_id: code,
      machine_code: code,
      machine_name: m.model ? `${code} (${m.model})` : code,
      supervisors: supervisorsList,
      operators: operatorsList,
      current_supervisor: supervisorsList[0] || null,
      current_operator: operatorsList[0] || null,
    };
  });
}

/**
 * Top-level cached machine export query.
 * Evaluated on-demand only when a user initiates an Excel, CSV, or PDF export.
 */
const getCachedMachineExportData = unstable_cache(
  async (
    role: string,
    scopedUserId: string,
    search: string,
    status: string,
    health_status: string,
    current_supervisor_id: string,
    client_id: string,
    sortField: string,
    sortOrder: "asc" | "desc",
    serializedIds: string
  ): Promise<Machine[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("machines").select(MACHINE_EXPORT_COLUMNS);

    // Selected machines filter
    if (serializedIds && serializedIds !== "all") {
      const ids = serializedIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        query = query.in("id", ids);
      }
    }

    // Role boundaries
    if (role === "operator" && scopedUserId !== "all") {
      query = query.or(`current_operator_id.eq.${scopedUserId},operator_ids.cs.{${scopedUserId}}`);
    } else if (role === "supervisor" && scopedUserId !== "all") {
      query = query.or(`current_supervisor_id.eq.${scopedUserId},supervisor_ids.cs.{${scopedUserId}}`);
    }

    // Search
    if (search) {
      const s = search.replace(/[,()"\\]/g, "");
      query = query.or(
        `machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,manufacturer.ilike.%${s}%`
      );
    }

    // Filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (health_status && health_status !== "all") {
      query = query.eq("health_status", health_status);
    }
    if (current_supervisor_id && current_supervisor_id !== "all") {
      query = query.or(`current_supervisor_id.eq.${current_supervisor_id},supervisor_ids.cs.{${current_supervisor_id}}`);
    }
    if (client_id && client_id !== "all") {
      query = query.eq("client_id", client_id);
    }

    // Sort
    const sortColumn = ALLOWED_SORTS[sortField as keyof typeof ALLOWED_SORTS] || "machine_id";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" }).limit(1000);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching machine export data:", error.message || error);
      return [];
    }

    const hydrated = await hydrateExportPersonnel(data || [], supabase);
    return hydrated as unknown as Machine[];
  },
  ["machines-export-dataset-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60s SWR
    tags: [TAGS.machinesList, TAGS.machines],
  }
);

/**
 * Fetch on-demand machine export dataset.
 * Deduplicates in-flight calls via React cache() and caches cross-request with 60s SWR.
 */
export const getMachineExportData = cache(async (params: MachineExportParams = {}): Promise<Machine[]> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const {
    search = "",
    status = "all",
    health_status = "all",
    current_supervisor_id = params.supervisor_id || "all",
    client_id = "all",
    ids = [],
  } = params;

  let sortField = params.sortField || "machine_id";
  let sortOrder: "asc" | "desc" = params.sortOrder || "asc";
  if (params.sort) {
    if (params.sort.endsWith("_desc")) {
      sortField = params.sort.slice(0, -5);
      sortOrder = "desc";
    } else if (params.sort.endsWith("_asc")) {
      sortField = params.sort.slice(0, -4);
      sortOrder = "asc";
    } else {
      sortField = params.sort;
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const scopedUserId = (user.role === "operator" || user.role === "supervisor") ? user.id : "all";
  const serializedIds = ids.length > 0 ? ids.sort().join(",") : "all";

  return getCachedMachineExportData(
    user.role,
    scopedUserId,
    normalizedSearch,
    status,
    health_status,
    current_supervisor_id,
    client_id,
    sortField,
    sortOrder,
    serializedIds
  );
});
