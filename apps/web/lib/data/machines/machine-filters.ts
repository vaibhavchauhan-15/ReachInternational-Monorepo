import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User } from "@/lib/types/database";

export interface MachineFilterOptions {
  supervisors: User[];
  operators: User[];
  statuses: Array<{ value: string; label: string }>;
  healthStatuses: Array<{ value: string; label: string }>;
}

export const getActiveSupervisors = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

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
  ["active-supervisors-v7"],
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
  ["active-operators-v7"],
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
  ["active-engineers-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineCities = unstable_cache(
  async (): Promise<string[]> => {
    return [];
  },
  ["machine-cities-v4"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta] }
);

export const getMachineOptions = unstable_cache(
  async (): Promise<{ id: string; label: string; model?: string }[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("machines")
      .select("id, machine_id, model")
      .order("machine_id", { ascending: true });

    if (error || !data) return [];

    return data.map((m: any) => {
      const code = m.machine_id || m.id;
      return {
        id: m.id,
        label: m.model ? `${code} (${m.model})` : code,
        model: m.model || undefined,
      };
    });
  },
  ["machine-options-v3"],
  { revalidate: CACHE_TIERS.CLASS_B_FLEET, tags: [TAGS.machines] }
);

const getCachedMachineFilterOptions = unstable_cache(
  async (): Promise<MachineFilterOptions> => {
    const [supervisors, operators] = await Promise.all([
      getActiveSupervisors(),
      getActiveOperators(),
    ]);

    return {
      supervisors,
      operators,
      statuses: [
        { value: "all", label: "All Statuses" },
        { value: "available", label: "Available" },
        { value: "rented", label: "On Rent" },
      ],
      healthStatuses: [
        { value: "all", label: "All Health" },
        { value: "active", label: "Active" },
        { value: "spare", label: "Spare" },
        { value: "under_maintenance", label: "Under Maintenance" },
        { value: "breakdown", label: "Breakdown" },
      ],
    };
  },
  ["machine-filter-options-master-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.machinesMeta, TAGS.machines],
  }
);

/**
 * Aggregated master filter options for Machine Directory toolbars.
 * Deduplicated per-request via React cache() and cached across requests via unstable_cache().
 */
export const getMachineFilterOptions = cache(async (): Promise<MachineFilterOptions> => {
  return getCachedMachineFilterOptions();
});

