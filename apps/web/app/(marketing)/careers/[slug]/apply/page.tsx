import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { getPublicJobBySlug } from "@/lib/data/careers";
import { CareersApplyForm } from "@/components/marketing/careers/CareersApplyForm";

interface ApplyPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ApplyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);

  if (!job) {
    return { title: "Apply | Reach International Careers" };
  }

  return {
    title: `Apply for ${job.title} | Reach International Careers`,
    description: `Submit your resume and candidate details for ${job.title} in ${job.city}. Fast 2-minute application.`,
    robots: {
      index: false, // Prevent duplicate indexing of dedicated apply form
      follow: true,
    },
  };
}

export default async function DedicatedApplyPage({ params }: ApplyPageProps) {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);

  if (!job) {
    notFound();
  }

  if (job.availability === "closed") {
    return (
      <div className="py-16 max-w-2xl mx-auto px-4 text-center space-y-4">
        <h1 className="text-xl font-bold text-foreground">Applications are Closed</h1>
        <p className="text-xs text-muted-foreground">
          The opening for &ldquo;{job.title}&rdquo; has recently been filled or closed.
        </p>
        <Link
          href="/careers"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#008CFC] hover:underline"
        >
          <ArrowLeft className="size-4" />
          <span>Browse Other Open Positions</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10 max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href="/careers" className="hover:text-foreground">
          Careers
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/careers/${job.slug}`} className="hover:text-foreground truncate max-w-[150px]">
          {job.title}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-semibold">Apply</span>
      </nav>

      {/* Form Container Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-md space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
            Candidate Application
          </span>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight mt-1">
            Apply for {job.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {job.department_name} • {job.city}{job.state_name ? `, ${job.state_name}` : ""} • {job.job_code}
          </p>
        </div>

        <CareersApplyForm jobId={job.id} jobTitle={job.title} />
      </div>
    </div>
  );
}
