import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  Machine,
  ServiceRecordWithDetails,
  User,
} from "@/lib/types/database";

export interface MachineListParams {
  search?: string;
  status?: string;
  health_status?: string;
  current_supervisor_id?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

// Columns projection for refactored machines schema
const MACHINE_LIST_COLUMNS = `
  id,
  machine_id,
  model,
  serial_number,
  year_of_mfg,
  manufacturer,
  current_supervisor_id,
  hour_meter,
  service_count,
  current_operator_id,
  health_status,
  status,
  created_at,
  updated_at,
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email)
`;

export async function getMachines(params: MachineListParams = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = createSupabaseAdminClient();

  const {
    search,
    status,
    health_status,
    current_supervisor_id,
    page = 1,
    pageSize = 25,
    sortField = "machine_id",
    sortOrder = "asc",
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("machines")
    .select(MACHINE_LIST_COLUMNS, { count: "estimated" });

  // Role scoping
  if (user.role === "operator") {
    query = query.eq("current_operator_id", user.id);
  } else if (user.role === "supervisor") {
    query = query.eq("current_supervisor_id", user.id);
  }

  // Search
  if (search) {
    query = query.or(
      `machine_id.ilike.%${search}%,model.ilike.%${search}%,serial_number.ilike.%${search}%`
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
    query = query.eq("current_supervisor_id", current_supervisor_id);
  }

  // Sorting
  if (sortField) {
    query = query.order(sortField, { ascending: sortOrder === "asc" });
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("Error fetching machines:", error.message || error.details || error);
    return {
      machines: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Backwards compatibility mapping for fields machine_code / machine_name
  const formattedMachines = (data ?? []).map((m: any) => ({
    ...m,
    machine_code: m.machine_id,
    machine_name: m.model ? `${m.machine_id} (${m.model})` : m.machine_id,
  }));

  return {
    machines: formattedMachines as unknown as Machine[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

// Cached Machine Details by ID using admin client & dynamic tag
const getCachedMachineById = unstable_cache(
  async (id: string): Promise<Machine | null> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("machines")
      .select(MACHINE_LIST_COLUMNS)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching machine by id:", error.message || error.details || error);
      return null;
    }

    const machineData = data as any;
    return {
      ...machineData,
      machine_code: machineData.machine_id,
      machine_name: machineData.model ? `${machineData.machine_id} (${machineData.model})` : machineData.machine_id,
    } as unknown as Machine;
  },
  ["machine-detail-by-id-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);

export const getMachineById = cache(async (id: string): Promise<Machine | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCachedMachineById(id);
});

// Cached Machine Service History by Machine ID
const getCachedMachineServiceHistory = unstable_cache(
  async (machineId: string): Promise<ServiceRecordWithDetails[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("service_records")
      .select(
        `
        id,
        machine_id,
        engineer_id,
        service_date,
        notes,
        next_service_due_date,
        engineer:users!service_records_engineer_id_fkey(id, full_name)
      `
      )
      .eq("machine_id", machineId)
      .order("service_date", { ascending: false })
      .limit(50);

    if (error) return [];
    return (data as unknown as ServiceRecordWithDetails[]) ?? [];
  },
  ["machine-service-history-v3"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.services] }
);

export const getMachineServiceHistory = cache(
  async (machineId: string): Promise<ServiceRecordWithDetails[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return getCachedMachineServiceHistory(machineId);
  }
);

export const getActiveSupervisors = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .in("role", ["supervisor", "admin", "super_admin", "service_manager", "branch_manager"])
      .eq("status", "active")
      .order("full_name");

    if (error) return [];
    return (data as User[]) ?? [];
  },
  ["active-supervisors-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getActiveEngineers = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .in("role", ["engineer", "service_engineer"])
      .eq("status", "active")
      .order("full_name");
    if (error) return [];
    return (data as User[]) ?? [];
  },
  ["active-engineers-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getActiveOperators = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .eq("role", "operator")
      .eq("status", "active")
      .order("full_name");
    if (error) return [];
    return (data as User[]) ?? [];
  },
  ["active-operators-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineCities = unstable_cache(
  async (): Promise<string[]> => {
    return [];
  },
  ["machine-cities-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export async function getMachineBreakdownHistory(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("machine_complaints")
    .select("*, engineer:users!machine_complaints_engineer_id_fkey(id, full_name)")
    .eq("machine_id", machineId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function getMachineHourMeterLogs(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("machine_hour_logs")
    .select("*, operator:users!operator_id(id, full_name)")
    .eq("machine_id", machineId)
    .order("log_date", { ascending: false })
    .limit(50);
  return data || [];
}

export async function getMachinePartsUsedHistory(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("inventory_transactions")
    .select("*")
    .eq("machine_id", machineId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function getMachineActiveRental(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("rental_contracts")
    .select("*")
    .eq("machine_id", machineId)
    .eq("status", "active")
    .maybeSingle();
  return data || null;
}