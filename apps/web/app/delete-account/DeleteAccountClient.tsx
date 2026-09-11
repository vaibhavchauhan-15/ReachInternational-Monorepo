"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  FileCheck,
  Building,
  User,
  Phone,
  Mail,
  ArrowLeft,
  Info,
  Check,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  submitAccountDeletionRequestAction,
  getMyPendingAccountDeletionRequestAction,
  cancelMyAccountDeletionRequestAction,
} from "@/app/actions/account-deletion";
import type { User as UserType } from "@/lib/types/database";

interface DeleteAccountClientProps {
  currentUser: UserType | null;
  initialPendingRequest: any | null;
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
  const router = useRouter();
  const { toast } = useToast();

  const [pendingRequest, setPendingRequest] = useState<any | null>(initialPendingRequest);
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>(COMMON_REASONS[0]);
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
        if (req) setPendingRequest(req);
      })
      .catch(() => {});
  }, [currentUser]);

  const fullReason =
    selectedReasonOption === "Other operational reason"
      ? customReason.trim()
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

    if (!confirmedRisk) {
      toast("error", "Please confirm that you understand the data deletion and retention policy.");
      return;
    }

    if (!fullReason) {
      toast("error", "Please select or provide a reason for requesting deletion.");
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
          id: res.requestId,
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
        toast("success", "Your account deletion request has been withdrawn.");
        setPendingRequest(null);
      } else {
        toast("error", res.error || "Unable to cancel deletion request. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb / Return Links */}
      <div className="flex items-center justify-between text-xs text-[var(--color-mute)]">
        <Link
          href={currentUser?.role === "operator" ? "/operations?tab=entry" : "/machines"}
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-ink)] transition-colors font-medium"
        >
          <ArrowLeft size={13} />
          <span>Return to Dashboard</span>
        </Link>

        <Link
          href="/account-deletion"
          className="inline-flex items-center gap-1.5 text-[#0070f3] dark:text-sky-400 hover:underline font-semibold"
        >
          <Info size={13} />
          <span>Read Deletion Policy & Guide</span>
        </Link>
      </div>

      {/* Main Container Card */}
      <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-6">
        {/* Header Title */}
        <div className="flex items-start gap-3.5 pb-5 border-b border-[var(--color-hairline)]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
            <Trash2 size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--color-ink)] tracking-tight">
              Delete Account & Personal Data
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-mute)] mt-1">
              Submit a verified request to permanently deactivate your account and erase personal identity records.
            </p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* VIEW 1: REQUEST ALREADY PENDING */}
        {/* ==================================================================== */}
        {pendingRequest ? (
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-sm">
                  <Clock size={16} />
                  <span>Deletion Request Currently Pending</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Pending Admin Approval
                </span>
              </div>

              <p className="text-xs leading-relaxed text-[var(--color-body)]">
                You have an active account deletion request submitted on{" "}
                <strong>
                  {new Date(pendingRequest.created_at || Date.now()).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                . Company administrators are reviewing your request. Upon approval, your account credentials and personal KYC identity will be purged.
              </p>

              {pendingRequest.reason && (
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">Stated Reason: </span>
                  <span className="italic text-[var(--color-body)]">"{pendingRequest.reason}"</span>
                </div>
              )}
            </div>

            {/* Retention Explainer */}
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-ink)]">
                <FileCheck size={15} className="text-sky-600 dark:text-sky-400" />
                <span>Statutory Industrial Heavy Machinery Retention</span>
              </div>
              <p className="text-xs text-[var(--color-mute)] leading-relaxed">
                In strict adherence to the Indian Factories Act (1948) and equipment insurance regulations, historical machinery running hour meter readings (HMR), breakdown timestamps, and equipment safety checklists are permanently retained under technical machine asset codes.
              </p>
            </div>

            {/* Actions: Withdraw or Go Home */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleCancelRequest}
                loading={isCancelling}
                disabled={isCancelling}
                icon={<RotateCcw size={14} />}
                className="text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
              >
                Withdraw Deletion Request
              </Button>

              <Link
                href={currentUser?.role === "operator" ? "/operations?tab=entry" : "/machines"}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] hover:bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] transition-colors shadow-2xs"
              >
                Return to Fleet Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* VIEW 2: NEW DELETION REQUEST FORM */
          /* ==================================================================== */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Warning Banner */}
            <div className="p-4 sm:p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 text-xs sm:text-sm">
                <ShieldAlert size={16} />
                <span>What Happens When You Request Deletion?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-[var(--color-body)] leading-relaxed ml-1">
                <li>
                  Your user login session will be terminated and credentials <strong>permanently deactivated</strong> upon administrator approval.
                </li>
                <li>
                  Personal identity records (masked Aadhaar, Driving Licence, personal phone number) will be <strong>permanently erased</strong>.
                </li>
                <li>
                  Historical industrial machinery operational logs (Hour Meter Readings, breakdown duration records) will be <strong>retained in an anonymized archive</strong> as mandated by statutory Indian heavy equipment legislation.
                </li>
              </ul>
            </div>

            {/* Account Details Card */}
            {currentUser ? (
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  Account To Be Deactivated
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
              <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  Unauthenticated Deletion Request
                </span>
                <p className="text-xs text-[var(--color-mute)]">
                  If you cannot log into your account, enter your registered email address below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                      Registered Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. user@reachinternational.co.in"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/30 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                      Full Legal Name
                    </label>
                    <input
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

            {/* Reason Selection Chips & Textarea */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[var(--color-ink)]">
                Reason for Account Deletion <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMMON_REASONS.map((reasonOpt) => {
                  const isSelected = selectedReasonOption === reasonOpt;
                  return (
                    <button
                      key={reasonOpt}
                      type="button"
                      onClick={() => setSelectedReasonOption(reasonOpt)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-body)] hover:border-slate-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <span className="truncate">{reasonOpt}</span>
                      {isSelected && <Check size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Additional Context Field */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-[var(--color-mute)] mb-1">
                  Additional Notes or Remarks (Optional)
                </label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  placeholder="Provide any additional comments or specifics regarding your departure or deletion request..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all resize-none"
                />
              </div>
            </div>

            {/* Mandatory Acknowledgement Checkbox */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedRisk}
                  onChange={(e) => setConfirmedRisk(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer shrink-0"
                />
                <span className="text-xs text-[var(--color-body)] leading-relaxed">
                  I understand that submitting this request initiates permanent account deactivation. Once approved by company administrators, my login access will be revoked and my personal KYC identity records will be permanently erased.
                </span>
              </label>
            </div>

            {/* Submit Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Link
                href={currentUser?.role === "operator" ? "/operations?tab=entry" : "/machines"}
                className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] transition-colors shadow-2xs"
              >
                Cancel & Return
              </Link>

              <Button
                type="submit"
                variant="danger"
                size="md"
                loading={isSubmitting}
                disabled={isSubmitting || !confirmedRisk}
                icon={<Trash2 size={15} />}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 shadow-xs"
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
