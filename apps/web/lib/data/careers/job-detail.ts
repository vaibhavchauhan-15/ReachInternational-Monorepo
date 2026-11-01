import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import type { JobPosting } from "@reachinternational/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const JOB_DETAIL_COLUMNS = `
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
  district,
  state_id,
  country_code,
  site_note,
  salary_min,
  salary_max,
  salary_currency,
  salary_period,
  show_salary,
  summary,
  description_md,
  responsibilities,
  requirements,
  nice_to_have,
  benefits,
  skills,
  status,
  is_featured,
  apply_by,
  published_at,
  closed_at,
  close_reason,
  seo_title,
  seo_description,
  created_by,
  updated_by,
  created_at,
  updated_at,
  deleted_at,
  department:job_departments!job_postings_department_id_fkey(id, slug, name, sort_order, is_active, created_at),
  state:states!job_postings_state_id_fkey(id, name),
  applications:job_applications(count)
`;

export const getJobDetailByIdOrCode = cache(async (identifier: string): Promise<JobPosting | null> => {
  if (!identifier) return null;
  const isUuid = UUID_REGEX.test(identifier);

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      let query = supabase
        .from("job_postings")
        .select(JOB_DETAIL_COLUMNS)
        .is("deleted_at", null);

      if (isUuid) {
        query = query.eq("id", identifier);
      } else {
        query = query.eq("job_code", identifier.toUpperCase());
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        return null;
      }

      const row: any = data;
      const appCount = Array.isArray(row.applications)
        ? row.applications[0]?.count || 0
        : typeof row.applications?.count === "number"
        ? row.applications.count
        : 0;

      const job: JobPosting = {
        id: row.id,
        job_code: row.job_code,
        slug: row.slug,
        title: row.title,
        department_id: row.department_id,
        employment_type: row.employment_type,
        workplace_type: row.workplace_type,
        experience_level: row.experience_level,
        min_experience_years: Number(row.min_experience_years),
        max_experience_years: row.max_experience_years != null ? Number(row.max_experience_years) : null,
        openings: row.openings,
        city: row.city,
        district: row.district,
        state_id: row.state_id,
        country_code: row.country_code,
        site_note: row.site_note,
        salary_min: row.salary_min != null ? Number(row.salary_min) : null,
        salary_max: row.salary_max != null ? Number(row.salary_max) : null,
        salary_currency: row.salary_currency,
        salary_period: row.salary_period,
        show_salary: Boolean(row.show_salary),
        summary: row.summary,
        description_md: row.description_md,
        responsibilities: row.responsibilities || [],
        requirements: row.requirements || [],
        nice_to_have: row.nice_to_have || [],
        benefits: row.benefits || [],
        skills: row.skills || [],
        status: row.status,
        is_featured: Boolean(row.is_featured),
        apply_by: row.apply_by,
        published_at: row.published_at,
        closed_at: row.closed_at,
        close_reason: row.close_reason,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        department: row.department || null,
        state_name: row.state?.name || null,
        application_count: appCount,
      };

      return job;
    },
    [`hiring-job-detail-${identifier}`],
    {
      revalidate: 60,
      tags: [TAGS.hiringJob(identifier), TAGS.hiringList],
    }
  )();
});
