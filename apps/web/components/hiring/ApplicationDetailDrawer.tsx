"use client";

import { useState, useTransition } from "react";
import { Drawer, Button, useToast, ConfirmationDialog } from "@/components/ui";
import {
  AnimatedX,
  AnimatedEye,
  AnimatedDownload,
  AnimatedCheck,
  AnimatedStar,
  AnimatedTrash2,
  AnimatedSave,
} from "@/components/ui/animated-icons";
import {
  updateApplicationStatusAction,
  rateApplicationAction,
  saveApplicationNotesAction,
  getApplicationResumeUrlAction,
  deleteApplicationAction,
} from "@/app/actions/hiring";
import type { JobApplication, ApplicationStatus } from "@reachinternational/types";
import { cn } from "@/lib/utils";

interface ApplicationDetailDrawerProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  userRole?: string;
}

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "new", label: "New Application" },
  { value: "screening", label: "Screening" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function ApplicationDetailDrawer({
  application,
  isOpen,
  onClose,
  onUpdated,
  userRole = "admin",
}: ApplicationDetailDrawerProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [currentStatus, setCurrentStatus] = useState<ApplicationStatus>(
    application?.status || "new"
  );
  const [rating, setRating] = useState<number | null>(application?.rating ?? null);
  const [notes, setNotes] = useState(application?.hr_notes || "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  // Sync state when application changes
  if (application && application.status !== currentStatus && !isPending) {
    setCurrentStatus(application.status);
    setRating(application.rating);
    setNotes(application.hr_notes || "");
  }

  if (!application) return null;

  async function handleStatusChange(newStatus: ApplicationStatus) {
    if (newStatus === "rejected") {
      setShowRejectInput(true);
      return;
    }

    startTransition(async () => {
      const res = await updateApplicationStatusAction(application!.id, newStatus);
      if (res.success) {
        setCurrentStatus(newStatus);
        toast("success", `Status updated to ${newStatus}`);
        onUpdated?.();
      } else {
        toast("error", res.error || "Failed to update status");
      }
    });
  }

  async function handleConfirmReject() {
    startTransition(async () => {
      const res = await updateApplicationStatusAction(
        application!.id,
        "rejected",
        rejectionReason || undefined
      );
      if (res.success) {
        setCurrentStatus("rejected");
        setShowRejectInput(false);
        setRejectionReason("");
        toast("success", "Application marked as rejected");
        onUpdated?.();
      } else {
        toast("error", res.error || "Failed to update status");
      }
    });
  }

  async function handleRatingChange(stars: number) {
    const newRating = rating === stars ? null : stars;
    startTransition(async () => {
      const res = await rateApplicationAction(application!.id, newRating);
      if (res.success) {
        setRating(newRating);
        toast("success", newRating ? `Rated ${newRating} stars` : "Rating cleared");
        onUpdated?.();
      } else {
        toast("error", res.error || "Failed to save rating");
      }
    });
  }

  async function handleSaveNotes() {
    startTransition(async () => {
      const res = await saveApplicationNotesAction(application!.id, notes);
      if (res.success) {
        toast("success", "HR notes saved");
        onUpdated?.();
      } else {
        toast("error", res.error || "Failed to save notes");
      }
    });
  }

  async function handleViewResume() {
    setResumeLoading(true);
    try {
      const res = await getApplicationResumeUrlAction(application!.id);
      if (res.success && res.data?.signedUrl) {
        window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        toast("error", res.error || "Unable to retrieve resume link");
      }
    } catch {
      toast("error", "Error requesting resume URL");
    } finally {
      setResumeLoading(false);
    }
  }

  async function handleDeleteApplication() {
    startTransition(async () => {
      const res = await deleteApplicationAction(application!.id);
      if (res.success) {
        toast("success", "Application soft-deleted");
        setDeleteConfirmOpen(false);
        onClose();
        onUpdated?.();
      } else {
        toast("error", res.error || "Failed to delete application");
      }
    });
  }

  return (
    <>
      <Drawer open={isOpen} onClose={onClose} position="right" size="lg">
        <div className="flex flex-col h-full bg-[var(--color-canvas-elevated)] select-none">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-ink)]">
                  {application.full_name}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)]">
                  {application.application_code}
                </span>
              </div>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Applied for: <span className="font-semibold text-[var(--color-ink)]">{application.job_title || "General Application"}</span> {application.job_code && `(${application.job_code})`}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors"
            >
              <AnimatedX size={18} />
            </button>
          </div>

          {/* Quick Action Bar: Status & Rating */}
          <div className="p-4 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-body)]">Status:</span>
              <select
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                disabled={isPending}
                className="h-8 px-2.5 text-xs font-semibold bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] focus:outline-none"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-body)] mr-1">Rating:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingChange(star)}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    (rating ?? 0) >= star
                      ? "text-amber-500 hover:text-amber-600"
                      : "text-zinc-300 dark:text-zinc-700 hover:text-amber-400"
                  )}
                  title={`Rate ${star} star`}
                >
                  <AnimatedStar size={18} className={cn((rating ?? 0) >= star && "fill-amber-400")} />
                </button>
              ))}
            </div>
          </div>

          {/* Rejection reason prompt */}
          {showRejectInput && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/20 space-y-2">
              <label className="text-xs font-bold text-red-600 dark:text-red-400 block">
                Provide rejection note (optional):
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Lacks required heavy hydraulic experience"
                className="w-full h-8 px-3 text-xs bg-[var(--color-canvas)] border border-red-500/30 rounded-lg text-[var(--color-ink)]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRejectInput(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleConfirmReject}
                  loading={isPending}
                >
                  Reject Candidate
                </Button>
              </div>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Contact & Location Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
                Contact & Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Email</span>
                  <a
                    href={`mailto:${application.email}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-sky-600 underline"
                  >
                    {application.email}
                  </a>
                </div>
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Phone</span>
                  <a
                    href={`tel:${application.phone}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-sky-600 underline font-mono"
                  >
                    +91 {application.phone}
                  </a>
                </div>
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Current City</span>
                  <span className="font-semibold text-[var(--color-ink)]">{application.current_city}</span>
                </div>
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Experience</span>
                  <span className="font-semibold text-[var(--color-ink)] font-mono">
                    {application.total_experience_yrs} Year{application.total_experience_yrs === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Current / Expected CTC</span>
                  <span className="font-semibold text-[var(--color-ink)] font-mono">
                    {application.current_ctc ? `₹${application.current_ctc.toLocaleString()}` : "—"} /{" "}
                    {application.expected_ctc ? `₹${application.expected_ctc.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="p-3 bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] rounded-xl">
                  <span className="text-[11px] text-[var(--color-mute)] block">Notice Period</span>
                  <span className="font-semibold text-[var(--color-ink)] font-mono">
                    {application.notice_period_days != null
                      ? `${application.notice_period_days} Days`
                      : "Immediate"}
                  </span>
                </div>
              </div>
            </div>

            {/* Resume Document Card */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
                Resume Document
              </h3>
              <div className="p-4 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[var(--color-ink)] truncate block">
                    {application.resume_file_name}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--color-mute)]">
                    {(application.resume_size_bytes / 1024 / 1024).toFixed(2)} MB • {application.resume_mime}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleViewResume}
                  loading={resumeLoading}
                  className="gap-2 shrink-0"
                >
                  <AnimatedEye size={15} />
                  <span>View Resume</span>
                </Button>
              </div>
            </div>

            {/* Candidate Cover Note */}
            {application.cover_note && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
                  Candidate Note
                </h3>
                <div className="p-3 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-body)] leading-relaxed whitespace-pre-wrap">
                  {application.cover_note}
                </div>
              </div>
            )}

            {/* Internal HR Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-mute)]">
                  Internal HR Notes
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNotes}
                  loading={isPending}
                  className="gap-1.5"
                >
                  <AnimatedSave size={13} />
                  <span>Save Notes</span>
                </Button>
              </div>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add confidential notes on candidate background, screening results, interview feedback..."
                className="w-full p-3 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            {/* Application Meta & Consent */}
            <div className="p-3 bg-[var(--color-hairline-soft-surface)]/30 border border-[var(--color-hairline)] rounded-xl space-y-1 text-[11px] text-[var(--color-mute)]">
              <div>Source: <span className="font-semibold text-[var(--color-body)]">{application.source}</span></div>
              <div>Submitted at: <span className="font-mono">{new Date(application.created_at).toLocaleString()}</span></div>
              <div>Privacy Consent: <span className="text-emerald-600 font-semibold">Granted (v{application.consent_version})</span></div>
            </div>
          </div>

          {/* Footer Delete */}
          {["super_admin", "admin", "hr"].includes(userRole) && (
            <div className="p-4 border-t border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-red-600 hover:bg-red-500/10 gap-2"
              >
                <AnimatedTrash2 size={15} />
                <span>Delete Application</span>
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {/* Delete Confirmation */}
      {deleteConfirmOpen && (
        <ConfirmationDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteApplication}
          title="Delete Application?"
          description={`Are you sure you want to soft-delete the application from ${application.full_name}?`}
          variant="danger"
          confirmLabel="Delete"
        />
      )}
    </>
  );
}
