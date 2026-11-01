import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { JobPostingListItem, JobListQuery } from "@reachinternational/types";

export interface JobListResponse {
  jobs: JobPostingListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const JOB_LIST_COLUMNS = `
  id,
  job_code,
  slug,
  title,
  department_id,
  employment_type,
  workplace_type,
  experience_level,
  min_experience_years,
  max_experience_years,
  openings,
  city,
  state_id,
  status,
  is_featured,
  apply_by,
  published_at,
  closed_at,
  created_at,
  updated_at,
  department:job_departments!job_postings_department_id_fkey(id, slug, name),
  state:states!job_postings_state_id_fkey(id, name),
  applications:job_applications(count)
`;

export const getAdminJobList = cache(async (params: JobListQuery): Promise<JobListResponse> => {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(Math.max(1, params.pageSize || 10), 100);
  const offset = (page - 1) * pageSize;

  const cacheKey = [
    "admin-jobs-list",
    `p:${page}`,
    `sz:${pageSize}`,
    `q:${params.search || ""}`,
    `st:${params.status || "all"}`,
    `dep:${params.department || ""}`,
    `typ:${params.employment_type || ""}`,
    `wkp:${params.workplace_type || ""}`,
    `sid:${params.state_id || ""}`,
    `sf:${params.sortField || "created_at"}`,
    `so:${params.sortOrder || "desc"}`,
  ].join("-");

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();

      let query = supabase
        .from("job_postings")
        .select(JOB_LIST_COLUMNS, { count: "exact" })
        .is("deleted_at", null);

      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }

      if (params.department) {
        // filter by department id or slug
        const deptId = parseInt(params.department, 10);
        if (!isNaN(deptId)) {
          query = query.eq("department_id", deptId);
        }
      }

      if (params.employment_type) {
        query = query.eq("employment_type", params.employment_type);
      }

      if (params.workplace_type) {
        query = query.eq("workplace_type", params.workplace_type);
      }

      if (params.state_id) {
        query = query.eq("state_id", params.state_id);
      }

      if (params.search && params.search.trim()) {
        const q = params.search.trim();
        query = query.or(`title.ilike.%${q}%,job_code.ilike.%${q}%,city.ilike.%${q}%`);
      }

      // Sort
      const ascending = params.sortOrder === "asc";
      if (params.sortField === "published_at") {
        query = query.order("published_at", { ascending, nullsFirst: false });
      } else if (params.sortField === "apply_by") {
        query = query.order("apply_by", { ascending, nullsFirst: false });
      } else if (params.sortField === "title") {
        query = query.order("title", { ascending });
      } else {
        query = query.order("created_at", { ascending });
      }
      query = query.order("id", { ascending: false });

      // Range pagination
      query = query.range(offset, offset + pageSize - 1);

      const { data, count, error } = await query;
      if (error) {
        console.error("Failed to fetch admin jobs list:", error);
        return { jobs: [], total: 0, page, pageSize, totalPages: 1 };
      }

      const total = count || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const jobs: JobPostingListItem[] = (data || []).map((row: any) => {
        const appCount = Array.isArray(row.applications)
          ? row.applications[0]?.count || 0
          : typeof row.applications?.count === "number"
          ? row.applications.count
          : 0;

        return {
          id: row.id,
          job_code: row.job_code,
          slug: row.slug,
          title: row.title,
          department_id: row.department_id,
          department_name: row.department?.name,
          department_slug: row.department?.slug,
          employment_type: row.employment_type,
          workplace_type: row.workplace_type,
          experience_level: row.experience_level,
          min_experience_years: Number(row.min_experience_years),
          max_experience_years: row.max_experience_years != null ? Number(row.max_experience_years) : null,
          openings: row.openings,
          city: row.city,
          state_id: row.state_id,
          state_name: row.state?.name,
          status: row.status,
          is_featured: row.is_featured,
          apply_by: row.apply_by,
          published_at: row.published_at,
          closed_at: row.closed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          application_count: appCount,
        };
      });

      return {
        jobs,
        total,
        page,
        pageSize,
        totalPages,
      };
    },
    [cacheKey],
    {
      revalidate: 60,
      tags: [TAGS.hiringList],
    }
  )();
});
