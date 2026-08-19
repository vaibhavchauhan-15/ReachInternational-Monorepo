import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { Branch } from "@/lib/types/database";

export interface BranchWithMetrics extends Branch {
  machines_count: number;
  employees_count: number;
  inventory_items_count: number;
  open_complaints_count: number;
}

const getCachedBranches = unstable_cache(
  async (): Promise<Branch[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("branches")
      .select("id, code, name, city, state, address, phone, email, status, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching branches:", error);
      return [];
    }

    return (data as Branch[]) ?? [];
  },
  ["branches-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_REFERENCE,
    tags: [TAGS.branches],
  }
);

export const getBranches = cache(async (): Promise<Branch[]> => {
  return getCachedBranches();
});

const getCachedBranchesWithMetrics = unstable_cache(
  async (): Promise<BranchWithMetrics[]> => {
    const supabase = createSupabaseAdminClient();

    const [
      { data: rawBranches },
      { data: machines },
      { data: employees },
      { data: stocks },
      { data: complaints },
    ] = await Promise.all([
      supabase.from("branches").select("id, code, name, city, state, address, phone, email, status, created_at, updated_at").order("name", { ascending: true }),
      supabase.from("machines").select("id, branch_id"),
      supabase.from("employees").select("id, branch_id"),
      supabase.from("inventory_stock").select("id, branch_id, quantity"),
      supabase.from("machine_complaints").select("id, machine_id, status"),
    ]);

    return (rawBranches || []).map((b) => {
      const branchMachines = (machines || []).filter((m) => m.branch_id === b.id);
      const machineIds = branchMachines.map((m) => m.id);

      return {
        ...(b as Branch),
        machines_count: branchMachines.length,
        employees_count: (employees || []).filter((e) => e.branch_id === b.id).length,
        inventory_items_count: (stocks || [])
          .filter((s) => s.branch_id === b.id)
          .reduce((sum, item) => sum + item.quantity, 0),
        open_complaints_count: (complaints || []).filter(
          (c) => machineIds.includes(c.machine_id) && c.status !== "closed"
        ).length,
      };
    });
  },
  ["branches-with-metrics-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_REFERENCE,
    tags: [TAGS.branches, TAGS.machines, TAGS.employees, TAGS.complaints],
  }
);

export const getBranchesWithMetrics = cache(async (): Promise<BranchWithMetrics[]> => {
  return getCachedBranchesWithMetrics();
});
