"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  EnterpriseTable,
  Button,
  SearchBox,
  ExportButton,
  useToast,
  EmptyState,
  type ColumnDef,
} from "@/components/ui";
import {
  AnimatedUsers,
  AnimatedEye,
  AnimatedStar,
  AnimatedSearch,
  AnimatedDownload,
} from "@/components/ui/animated-icons";
import { ApplicationDetailDrawer } from "./ApplicationDetailDrawer";
import type { JobApplication, ApplicationStatus } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface JobOption {
  id: string;
  title: string;
  job_code: string;
}

interface ApplicationListClientProps {
  applications: JobApplication[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  jobs: JobOption[];
  userRole: string;
}

const PIPELINE_STATUSES: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Candidates" },
  { id: "new", label: "New" },
  { id: "screening", label: "Screening" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interview", label: "Interview" },
  { id: "offered", label: "Offered" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

export function ApplicationListClient({
  applications,
  total,
  page,
  pageSize,
  totalPages,
  jobs,
  userRole,
}: ApplicationListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentJobId = searchParams.get("job_id") || "";
  const currentRating = searchParams.get("rating") || "";

  // Drawer state
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

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

  // Export applications to CSV
  function handleExportCsv() {
    if (applications.length === 0) {
      toast("info", "No applications to export");
      return;
    }

    const headers = [
      "Application Code",
      "Candidate Name",
      "Email",
      "Phone",
      "City",
      "Experience (Yrs)",
      "Current CTC",
      "Expected CTC",
      "Notice Period",
      "Job Title",
      "Status",
      "Rating",
      "Applied Date",
    ];

    const rows = applications.map((app) => [
      `"${app.application_code}"`,
      `"${app.full_name.replace(/"/g, '""')}"`,
      `"${app.email}"`,
      `"${app.phone}"`,
      `"${app.current_city}"`,
      app.total_experience_yrs,
      app.current_ctc || "",
      app.expected_ctc || "",
      app.notice_period_days || "",
      `"${(app.job_title || "General").replace(/"/g, '""')}"`,
      app.status,
      app.rating || "",
      `"${new Date(app.created_at).toLocaleDateString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reach-applications-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${applications.length} applications to CSV`);
  }

  const columns: ColumnDef<JobApplication>[] = [
    {
      id: "candidate",
      header: "Candidate Name & Code",
      cell: (row: JobApplication) => (
        <div className="flex flex-col py-1">
          <button
            type="button"
            onClick={() => setSelectedApp(row)}
            className="text-xs font-bold text-left text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
          >
            {row.full_name}
          </button>
          <span className="text-[11px] font-mono text-[var(--color-mute)]">
            {row.application_code} • {row.current_city}
          </span>
        </div>
      ),
    },
    {
      id: "job",
      header: "Applied Role",
      cell: (row: JobApplication) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-[var(--color-ink)]">
            {row.job_title || "General Application"}
          </span>
          {row.job_code && (
            <span className="text-[11px] font-mono text-[var(--color-mute)]">{row.job_code}</span>
          )}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row: JobApplication) => (
        <div className="flex flex-col text-[11px] text-[var(--color-body)]">
          <span className="font-mono">+91 {row.phone}</span>
          <span className="text-[10px] text-[var(--color-mute)] truncate max-w-[150px]">
            {row.email}
          </span>
        </div>
      ),
    },
    {
      id: "experience",
      header: "Experience & CTC",
      cell: (row: JobApplication) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono font-semibold text-[var(--color-ink)]">
            {row.total_experience_yrs} Yrs
          </span>
          <span className="text-[11px] text-[var(--color-mute)] font-mono">
            {row.expected_ctc ? `Exp: ₹${row.expected_ctc.toLocaleString()}` : "CTC: Open"}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: JobApplication) => {
        const variants: Record<string, { label: string; bg: string; text: string }> = {
          new: { label: "New", bg: "bg-sky-500/10 border-sky-500/20", text: "text-sky-700 dark:text-sky-400" },
          screening: { label: "Screening", bg: "bg-purple-500/10 border-purple-500/20", text: "text-purple-700 dark:text-purple-400" },
          shortlisted: { label: "Shortlisted", bg: "bg-indigo-500/10 border-indigo-500/20", text: "text-indigo-700 dark:text-indigo-400" },
          interview: { label: "Interview", bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-700 dark:text-amber-400" },
          offered: { label: "Offered", bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
          hired: { label: "Hired", bg: "bg-emerald-600/15 border-emerald-600/30", text: "text-emerald-800 dark:text-emerald-300 font-bold" },
          rejected: { label: "Rejected", bg: "bg-red-500/10 border-red-500/20", text: "text-red-700 dark:text-red-400" },
          withdrawn: { label: "Withdrawn", bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-600 dark:text-zinc-400" },
        };
        const cfg = variants[row.status] || variants.new;
        return (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
              cfg.bg,
              cfg.text
            )}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      id: "rating",
      header: "Rating",
      cell: (row: JobApplication) => (
        <div className="flex items-center gap-0.5 text-amber-500">
          {row.rating ? (
            <>
              <AnimatedStar size={14} className="fill-amber-400" />
              <span className="text-xs font-mono font-bold ml-1">{row.rating}</span>
            </>
          ) : (
            <span className="text-[11px] text-[var(--color-mute)]">—</span>
          )}
        </div>
      ),
    },
    {
      id: "created_at",
      header: "Applied",
      cell: (row: JobApplication) => (
        <span className="text-[11px] text-[var(--color-mute)]">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: JobApplication) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedApp(row)}
          className="gap-1.5"
        >
          <AnimatedEye size={13} />
          <span>Review</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Pipeline status filter tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl overflow-x-auto max-w-full">
          {PIPELINE_STATUSES.map((tab) => {
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

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="gap-2"
        >
          <AnimatedDownload size={15} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[var(--color-canvas-elevated)] p-3 border border-[var(--color-hairline)] rounded-2xl shadow-2xs">
        <div className="flex-1">
          <SearchBox
            value={currentSearch}
            onChange={(val) => updateQuery("search", val)}
            placeholder="Search by name, email, phone, application code, city..."
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Job Filter */}
          <select
            value={currentJobId}
            onChange={(e) => updateQuery("job_id", e.target.value)}
            className="h-10 px-3 text-xs bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none"
          >
            <option value="">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.job_code})
              </option>
            ))}
          </select>

          {/* Rating filter */}
          <select
            value={currentRating}
            onChange={(e) => updateQuery("rating", e.target.value)}
            className="h-10 px-3 text-xs bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
          </select>
        </div>
      </div>

      {/* Main Table View */}
      {applications.length === 0 ? (
        <EmptyState
          icon={<AnimatedUsers size={28} />}
          title="No applications found"
          description={
            currentSearch || currentStatus !== "all" || currentJobId
              ? "Try adjusting your search criteria or status filter."
              : "Applications submitted on the public careers portal will appear here."
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <EnterpriseTable
              data={applications}
              columns={columns}
              loading={isPending}
            />
          </div>

          {/* Mobile Touch Cards View */}
          <div className="sm:hidden space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="p-4 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl shadow-2xs space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-[var(--color-ink)] block">
                      {app.full_name}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--color-mute)]">
                      {app.application_code} • {app.current_city}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-sky-500/10 text-sky-600 border border-sky-500/20">
                    {app.status}
                  </span>
                </div>

                <div className="text-xs text-[var(--color-body)] space-y-0.5">
                  <p className="font-semibold text-[var(--color-ink)]">
                    Role: {app.job_title || "General Application"}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--color-mute)]">
                    +91 {app.phone} • {app.total_experience_yrs} Yrs Exp
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--color-mute)]">
                    {new Date(app.created_at).toLocaleDateString()}
                  </span>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <AnimatedEye size={12} />
                    <span>Review</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Application Detail Drawer */}
      <ApplicationDetailDrawer
        application={selectedApp}
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        onUpdated={() => {
          router.refresh();
        }}
        userRole={userRole}
      />
    </div>
  );
}
