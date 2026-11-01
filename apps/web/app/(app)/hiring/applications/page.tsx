import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getAdminApplicationList,
  getHiringSummary,
  getAdminJobList,
} from "@/lib/data/careers";
import { HiringNavigationTabs } from "@/components/hiring/HiringNavigationTabs";
import { HiringKpiStrip } from "@/components/hiring/HiringKpiStrip";
import { ApplicationListClient } from "@/components/hiring/ApplicationListClient";

interface ApplicationsPageProps {
  searchParams: Promise<{
    search?: string;
    job_id?: string;
    status?: string;
    rating?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
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
  const jobId = resolved.job_id || undefined;
  const rating = resolved.rating ? parseInt(resolved.rating, 10) : undefined;

  const [appsData, summary, jobsData] = await Promise.all([
    getAdminApplicationList({
      page,
      pageSize,
      status: status as any,
      search,
      job_id: jobId,
      rating,
    }),
    getHiringSummary(),
    getAdminJobList({ pageSize: 100 }), // for job dropdown
  ]);

  const jobOptions = jobsData.jobs.map((j) => ({
    id: j.id,
    title: j.title,
    job_code: j.job_code,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)]">
            Candidate Applications
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Review candidate profiles, screen resumes, track recruitment stage, and record HR notes
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

      {/* Applications Table & Filters */}
      <ApplicationListClient
        applications={appsData.applications}
        total={appsData.total}
        page={appsData.page}
        pageSize={appsData.pageSize}
        totalPages={appsData.totalPages}
        jobs={jobOptions}
        userRole={user.role}
      />
    </div>
  );
}
