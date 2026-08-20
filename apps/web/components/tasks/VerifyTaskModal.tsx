"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, RotateCcw, AlertCircle, Camera, Paperclip, ExternalLink, Eye, X } from "lucide-react";
import { verifyTask } from "@/app/actions/tasks";
import type { Task, TaskAttachment } from "@reachinternational/types";

interface VerifyTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSuccess?: () => void;
}

export function VerifyTaskModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: VerifyTaskModalProps) {
  const [decision, setDecision] = useState<"verify" | "reopen">("verify");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Lightbox modal state for viewing uploaded proof image full-size
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await verifyTask(task.id, decision, reason);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to submit verification decision");
    }
  };

  const attachments: TaskAttachment[] = task.attachments || [];
  const proofAttachments = attachments.filter((att) => att.file_type === "completion_proof" || attachments.length === 1);
  const displayAttachments = proofAttachments.length > 0 ? proofAttachments : attachments;

  const isImageFile = (url: string) => {
    return (
      url.startsWith("data:image/") ||
      /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url) ||
      url.includes("completion_proof") ||
      url.includes("proof")
    );
  };

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title={`Verify Completion — Task #${task.task_no}`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="secondary" onClick={onClose} loading={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              loading={loading}
              variant={decision === "verify" ? "primary" : "secondary"}
            >
              {loading ? "Processing..." : decision === "verify" ? "Approve & Verify Task" : "Reopen Task for Revision"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-[var(--color-ink)]">
          {errorMsg && (
            <div className="p-3 text-sm text-rose-600 dark:text-rose-400 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Task Completion Summary */}
          <div className="p-3 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl space-y-1.5 text-xs text-[var(--color-body)]">
            <p className="font-semibold text-[var(--color-ink)] text-sm">{task.title}</p>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-hairline)]">
              <p><span className="text-[var(--color-mute)] font-medium">Completed By:</span> <span className="font-semibold text-[var(--color-ink)]">{task.completer?.full_name || "Employee"}</span></p>
              <p><span className="text-[var(--color-mute)] font-medium">Completed Date:</span> {task.completed_at ? new Date(task.completed_at).toLocaleString("en-GB") : "N/A"}</p>
            </div>
            {task.completion_notes && (
              <p className="pt-1"><span className="text-[var(--color-mute)] font-medium">Completion Remarks:</span> <span className="italic text-[var(--color-ink)]">"{task.completion_notes}"</span></p>
            )}
          </div>

          {/* Uploaded Proof Images Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[var(--color-link)]" /> Uploaded Proof Image(s) / Completion Attachments ({displayAttachments.length})
            </label>

            {displayAttachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayAttachments.map((att) => {
                  const isImg = isImageFile(att.file_url);

                  return (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-2 hover:border-[var(--color-link)]/40 transition-all group"
                    >
                      {isImg ? (
                        <div
                          onClick={() => setActiveLightboxImage(att.file_url)}
                          className="relative h-40 w-full rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 border border-[var(--color-hairline)] cursor-pointer group/img"
                        >
                          {/* eslint-disable-next-html-element-suppression */}
                          <img
                            src={att.file_url}
                            alt={att.file_name}
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                            <Eye className="w-4 h-4" /> Click to Zoom
                          </div>
                          <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500 text-white shadow-xs">
                            Proof Photo
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs text-[var(--color-link)] font-medium">
                          <Paperclip className="w-4 h-4 text-purple-500 shrink-0" />
                          <span className="truncate flex-1">{att.file_name}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-[var(--color-mute)] truncate max-w-[170px]">{att.file_name}</span>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-link)] font-semibold hover:underline flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" /> Open Link
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">No proof image uploaded by employee.</p>
                  <p className="text-[11px] opacity-80">You can still approve the task based on completion notes, or reopen it to request photo evidence.</p>
                </div>
              </div>
            )}
          </div>

          {/* Decision Toggle */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Verification Decision
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision("verify")}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-semibold gap-1.5 transition-colors cursor-pointer ${
                  decision === "verify"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Approve & Verify
              </button>

              <button
                type="button"
                onClick={() => setDecision("reopen")}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-semibold gap-1.5 transition-colors cursor-pointer ${
                  decision === "reopen"
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]"
                }`}
              >
                <RotateCcw className="w-5 h-5" />
                Reject & Reopen Task
              </button>
            </div>
          </div>

          {/* Reopen Reason */}
          {decision === "reopen" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
                Revision Reason / Feedback for Employee <span className="text-amber-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this task is being reopened (e.g. please upload clear proof image)..."
                rows={3}
                required
                className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Lightbox Image Preview Dialog */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 border-b border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[var(--color-link)]" /> Uploaded Proof Image — Task #{task.task_no}
              </span>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="p-1 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-black/40">
              <img
                src={activeLightboxImage}
                alt="Uploaded Proof Full View"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

