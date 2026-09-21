"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  Trash2,
  Clock,
  RotateCcw,
  FileCheck,
  ChevronDown,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  submitAccountDeletionRequestAction,
  getMyPendingAccountDeletionRequestAction,
  cancelMyAccountDeletionRequestAction,
} from "@/app/actions/account-deletion";
import type { User as UserType } from "@/lib/types/database";

export interface PendingAccountDeletionRecord {
  id: string;
  user_id?: string | null;
  email?: string;
  full_name?: string;
  role?: string;
  reason?: string;
  source?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface DeleteAccountClientProps {
  currentUser: UserType | null;
  initialPendingRequest: PendingAccountDeletionRecord | null;
}

const COMMON_REASONS = [
  "Leaving organization / Change of employment",
  "No longer operating machinery or using platform",
  "Privacy & personal data minimization request",
  "Duplicate or test account cleanup",
  "Transferring to another branch or location",
  "Other operational reason",
];

export function DeleteAccountClient({
  currentUser,
  initialPendingRequest,
}: DeleteAccountClientProps) {
  const { toast } = useToast();

  const [pendingRequest, setPendingRequest] = useState<PendingAccountDeletionRecord | null>(initialPendingRequest);
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>(currentUser?.email || "");
  const [fullNameInput, setFullNameInput] = useState<string>(currentUser?.full_name || "");
  const [confirmedRisk, setConfirmedRisk] = useState<boolean>(false);

  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  // Refresh pending status on client mount
  useEffect(() => {
    if (!currentUser) return;
    getMyPendingAccountDeletionRequestAction()
      .then((req) => {
        if (req) setPendingRequest(req as PendingAccountDeletionRecord);
      })
      .catch(() => {});
  }, [currentUser]);

  const fullReason =
    selectedReasonOption === "Other operational reason"
      ? customReason.trim() || selectedReasonOption
      : customReason.trim()
      ? `${selectedReasonOption} — ${customReason.trim()}`
      : selectedReasonOption;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const targetEmail = currentUser?.email || emailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      toast("error", "Please provide a valid registered email address.");
      return;
    }

    if (!selectedReasonOption) {
      toast("error", "Please select a reason for account deletion from the dropdown.");
      return;
    }

    if (!confirmedRisk) {
      toast("error", "You must confirm that your account will be permanently deleted and cannot be restored.");
      return;
    }

