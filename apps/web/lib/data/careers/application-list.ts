import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { JobApplication, ApplicationListQuery } from "@reachinternational/types";

export interface ApplicationListResponse {
  applications: JobApplication[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const APPLICATION_LIST_COLUMNS = `
  id,
  application_code,
  job_id,
  full_name,
  email,
  phone,
  current_city,
  total_experience_yrs,
  current_ctc,
  expected_ctc,
  notice_period_days,
  cover_note,
  resume_path,
  resume_file_name,
  resume_mime,
  resume_size_bytes,
  source,
  consent_given_at,
  consent_version,
  status,
  rating,
  hr_notes,
  assigned_to,
  status_changed_at,
  created_at,
  updated_at,
  deleted_at,
  job:job_postings!job_applications_job_id_fkey(id, job_code, title)
`;

export const getAdminApplicationList = cache(
  async (params: ApplicationListQuery): Promise<ApplicationListResponse> => {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 10), 100);
    const offset = (page - 1) * pageSize;

    const cacheKey = [
      "admin-applications-list",
      `p:${page}`,
      `sz:${pageSize}`,
      `q:${params.search || ""}`,
      `job:${params.job_id || "all"}`,
      `st:${params.status || "all"}`,
      `r:${params.rating || "all"}`,
      `sf:${params.sortField || "created_at"}`,
      `so:${params.sortOrder || "desc"}`,
    ].join("-");

    return unstable_cache(
      async () => {
        const supabase = createSupabaseAdminClient();

        let query = supabase
          .from("job_applications")
          .select(APPLICATION_LIST_COLUMNS, { count: "exact" })
          .is("deleted_at", null);

        if (params.job_id) {
          query = query.eq("job_id", params.job_id);
        }

        if (params.status && params.status !== "all") {
          query = query.eq("status", params.status);
        }

        if (params.rating) {
          query = query.eq("rating", params.rating);
        }

        if (params.search && params.search.trim()) {
          const q = params.search.trim();
          query = query.or(
            `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,application_code.ilike.%${q}%,current_city.ilike.%${q}%`
          );
        }

        const ascending = params.sortOrder === "asc";
        const sortField = params.sortField || "created_at";

        query = query
          .order(sortField, { ascending, nullsFirst: false })
          .range(offset, offset + pageSize - 1);

        const { data, count, error } = await query;

        if (error) {
          console.error("[getAdminApplicationList] error:", error);
          throw new Error(`Failed to load applications: ${error.message}`);
        }

        const applications: JobApplication[] = (data || []).map((row: any) => ({
          id: row.id,
          application_code: row.application_code,
          job_id: row.job_id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          current_city: row.current_city,
          total_experience_yrs: Number(row.total_experience_yrs),
          current_ctc: row.current_ctc != null ? Number(row.current_ctc) : null,
          expected_ctc: row.expected_ctc != null ? Number(row.expected_ctc) : null,
          notice_period_days: row.notice_period_days != null ? Number(row.notice_period_days) : null,
          cover_note: row.cover_note,
          resume_path: row.resume_path,
          resume_file_name: row.resume_file_name,
          resume_mime: row.resume_mime,
          resume_size_bytes: Number(row.resume_size_bytes),
          source: row.source,
          consent_given_at: row.consent_given_at,
          consent_version: row.consent_version,
          ip_hash: null, // deliberately omit IP hash for privacy
          status: row.status,
          rating: row.rating != null ? Number(row.rating) : null,
          hr_notes: row.hr_notes,
          assigned_to: row.assigned_to,
          status_changed_at: row.status_changed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
          job_title: row.job?.title || null,
          job_code: row.job?.job_code || null,
        }));

        const total = count || 0;
        const totalPages = Math.ceil(total / pageSize);

        return {
          applications,
          total,
          page,
          pageSize,
          totalPages,
        };
      },
      [cacheKey],
      {
        revalidate: 60,
        tags: [TAGS.hiringApplications],
      }
    )();
  }
);
