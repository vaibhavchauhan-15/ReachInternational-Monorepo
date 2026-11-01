import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicJobBySlug,
  getPublicJobSlugs,
} from "@/lib/data/careers";
import { CareersJobDetailView } from "@/components/marketing/careers/CareersJobDetailView";
import { buildJobPostingJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/jsonld";

export const revalidate = 300; // 5 minutes ISR

interface JobPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  try {
    const slugs = await getPublicJobSlugs();
    return slugs.map((item) => ({
      slug: item.slug,
    }));
  } catch (err) {
    console.error("[generateStaticParams:careers] error:", err);
    return [];
  }
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);

  if (!job) {
    return {
      title: "Position Not Found | Reach International Careers",
    };
  }

  const title = job.seo_title || `${job.title} in ${job.city} | Reach International Careers`;
  const description =
    job.seo_description ||
    `${job.title} opening at Reach International in ${job.city}. ${job.summary.slice(0, 150)}... Apply today.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.reachinternational.co.in/careers/${job.slug}`,
      siteName: "Reach International",
      type: "article",
    },
    alternates: {
      canonical: `https://www.reachinternational.co.in/careers/${job.slug}`,
    },
  };
}

export default async function JobDetailPage({ params }: JobPageProps) {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);

  if (!job) {
    notFound();
  }

  const jobPostingJsonLd = buildJobPostingJsonLd(job);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { label: "Careers", href: "/careers" },
    { label: job.title, href: `/careers/${job.slug}` },
  ]);

  return (
    <>
      {/* Google for Jobs Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="min-h-screen bg-background">
        <CareersJobDetailView job={job} />
      </div>
    </>
  );
}
