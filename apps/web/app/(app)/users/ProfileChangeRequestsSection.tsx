"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Modal,
  Input,
} from "@/components/ui";
import {
  AnimatedShieldAlert,
  AnimatedClock,
  AnimatedCheck,
  AnimatedX,
  AnimatedChevronDown,
} from "@/components/ui/animated-icons";
import { Clock, UserCog, Check, X, Phone, MapPin, Shield, FileText, ArrowRight, AlertTriangle } from "lucide-react";
import { formatDateTime, formatTimeAgo, formatTinyRelativeTime } from "@reachinternational/utils";
import type { ProfileChangeRequest, UserRole } from "@/lib/types/database";

interface ProfileChangeRequestsSectionProps {
  requests: ProfileChangeRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason?: string) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  loadingState?: { type: "approve" | "reject"; id: string } | null;
  isBulkApproving?: boolean;
  isBulkRejecting?: boolean;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-xs whitespace-nowrap">
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          Admin
        </span>
      );
    case "manager":
    case "branch_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-xs whitespace-nowrap">
          Manager
        </span>
      );
    case "service_manager":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80 shadow-xs whitespace-nowrap">
          Service Manager
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 shadow-xs whitespace-nowrap">
          Supervisor
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs whitespace-nowrap">
          Operator
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shadow-xs whitespace-nowrap">
          {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "User"}
        </span>
      );
  }
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DiffItem {
  label: string;
  oldVal?: string | null;
  newVal?: string | null;
}

function extractDiffs(currentData: any = {}, requestedData: any = {}): DiffItem[] {
  const diffs: DiffItem[] = [];

  if (requestedData.full_name && requestedData.full_name !== currentData.full_name) {
    diffs.push({ label: "Full Name", oldVal: currentData.full_name, newVal: requestedData.full_name });
  }
  if (requestedData.phone && requestedData.phone !== currentData.phone) {
    diffs.push({ label: "Phone", oldVal: currentData.phone, newVal: requestedData.phone });
  }
  if (requestedData.shift_time && requestedData.shift_time !== currentData.shift_time) {
    diffs.push({ label: "Shift Timing", oldVal: currentData.shift_time || "Standard", newVal: requestedData.shift_time });
  }
  if (requestedData.address && requestedData.address !== currentData.address) {
    diffs.push({ label: "Street Address", oldVal: currentData.address || "—", newVal: requestedData.address });
  }
  if (requestedData.city && (requestedData.city !== currentData.city || requestedData.state !== currentData.state)) {
    const oldLoc = [currentData.city, currentData.district, currentData.state].filter(Boolean).join(", ");
    const newLoc = [requestedData.city, requestedData.district, requestedData.state].filter(Boolean).join(", ");
    if (oldLoc !== newLoc) {
      diffs.push({ label: "Location", oldVal: oldLoc || "—", newVal: newLoc });
    }
  }
  if (requestedData.aadhaar_number && requestedData.aadhaar_number !== currentData.aadhaar_number) {
    diffs.push({ label: "Aadhaar Number", oldVal: currentData.aadhaar_number || "—", newVal: requestedData.aadhaar_number });
  }
  if (requestedData.license_number && requestedData.license_number !== currentData.license_number) {
    diffs.push({ label: "Driving Licence", oldVal: currentData.license_number || "—", newVal: requestedData.license_number });
  }

  return diffs;
}

