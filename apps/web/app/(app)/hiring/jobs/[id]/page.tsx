import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getJobDetailByIdOrCode } from "@/lib/data/careers";
import { Button } from "@/components/ui";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedEye,
  AnimatedBriefcase,
  AnimatedUsers,
  AnimatedMapPin,
  AnimatedClock,
} from "@/components/ui/animated-icons";

interface JobDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const job = await getJobDetailByIdOrCode(id);

  if (!job) {
    notFound();
  }

  const canManage = ["super_admin", "admin", "hr"].includes(user.role);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/hiring/jobs"
            className="p-2 rounded-xl text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
          >
            <AnimatedChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--color-ink)]">{job.title}</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-[var(--color-mute)]">
                {job.job_code}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {job.status}
              </span>
            </div>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              {job.department?.name || "General"} • {job.city}{job.state_name ? `, ${job.state_name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/careers/${job.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-hairline)] text-xs font-semibold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          >
            <AnimatedEye size={14} />
            <span>Public Page</span>
          </Link>

          <Link
            href={`/hiring/applications?job_id=${job.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-500/20 transition-colors"
          >
            <AnimatedUsers size={14} />
            <span>View Applications</span>
          </Link>

          {canManage && (
            <Link href={`/hiring/jobs/${job.id}/edit`}>
              <Button variant="primary" size="sm" className="gap-2">
                <AnimatedEdit size={14} />
                <span>Edit Job</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl">
          <span className="text-[11px] text-[var(--color-mute)] block">Workplace & Type</span>
          <span className="font-semibold text-[var(--color-ink)] capitalize">
            {job.employment_type.replace("_", " ")} ({job.workplace_type})
          </span>
        </div>
        <div className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl">
          <span className="text-[11px] text-[var(--color-mute)] block">Experience Level</span>
          <span className="font-semibold text-[var(--color-ink)] capitalize">
            {job.experience_level} ({job.min_experience_years}{job.max_experience_years ? `-${job.max_experience_years}` : "+"} yrs)
          </span>
        </div>
        <div className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl">
          <span className="text-[11px] text-[var(--color-mute)] block">Openings</span>
          <span className="font-semibold text-[var(--color-ink)] font-mono">{job.openings} Open Position{job.openings > 1 ? "s" : ""}</span>
        </div>
        <div className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl">
          <span className="text-[11px] text-[var(--color-mute)] block">Compensation</span>
          <span className="font-semibold text-[var(--color-ink)]">
            {job.show_salary && job.salary_min
              ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max?.toLocaleString() || ""} / ${job.salary_period}`
              : "Undisclosed publicly"}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
          Summary
        </h3>
        <p className="text-xs text-[var(--color-body)] leading-relaxed">{job.summary}</p>
      </div>

      {/* Responsibilities */}
      {job.responsibilities?.length > 0 && (
        <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
            Responsibilities
          </h3>
          <ul className="space-y-1.5 text-xs text-[var(--color-body)] pl-2">
            {job.responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sky-600 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requirements */}
      {job.requirements?.length > 0 && (
        <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
            Requirements
          </h3>
          <ul className="space-y-1.5 text-xs text-[var(--color-body)] pl-2">
            {job.requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sky-600 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
