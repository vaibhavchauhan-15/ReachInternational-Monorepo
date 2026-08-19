import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { MachineCategory } from "@/lib/types/database";

const getCachedMachineCategories = unstable_cache(
  async (): Promise<MachineCategory[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("machine_categories")
      .select("id, name, description, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching machine categories:", error);
      return [];
    }

    return (data as MachineCategory[]) ?? [];
  },
  ["machine-categories-list-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.categories],
  }
);

export const getMachineCategories = cache(async (): Promise<MachineCategory[]> => {
  return getCachedMachineCategories();
});
