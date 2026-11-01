import React, { Suspense } from "react";
import type { Metadata } from "next";
import { getPublicJobs, getPublicJobFilters } from "@/lib/data/careers";
import { CareersHero } from "@/components/marketing/careers/CareersHero";
import { CareersWhyJoin } from "@/components/marketing/careers/CareersWhyJoin";
import { CareersJobList } from "@/components/marketing/careers/CareersJobList";
import { CareersHiringProcess } from "@/components/marketing/careers/CareersHiringProcess";
import { CareersGeneralCta } from "@/components/marketing/careers/CareersGeneralCta";

export const revalidate = 300; // 5 minutes ISR

export const metadata: Metadata = {
  title: "Careers & Open Positions | Reach International",
  description:
    "Join Reach International — India's leading aerial work platform and heavy equipment rental specialist. Explore open roles for mechanics, certified operators, and engineering leaders nationwide.",
  openGraph: {
    title: "Careers at Reach International | Reaching All Heights",
    description:
      "Join our nationwide team operating landmark infrastructure, rail, and industrial projects. Competitive compensation, certified OEM training, and safety-first culture.",
    url: "https://www.reachinternational.co.in/careers",
    siteName: "Reach International",
    type: "website",
  },
  alternates: {
    canonical: "https://www.reachinternational.co.in/careers",
  },
};

export default async function CareersPage() {
  const [jobsData, filterOptions] = await Promise.all([
    getPublicJobs({ pageSize: 50 }),
    getPublicJobFilters(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Hero Section */}
      <CareersHero openRoleCount={jobsData.total} />

      {/* 2. Open Roles Section with Instant Filtering */}
      <Suspense fallback={<div className="py-12 text-center text-sm text-neutral-500">Loading careers...</div>}>
        <CareersJobList
          initialJobs={jobsData.jobs}
          total={jobsData.total}
          filters={filterOptions}
        />
      </Suspense>

      {/* 3. Why Join Section */}
      <CareersWhyJoin />

      {/* 4. Hiring Process Timeline */}
      <CareersHiringProcess />

      {/* 5. General Application CTA */}
      <CareersGeneralCta />
    </div>
  );
}