export function ProfileChangeRequestsSection({
  requests,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  loadingState,
  isBulkApproving,
  isBulkRejecting,
}: ProfileChangeRequestsSectionProps) {
  const [rejectModalReq, setRejectModalReq] = useState<ProfileChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectingIndividual, setIsRejectingIndividual] = useState(false);

  if (!requests || requests.length === 0) {
    return null;
  }

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    setIsRejectingIndividual(true);
    try {
      await onReject(rejectModalReq.id, rejectReason);
      setRejectModalReq(null);
      setRejectReason("");
    } finally {
      setIsRejectingIndividual(false);
    }
  };

  return (
    <>
      <div
        id="profile-change-requests-section"
        className="relative overflow-hidden rounded-2xl border border-indigo-500/25 dark:border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.05] via-[var(--color-canvas-elevated)] to-[var(--color-canvas-elevated)] dark:from-indigo-950/[0.22] dark:via-[var(--color-canvas-elevated)] dark:to-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs transition-all mb-5"
      >
        {/* Top Highlight Hairline */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 dark:via-indigo-400/50 to-transparent pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-indigo-500/15 dark:border-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
              <UserCog size={18} />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight">
                  Profile Detail Change Requests
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {requests.length} Pending
                </span>
              </div>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Review and authorize employee profile and shift modifications before updating live records
              </p>
            </div>
          </div>

          {/* Batch Actions */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="success-sm"
              onClick={onApproveAll}
              loading={isBulkApproving}
              className="h-8 px-3.5 text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title={`Accept all ${requests.length} profile change requests`}
            >
              Accept All ({requests.length})
            </Button>
            <Button
              variant="danger-sm"
              onClick={onRejectAll}
              loading={isBulkRejecting}
              className="h-8 px-3 text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
              title={`Reject all ${requests.length} profile change requests`}
            >
              Reject All
            </Button>
          </div>
        </div>

        {/* Requests List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <AnimatePresence mode="popLayout">
            {requests.map((req) => {
              const userDisplayName = req.user?.full_name || req.current_data?.full_name || "User";
              const userEmail = req.user?.email || req.current_data?.email;
              const userRole = req.requester_role;
              const diffs = extractDiffs(req.current_data, req.requested_data);

              return (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
                  className="relative flex flex-col justify-between p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-indigo-500/40 hover:shadow-md dark:hover:shadow-indigo-950/25 transition-all duration-200 group overflow-hidden border-l-[3px] border-l-indigo-500 dark:border-l-indigo-400 gap-3"
                >
                  {/* Top Card Section: User Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-500/20 font-bold text-sm text-indigo-700 dark:text-indigo-300 shadow-2xs">
                        {getInitials(userDisplayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--color-ink)] truncate" title={userDisplayName}>
                            {userDisplayName}
                          </span>
                          {getRoleBadge(userRole)}
                        </div>
                        <p className="text-xs text-[var(--color-mute)] truncate mt-0.5">
                          {userEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-indigo-500/10 text-[10px] sm:text-[11px] font-mono font-semibold text-indigo-800 dark:text-indigo-300">
                      <Clock size={11} className="text-indigo-600 dark:text-indigo-400" />
                      <span>{formatTinyRelativeTime(req.created_at)}</span>
                    </div>
                  </div>

                  {/* Middle Card Section: Modified Fields Side-by-Side Diff */}
                  <div className="p-2.5 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] space-y-1.5 text-xs">
                    <p className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                      Requested Changes:
                    </p>
                    {diffs.length > 0 ? (
                      <div className="space-y-1">
                        {diffs.map((d, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 flex-wrap leading-tight">
                            <span className="font-semibold text-[var(--color-mute)] shrink-0 min-w-[70px]">
                              {d.label}:
                            </span>
                            <span className="line-through text-rose-600 dark:text-rose-400 opacity-80 shrink-0">
                              {d.oldVal || "—"}
                            </span>
                            <ArrowRight size={12} className="text-[var(--color-mute)] shrink-0 self-center" />
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">
                              {d.newVal || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--color-mute)] italic">General profile details review</p>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-hairline)]">
                    <Button
                      variant="success-sm"
                      onClick={() => onApprove(req.id)}
                      loading={loadingState?.type === "approve" && loadingState.id === req.id}
                      className="h-8 px-4 text-xs font-semibold rounded-md shadow-xs cursor-pointer active:scale-95 transition-all flex-1 sm:flex-initial justify-center"
                      title="Approve and apply profile changes"
                    >
                      Approve Change
                    </Button>
                    <Button
                      variant="danger-sm"
                      onClick={() => setRejectModalReq(req)}
                      loading={loadingState?.type === "reject" && loadingState.id === req.id}
                      className="h-8 px-3.5 text-xs font-semibold rounded-md shadow-xs cursor-pointer active:scale-95 transition-all flex-1 sm:flex-initial justify-center bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
                      title="Reject profile change request"
                    >
                      Reject
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Reject Reason Confirmation Modal */}
      {rejectModalReq && (
        <Modal
          open={Boolean(rejectModalReq)}
          onClose={() => setRejectModalReq(null)}
          title="Reject Profile Change Request"
          description={`Decline profile changes requested by ${rejectModalReq.user?.full_name || "user"}.`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
              The user&apos;s active profile will remain unchanged. You may optionally enter a rejection reason below.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1">
                Rejection Reason (Optional)
              </label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Identity document not clear or timing mismatch"
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-hairline)]">
              <Button
                variant="ghost"
                onClick={() => setRejectModalReq(null)}
                disabled={isRejectingIndividual}
                className="h-9 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReject}
                loading={isRejectingIndividual}
                className="h-9 px-4 text-xs font-bold"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
