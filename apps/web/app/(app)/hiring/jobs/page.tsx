import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import {
  getAdminJobList,
  getHiringSummary,
  getJobFilterOptions,
} from "@/lib/data/careers";
import { HiringNavigationTabs } from "@/components/hiring/HiringNavigationTabs";
import { HiringKpiStrip } from "@/components/hiring/HiringKpiStrip";
import { JobListClient } from "@/components/hiring/JobListClient";
import { redirect } from "next/navigation";

interface JobsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    department?: string;
    employment_type?: string;
    workplace_type?: string;
    state_id?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "hr", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const resolved = await searchParams;
  const page = parseInt(resolved.page || "1", 10);
  const pageSize = parseInt(resolved.pageSize || "10", 10);
  const status = resolved.status || "all";
  const search = resolved.search || "";
  const department = resolved.department || "";

  const [jobData, summary, filterOptions] = await Promise.all([
    getAdminJobList({
      page,
      pageSize,
      status: status as any,
      search,
      department,
      employment_type: resolved.employment_type,
      workplace_type: resolved.workplace_type,
      state_id: resolved.state_id ? parseInt(resolved.state_id, 10) : undefined,
    }),
    getHiringSummary(),
    getJobFilterOptions(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)]">
            Hiring & Careers Management
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Manage public job postings, recruitment pipeline, and applicant submissions
          </p>
        </div>

        <HiringNavigationTabs
          totalJobs={summary.total_jobs}
          totalApplications={summary.applications}
          newApplications={summary.new_applications}
        />
      </div>

      {/* KPI Overview Strip */}
      <HiringKpiStrip summary={summary} />

      {/* Job Postings Table & Filter Controls */}
      <JobListClient
        jobs={jobData.jobs}
        total={jobData.total}
        page={jobData.page}
        pageSize={jobData.pageSize}
        totalPages={jobData.totalPages}
        departments={filterOptions.departments}
        userRole={user.role}
      />
    </div>
  );
}
