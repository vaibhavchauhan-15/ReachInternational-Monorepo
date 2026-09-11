"use client";

import React, { useState, useTransition } from "react";
import { submitAccountDeletionRequestAction } from "@/app/actions/account-deletion";
import { CheckCircle2, AlertTriangle, Globe, Loader2, ShieldCheck } from "lucide-react";

interface AccountDeletionWebFormProps {
  initialEmail?: string;
  initialName?: string;
  isAuthenticated?: boolean;
}

export function AccountDeletionWebForm({
  initialEmail = "",
  initialName = "",
  isAuthenticated = false,
}: AccountDeletionWebFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState(initialName);
  const [reasonCategory, setReasonCategory] = useState("Leaving organization / Change of employment");
  const [customReason, setCustomReason] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; requestId?: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setStatus({ type: "error", message: "Please enter a valid registered email address." });
      return;
    }

    if (confirmationInput.trim().toUpperCase() !== "DELETE") {
      setStatus({ type: "error", message: 'Please type "DELETE" in the confirmation box to authorize this request.' });
      return;
    }

    const compiledReason = customReason.trim()
      ? `${reasonCategory}: ${customReason.trim()}`
      : reasonCategory;

    startTransition(async () => {
      const res = await submitAccountDeletionRequestAction({
        email: cleanEmail,
        fullName: fullName.trim() || undefined,
        reason: compiledReason,
        source: "web",
      });

      if (res.success) {
        setStatus({
          type: "success",
          message: res.message || "Your account deletion request has been registered with our compliance desk.",
          requestId: res.requestId,
        });
        setConfirmationInput("");
      } else {
        setStatus({
          type: "error",
          message: res.error || "Failed to submit deletion request. Please try again or contact info@reachinternational.co.in.",
        });
      }
    });
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--color-ink)]">
          <Globe className="w-4 h-4 text-[var(--color-link)]" />
          <span>Method 1: Direct Web Request Portal (Self-Serve)</span>
        </div>
        {isAuthenticated && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            Authenticated User
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--color-body)] leading-relaxed">
        Submit a verified account deletion request directly through this portal without needing access to the mobile application.
      </p>

      {status?.type === "success" ? (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Deletion Request Submitted Successfully</span>
          </div>
          <p className="text-xs text-[var(--color-body)] leading-relaxed">
            {status.message}
          </p>
          {status.requestId && (
            <p className="text-[11px] font-mono text-[var(--color-mute)] bg-[var(--color-canvas-elevated)] p-2 rounded-md border border-[var(--color-hairline)]">
              Reference ID: {status.requestId}
            </p>
          )}
          <p className="text-[11px] text-[var(--color-mute)]">
            A compliance officer will review your request. Processing SLA: acknowledgment within 48 hours, execution within 14 business days.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {status?.type === "error" && (
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{status.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
                Registered Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={isAuthenticated && Boolean(initialEmail)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Reason for Deletion
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors"
            >
              <option value="Leaving organization / Change of employment">Leaving organization / Change of employment</option>
              <option value="No longer using machinery or mobile application">No longer using machinery or mobile application</option>
              <option value="Privacy & personal data minimization">Privacy & personal data minimization</option>
              <option value="Duplicate or test account">Duplicate or test account</option>
              <option value="Other reason">Other reason</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Any specific instructions regarding your data erasure..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors resize-none"
            />
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 leading-snug">
              Confirmation: Type <strong>DELETE</strong> below to verify you understand that personal identity records, credentials, and KYC documents will be permanently purged.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder='Type "DELETE"'
                className="w-40 px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-lg border border-amber-500/30 bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] uppercase focus:outline-hidden focus:border-amber-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isPending || confirmationInput.trim().toUpperCase() !== "DELETE"}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Deletion Request</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
