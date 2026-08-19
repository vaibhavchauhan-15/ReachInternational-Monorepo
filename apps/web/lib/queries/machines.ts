import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type {
  MachineWithEngineer,
  ServiceRecordWithDetails,
  User,
} from "@/lib/types/database";

export interface MachineListParams {
  search?: string;
  status?: string;
  city?: string;
  engineer_id?: string;
  bucket?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

// Minimal projection — columns the UI + edit modal render.
const MACHINE_LIST_COLUMNS = `
  id,
  machine_code,
  machine_name,
  model,
  serial_number,
  manufacturer,
  year_of_mfg,
  category_id,
  category_name,
  hour_meter,
  service_count,
  engine_serial_no,
  engine_mot_no,
  insurance_policy_no,
  insurance_expiry_date,
  third_party_certificate,
  third_party_expiry_date,
  rto_tax,
  rto_tax_expiry_date,
  customer_name,
  customer_mobile,
  customer_email,
  customer_address,
  city,
  state,
  engineer_id,
  last_service_date,
  next_service_due_date,
  service_interval_days,
  status,
  notes,
  engineer:users!machines_engineer_id_fkey(id, full_name, phone)
`;

export async function getMachines(params: MachineListParams = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = createSupabaseAdminClient();

  const {
    search,
    status,
    city,
    engineer_id,
    bucket,
    page = 1,
    pageSize = 25,
    sortField = "next_service_due_date",
    sortOrder = "asc",
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  let query = supabase
    .from("machines")
    .select(MACHINE_LIST_COLUMNS, { count: "estimated" });

  // Role scoping
  if (user.role === "engineer" || user.role === "service_engineer" || user.role === "mechanic") {
    query = query.eq("engineer_id", user.id);
  } else if (user.role === "operator") {
    query = query.eq("current_operator_id", user.id);
  } else if (
    (user.role === "branch_manager" ||
      user.role === "supervisor" ||
      user.role === "service_manager" ||
      user.role === "store_manager" ||
      user.role === "rental_manager" ||
      user.role === "sales_executive") &&
    user.branch_id
  ) {
    query = query.eq("branch_id", user.branch_id);
  }

  // Search
  if (search) {
    query = query.or(
      `machine_code.ilike.%${search}%,machine_name.ilike.%${search}%,customer_name.ilike.%${search}%,serial_number.ilike.%${search}%,category_name.ilike.%${search}%`
    );
  }

  // Filters
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (city && city !== "all") {
    query = query.eq("city", city);
  }
  if (engineer_id && engineer_id !== "all") {
    query = query.eq("engineer_id", engineer_id);
  }

  // Due buckets
  if (bucket === "today") {
    query = query.eq("next_service_due_date", today).eq("status", "active");
  } else if (bucket === "tomorrow") {
    query = query.eq("next_service_due_date", tomorrow).eq("status", "active");
  } else if (bucket === "overdue") {
    query = query.lt("next_service_due_date", today).eq("status", "active");
  }

  // Sorting
  if (sortField) {
    query = query.order(sortField, { ascending: sortOrder === "asc" });
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("Error fetching machines:", error);
    throw new Error("Failed to fetch machines");
  }

  return {
    machines: (data as unknown as MachineWithEngineer[]) ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

// Cached Machine Details by ID using admin client & dynamic tag
const getCachedMachineById = unstable_cache(
  async (id: string, role: string, userId: string): Promise<MachineWithEngineer | null> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("machines")
      .select(
        `
        id,
        machine_code,
        machine_name,
        model,
        serial_number,
        manufacturer,
        year_of_mfg,
        category_id,
        category_name,
        hour_meter,
        service_count,
        engine_serial_no,
        engine_mot_no,
        insurance_policy_no,
        insurance_expiry_date,
        third_party_certificate,
        third_party_expiry_date,
        rto_tax,
        rto_tax_expiry_date,
        customer_name,
        customer_mobile,
        customer_email,
        customer_address,
        city,
        state,
        engineer_id,
        last_service_date,
        next_service_due_date,
        service_interval_days,
        status,
        notes,
        engineer:users!machines_engineer_id_fkey(id, full_name, phone, email)
      `
      )
      .eq("id", id);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      query = query.eq("engineer_id", userId);
    } else if (role === "operator") {
      query = query.eq("current_operator_id", userId);
    }

    const { data, error } = await query.single();
    if (error) return null;
    return data as unknown as MachineWithEngineer;
  },
  ["machine-detail-by-id-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);

export const getMachineById = cache(async (id: string): Promise<MachineWithEngineer | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCachedMachineById(id, user.role, user.id);
});

// Cached Machine Service History by Machine ID
const getCachedMachineServiceHistory = unstable_cache(
  async (machineId: string, role: string, userId: string): Promise<ServiceRecordWithDetails[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("service_records")
      .select(
        `
        id,
        machine_id,
        engineer_id,
        service_date,
        notes,
        next_service_due_date,
        machine:machines!service_records_machine_id_fkey(id, machine_code, machine_name, customer_name),
        engineer:users!service_records_engineer_id_fkey(id, full_name)
      `
      )
      .eq("machine_id", machineId)
      .order("service_date", { ascending: false })
      .limit(50);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      query = query.eq("engineer_id", userId);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data as unknown as ServiceRecordWithDetails[]) ?? [];
  },
  ["machine-service-history-v2"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.services] }
);

export const getMachineServiceHistory = cache(
  async (machineId: string): Promise<ServiceRecordWithDetails[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return getCachedMachineServiceHistory(machineId, user.role, user.id);
  }
);

export const getActiveEngineers = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .eq("role", "engineer")
      .eq("status", "active")
      .order("full_name");

    if (error) return [];
    return (data as User[]) ?? [];
  },
  ["active-engineers-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getActiveSupervisors = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email")
      .in("role", ["supervisor", "admin", "super_admin"])
      .eq("status", "active")
      .order("full_name");

    if (error) return [];
    return (data as User[]) ?? [];
  },
  ["active-supervisors-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineCities = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("machines")
      .select("city")
      .eq("status", "active")
      .order("city")
      .limit(1000);

    if (error) return [];
    return Array.from(new Set(data?.map((d) => d.city).filter(Boolean))) as string[];
  },
  ["machine-cities-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export function getDueBucketLabel(bucket: string | undefined): string {
  switch (bucket) {
    case "today":
      return "Due Today";
    case "tomorrow":
      return "Due Tomorrow";
    case "overdue":
      return "Overdue";
    default:
      return "All Machines";
  }
}