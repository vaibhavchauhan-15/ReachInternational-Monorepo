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
    const s = search.replace(/[,()"\\]/g, "");
    query = query.or(
      `machine_code.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`
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
  const allowedSorts = {
    machine_id: "machine_id",
    machine_code: "machine_code",
    model: "model",
    serial_number: "serial_number",
    year_of_mfg: "year_of_mfg",
    manufacturer: "manufacturer",
    current_supervisor_id: "current_supervisor_id",
    hour_meter: "hour_meter",
    service_count: "service_count",
    current_operator_id: "current_operator_id",
    health_status: "health_status",
    status: "status",
    created_at: "created_at",
    updated_at: "updated_at",
  } as const;

  const sortColumn = allowedSorts[sortField as keyof typeof allowedSorts] || "machine_id";
  query = query.order(sortColumn, { ascending: sortOrder === "asc" });

  let { data, count, error } = await query.range(from, to);

  // If primary query fails (e.g. "column machines.machine_id does not exist" on unmigrated DB), execute fallback query with machine_code
  if (error) {
    const FALLBACK_COLUMNS = `
      id,
      machine_code,
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

    let fallbackQuery = supabase
      .from("machines")
      .select(FALLBACK_COLUMNS, { count: "estimated" });

    if (user.role === "operator") {
      fallbackQuery = fallbackQuery.eq("current_operator_id", user.id);
    } else if (user.role === "supervisor") {
      fallbackQuery = fallbackQuery.eq("current_supervisor_id", user.id);
    }

    if (search) {
      const s = search.replace(/[,()"\\]/g, "");
      fallbackQuery = fallbackQuery.or(
        `machine_code.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%`
      );
    }

    if (status && status !== "all") {
      fallbackQuery = fallbackQuery.eq("status", status);
    }
    if (health_status && health_status !== "all") {
      fallbackQuery = fallbackQuery.eq("health_status", health_status);
    }
    if (current_supervisor_id && current_supervisor_id !== "all") {
      fallbackQuery = fallbackQuery.eq("current_supervisor_id", current_supervisor_id);
    }

    const fallbackSortField = sortField === "machine_id" ? "machine_code" : sortField;
    const fallbackSortColumn = allowedSorts[fallbackSortField as keyof typeof allowedSorts] || "machine_code";
    fallbackQuery = fallbackQuery.order(fallbackSortColumn, { ascending: sortOrder === "asc" });

    const fallbackRes = await fallbackQuery.range(from, to);
    if (!fallbackRes.error) {
      data = fallbackRes.data as any;
      count = fallbackRes.count;
      error = null;
    } else {
      console.error("Error fetching machines:", error.message || error.details || error);
    }
  }

  if (error) {
    return {
      machines: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Backwards & forwards compatibility mapping for machine_id / machine_code / machine_name
  const formattedMachines = (data ?? []).map((m: any) => {
    const code = m.machine_id || m.machine_code || m.id;
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
}

// Cached Machine Details by ID using admin client & dynamic tag
const getCachedMachineById = unstable_cache(
  async (id: string): Promise<Machine | null> => {
    const supabase = createSupabaseAdminClient();
    let { data, error } = await supabase
      .from("machines")
      .select(MACHINE_LIST_COLUMNS)
      .eq("id", id)
      .single();

    if (error) {
      const FALLBACK_COLUMNS = `
        id,
        machine_code,
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

      const fallbackRes = await supabase
        .from("machines")
        .select(FALLBACK_COLUMNS)
        .eq("id", id)
        .single();

      if (!fallbackRes.error) {
        data = fallbackRes.data as any;
        error = null;
      }
    }

    if (error || !data) {
      console.error("Error fetching machine by id:", error?.message || error?.details || error);
      return null;
    }

    const machineData = data as any;
    const code = machineData.machine_id || machineData.machine_code || machineData.id;
    return {
      ...machineData,
      machine_id: code,
      machine_code: code,
      machine_name: machineData.model ? `${code} (${machineData.model})` : code,
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

    // Query users table strictly for users with role = 'supervisor' and active/non-inactive status
    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role")
      .eq("role", "supervisor")
      .neq("status", "inactive")
      .order("full_name");

    const userMap = new Map<string, User>();

    (usersData || []).forEach((u: any) => {
      userMap.set(u.id, {
        id: u.id,
        full_name: u.full_name || u.email || "Supervisor",
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: "active",
      } as User);
    });

    // Also query employees table strictly for employees with supervisor designation
    const { data: empData } = await supabase
      .from("employees")
      .select("id, full_name, phone, email, designation, user_id")
      .neq("status", "inactive")
      .order("full_name");

    (empData || []).forEach((e: any) => {
      const isSupervisorEmp =
        e.designation && e.designation.toLowerCase().includes("supervisor");

      if (isSupervisorEmp) {
        const key = e.user_id || e.id;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: key,
            full_name: e.full_name || e.email || "Supervisor",
            phone: e.phone,
            email: e.email,
            role: "supervisor",
            status: "active",
          } as User);
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  },
  ["active-supervisors-v5"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getActiveEngineers = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .in("role", ["engineer", "service_engineer"])
      .neq("status", "inactive")
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

    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role")
      .eq("role", "operator")
      .neq("status", "inactive")
      .order("full_name");

    const userMap = new Map<string, User>();

    (usersData || []).forEach((u: any) => {
      userMap.set(u.id, {
        id: u.id,
        full_name: u.full_name || u.email || "Operator",
        phone: u.phone,
        email: u.email,
        role: u.role,
        status: "active",
      } as User);
    });

    const { data: empData } = await supabase
      .from("employees")
      .select("id, full_name, phone, email, designation, user_id")
      .neq("status", "inactive")
      .order("full_name");

    (empData || []).forEach((e: any) => {
      const isOperatorEmp =
        e.designation &&
        (e.designation.toLowerCase().includes("operator") ||
          e.designation.toLowerCase().includes("driver"));

      if (isOperatorEmp) {
        const key = e.user_id || e.id;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: key,
            full_name: e.full_name || e.email || "Operator",
            phone: e.phone,
            email: e.email,
            role: "operator",
            status: "active",
          } as User);
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  },
  ["active-operators-v5"],
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