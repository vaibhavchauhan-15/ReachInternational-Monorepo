import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { JobDepartment } from "@reachinternational/types";

export interface JobFilterOptions {
  departments: JobDepartment[];
  states: Array<{ id: number; name: string }>;
}

export const getJobFilterOptions = cache(async (): Promise<JobFilterOptions> => {
  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const [deptRes, statesRes] = await Promise.all([
        supabase
          .from("job_departments")
          .select("id, slug, name, sort_order, is_active, created_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("states")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      return {
        departments: (deptRes.data as JobDepartment[]) || [],
        states: (statesRes.data as Array<{ id: number; name: string }>) || [],
      };
    },
    ["hiring-job-filters-v1"],
    {
      revalidate: 120, // 120s TTL
      tags: [TAGS.hiringList],
    }
  )();
});
