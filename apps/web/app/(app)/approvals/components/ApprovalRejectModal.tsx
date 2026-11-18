"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, AlertTriangle } from "lucide-react";

export interface ApprovalRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  requestSummary?: string;
  isSubmitting?: boolean;
}

export function ApprovalRejectModal({
  isOpen,
  onClose,
  onConfirm,
  requestSummary,
  isSubmitting = false,
}: ApprovalRejectModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason for rejecting this request.");
      return;
    }

    try {
      setError(null);
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-semibold text-base">
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <AlertTriangle size={18} />
            </div>
            <span id="reject-dialog-title">Reject Approval Request</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {requestSummary && (
            <p className="text-xs text-[var(--color-ink-muted)] bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-border)]">
              {requestSummary}
            </p>
          )}

          <div>
            <label
              htmlFor="rejection-reason"
              className="block text-xs font-medium text-[var(--color-ink)] mb-1.5"
            >
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              id="rejection-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Incomplete documentation, blurred document image, or incorrect phone number..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-ink-muted)] focus:outline-hidden focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all resize-none"
              disabled={isSubmitting}
              autoFocus
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
