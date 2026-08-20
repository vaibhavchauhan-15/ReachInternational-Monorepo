"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, RotateCcw, AlertCircle } from "lucide-react";
import { verifyTask } from "@/app/actions/tasks";
import type { Task } from "@servicecentric/types";

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

  return (
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

        {/* Task Completion Info */}
        <div className="p-3 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg space-y-1.5 text-xs text-[var(--color-body)]">
          <p><span className="text-[var(--color-mute)] font-medium">Completed By:</span> {task.completer?.full_name || "Employee"}</p>
          <p><span className="text-[var(--color-mute)] font-medium">Completed Date:</span> {task.completed_at ? new Date(task.completed_at).toLocaleString("en-GB") : "N/A"}</p>
          {task.completion_notes && (
            <p><span className="text-[var(--color-mute)] font-medium">Notes:</span> {task.completion_notes}</p>
          )}
        </div>

        {/* Decision Toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDecision("verify")}
            className={`p-3 rounded-lg border flex flex-col items-center justify-center text-xs font-semibold gap-1.5 transition-colors cursor-pointer ${
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
            className={`p-3 rounded-lg border flex flex-col items-center justify-center text-xs font-semibold gap-1.5 transition-colors cursor-pointer ${
              decision === "reopen"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            Reject & Reopen Task
          </button>
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
              placeholder="Explain why this task is being reopened and what needs to be fixed..."
              rows={3}
              required
              className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
