import "server-only";
import { revalidateTag } from "next/cache";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { slugify } from "@reachinternational/utils";
import type { JobPostingInput } from "@reachinternational/validation";
import type { JobPosting } from "@reachinternational/types";

interface MutationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Triggers external revalidation webhook if configured
 */
async function dispatchMarketingRevalidation(tags: string[]) {
  const marketingUrl = process.env.MARKETING_SITE_URL;
  const secret = process.env.CAREERS_REVALIDATE_SECRET;
  if (!marketingUrl || !secret) return;

  try {
    const payload = JSON.stringify({ tags });
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    await fetch(`${marketingUrl.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-signature": hmac,
      },
      body: payload,
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
  } catch (err) {
    // Non-blocking log
    console.warn("Marketing site revalidation dispatch skipped or failed:", err);
  }
}

function invalidateHiringTags(jobId: string, slug?: string) {
  revalidateTag(TAGS.hiringList, "max");
  revalidateTag(TAGS.hiringKpis, "max");
  revalidateTag(TAGS.hiringJob(jobId), "max");
  revalidateTag(TAGS.careersList, "max");
  if (slug) {
    revalidateTag(TAGS.careerDetail(slug), "max");
  }
  dispatchMarketingRevalidation([TAGS.careersList, ...(slug ? [TAGS.careerDetail(slug)] : [])]);
}

export async function createJob(input: JobPostingInput, userId?: string): Promise<MutationResponse<JobPosting>> {
  try {
    const supabase = await createSupabaseServerClient();

    // Ensure slug uniqueness
    const { data: existingJobs } = await supabase
      .from("job_postings")
      .select("slug")
      .ilike("slug", `${input.slug}%`);

    const existingSlugs = (existingJobs || []).map((j: { slug: string }) => j.slug);
    const resolvedSlug = slugify(input.slug, existingSlugs);

    const payload = {
      title: input.title,
      slug: resolvedSlug,
      department_id: input.department_id,
      employment_type: input.employment_type,
      workplace_type: input.workplace_type,
      experience_level: input.experience_level,
      min_experience_years: input.min_experience_years,
      max_experience_years: input.max_experience_years ?? null,
      openings: input.openings,
      city: input.city,
      district: input.district ?? null,
      state_id: input.state_id ?? null,
      country_code: input.country_code || "IN",
      site_note: input.site_note ?? null,
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      salary_currency: input.salary_currency || "INR",
      salary_period: input.salary_period,
      show_salary: input.show_salary,
      summary: input.summary,
      description_md: input.description_md,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      nice_to_have: input.nice_to_have,
      benefits: input.benefits,
      skills: input.skills,
      status: input.status,
      is_featured: input.is_featured,
      apply_by: input.apply_by ?? null,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    };

    const { data, error } = await supabase
      .from("job_postings")
      .insert(payload)
      .select("id, job_code, slug, title, status, created_at")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to create job posting" };
    }

    await logAudit({
      action: "job.created",
      entity_type: "job_posting",
      entity_id: data.id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { job_code: data.job_code, title: data.title, slug: data.slug, status: data.status },
    });

    invalidateHiringTags(data.id, data.slug);
    return { success: true, data: data as unknown as JobPosting };
  } catch (err: any) {
    return { success: false, error: err?.message || "Unexpected error creating job" };
  }
}

export async function updateJob(id: string, input: JobPostingInput, userId?: string): Promise<MutationResponse<JobPosting>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: currentJob, error: fetchError } = await supabase
      .from("job_postings")
      .select("id, job_code, slug, status, published_at, title")
      .eq("id", id)
      .single();

    if (fetchError || !currentJob) {
      return { success: false, error: "Job posting not found" };
    }

    const payload: Record<string, any> = {
      title: input.title,
      department_id: input.department_id,
      employment_type: input.employment_type,
      workplace_type: input.workplace_type,
      experience_level: input.experience_level,
      min_experience_years: input.min_experience_years,
      max_experience_years: input.max_experience_years ?? null,
      openings: input.openings,
      city: input.city,
      district: input.district ?? null,
      state_id: input.state_id ?? null,
      country_code: input.country_code || "IN",
      site_note: input.site_note ?? null,
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      salary_currency: input.salary_currency || "INR",
      salary_period: input.salary_period,
      show_salary: input.show_salary,
      summary: input.summary,
      description_md: input.description_md,
      responsibilities: input.responsibilities,
      requirements: input.requirements,
      nice_to_have: input.nice_to_have,
      benefits: input.benefits,
      skills: input.skills,
      status: input.status,
      is_featured: input.is_featured,
      apply_by: input.apply_by ?? null,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      updated_by: userId ?? null,
    };

    // Slug is editable only if job was never published before
    if (!currentJob.published_at && input.slug && input.slug !== currentJob.slug) {
      payload.slug = input.slug;
    }

    const { data, error } = await supabase
      .from("job_postings")
      .update(payload)
      .eq("id", id)
      .select("id, job_code, slug, title, status, updated_at")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to update job posting" };
    }

    await logAudit({
      action: "job.updated",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      before_state: { title: currentJob.title, status: currentJob.status },
      after_state: { title: data.title, status: data.status },
      details: { job_code: data.job_code },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true, data: data as unknown as JobPosting };
  } catch (err: any) {
    return { success: false, error: err?.message || "Unexpected error updating job" };
  }
}

export async function publishJob(id: string, userId?: string): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("job_postings")
      .update({ status: "published", updated_by: userId ?? null })
      .eq("id", id)
      .select("id, job_code, slug, title, status")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to publish job" };
    }

    await logAudit({
      action: "job.published",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { job_code: data.job_code, title: data.title },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error publishing job" };
  }
}

export async function unpublishJob(id: string, userId?: string): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("job_postings")
      .update({ status: "draft", updated_by: userId ?? null })
      .eq("id", id)
      .select("id, job_code, slug, title, status")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to unpublish job" };
    }

    await logAudit({
      action: "job.unpublished",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { job_code: data.job_code, title: data.title },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error unpublishing job" };
  }
}

export async function closeJob(id: string, reason: string = "filled", userId?: string): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("job_postings")
      .update({
        status: "closed",
        close_reason: reason,
        closed_at: new Date().toISOString(),
        updated_by: userId ?? null,
      })
      .eq("id", id)
      .select("id, job_code, slug, title, status, close_reason")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to close job" };
    }

    await logAudit({
      action: "job.closed",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { job_code: data.job_code, reason },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error closing job" };
  }
}

export async function reopenJob(id: string, userId?: string): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("job_postings")
      .update({
        status: "published",
        closed_at: null,
        close_reason: null,
        updated_by: userId ?? null,
      })
      .eq("id", id)
      .select("id, job_code, slug, title, status")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to reopen job" };
    }

    await logAudit({
      action: "job.reopened",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { job_code: data.job_code },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error reopening job" };
  }
}

export async function duplicateJob(id: string, userId?: string): Promise<MutationResponse<JobPosting>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: source, error: fetchErr } = await supabase
      .from("job_postings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !source) {
      return { success: false, error: "Original job posting not found" };
    }

    const newTitle = `${source.title} (Copy)`;
    const newSlug = slugify(newTitle);

    const { data: existingJobs } = await supabase
      .from("job_postings")
      .select("slug")
      .ilike("slug", `${newSlug}%`);

    const existingSlugs = (existingJobs || []).map((j: { slug: string }) => j.slug);
    const resolvedSlug = slugify(newTitle, existingSlugs);

    const duplicatePayload = {
      title: newTitle,
      slug: resolvedSlug,
      department_id: source.department_id,
      employment_type: source.employment_type,
      workplace_type: source.workplace_type,
      experience_level: source.experience_level,
      min_experience_years: source.min_experience_years,
      max_experience_years: source.max_experience_years,
      openings: source.openings,
      city: source.city,
      district: source.district,
      state_id: source.state_id,
      country_code: source.country_code,
      site_note: source.site_note,
      salary_min: source.salary_min,
      salary_max: source.salary_max,
      salary_currency: source.salary_currency,
      salary_period: source.salary_period,
      show_salary: source.show_salary,
      summary: source.summary,
      description_md: source.description_md,
      responsibilities: source.responsibilities,
      requirements: source.requirements,
      nice_to_have: source.nice_to_have,
      benefits: source.benefits,
      skills: source.skills,
      status: "draft",
      is_featured: false,
      apply_by: null,
      seo_title: source.seo_title,
      seo_description: source.seo_description,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    };

    const { data, error } = await supabase
      .from("job_postings")
      .insert(duplicatePayload)
      .select("id, job_code, slug, title, status")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to duplicate job posting" };
    }

    await logAudit({
      action: "job.duplicated",
      entity_type: "job_posting",
      entity_id: data.id,
      category: "hiring",
      severity: "info",
      user_id: userId,
      details: { original_id: id, new_code: data.job_code },
    });

    invalidateHiringTags(data.id, data.slug);
    return { success: true, data: data as unknown as JobPosting };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error duplicating job" };
  }
}

export async function softDeleteJob(id: string, userId?: string): Promise<MutationResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("job_postings")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
      })
      .eq("id", id)
      .select("id, job_code, slug, title")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to delete job posting" };
    }

    await logAudit({
      action: "job.deleted",
      entity_type: "job_posting",
      entity_id: id,
      category: "hiring",
      severity: "warning",
      user_id: userId,
      details: { job_code: data.job_code, title: data.title },
    });

    invalidateHiringTags(id, data.slug);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error deleting job" };
  }
}
