"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { X, CheckCheck, AlertCircle, Loader2 } from "lucide-react";

export interface ApproveAllConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
  typeLabel?: string;
  isSubmitting?: boolean;
}

export function ApproveAllConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  count,
  typeLabel,
  isSubmitting = false,
}: ApproveAllConfirmModalProps) {
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-all-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-base">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCheck size={18} />
            </div>
            <span id="approve-all-dialog-title">Approve All Pending Requests</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-ink)]">
                Scope of Bulk Approval:
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {count} {count === 1 ? "Request" : "Requests"} {typeLabel ? `(${typeLabel})` : ""}
              </span>
            </div>
            <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed">
              All selected pending registrations will be approved immediately and user profiles will be activated.
            </p>
          </div>

          {/* Statutory Documents Rule Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-amber-800 dark:text-amber-200 block">
                Statutory Documents Remain Pending
              </span>
              <p className="text-amber-700 dark:text-amber-300 leading-relaxed text-[11px]">
                All attached user documents (Aadhaar, Driving License, Bank Details) will remain in <strong>pending</strong> verification status. Only the user accounts will be activated. Documents can be reviewed and verified individually at any time.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-border)]">
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
              size="sm"
              disabled={isSubmitting || count === 0}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-transparent"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  <span>Approving All...</span>
                </>
              ) : (
                <>
                  <CheckCheck size={14} className="mr-1.5" />
                  <span>Confirm &amp; Approve All</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