    startSubmitTransition(async () => {
      const res = await submitAccountDeletionRequestAction({
        email: targetEmail,
        fullName: currentUser?.full_name || fullNameInput.trim() || undefined,
        reason: fullReason,
        source: "web",
      });

      if (res.success) {
        toast("success", "Your account deletion request has been submitted to company administrators.");
        setPendingRequest({
          id: res.requestId || "req_pending",
          created_at: new Date().toISOString(),
          reason: fullReason,
          status: "pending",
        });
        setCustomReason("");
      } else {
        toast("error", res.error || "Unable to submit deletion request. Please try again.");
      }
    });
  };

  const handleCancelRequest = () => {
    if (!pendingRequest?.id) return;
    startCancelTransition(async () => {
      const res = await cancelMyAccountDeletionRequestAction(pendingRequest.id);
      if (res.success) {
        toast("success", "Account deletion request has been withdrawn.");
        setPendingRequest(null);
      } else {
        toast("error", res.error || "Unable to withdraw request. Please try again.");
      }
    });
  };

  const isDeleteDisabled = isSubmitting || !confirmedRisk || !selectedReasonOption;

  return (
    <div className="space-y-5 select-none">
      {/* Main Card */}
      <section className="p-4 sm:p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-ink)] leading-tight">
            Permanent Account Deletion
          </h2>
          <p className="text-xs text-[var(--color-mute)] leading-normal mt-0.5">
            Submit an official request to permanently erase your profile and identity credentials.
          </p>
        </div>

        <p className="text-xs text-[var(--color-body)] leading-relaxed">
          Before submitting your request, please review our{" "}
          <Link
            href="/account-deletion-guide"
            className="text-[#0070f3] dark:text-sky-400 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Account Deletion Guide &amp; Warnings
          </Link>{" "}
          for detailed data erasure policies and statutory machinery records retention rules.
        </p>

        <div className="h-px bg-[var(--color-hairline)]" />

        {pendingRequest ? (
          /* ==================================================================== */
          /* VIEW 1: ACTIVE PENDING REQUEST STATUS */
          /* ==================================================================== */
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
                <Clock size={16} className="shrink-0" />
                <span>Deletion Request Pending Administrator Review</span>
              </div>
              <p className="text-xs text-[var(--color-body)] leading-relaxed">
                Your account deletion request has been submitted. Company administrators will review and execute the permanent purge within <strong>14 business days</strong>.
              </p>
              {pendingRequest.reason && (
                <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs mt-2">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Stated Reason: </span>
                  <span className="italic text-[var(--color-body)]">&quot;{pendingRequest.reason}&quot;</span>
                </div>
              )}
            </div>

            {/* Retention Note */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-[var(--color-ink)]">
                <FileCheck size={14} className="text-sky-600 dark:text-sky-400" />
                <span>Statutory Industrial Machinery Records Retention</span>
              </div>
              <p className="text-[var(--color-mute)] leading-relaxed">
                As required by the Indian Factories Act (1948) and equipment safety regulations, historical machinery running hours (HMR) and breakdown logs are decoupled and retained anonymously under machine asset codes. Review our{" "}
                <Link
                  href="/account-deletion-guide"
                  className="text-[#0070f3] dark:text-sky-400 font-semibold underline"
                >
                  Account Deletion Guide
                </Link>{" "}
                for full details.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleCancelRequest}
                loading={isCancelling}
                disabled={isCancelling}
                icon={<RotateCcw size={14} />}
                className="text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold text-xs"
              >
                Withdraw Deletion Request
              </Button>

              <Link
                href="/settings"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] hover:bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] transition-colors shadow-2xs"
              >
                Return to Settings
              </Link>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* VIEW 2: NEW DELETION REQUEST FORM */
          /* ==================================================================== */
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

            {/* Account Details */}
            {currentUser ? (
              <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)] block">
                  Account To Be Deactivated
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">Staff Name</span>
                    <span className="font-bold text-[var(--color-ink)]">{currentUser.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">Registered Email</span>
                    <span className="font-mono text-[var(--color-ink)]">{currentUser.email}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">System Role</span>
                    <span className="capitalize text-[var(--color-ink)] font-semibold">
                      {currentUser.role?.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">Registered Phone</span>
                    <span className="font-mono text-[var(--color-ink)]">
                      {currentUser.phone ? (currentUser.phone.startsWith("+") ? currentUser.phone : `+91 ${currentUser.phone}`) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)] block">
                  Unauthenticated Deletion Request
                </span>
                <p className="text-xs text-[var(--color-mute)]">
                  If you cannot sign in, enter your registered email address below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="user-email" className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                      Registered Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. user@reachinternational.co.in"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/30 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-name" className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                      Full Legal Name
                    </label>
                    <input
                      id="user-name"
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/30 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dropdown Selector for Reason */}
            <div className="space-y-2">
              <label htmlFor="deletion-reason" className="block text-xs font-bold text-[var(--color-ink)]">
                Reason for Account Deletion <span className="text-rose-500">*</span>
              </label>

              <div className="relative">
                <select
                  id="deletion-reason"
                  required
                  value={selectedReasonOption}
                  onChange={(e) => setSelectedReasonOption(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] font-medium focus:outline-none focus:ring-2 focus:ring-[#0070f3]/30 transition-all cursor-pointer pr-10"
                >
                  <option value="" disabled>
                    Select a reason for deletion...
                  </option>
                  {COMMON_REASONS.map((reasonOpt) => (
                    <option key={reasonOpt} value={reasonOpt}>
                      {reasonOpt}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none"
                />
              </div>

              {/* Additional Context Field */}
              <div className="pt-1">
                <label htmlFor="additional-remarks" className="block text-[11px] font-semibold text-[var(--color-mute)] mb-1">
                  Additional Notes or Remarks (Optional)
                </label>
                <textarea
                  id="additional-remarks"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={2}
                  placeholder="Provide any additional comments regarding your deletion request..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/30 transition-all resize-none"
                />
              </div>
            </div>

            {/* Mandatory Acknowledgement Checkbox */}
            <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.04]">
              <label htmlFor="confirm-deletion" className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  id="confirm-deletion"
                  type="checkbox"
                  required
                  checked={confirmedRisk}
                  onChange={(e) => setConfirmedRisk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500/30 cursor-pointer shrink-0"
                />
                <span className="text-xs text-[var(--color-ink)] leading-relaxed font-medium">
                  I understand that my account and personal data will be permanently deleted and cannot be restored under any circumstance.
                </span>
              </label>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Link
                href="/settings"
                className="w-full sm:w-auto h-10 px-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] transition-colors flex items-center justify-center shadow-2xs"
              >
                Cancel & Return to Settings
              </Link>

              <Button
                type="submit"
                variant="danger"
                size="md"
                loading={isSubmitting}
                disabled={isDeleteDisabled}
                icon={<Trash2 size={15} />}
                className="w-full sm:w-auto h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs"
              >
                Submit Deletion Request
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
