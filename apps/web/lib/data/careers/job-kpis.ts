import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { HiringSummary } from "@reachinternational/types";

const DEFAULT_HIRING_SUMMARY: HiringSummary = {
  total_jobs: 0,
  published: 0,
  drafts: 0,
  closed: 0,
  applications: 0,
  new_applications: 0,
  applications_7d: 0,
};

export const getHiringSummary = cache(async (): Promise<HiringSummary> => {
  return unstable_cache(
    async () => {
      try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase.rpc("get_hiring_summary");
        if (error || !data) {
          return DEFAULT_HIRING_SUMMARY;
        }
        return data as HiringSummary;
      } catch {
        return DEFAULT_HIRING_SUMMARY;
      }
    },
    ["hiring-kpis-summary-v1"],
    {
      revalidate: 15,
      tags: [TAGS.hiringKpis],
    }
  )();
});
