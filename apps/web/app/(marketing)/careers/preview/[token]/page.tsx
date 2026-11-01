import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyJobPreviewToken } from "@/app/actions/hiring";
import { getJobDetailByIdOrCode } from "@/lib/data/careers";
import { CareersJobDetailView } from "@/components/marketing/careers/CareersJobDetailView";
import type { PublicJobDetail } from "@reachinternational/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft Preview | Reach International Careers",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

interface PreviewPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function DraftPreviewPage({ params }: PreviewPageProps) {
  const { token } = await params;
  const verification = await verifyJobPreviewToken(token);

  if (!verification.valid || !verification.jobId) {
    return (
      <div className="py-20 max-w-xl mx-auto px-4 text-center space-y-4">
        <h1 className="text-xl font-bold text-foreground">Preview Link Expired or Invalid</h1>
        <p className="text-xs text-muted-foreground">
          This preview token is invalid or has expired (tokens are valid for 15 minutes). Please generate a fresh preview link from the Hiring Admin panel.
        </p>
      </div>
    );
  }

  const job = await getJobDetailByIdOrCode(verification.jobId);
  if (!job) {
    notFound();
  }

  // Adapt internal JobPosting to PublicJobDetail shape for preview
  const publicJob: PublicJobDetail = {
    id: job.id,
    job_code: job.job_code,
    slug: job.slug,
    title: job.title,
    summary: job.summary,
    description_md: job.description_md,
    department_slug: job.department?.slug || "general",
    department_name: job.department?.name || "General",
    employment_type: job.employment_type,
    workplace_type: job.workplace_type,
    experience_level: job.experience_level,
    min_experience_years: job.min_experience_years,
    max_experience_years: job.max_experience_years,
    openings: job.openings,
    city: job.city,
    district: job.district,
    state_name: job.state_name || null,
    country_code: job.country_code,
    is_featured: job.is_featured,
    apply_by: job.apply_by,
    published_at: job.published_at || new Date().toISOString(),
    updated_at: job.updated_at,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    salary_period: job.salary_period,
    show_salary: job.show_salary,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    nice_to_have: job.nice_to_have || [],
    benefits: job.benefits || [],
    skills: job.skills || [],
    seo_title: job.seo_title,
    seo_description: job.seo_description,
    availability: job.status === "closed" ? "closed" : "open",
    closed_at: job.closed_at,
  };

  return (
    <div className="min-h-screen bg-background">
      <CareersJobDetailView job={publicJob} isPreview={true} />
    </div>
  );
}
