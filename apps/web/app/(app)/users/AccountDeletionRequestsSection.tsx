"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Modal,
} from "@/components/ui";
import {
  Trash2,
  AlertTriangle,
  Check,
  X,
  Clock,
  Smartphone,
  Globe,
  Mail,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { formatDateTime, formatTinyRelativeTime } from "@reachinternational/utils";
import type { AccountDeletionRequest } from "@reachinternational/types";

interface AccountDeletionRequestsSectionProps {
  requests: AccountDeletionRequest[];
  onApprove: (request: AccountDeletionRequest, notes?: string) => Promise<void>;
  onReject: (request: AccountDeletionRequest, notes?: string) => Promise<void>;
  loadingState?: { type: "approve" | "reject"; id: string } | null;
}

function getSourceBadge(source: string) {
  switch (source) {
    case "mobile":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          <Smartphone size={10} />
          Mobile App
        </span>
      );
    case "web":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
          <Globe size={10} />
          Web App
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <Mail size={10} />
          Public Web Portal
        </span>
      );
  }
}

function getRoleBadge(role?: string | null) {
  if (!role) return null;
  const formatted = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
      {formatted}
    </span>
  );
}

export function AccountDeletionRequestsSection({
  requests,
  onApprove,
  onReject,
  loadingState,
}: AccountDeletionRequestsSectionProps) {
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<AccountDeletionRequest | null>(null);
  const [selectedRequestForRejection, setSelectedRequestForRejection] = useState<AccountDeletionRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  if (!requests || requests.length === 0) {
    return null;
  }

  const handleConfirmApproval = async () => {
    if (!selectedRequestForApproval) return;
    await onApprove(selectedRequestForApproval, adminNotes.trim() || undefined);
    setSelectedRequestForApproval(null);
    setAdminNotes("");
  };

  const handleConfirmRejection = async () => {
    if (!selectedRequestForRejection) return;
    await onReject(selectedRequestForRejection, adminNotes.trim() || undefined);
    setSelectedRequestForRejection(null);
    setAdminNotes("");
  };

  return (
    <div
      id="account-deletion-requests-section"
      className="relative overflow-hidden rounded-2xl border border-rose-500/30 dark:border-rose-500/25 bg-gradient-to-b from-rose-500/[0.04] via-[var(--color-canvas-elevated)] to-[var(--color-canvas-elevated)] dark:from-rose-950/[0.2] dark:via-[var(--color-canvas-elevated)] dark:to-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs transition-all"
    >
      {/* Top Rose Hairline Ambient Sheen */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/70 dark:via-rose-400/60 to-transparent pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-rose-500/15 dark:border-rose-500/10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 dark:bg-rose-400/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 shrink-0 shadow-xs">
            <Trash2 size={18} />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight">
                Account Deletion Requests
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                {requests.length} Pending
              </span>
            </div>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Review and authorize de-provisioning and statutory personal data erasure requests
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Deletion Request Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <AnimatePresence mode="popLayout">
          {requests.map((req) => {
            const isApproving = loadingState?.type === "approve" && loadingState.id === req.id;
            const isRejecting = loadingState?.type === "reject" && loadingState.id === req.id;
            const userName = req.full_name || (req.user as any)?.full_name || req.email.split("@")[0];

            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
                className="relative flex flex-col justify-between gap-3 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-rose-500/40 hover:shadow-md dark:hover:shadow-rose-950/20 transition-all duration-200 border-l-[3px] border-l-rose-500 dark:border-l-rose-400 overflow-hidden"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-500/20">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate">
                          {userName}
                        </span>
                        {getRoleBadge(req.role)}
                        {getSourceBadge(req.source)}
                      </div>
                      <p className="text-xs text-[var(--color-mute)] truncate font-mono mt-0.5">
                        {req.email}
                      </p>
                    </div>
                  </div>

                  <span
                    className="text-[11px] text-[var(--color-mute)] font-medium shrink-0"
                    title={formatDateTime(req.created_at)}
                  >
                    {formatTinyRelativeTime(req.created_at)}
                  </span>
                </div>

                {/* Reason Section */}
                <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                    Reason for Deletion
                  </span>
                  <p className="text-xs text-[var(--color-ink)] leading-snug">
                    {req.reason || "No explicit reason provided by user."}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-hairline)]/70">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={isRejecting}
                    onClick={() => {
                      setSelectedRequestForRejection(req);
                      setAdminNotes("");
                    }}
                    className="h-8 px-3 text-xs font-semibold text-[var(--color-mute)] hover:text-rose-600 hover:bg-rose-500/10"
                  >
                    Decline Request
                  </Button>

                  <Button
                    variant="danger-sm"
                    size="sm"
                    loading={isApproving}
                    onClick={() => {
                      setSelectedRequestForApproval(req);
                      setAdminNotes("");
                    }}
                    className="h-8 px-3 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Approve Deletion</span>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal: Approve Deletion */}
      <Modal
        open={Boolean(selectedRequestForApproval)}
        onClose={() => setSelectedRequestForApproval(null)}
        title="Authorize Account Deletion & De-Provisioning"
        description="Verify permanent account deactivation and personal data erasure."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRequestForApproval(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmApproval}
              icon={<Trash2 size={14} />}
            >
              Confirm Account Deletion
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-[var(--color-ink)]">
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5">
            <p className="font-bold text-rose-700 dark:text-rose-400">
              Target User: {selectedRequestForApproval?.full_name || selectedRequestForApproval?.email}
            </p>
            <p className="text-[var(--color-mute)] font-mono">
              Email: {selectedRequestForApproval?.email}
            </p>
            <p className="text-[var(--color-body)] leading-relaxed">
              Approving this request will immediately mark this user account as <strong>inactive</strong> in the database, terminate all active authentication tokens, and purge KYC credentials.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">Statutory Records Preservation</p>
            <p className="text-[11px] leading-relaxed">
              Historical machine hour logs and safety inspection reports will be preserved in an anonymized format to satisfy heavy equipment insurance and machinery warranty regulations.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Admin Review Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Identity verified via phone on 11 Sep. De-provisioning approved."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Reject Deletion */}
      <Modal
        open={Boolean(selectedRequestForRejection)}
        onClose={() => setSelectedRequestForRejection(null)}
        title="Decline Account Deletion Request"
        description="Dismiss this deletion request and keep the user account active."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRequestForRejection(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmRejection}
            >
              Confirm Decline
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-[var(--color-ink)]">
          <p className="text-[var(--color-body)]">
            Are you sure you want to decline the account deletion request for{" "}
            <strong>{selectedRequestForRejection?.email}</strong>?
          </p>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Rejection Reason / Notes
            </label>
            <textarea
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. User confirmed request was sent by mistake; active machine assignment ongoing."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
