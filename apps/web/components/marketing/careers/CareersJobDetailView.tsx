"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Briefcase,
  Clock,
  Calendar,
  CheckCircle2,
  Users,
  
  Copy,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { CareersApplyForm } from "./CareersApplyForm";
import type { PublicJobDetail } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface CareersJobDetailViewProps {
  job: PublicJobDetail;
  isPreview?: boolean;
}

export function CareersJobDetailView({ job, isPreview = false }: CareersJobDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const [showApplySection, setShowApplySection] = useState(false);

  const isClosed = job.availability === "closed";

  function handleCopyLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="py-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Draft Preview Warning Header */}
      {isPreview && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Preview Mode: This is an unpublished internal draft. It is not visible to candidates and will not be indexed by search engines.
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20">
            Confidential
          </span>
        </div>
      )}

      {/* Closed Job Alert Banner */}
      {isClosed && (
        <div className="p-5 rounded-2xl bg-zinc-500/10 border border-zinc-500/20 text-zinc-700 dark:text-zinc-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            <span>This position has been filled or closed</span>
          </div>
          <p className="text-xs text-muted-foreground">
            We are no longer accepting new submissions for this specific opening. You can explore other active openings or submit a general profile for future opportunities.
          </p>
          <div className="pt-1">
            <Link
              href="/careers#open-roles"
              className="text-xs font-bold text-[#008CFC] hover:underline inline-flex items-center gap-1"
            >
              <span>Browse Active Openings</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href="/careers" className="hover:text-foreground transition-colors">
          Careers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-semibold truncate max-w-[200px] sm:max-w-none">
          {job.title}
        </span>
      </nav>

      {/* Role Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-500/10 text-[#008CFC]">
            {job.department_name}
          </span>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {job.job_code}
          </span>
          {job.is_featured && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sparkles className="size-3" /> Featured Role
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
          {job.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-muted-foreground/70" />
            <span>{job.city}{job.state_name ? `, ${job.state_name}` : ""}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Briefcase className="size-4 text-muted-foreground/70" />
            <span>{job.employment_type.replace("_", " ")} ({job.workplace_type})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground/70" />
            <span>{job.min_experience_years}{job.max_experience_years ? `-${job.max_experience_years}` : "+"} Years Exp</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-muted-foreground/70" />
            <span>{job.openings} Opening{job.openings > 1 ? "s" : ""}</span>
          </span>
        </div>
      </div>

      {/* Main Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Job Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Summary */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#008CFC]">
              Role Overview
            </h2>
            <p className="text-sm text-foreground leading-relaxed">
              {job.summary}
            </p>
          </div>

          {/* Description */}
          {job.description_md && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-3">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#008CFC]">
                About the Position
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {job.description_md}
              </div>
            </div>
          )}

          {/* Key Responsibilities */}
          {job.responsibilities?.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#008CFC]">
                What You&apos;ll Do
              </h2>
              <ul className="space-y-2.5">
                {job.responsibilities.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="size-4 text-[#008CFC] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications & Requirements */}
          {job.requirements?.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#008CFC]">
                What We&apos;re Looking For
              </h2>
              <ul className="space-y-2.5">
                {job.requirements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits & Perks */}
          {job.benefits?.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#008CFC]">
                Benefits & Rewards
              </h2>
              <ul className="space-y-2.5">
                {job.benefits.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inline Application Form Section */}
          {!isClosed && (
            <div id="apply-now" className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#171717] border-2 border-[#008CFC]/30 shadow-md space-y-6 scroll-mt-24">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
                  Direct Application
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Apply for {job.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Submit your resume in 2 minutes. No account creation required.
                </p>
              </div>

              <CareersApplyForm jobId={job.id} jobTitle={job.title} />
            </div>
          )}
        </div>

        {/* Right Column: Sticky Summary & Apply Card */}
        <div className="space-y-6">
          <div className="sticky top-24 p-6 rounded-3xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-md space-y-5">
            {/* Compensation */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Offered Compensation
              </span>
              {job.show_salary && job.salary_min ? (
                <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{job.salary_min.toLocaleString()}
                  {job.salary_max ? ` - ₹${job.salary_max.toLocaleString()}` : ""}{" "}
                  <span className="text-xs font-sans text-muted-foreground font-normal">
                    / {job.salary_period || "month"}
                  </span>
                </div>
              ) : (
                <div className="text-base font-bold text-foreground">
                  Competitive Compensation
                </div>
              )}
            </div>

            {/* Quick Details Table */}
            <div className="space-y-3 pt-3 border-t border-border/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-semibold text-foreground">{job.department_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employment</span>
                <span className="font-semibold text-foreground capitalize">
                  {job.employment_type.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workplace</span>
                <span className="font-semibold text-foreground capitalize">
                  {job.workplace_type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Experience</span>
                <span className="font-semibold text-foreground">
                  {job.min_experience_years}{job.max_experience_years ? `-${job.max_experience_years}` : "+"} Years
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Openings</span>
                <span className="font-semibold text-foreground font-mono">{job.openings}</span>
              </div>
              {job.apply_by && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Apply Deadline</span>
                  <span className="font-semibold text-foreground">
                    {new Date(job.apply_by).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Apply Action Button */}
            {!isClosed ? (
              <a
                href="#apply-now"
                className="w-full h-12 rounded-xl font-bold text-sm bg-[#008CFC] text-white hover:bg-[#0070CA] shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Apply for this Position</span>
                <ArrowRight className="size-4" />
              </a>
            ) : (
              <button
                disabled
                className="w-full h-12 rounded-xl font-bold text-sm bg-muted text-muted-foreground cursor-not-allowed flex items-center justify-center"
              >
                Applications Closed
              </button>
            )}

            {/* Share / Copy Link */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Share this opening:</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
              >
                <Copy className="size-3.5" />
                <span>{copied ? "Link Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
