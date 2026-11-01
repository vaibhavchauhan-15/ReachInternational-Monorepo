"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Textarea, useToast, ConfirmationDialog } from "@/components/ui";
import {
  AnimatedChevronLeft,
  AnimatedPlus,
  AnimatedTrash2,
  AnimatedEye,
  AnimatedCheck,
  AnimatedSave,
  AnimatedSparkles,
} from "@/components/ui/animated-icons";
import {
  createJobAction,
  updateJobAction,
  publishJobAction,
  generateJobPreviewTokenAction,
} from "@/app/actions/hiring";
import { slugify } from "@reachinternational/utils";
import type { JobPosting, JobDepartment } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface StateOption {
  id: number;
  name: string;
}

interface JobEditorFormProps {
  initialJob?: JobPosting | null;
  departments: JobDepartment[];
  states: StateOption[];
  isEditing?: boolean;
}

export function JobEditorForm({
  initialJob,
  departments,
  states,
  isEditing = false,
}: JobEditorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [title, setTitle] = useState(initialJob?.title || "");
  const [slug, setSlug] = useState(initialJob?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!isEditing);
  const [departmentId, setDepartmentId] = useState<number>(
    initialJob?.department_id || departments[0]?.id || 1
  );
  const [employmentType, setEmploymentType] = useState(initialJob?.employment_type || "full_time");
  const [workplaceType, setWorkplaceType] = useState(initialJob?.workplace_type || "onsite");
  const [experienceLevel, setExperienceLevel] = useState(initialJob?.experience_level || "mid");
  const [minExp, setMinExp] = useState<number>(initialJob?.min_experience_years ?? 1);
  const [maxExp, setMaxExp] = useState<number | "">(initialJob?.max_experience_years ?? "");
  const [openings, setOpenings] = useState<number>(initialJob?.openings ?? 1);
  const [city, setCity] = useState(initialJob?.city || "New Delhi");
  const [district, setDistrict] = useState(initialJob?.district || "");
  const [stateId, setStateId] = useState<number | "">(initialJob?.state_id ?? (states[0]?.id || ""));
  const [siteNote, setSiteNote] = useState(initialJob?.site_note || "");

  // Salary
  const [showSalary, setShowSalary] = useState(initialJob?.show_salary ?? false);
  const [salaryMin, setSalaryMin] = useState<number | "">(initialJob?.salary_min ?? "");
  const [salaryMax, setSalaryMax] = useState<number | "">(initialJob?.salary_max ?? "");
  const [salaryPeriod, setSalaryPeriod] = useState(initialJob?.salary_period || "month");
  const [salaryCurrency, setSalaryCurrency] = useState(initialJob?.salary_currency || "INR");

  // Content
  const [summary, setSummary] = useState(initialJob?.summary || "");
  const [descriptionMd, setDescriptionMd] = useState(initialJob?.description_md || "");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");

  // List arrays
  const [responsibilities, setResponsibilities] = useState<string[]>(
    initialJob?.responsibilities?.length ? initialJob.responsibilities : [""]
  );
  const [requirements, setRequirements] = useState<string[]>(
    initialJob?.requirements?.length ? initialJob.requirements : [""]
  );
  const [niceToHave, setNiceToHave] = useState<string[]>(
    initialJob?.nice_to_have?.length ? initialJob.nice_to_have : [""]
  );
  const [benefits, setBenefits] = useState<string[]>(
    initialJob?.benefits?.length ? initialJob.benefits : [""]
  );
  const [skills, setSkills] = useState<string[]>(
    initialJob?.skills?.length ? initialJob.skills : [""]
  );

  // SEO & Publishing
  const [isFeatured, setIsFeatured] = useState(initialJob?.is_featured ?? false);
  const [applyBy, setApplyBy] = useState(initialJob?.apply_by || "");
  const [seoTitle, setSeoTitle] = useState(initialJob?.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(initialJob?.seo_description || "");

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Handle title change & auto slug
  function handleTitleChange(val: string) {
    setTitle(val);
    if (autoSlug && !isEditing) {
      setSlug(slugify(val));
    }
  }

  // Generic List item helpers
  function updateListItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, val: string) {
    setter((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function addListItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) => [...prev, ""]);
  }

  function removeListItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function buildPayload(statusOverride?: "draft" | "published") {
    return {
      title,
      slug,
      department_id: Number(departmentId),
      employment_type: employmentType,
      workplace_type: workplaceType,
      experience_level: experienceLevel,
      min_experience_years: Number(minExp),
      max_experience_years: maxExp === "" ? null : Number(maxExp),
      openings: Number(openings),
      city,
      district: district.trim() || null,
      state_id: stateId === "" ? null : Number(stateId),
      country_code: "IN",
      site_note: siteNote.trim() || null,
      salary_min: salaryMin === "" ? null : Number(salaryMin),
      salary_max: salaryMax === "" ? null : Number(salaryMax),
      salary_currency: salaryCurrency,
      salary_period: salaryPeriod,
      show_salary: showSalary,
      summary,
      description_md: descriptionMd,
      responsibilities: responsibilities.map((s) => s.trim()).filter(Boolean),
      requirements: requirements.map((s) => s.trim()).filter(Boolean),
      nice_to_have: niceToHave.map((s) => s.trim()).filter(Boolean),
      benefits: benefits.map((s) => s.trim()).filter(Boolean),
      skills: skills.map((s) => s.trim()).filter(Boolean),
      status: statusOverride || initialJob?.status || "draft",
      is_featured: isFeatured,
      apply_by: applyBy || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
    };
  }

  async function handleSave(statusOverride?: "draft" | "published") {
    setFieldErrors({});
    const payload = buildPayload(statusOverride);

    startTransition(async () => {
      try {
        let res: any;
        if (isEditing && initialJob?.id) {
          res = await updateJobAction(initialJob.id, payload);
        } else {
          res = await createJobAction(payload);
        }

        if (res.success) {
          const savedId = res.data?.id || initialJob?.id;
          toast(
            "success",
            statusOverride === "published"
              ? "Job published successfully!"
              : "Job draft saved successfully!"
          );
          router.push(`/hiring/jobs`);
          router.refresh();
        } else {
          toast("error", res.error || "Failed to save job");
          if (res.fieldErrors) {
            setFieldErrors(res.fieldErrors);
          }
        }
      } catch (err: any) {
        toast("error", err.message || "An unexpected error occurred");
      }
    });
  }

  async function handlePreview() {
    if (!initialJob?.id) {
      toast("info", "Please save this job draft first to generate a live preview");
      return;
    }
    const res = await generateJobPreviewTokenAction(initialJob.id);
    if (res.success && res.data?.url) {
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast("error", res.error || "Failed to generate preview");
    }
  }

  // Pre-publish validation check
  function triggerPublishModal() {
    const activeResp = responsibilities.map((s) => s.trim()).filter(Boolean);
    const activeReq = requirements.map((s) => s.trim()).filter(Boolean);

    if (title.trim().length < 3) {
      toast("error", "Job title must be at least 3 characters");
      return;
    }
    if (summary.trim().length < 20) {
      toast("error", "Job summary must be at least 20 characters before publishing");
      return;
    }
    if (descriptionMd.trim().length < 50) {
      toast("error", "Job description must be at least 50 characters before publishing");
      return;
    }
    if (activeResp.length === 0) {
      toast("error", "Add at least one Key Responsibility before publishing");
      return;
    }
    if (activeReq.length === 0) {
      toast("error", "Add at least one Qualification/Requirement before publishing");
      return;
    }

    setPublishModalOpen(true);
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/hiring/jobs"
            className="p-2 rounded-xl text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
          >
            <AnimatedChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-ink)]">
              {isEditing ? `Edit Job: ${initialJob?.title}` : "Create Job Posting"}
            </h1>
            <p className="text-xs text-[var(--color-mute)]">
              {isEditing ? `Code: ${initialJob?.job_code}` : "Draft a new role for Reach International careers portal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="gap-2"
            >
              <AnimatedEye size={15} />
              <span>Preview</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave("draft")}
            loading={isPending}
            className="gap-2"
          >
            <AnimatedSave size={15} />
            <span>Save Draft</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={triggerPublishModal}
            loading={isPending}
            className="gap-2"
          >
            <AnimatedCheck size={15} />
            <span>Publish Job</span>
          </Button>
        </div>
      </div>

      {/* Form Section 1: Basics */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
          1. Role Basics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Senior Heavy Equipment Mechanic"
              className="w-full h-10 px-3.5 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            {fieldErrors.title && (
              <p className="text-[11px] text-red-500">{fieldErrors.title[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                URL Slug <span className="text-red-500">*</span>
              </label>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-[10px] text-sky-600 hover:underline font-medium"
                >
                  {autoSlug ? "Manual Slug" : "Auto Slug"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-3 h-10 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-mute)]">
              <span>/careers/</span>
              <input
                type="text"
                value={slug}
                disabled={autoSlug && !isEditing}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="flex-1 bg-transparent text-[var(--color-ink)] focus:outline-none disabled:opacity-60"
              />
            </div>
            {fieldErrors.slug && (
              <p className="text-[11px] text-red-500">{fieldErrors.slug[0]}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Employment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as any)}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20 capitalize"
            >
              <option value="full_time">Full-Time</option>
              <option value="part_time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Openings Available <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={openings}
              onChange={(e) => setOpenings(Math.max(1, parseInt(e.target.value || "1", 10)))}
              className="w-full h-10 px-3.5 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>
      </div>

      {/* Form Section 2: Location & Experience */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
          2. Workplace & Experience
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Workplace Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={workplaceType}
              onChange={(e) => setWorkplaceType(e.target.value as any)}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] capitalize"
            >
              <option value="onsite">On-Site (Yard / Client Site)</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Experience Level <span className="text-red-500">*</span>
            </label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as any)}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] capitalize"
            >
              <option value="fresher">Fresher (0 years)</option>
              <option value="junior">Junior (1-3 years)</option>
              <option value="mid">Mid-Level (3-6 years)</option>
              <option value="senior">Senior (6-10 years)</option>
              <option value="lead">Lead / Principal (10+ years)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--color-ink)]">Min Exp (Yrs)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={minExp}
                onChange={(e) => setMinExp(Number(e.target.value || 0))}
                className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--color-ink)]">Max Exp (Yrs)</label>
              <input
                type="number"
                min={minExp}
                max={50}
                value={maxExp}
                onChange={(e) => setMaxExp(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Optional"
                className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Primary City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New Delhi"
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">District (optional)</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. South Delhi"
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">State</label>
            <select
              value={stateId}
              onChange={(e) => setStateId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            >
              <option value="">Select State</option>
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Site Note / Travel Expectation (optional)
            </label>
            <input
              type="text"
              value={siteNote}
              onChange={(e) => setSiteNote(e.target.value)}
              placeholder="e.g. Frequent site travel to metro projects required; company vehicle provided."
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>
        </div>
      </div>

      {/* Form Section 3: Compensation */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
              3. Compensation
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Configure salary range and visibility on the public site
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSalary}
              onChange={(e) => setShowSalary(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
            />
            <span className="text-xs font-semibold text-[var(--color-ink)]">
              Show Salary Publicly
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">Currency</label>
            <input
              type="text"
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Minimum Salary {showSalary && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 35000"
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">Maximum Salary</label>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 50000"
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">Period</label>
            <select
              value={salaryPeriod}
              onChange={(e) => setSalaryPeriod(e.target.value as any)}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] capitalize"
            >
              <option value="month">Per Month</option>
              <option value="year">Per Year (LPA)</option>
              <option value="day">Per Day</option>
              <option value="hour">Per Hour</option>
            </select>
          </div>
        </div>
      </div>

      {/* Form Section 4: Content & Descriptions */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
          4. Role Description & Requirements
        </h2>

        {/* Short Summary */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Brief Summary <span className="text-red-500">*</span>
            </label>
            <span
              className={cn(
                "text-[10px] font-mono",
                summary.length < 20 || summary.length > 300
                  ? "text-amber-600 dark:text-amber-400 font-bold"
                  : "text-[var(--color-mute)]"
              )}
            >
              {summary.length} / 300 chars (min 20)
            </span>
          </div>
          <textarea
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A compelling 1-2 sentence overview of the role for job cards and previews..."
            className="w-full p-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        {/* Full Markdown Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Detailed Description (Markdown) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1 p-0.5 bg-[var(--color-hairline-soft-surface)] rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewTab("edit")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-colors",
                  previewTab === "edit"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                )}
              >
                Markdown Editor
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("preview")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-semibold transition-colors",
                  previewTab === "preview"
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                )}
              >
                Preview HTML
              </button>
            </div>
          </div>

          {previewTab === "edit" ? (
            <textarea
              rows={8}
              value={descriptionMd}
              onChange={(e) => setDescriptionMd(e.target.value)}
              placeholder="Write the comprehensive role overview, company background, and day-to-day context using markdown..."
              className="w-full p-3 text-xs font-mono bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20 leading-relaxed"
            />
          ) : (
            <div className="p-4 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl min-h-[160px] text-xs text-[var(--color-body)] prose prose-sm dark:prose-invert max-w-none">
              {descriptionMd ? (
                <div className="whitespace-pre-wrap">{descriptionMd}</div>
              ) : (
                <p className="text-[var(--color-mute)] italic">No description written yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Lists */}
        {/* Responsibilities */}
        <div className="space-y-2 pt-2 border-t border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Key Responsibilities <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => addListItem(setResponsibilities)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <AnimatedPlus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {responsibilities.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--color-mute)] w-5 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateListItem(setResponsibilities, idx, e.target.value)}
                  placeholder="e.g. Conduct daily maintenance checks on CAT & JCB excavators"
                  className="flex-1 h-9 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)]"
                />
                {responsibilities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(setResponsibilities, idx)}
                    className="p-1.5 text-[var(--color-mute)] hover:text-red-500 rounded-lg transition-colors"
                  >
                    <AnimatedTrash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-2 pt-2 border-t border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Qualifications & Requirements <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => addListItem(setRequirements)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <AnimatedPlus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {requirements.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--color-mute)] w-5 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateListItem(setRequirements, idx, e.target.value)}
                  placeholder="e.g. ITI/Diploma in Automobile/Mechanical Engineering"
                  className="flex-1 h-9 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)]"
                />
                {requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(setRequirements, idx)}
                    className="p-1.5 text-[var(--color-mute)] hover:text-red-500 rounded-lg transition-colors"
                  >
                    <AnimatedTrash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Benefits & Perks */}
        <div className="space-y-2 pt-2 border-t border-[var(--color-hairline)]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Benefits & Perks (optional)
            </label>
            <button
              type="button"
              onClick={() => addListItem(setBenefits)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <AnimatedPlus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {benefits.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--color-mute)] w-5 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateListItem(setBenefits, idx, e.target.value)}
                  placeholder="e.g. Company provided accommodation and medical insurance"
                  className="flex-1 h-9 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)]"
                />
                {benefits.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(setBenefits, idx)}
                    className="p-1.5 text-[var(--color-mute)] hover:text-red-500 rounded-lg transition-colors"
                  >
                    <AnimatedTrash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Section 5: Publishing & SEO */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl p-5 shadow-2xs space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
          5. Publishing & SEO
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Apply-By Deadline (optional)
            </label>
            <input
              type="date"
              value={applyBy}
              onChange={(e) => setApplyBy(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <span className="text-xs font-bold text-[var(--color-ink)] block">
                  Mark as Featured Role
                </span>
                <span className="text-[11px] text-[var(--color-mute)]">
                  Pins this job to the top of careers search with an eye-catching badge
                </span>
              </div>
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                SEO Meta Title (optional)
              </label>
              <span className="text-[10px] font-mono text-[var(--color-mute)]">
                {seoTitle.length} / 70
              </span>
            </div>
            <input
              type="text"
              maxLength={70}
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="e.g. Careers | Heavy Machinery Mechanic in Delhi"
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                SEO Meta Description (optional)
              </label>
              <span className="text-[10px] font-mono text-[var(--color-mute)]">
                {seoDescription.length} / 160
              </span>
            </div>
            <input
              type="text"
              maxLength={160}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="e.g. Reach International is hiring experienced mechanics for Delhi operations..."
              className="w-full h-10 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)]"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-canvas-elevated)]/90 backdrop-blur-md border-t border-[var(--color-hairline)] py-3 px-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/hiring/jobs">
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave("draft")}
              loading={isPending}
              className="gap-2"
            >
              <AnimatedSave size={15} />
              <span>Save as Draft</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={triggerPublishModal}
              loading={isPending}
              className="gap-2"
            >
              <AnimatedCheck size={15} />
              <span>Publish Job</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Pre-publish Checklist Confirmation Modal */}
      {publishModalOpen && (
        <ConfirmationDialog
          isOpen={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          onConfirm={() => {
            setPublishModalOpen(false);
            handleSave("published");
          }}
          title="Ready to Publish this Role?"
          description={
            <div className="space-y-3 text-xs">
              <p className="text-[var(--color-body)]">
                Please verify the publication checklist before going live:
              </p>
              <ul className="space-y-1.5 pl-2">
                <li className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <AnimatedCheck size={14} /> Title: {title}
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <AnimatedCheck size={14} /> Department assigned
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <AnimatedCheck size={14} /> {responsibilities.filter(Boolean).length} responsibilities listed
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <AnimatedCheck size={14} /> {requirements.filter(Boolean).length} requirements listed
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <AnimatedCheck size={14} /> {city} location defined
                </li>
              </ul>
              <p className="text-[var(--color-mute)] text-[11px] pt-1 border-t border-[var(--color-hairline)]">
                Once published, this job will appear immediately on <code className="font-mono text-sky-600">reachinternational.co.in/careers/{slug}</code> and candidates will be able to submit applications.
              </p>
            </div>
          }
          variant="info"
          confirmLabel="Confirm & Publish"
        />
      )}
    </div>
  );
}
