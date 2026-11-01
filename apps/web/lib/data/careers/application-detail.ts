import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { JobApplication } from "@reachinternational/types";

const APPLICATION_DETAIL_COLUMNS = `
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

export const getApplicationDetailByIdOrCode = cache(
  async (idOrCode: string): Promise<JobApplication | null> => {
    if (!idOrCode) return null;

    return unstable_cache(
      async () => {
        const supabase = createSupabaseAdminClient();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          idOrCode
        );

        let query = supabase
          .from("job_applications")
          .select(APPLICATION_DETAIL_COLUMNS)
          .is("deleted_at", null);

        if (isUuid) {
          query = query.eq("id", idOrCode);
        } else {
          query = query.eq("application_code", idOrCode);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("[getApplicationDetailByIdOrCode] error:", error);
          throw new Error(`Failed to load application: ${error.message}`);
        }

        if (!data) return null;

        const row = data as any;
        return {
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
          ip_hash: null,
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
        };
      },
      [`hiring-app-${idOrCode}`],
      {
        revalidate: 60,
        tags: [TAGS.hiringApplicationDetail(idOrCode), TAGS.hiringApplications],
      }
    )();
  }
);
