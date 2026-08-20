"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertCircle, Paperclip } from "lucide-react";
import { updateTaskStatus } from "@/app/actions/tasks";
import type { Task } from "@servicecentric/types";

interface CompleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSuccess?: () => void;
}

export function CompleteTaskModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: CompleteTaskModalProps) {
  const [notes, setNotes] = useState("");
  const [proofUrlInput, setProofUrlInput] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const addProofUrl = () => {
    if (!proofUrlInput.trim()) return;
    setProofUrls((prev) => [...prev, proofUrlInput.trim()]);
    setProofUrlInput("");
  };

  const removeProofUrl = (index: number) => {
    setProofUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await updateTaskStatus(task.id, "completed", notes, proofUrls);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to mark task as completed");
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Mark Complete — #${task.task_no}`}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose} loading={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={loading} variant="primary">
            {loading ? "Submitting..." : "Submit Completion"}
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

        {/* Completion Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
            Completion Notes / Remarks
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe work completed, outcome, or notes for your manager..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
          />
        </div>

        {/* Completion Proof Attachment */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" /> Completion Proof URL (Photo / Document)
          </label>
          <div className="flex gap-2">
            <Input
              value={proofUrlInput}
              onChange={(e) => setProofUrlInput(e.target.value)}
              placeholder="https://example.com/proof.jpg"
            />
            <Button type="button" variant="secondary" onClick={addProofUrl}>
              Add
            </Button>
          </div>
          {proofUrls.length > 0 && (
            <div className="mt-2 space-y-1">
              {proofUrls.map((url, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-[var(--color-canvas-elevated)] rounded border border-[var(--color-hairline)]">
                  <span className="truncate max-w-[280px] text-[var(--color-link)]">{url}</span>
                  <button type="button" onClick={() => removeProofUrl(idx)} className="text-rose-500 hover:underline">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
