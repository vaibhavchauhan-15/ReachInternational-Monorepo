"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  EnterpriseTable,
  Button,
  SearchBox,
  ConfirmationDialog,
  useToast,
  EmptyState,
  type ColumnDef,
} from "@/components/ui";
import {
  AnimatedPlus,
  AnimatedSearch,
  AnimatedEdit,
  AnimatedCopy,
  AnimatedTrash2,
  AnimatedEye,
  AnimatedCheck,
  AnimatedX,
  AnimatedRotateCcw,
  AnimatedBriefcase,
} from "@/components/ui/animated-icons";
import {
  publishJobAction,
  unpublishJobAction,
  closeJobAction,
  reopenJobAction,
  duplicateJobAction,
  deleteJobAction,
  generateJobPreviewTokenAction,
} from "@/app/actions/hiring";
import type { JobPostingListItem, JobDepartment } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface JobListClientProps {
  jobs: JobPostingListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  departments: JobDepartment[];
  userRole: string;
}

const STATUS_TABS = [
  { id: "all", label: "All Roles" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "closed", label: "Closed" },
] as const;

export function JobListClient({
  jobs,
  total,
  page,
  pageSize,
  totalPages,
  departments,
  userRole,
}: JobListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentDept = searchParams.get("department") || "";

  // Modals state
  const [dialogTarget, setDialogTarget] = useState<{
    action: "publish" | "unpublish" | "close" | "reopen" | "duplicate" | "delete";
    job: JobPostingListItem;
  } | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  // Update query params helper
  function updateQuery(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  // Handle preview token generation
  async function handlePreview(jobId: string) {
    try {
      const res = await generateJobPreviewTokenAction(jobId);
      if (res.success && res.data?.url) {
        window.open(res.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast("error", res.error || "Failed to generate preview");
      }
    } catch {
      toast("error", "Error generating preview");
    }
  }

  // Handle confirmed modal action
  async function handleConfirmAction() {
    if (!dialogTarget) return;
    const { action, job } = dialogTarget;
    setLoadingAction(true);

    try {
      let res: any;
      if (action === "publish") {
        res = await publishJobAction(job.id);
      } else if (action === "unpublish") {
        res = await unpublishJobAction(job.id);
      } else if (action === "close") {
        res = await closeJobAction(job.id, closeReason || undefined);
      } else if (action === "reopen") {
        res = await reopenJobAction(job.id);
      } else if (action === "duplicate") {
        res = await duplicateJobAction(job.id);
      } else if (action === "delete") {
        res = await deleteJobAction(job.id);
      }

      if (res?.success) {
        toast("success", `Job ${action}ed successfully`);
        setDialogTarget(null);
        setCloseReason("");
        router.refresh();
      } else {
        toast("error", res?.error || `Failed to ${action} job`);
      }
    } catch (err: any) {
      toast("error", err?.message || `Failed to perform ${action}`);
    } finally {
      setLoadingAction(false);
    }
  }

  const columns: ColumnDef<JobPostingListItem>[] = [
    {
      id: "title",
      header: "Job Code & Title",
      cell: (row: JobPostingListItem) => (
        <div className="flex flex-col py-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/hiring/jobs/${row.id}`}
              className="text-xs font-bold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              {row.title}
            </Link>
            {row.is_featured && (
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Featured
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-[var(--color-mute)]">
            {row.job_code} • {row.city}
          </span>
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      cell: (row: JobPostingListItem) => (
        <span className="text-xs text-[var(--color-body)] font-medium">
          {row.department_name || "General"}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type & Workplace",
      cell: (row: JobPostingListItem) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--color-hairline-soft-surface)] text-[var(--color-body)] border border-[var(--color-hairline)] capitalize">
            {row.employment_type.replace("_", " ")}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border border-[var(--color-hairline)] capitalize">
            {row.workplace_type}
          </span>
        </div>
      ),
    },
    {
      id: "openings",
      header: "Openings",
      cell: (row: JobPostingListItem) => (
        <span className="text-xs font-mono font-semibold text-[var(--color-body)]">
          {row.openings}
        </span>
      ),
    },
    {
      id: "applications",
      header: "Applications",
      cell: (row: JobPostingListItem) => {
        const count = row.application_count || 0;
        return (
          <Link
            href={`/hiring/applications?job_id=${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <span className="font-mono">{count}</span>
            <span className="text-[10px]">apps</span>
          </Link>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (row: JobPostingListItem) => {
        const variants: Record<string, { label: string; bg: string; dot: string; text: string }> = {
          published: {
            label: "Published",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            dot: "bg-emerald-500",
            text: "text-emerald-700 dark:text-emerald-400",
          },
          draft: {
            label: "Draft",
            bg: "bg-amber-500/10 border-amber-500/20",
            dot: "bg-amber-500",
            text: "text-amber-700 dark:text-amber-400",
          },
          closed: {
            label: "Closed",
            bg: "bg-zinc-500/10 border-zinc-500/20",
            dot: "bg-zinc-400",
            text: "text-zinc-600 dark:text-zinc-400",
          },
          archived: {
            label: "Archived",
            bg: "bg-zinc-500/10 border-zinc-500/20",
            dot: "bg-zinc-400",
            text: "text-zinc-500",
          },
        };
        const cfg = variants[row.status] || variants.draft;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
              cfg.bg,
              cfg.text
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      id: "dates",
      header: "Apply By / Updated",
      cell: (row: JobPostingListItem) => (
        <div className="flex flex-col text-[11px] text-[var(--color-mute)]">
          {row.apply_by ? (
            <span>Apply by: {new Date(row.apply_by).toLocaleDateString()}</span>
          ) : (
            <span>No deadline</span>
          )}
          <span className="text-[10px]">
            {row.published_at ? `Pub: ${new Date(row.published_at).toLocaleDateString()}` : "Unpublished"}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: JobPostingListItem) => {
        const canManage = ["super_admin", "admin", "hr"].includes(userRole);
        return (
          <div className="flex items-center justify-end gap-1">
            {/* Preview draft or live view */}
            <button
              type="button"
              onClick={() => handlePreview(row.id)}
              title="Preview on site"
              className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-500/10 transition-colors"
            >
              <AnimatedEye size={15} />
            </button>

            {canManage && (
              <>
                <Link
                  href={`/hiring/jobs/${row.id}/edit`}
                  title="Edit Job"
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-500/10 transition-colors"
                >
                  <AnimatedEdit size={15} />
                </Link>

                {row.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => setDialogTarget({ action: "publish", job: row })}
                    title="Publish Job"
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                  >
                    <AnimatedCheck size={15} />
                  </button>
                )}

                {row.status === "published" && (
                  <button
                    type="button"
                    onClick={() => setDialogTarget({ action: "close", job: row })}
                    title="Close Job"
                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10 transition-colors"
                  >
                    <AnimatedX size={15} />
                  </button>
                )}

                {row.status === "closed" && (
                  <button
                    type="button"
                    onClick={() => setDialogTarget({ action: "reopen", job: row })}
                    title="Reopen Job"
                    className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-500/10 transition-colors"
                  >
                    <AnimatedRotateCcw size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDialogTarget({ action: "duplicate", job: row })}
                  title="Duplicate as new draft"
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
                >
                  <AnimatedCopy size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setDialogTarget({ action: "delete", job: row })}
                  title="Delete job"
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <AnimatedTrash2 size={15} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Controls: Status Tabs & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status segmented tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = currentStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateQuery("status", tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        {["super_admin", "admin", "hr"].includes(userRole) && (
          <Link href="/hiring/jobs/new">
            <Button variant="primary" size="sm" className="gap-2">
              <AnimatedPlus size={15} />
              <span>Post New Job</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[var(--color-canvas-elevated)] p-3 border border-[var(--color-hairline)] rounded-2xl shadow-2xs">
        <div className="flex-1">
          <SearchBox
            value={currentSearch}
            onChange={(val) => updateQuery("search", val)}
            placeholder="Search by title, job code, or city..."
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Department Select */}
          <select
            value={currentDept}
            onChange={(e) => updateQuery("department", e.target.value)}
            className="h-10 px-3 text-xs bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id.toString()}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table View */}
      {jobs.length === 0 ? (
        <EmptyState
          icon={<AnimatedBriefcase size={28} />}
          title="No job postings found"
          description={
            currentSearch || currentStatus !== "all" || currentDept
              ? "Try adjusting your search or filters to see more roles."
              : "Start by publishing your first open job posting."
          }
          action={
            ["super_admin", "admin", "hr"].includes(userRole) ? (
              <Link href="/hiring/jobs/new">
                <Button variant="primary" size="sm" className="gap-2">
                  <AnimatedPlus size={15} />
                  <span>Create Job Posting</span>
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Enterprise Table (≥641px) */}
          <div className="hidden sm:block">
            <EnterpriseTable
              data={jobs}
              columns={columns}
              loading={isPending}
            />
          </div>

          {/* Mobile Touch Cards (≤640px) */}
          <div className="sm:hidden space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/hiring/jobs/${job.id}`}
                      className="text-sm font-bold text-[var(--color-ink)] hover:text-sky-600 block"
                    >
                      {job.title}
                    </Link>
                    <span className="text-[11px] font-mono text-[var(--color-mute)]">
                      {job.job_code} • {job.city}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                      job.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : job.status === "draft"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                    )}
                  >
                    {job.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-[var(--color-body)] flex-wrap">
                  <span className="px-2 py-0.5 bg-[var(--color-hairline-soft-surface)] rounded-md capitalize">
                    {job.employment_type.replace("_", " ")}
                  </span>
                  <span className="px-2 py-0.5 bg-[var(--color-hairline-soft-surface)] rounded-md capitalize">
                    {job.workplace_type}
                  </span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {job.openings} opening{job.openings > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between text-xs">
                  <Link
                    href={`/hiring/applications?job_id=${job.id}`}
                    className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {job.application_count || 0} applications
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePreview(job.id)}
                      className="p-1.5 rounded-lg text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]"
                    >
                      <AnimatedEye size={16} />
                    </button>
                    {["super_admin", "admin", "hr"].includes(userRole) && (
                      <Link
                        href={`/hiring/jobs/${job.id}/edit`}
                        className="p-1.5 rounded-lg text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]"
                      >
                        <AnimatedEdit size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      {dialogTarget && (
        <ConfirmationDialog
          isOpen={Boolean(dialogTarget)}
          onClose={() => setDialogTarget(null)}
          onConfirm={handleConfirmAction}
          loading={loadingAction}
          title={
            dialogTarget.action === "publish"
              ? "Publish Job Posting?"
              : dialogTarget.action === "close"
              ? "Close Job Posting?"
              : dialogTarget.action === "reopen"
              ? "Reopen Job Posting?"
              : dialogTarget.action === "duplicate"
              ? "Duplicate Job Posting?"
              : "Delete Job Posting?"
          }
          description={
            <div className="space-y-3">
              <p>
                {dialogTarget.action === "publish" &&
                  `Are you sure you want to publish "${dialogTarget.job.title}"? It will become visible on the public careers portal immediately.`}
                {dialogTarget.action === "close" &&
                  `Closing "${dialogTarget.job.title}" will remove it from active listings and disable new applications.`}
                {dialogTarget.action === "reopen" &&
                  `Reopening "${dialogTarget.job.title}" will republish it on the public careers page.`}
                {dialogTarget.action === "duplicate" &&
                  `Create a new draft job based on "${dialogTarget.job.title}"?`}
                {dialogTarget.action === "delete" &&
                  `Are you sure you want to soft-delete "${dialogTarget.job.title}"? Existing applications will be preserved.`}
              </p>
              {dialogTarget.action === "close" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--color-body)] block mb-1">
                    Reason for closing (optional):
                  </label>
                  <input
                    type="text"
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="e.g. Position filled, hiring paused..."
                    className="w-full h-9 px-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)]"
                  />
                </div>
              )}
            </div>
          }
          variant={
            dialogTarget.action === "delete"
              ? "danger"
              : dialogTarget.action === "close"
              ? "warning"
              : "info"
          }
          confirmLabel={
            dialogTarget.action === "publish"
              ? "Publish Now"
              : dialogTarget.action === "close"
              ? "Close Job"
              : dialogTarget.action === "reopen"
              ? "Reopen"
              : dialogTarget.action === "duplicate"
              ? "Duplicate"
              : "Delete"
          }
        />
      )}
    </div>
  );
}
