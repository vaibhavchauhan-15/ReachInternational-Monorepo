import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/env/client";
import { TAGS } from "@/lib/cache";
import type {
  PublicJobListItem,
  PublicJobDetail,
  PublicJobFilters,
} from "@reachinternational/types";

function getPublicSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface PublicJobsResponse {
  jobs: PublicJobListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PublicJobFilterParams {
  search?: string;
  department?: string;
  employment_type?: string;
  workplace_type?: string;
  state_id?: number;
  page?: number;
  pageSize?: number;
}

export const getPublicJobs = cache(
  async (params: PublicJobFilterParams = {}): Promise<PublicJobsResponse> => {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 10), 50);

    const cacheKey = [
      "public-jobs",
      `p:${page}`,
      `sz:${pageSize}`,
      `q:${params.search || ""}`,
      `dep:${params.department || ""}`,
      `typ:${params.employment_type || ""}`,
      `wkp:${params.workplace_type || ""}`,
      `sid:${params.state_id || ""}`,
    ].join("-");

    return unstable_cache(
      async () => {
        const supabase = getPublicSupabaseClient();

        const { data, error } = await supabase.rpc("get_public_jobs", {
          p_search: params.search && params.search.trim() ? params.search.trim() : null,
          p_department: params.department || null,
          p_type: params.employment_type || null,
          p_workplace: params.workplace_type || null,
          p_state_id: params.state_id || null,
          p_page: page,
          p_page_size: pageSize,
        });

        if (error) {
          console.error("[getPublicJobs] RPC error:", error);
          return {
            jobs: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }

        const res = (data as any) || {};
        const jobsList = (res.rows || res.jobs || []) as PublicJobListItem[];
        return {
          jobs: jobsList,
          total: Number(res.total || 0),
          page: Number(res.page || 1),
          pageSize: Number(res.page_size || pageSize),
          totalPages: Number(res.total_pages || 0),
        };
      },
      [cacheKey],
      {
        revalidate: 300,
        tags: [TAGS.careersList],
      }
    )();
  }
);

export const getPublicJobBySlug = cache(
  async (slug: string): Promise<PublicJobDetail | null> => {
    if (!slug) return null;

    return unstable_cache(
      async () => {
        const supabase = getPublicSupabaseClient();

        const { data, error } = await supabase.rpc("get_public_job_by_slug", {
          p_slug: slug,
        });

        if (error || !data) {
          if (error) {
            console.error("[getPublicJobBySlug] RPC error:", error);
          }
          return null;
        }

        return data as PublicJobDetail;
      },
      [`public-job-${slug}`],
      {
        revalidate: 300,
        tags: [TAGS.careerDetail(slug), TAGS.careersList],
      }
    )();
  }
);

export const getPublicJobSlugs = cache(
  async (): Promise<Array<{ slug: string; updated_at: string }>> => {
    return unstable_cache(
      async () => {
        const supabase = getPublicSupabaseClient();

        const { data, error } = await supabase.rpc("get_public_job_slugs");

        if (error || !data) {
          console.error("[getPublicJobSlugs] RPC error:", error);
          return [];
        }

        return data as Array<{ slug: string; updated_at: string }>;
      },
      ["public-job-slugs"],
      {
        revalidate: 300,
        tags: [TAGS.careersList],
      }
    )();
  }
);

export const getPublicJobFilters = cache(
  async (): Promise<PublicJobFilters> => {
    return unstable_cache(
      async () => {
        const supabase = getPublicSupabaseClient();

        const { data, error } = await supabase.rpc("get_public_job_filters");

        if (error || !data) {
          console.error("[getPublicJobFilters] RPC error:", error);
          return {
            total: 0,
            departments: [],
            employment_types: [],
            workplace_types: [],
            states: [],
          };
        }

        return data as PublicJobFilters;
      },
      ["public-job-filters"],
      {
        revalidate: 300,
        tags: [TAGS.careersList],
      }
    )();
  }
);
