import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  Machine,
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
  supervisor_ids,
  hour_meter,
  current_operator_id,
  operator_ids,
  client_id,
  health_status,
  status,
  created_at,
  updated_at,
  current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_time),
  current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_time),
  client:clients!machines_client_id_fkey(id, code, company_name, city, district, state, pincode, phone, contact_person, address, gstin, pan_number, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status)
`;

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

  const usersMap = new Map<string, any>();
  if (allUserIds.size > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name, phone, email, shift_time, role")
      .in("id", Array.from(allUserIds));

    (usersData || []).forEach((u: any) => {
      usersMap.set(u.id, u);
    });
  }

  return machines.map((m) => {
    const supIds = Array.isArray(m.supervisor_ids) && m.supervisor_ids.length > 0
      ? m.supervisor_ids
      : m.current_supervisor_id ? [m.current_supervisor_id] : [];
    const opIds = Array.isArray(m.operator_ids) && m.operator_ids.length > 0
      ? m.operator_ids
      : m.current_operator_id ? [m.current_operator_id] : [];

    const supervisorsList = supIds.map((id: string) => usersMap.get(id) || (m.current_supervisor?.id === id ? m.current_supervisor : null)).filter(Boolean);
    const operatorsList = opIds.map((id: string) => usersMap.get(id) || (m.current_operator?.id === id ? m.current_operator : null)).filter(Boolean);

    const cleanSupIds = Array.from(new Set(supervisorsList.map((s: any) => s.id)));
    const cleanOpIds = Array.from(new Set(operatorsList.map((o: any) => o.id)));

    return {
      ...m,
      supervisor_ids: cleanSupIds,
      operator_ids: cleanOpIds,
      supervisors: supervisorsList,
      operators: operatorsList,
      current_supervisor: supervisorsList[0] || m.current_supervisor || null,
      current_operator: operatorsList[0] || m.current_operator || null,
    };
  });
}

export const getMachines = cache(async (params: MachineListParams = {}) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = createSupabaseAdminClient();

  const {
    search,
    status,
    health_status,
    current_supervisor_id,
    page = 1,
    pageSize: rawPageSize = 25,
    sortField = "machine_id",
    sortOrder = "asc",
  } = params;

  const pageSize = Math.min(Math.max(1, rawPageSize), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("machines")
    .select(MACHINE_LIST_COLUMNS, { count: "exact" });

  // Role scoping
  if (user.role === "operator") {
    query = query.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
  } else if (user.role === "supervisor") {
    query = query.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
  }

  // Search across indexed machine columns
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

  // Sorting
  const allowedSorts = {
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

  const sortColumn = allowedSorts[sortField as keyof typeof allowedSorts] || "machine_id";
  query = query.order(sortColumn, { ascending: sortOrder === "asc" });

  let { data, count, error } = await query.range(from, to);

  // If primary query encounters error, execute fallback query
  if (error) {
    const FALLBACK_COLUMNS = `
      id,
      machine_id,
      model,
      serial_number,
      year_of_mfg,
      manufacturer,
      current_supervisor_id,
      hour_meter,
      current_operator_id,
      client_id,
      health_status,
      status,
      created_at,
      updated_at,
      current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email),
      current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email),
      client:clients!machines_client_id_fkey(id, code, company_name, city, district, state, pincode, phone, contact_person, address, gstin, pan_number, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status)
    `;

    let fallbackQuery = supabase
      .from("machines")
      .select(FALLBACK_COLUMNS, { count: "exact" });

    if (user.role === "operator") {
      fallbackQuery = fallbackQuery.eq("current_operator_id", user.id);
    } else if (user.role === "supervisor") {
      fallbackQuery = fallbackQuery.eq("current_supervisor_id", user.id);
    }

    if (search) {
      const s = search.replace(/[,()"\\]/g, "");
      fallbackQuery = fallbackQuery.or(
        `machine_id.ilike.%${s}%,model.ilike.%${s}%,serial_number.ilike.%${s}%,manufacturer.ilike.%${s}%`
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

    const fallbackSortColumn = allowedSorts[sortField as keyof typeof allowedSorts] || "machine_id";
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
});

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
        supervisor_ids,
        hour_meter,
        current_operator_id,
        operator_ids,
        client_id,
        health_status,
        status,
        created_at,
        updated_at,
        current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_time),
        current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_time),
        client:clients!machines_client_id_fkey(id, code, company_name, city, district, state, pincode, phone, contact_person, address, gstin, pan_number, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status)
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

    const hydratedList = await hydrateMachinesPersonnel([data], supabase);
    const machineData = hydratedList[0] || data;
    const code = machineData.machine_id || machineData.machine_code || machineData.id;
    return {
      ...machineData,
      machine_id: code,
      machine_code: code,
      machine_name: machineData.model ? `${code} (${machineData.model})` : code,
    } as unknown as Machine;
  },
  ["machine-detail-by-id-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);

export const getMachineById = cache(async (id: string): Promise<Machine | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCachedMachineById(id);
});

export const getActiveSupervisors = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    // Query users table strictly for users with role = 'supervisor' and active/non-inactive status
    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role, shift_time")
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
        shift_time: u.shift_time || null,
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
            shift_time: null,
            status: "active",
          } as User);
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  },
  ["active-supervisors-v6"],
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
      .select("id, full_name, phone, email, role, status, shift_time")
      .eq("role", "operator")
      .eq("status", "active")
      .order("full_name");

    const userMap = new Map<string, User>();

    (usersData || []).forEach((u: any) => {
      userMap.set(u.id, {
        id: u.id,
        full_name: u.full_name || u.email || "Operator",
        phone: u.phone,
        email: u.email,
        role: u.role,
        shift_time: u.shift_time || null,
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
            shift_time: null,
            status: "active",
          } as User);
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  },
  ["active-operators-v6"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineCities = unstable_cache(
  async (): Promise<string[]> => {
    return [];
  },
  ["machine-cities-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export async function getMachineHourMeterLogs(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("machine_hour_logs")
    .select(`
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
      operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
    `)
    .eq("machine_id", machineId)
    .order("log_date", { ascending: false })
    .limit(50);
  return data || [];
}

export async function getMachineActiveRental(machineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("rental_contracts")
    .select("id, contract_number, client_id, start_date, end_date, monthly_rate, status, client:clients(id, code, company_name, city, district, state, pincode, phone, contact_person, address, gstin, pan_number, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status)")
    .eq("machine_id", machineId)
    .eq("status", "active")
    .maybeSingle();
  return data || null;
}

export const getMachineOptions = unstable_cache(
  async (): Promise<{ id: string; label: string; model?: string }[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("machines")
      .select("id, machine_id, machine_code, model")
      .order("machine_id", { ascending: true });

    if (error || !data) return [];

    return data.map((m: any) => {
      const code = m.machine_id || m.machine_code || m.id;
      return {
        id: m.id,
        label: m.model ? `${code} (${m.model})` : code,
        model: m.model || undefined,
      };
    });
  },
  ["machine-options-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);