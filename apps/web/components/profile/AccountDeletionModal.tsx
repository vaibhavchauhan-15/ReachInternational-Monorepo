"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal, Button, useToast } from "@/components/ui";
import {
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  FileCheck,
  Building,
} from "lucide-react";
import {
  submitAccountDeletionRequestAction,
  getMyPendingAccountDeletionRequestAction,
  cancelMyAccountDeletionRequestAction,
} from "@/app/actions/account-deletion";
import type { User as UserType } from "@/lib/types/database";

interface AccountDeletionModalProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AccountDeletionModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: AccountDeletionModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Check if current user already has a pending request whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingStatus(true);

    getMyPendingAccountDeletionRequestAction()
      .then((req) => {
        if (isMounted) {
          setPendingRequest(req);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsLoadingStatus(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast("error", "Please provide a brief reason for requesting account deletion.");
      return;
    }

    startSubmitTransition(async () => {
      const res = await submitAccountDeletionRequestAction({
        email: user.email,
        fullName: user.full_name,
        reason: trimmedReason,
        source: "web",
      });

      if (res.success) {
        toast("success", "Your account deletion request has been submitted for administrator review.");
        setPendingRequest({
          id: res.requestId,
          created_at: new Date().toISOString(),
          reason: trimmedReason,
        });
        setReason("");
        if (onSuccess) onSuccess();
      } else {
        toast("error", res.error || "Unable to register deletion request. Please try again.");
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
        if (onSuccess) onSuccess();
      } else {
        toast("error", res.error || "Unable to cancel deletion request. Please try again.");
      }
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Trash2 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink)] leading-tight">
              {pendingRequest ? "Account Deletion Request" : "Request Account Deletion"}
            </h2>
            <p className="text-xs text-[var(--color-mute)] font-normal mt-0.5">
              {pendingRequest
                ? "Your deletion request is currently pending administrative review."
                : "Submit a formal request to de-provision your account."}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-xs">
        {/* Loading status spinner */}
        {isLoadingStatus && (
          <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-center text-[var(--color-mute)]">
            Checking deletion request status...
          </div>
        )}

        {/* Existing Pending Request View */}
        {!isLoadingStatus && pendingRequest && (
          <div className="space-y-3.5">
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-xs">
                  <Clock size={15} />
                  <span>Request Pending Review</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Pending Admin Approval
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-body)]">
                You submitted an account deletion request on{" "}
                <strong>
                  {new Date(pendingRequest.created_at || Date.now()).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </strong>
                . Our compliance desk and administrators will review and deactivate your account within 14 business days.
              </p>
              {pendingRequest.reason && (
                <div className="mt-2 pt-2 border-t border-amber-500/20 text-[11px]">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Stated Reason: </span>
                  <span className="italic text-[var(--color-body)]">"{pendingRequest.reason}"</span>
                </div>
              )}
            </div>

            {/* Retention Notice */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-[var(--color-ink)]">
                <FileCheck size={14} className="text-sky-600 dark:text-sky-400" />
                <span>Statutory Compliance Retention</span>
              </div>
              <p className="text-[11px] text-[var(--color-mute)] leading-relaxed">
                Under Indian heavy equipment safety regulations, historical machine running hour meter readings (HMR) and shift logs are permanently retained with technical equipment attribution.
              </p>
            </div>

            {/* Actions: Cancel request or Close */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelRequest}
                loading={isCancelling}
                disabled={isCancelling}
                icon={<RotateCcw size={13} />}
                className="text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              >
                Withdraw Request
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* New Deletion Request Form */}
        {!isLoadingStatus && !pendingRequest && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Warning Disclosure Card */}
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 text-xs">
                <ShieldAlert size={15} />
                <span>Important Data Deletion Notice</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[var(--color-body)] leading-relaxed">
                <li>
                  Your user login and system access will be <strong>permanently deactivated</strong> upon administrator approval.
                </li>
                <li>
                  Personal identity records (Aadhaar number, Driving Licence, personal phone) will be <strong>scrubbed</strong>.
                </li>
                <li>
                  Daily machine running logs (HMR), breakdown logs, and site assignments will be <strong>retained</strong> for statutory compliance under the Indian Factories Act.
                </li>
              </ul>
            </div>

            {/* Account Details Preview */}
            <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Account</span>
                <span className="font-bold text-[var(--color-ink)]">{user.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Email</span>
                <span className="text-[var(--color-ink)] font-mono">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">Role</span>
                <span className="capitalize text-[var(--color-ink)]">{user.role?.replace("_", " ")}</span>
              </div>
            </div>

            {/* Reason Field */}
            <div className="space-y-1.5">
              <label htmlFor="deletion-reason" className="block text-xs font-bold text-[var(--color-ink)]">
                Reason for Account Deletion <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="deletion-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                placeholder="Please state why you wish to delete your account (e.g., Leaving the organization, no longer operating equipment, changing contact details)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all resize-none"
              />
              <p className="text-[10px] text-[var(--color-mute)]">
                Your reason will be shared with company administrators reviewing this request.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                loading={isSubmitting}
                disabled={isSubmitting || !reason.trim()}
                icon={<Trash2 size={13} />}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Submit Deletion Request
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
