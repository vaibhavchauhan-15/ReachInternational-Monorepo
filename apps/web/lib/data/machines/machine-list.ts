import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { Machine } from "@/lib/types/database";

export interface MachineListParams {
  search?: string;
  status?: string;
  health_status?: string;
  current_supervisor_id?: string;
  client_id?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export interface MachineListResponse {
  machines: Machine[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Slim projection for list view: only 3 client columns instead of 19
const MACHINE_LIST_COLUMNS = `
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
  client:clients!machines_client_id_fkey(id, code, company_name)
`;

// Allowed sort columns
const ALLOWED_SORTS = {
  machine_id: "machine_id",
  model: "model",
  serial_number: "serial_number",
  year_of_mfg: "year_of_mfg",
  manufacturer: "manufacturer",
  current_supervisor_id: "current_supervisor_id",
  hour_meter: "hour_meter",
  current_operator_id: "current_operator_id",
  health_status: "health_status",
  status: "status",
  created_at: "created_at",
  updated_at: "updated_at",
} as const;

/**
 * Hydrates supervisor and operator personnel arrays in parallel.
 * Eliminates the sequential 3-step waterfall by issuing concurrent queries
 * to `users` and `operator_machine_assignments`.
 */
async function hydrateMachinesPersonnel(machines: any[], supabase: any): Promise<any[]> {
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

    const cleanSupIds = Array.from(new Set(supervisorsList.map((s: any) => s.id)));
    const cleanOpIds = Array.from(new Set(operatorsList.map((o: any) => o.id)));

    return {
      ...m,
      supervisor_ids: cleanSupIds,
      operator_ids: cleanOpIds,
      supervisors: supervisorsList,
      operators: operatorsList,
      current_supervisor: supervisorsList[0] || null,
      current_operator: operatorsList[0] || null,
    };
  });
}

/**
 * Top-level cached machine list fetcher using stateless admin client.
 * Arguments are automatically serialized into the cache key by unstable_cache:
 * Key format: machines:list:{role}:{scopedUserId}:{search}:{status}:{health}:{supervisor}:{client}:{page}:{pageSize}:{sortField}:{sortOrder}
 */
const getCachedMachineList = unstable_cache(
  async (
    role: string,
    scopedUserId: string,
    search: string,
    status: string,
    health_status: string,
    current_supervisor_id: string,
    client_id: string,
    page: number,
    pageSize: number,
    sortField: string,
    sortOrder: "asc" | "desc"
  ): Promise<MachineListResponse> => {
    const supabase = createSupabaseAdminClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("machines")
      .select(MACHINE_LIST_COLUMNS, { count: "exact" });

    // Role scoping boundaries
    if (role === "operator" && scopedUserId !== "all") {
      const { data: omaList } = await supabase
        .from("operator_machine_assignments")
        .select("machine_id")
        .eq("operator_id", scopedUserId)
        .eq("is_active", true);

      const assignedMachineIds = (omaList || [])
        .map((r: any) => r.machine_id)
        .filter(Boolean);

      if (assignedMachineIds.length > 0) {
        query = query.or(
          `current_operator_id.eq.${scopedUserId},operator_ids.cs.{${scopedUserId}},id.in.(${assignedMachineIds.join(",")})`
        );
      } else {
        query = query.or(
          `current_operator_id.eq.${scopedUserId},operator_ids.cs.{${scopedUserId}}`
        );
      }
    } else if (role === "supervisor" && scopedUserId !== "all") {
      query = query.or(`current_supervisor_id.eq.${scopedUserId},supervisor_ids.cs.{${scopedUserId}}`);
    }

    // Full-fleet search across trigram-indexed columns (machine_id, model, serial_number only)
    if (search) {
      const s = search.replace(/[,()"\\]/g, "").trim();
      if (s) {
        query = query.or(
          `machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`
        );
      }
    }

    // Server-side filters
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

    // Server-side sorting
    const sortColumn = ALLOWED_SORTS[sortField as keyof typeof ALLOWED_SORTS] || "machine_id";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error("Error fetching machine list:", error.message || error.details || error);
      return {
        machines: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const hydrated = await hydrateMachinesPersonnel(data ?? [], supabase);
    const formattedMachines = hydrated.map((m: any) => {
      const code = m.machine_id || m.id;
      return {
        ...m,
        machine_id: code,
        machine_code: code,
        machine_name: m.model ? `${code} (${m.model})` : code,
      };
    });

    return {
      machines: formattedMachines as unknown as Machine[],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },
  ["machines-list-query-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60 seconds SWR
    tags: [TAGS.machinesList, TAGS.machines],
  }
);

/**
 * Fetch paginated list of machines for the Machine Directory.
 * Applies server-side filters, server-side sorting, role boundaries, and pagination.
 * Deduplicates in-flight calls via React cache() and serves cross-request cached results via unstable_cache().
 */
export const getMachineList = cache(async (params: MachineListParams = {}): Promise<MachineListResponse> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const {
    search = "",
    status = "all",
    health_status = "all",
    current_supervisor_id = "all",
    client_id = "all",
    page = 1,
    pageSize: rawPageSize = 25,
    sortField = "machine_id",
    sortOrder = "asc",
  } = params;

  const pageSize = Math.min(Math.max(1, rawPageSize), 100);
  const normalizedSearch = search.trim().toLowerCase();
  const scopedUserId = (user.role === "operator" || user.role === "supervisor") ? user.id : "all";

  return getCachedMachineList(
    user.role,
    scopedUserId,
    normalizedSearch,
    status,
    health_status,
    current_supervisor_id,
    client_id,
    page,
    pageSize,
    sortField,
    sortOrder
  );
});
