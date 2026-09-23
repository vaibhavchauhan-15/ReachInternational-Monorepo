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

    const { data: usersData, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role, status, shift_start_time, shift_end_time")
      .in("role", ["supervisor", "manager", "admin", "super_admin"])
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[machine-filters] Error fetching active supervisors:", error.message || error);
      return [];
    }

    return (usersData || []).map((u: any) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Supervisor",
        phone: u.phone,
        email: u.email,
        role: u.role,
        shift_time: shiftTime,
        shift_start_time: u.shift_start_time,
        shift_end_time: u.shift_end_time,
        status: u.status || "active",
      } as User;
    });
  },
  ["active-supervisors-v10"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users] }
);

export const getActiveOperators = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();

    const { data: usersData, error } = await supabase
      .from("users")
      .select("id, full_name, phone, email, role, status, shift_start_time, shift_end_time")
      .eq("role", "operator")
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[machine-filters] Error fetching active operators:", error.message || error);
      return [];
    }

    return (usersData || []).map((u: any) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Operator",
        phone: u.phone,
        email: u.email,
        role: u.role,
        shift_time: shiftTime,
        shift_start_time: u.shift_start_time,
        shift_end_time: u.shift_end_time,
        status: u.status || "active",
      } as User;
    });
  },
  ["active-operators-v10"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.machinesMeta, TAGS.users] }
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
  ["machine-filter-options-master-v3"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.machinesMeta, TAGS.machines, TAGS.users],
  }
);

/**
 * Aggregated master filter options for Machine Directory toolbars.
 * Deduplicated per-request via React cache() and cached across requests via unstable_cache().
 */
export const getMachineFilterOptions = cache(async (): Promise<MachineFilterOptions> => {
  return getCachedMachineFilterOptions();
});

