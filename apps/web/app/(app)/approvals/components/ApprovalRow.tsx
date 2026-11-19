"use client";

import React from "react";
import type {
  ApprovalRequestListItem,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import { ApprovalTypeBadge } from "./ApprovalTypeBadge";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import {
  Clock,
  User,
  Hash,
  CheckCircle2,
  XCircle,
  Eye,
  Mail,
  Phone,
  Wrench,
  FileText,
  FileCheck2,
  RefreshCw,
  UserCog,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ApprovalRowProps {
  item: ApprovalRequestListItem;
  onSelect?: (item: ApprovalRequestListItem) => void;
  onApprove?: (requestId: string) => Promise<void> | void;
  onRejectPrompt?: (requestId: string) => void;
  onOpenDocumentLightbox?: (
    doc: AttachedDocumentSummary,
    userName?: string,
    userId?: string
  ) => void;
  onVerifyDocument?: (docId: string, userId?: string) => Promise<void> | void;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary, userId?: string) => void;
  canDecide?: boolean;
  isActionLoading?: boolean;
  isRejectLoading?: boolean;
  exitState?: "approved" | "rejected" | null;
}

interface DocumentThumbnailProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

function DocumentThumbnail({
  src,
  alt,
  className,
  fallbackIcon,
}: DocumentThumbnailProps) {
  const [hasError, setHasError] = React.useState(false);

  // Reset error state if src changes
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  // If no source or error occurred, NEVER render an <img> tag.
  // Rendering <img src=""> triggers React's console error and browser reload attempts.
  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-canvas)] text-[var(--color-mute)]">
        {fallbackIcon || <FileText size={16} className="text-[var(--color-mute)]" />}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={
        className ||
        "w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      }
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// ⚡ React.memo prevents full list re-renders on parent state changes (781-line component)
export const ApprovalRow = React.memo(function ApprovalRow({
  item,
  onSelect,
  onApprove,
  onRejectPrompt,
  onOpenDocumentLightbox,
  onVerifyDocument,
  onRejectDocumentPrompt,
  canDecide = false,
  isActionLoading = false,
  isRejectLoading = false,
  exitState = null,
}: ApprovalRowProps) {
  const isPending = item.status === "pending";
  const showDecideActions = isPending && canDecide && onApprove && onRejectPrompt;
  const isApprovedExit = exitState === "approved";
  const isRejectedExit = exitState === "rejected";

  // Identity resolution
  const fullName = item.requester_name || item.subject_label || "Applicant";
  const empId = item.employee_id;
  const role = item.role;
  const email = item.email;
  const phone = item.phone;
  const machineCategory = item.machine_category;
  const documents = item.documents || [];
  const payload = item.payload || {};

  // Type categorization
  const isRegistration = item.type_key === "registration";
  const isDocVerify = item.type_key === "document_verify";
  const isDocReplace = item.type_key === "document_replace";
  const isProfileChange = item.type_key === "profile_change";
  const isAccountDeletion = item.type_key === "account_deletion";
  const isShiftConflict = item.type_key === "shift_conflict";

  // Target document resolution for document-specific approval types
  const replacementDocTarget = isDocReplace
    ? documents.find((d) => d.id === item.id || d.label?.includes("(Replacement)")) ||
      documents.find((d) => d.id === item.subject_id) ||
      documents[0] ||
      null
    : null;

  const activeDocBeingReplaced = isDocReplace
    ? documents.find(
        (d) =>
          d !== replacementDocTarget &&
          d.document_type_code === payload.document_type_code
      ) || null
    : null;

  const singleDocTarget = isDocReplace
    ? replacementDocTarget
    : documents.find(
        (d) =>
          d.id === item.subject_id ||
          d.document_type_code === payload.document_type_code
      ) ||
      documents[0] ||
      null;

  return (
    <div
      className={`w-full relative flex flex-col justify-between rounded-xl border p-3.5 sm:p-4 shadow-xs transition-all duration-300 gap-3 ${
        isApprovedExit
          ? "border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/25 ring-1 ring-emerald-500/30 shadow-md"
          : isRejectedExit
          ? "border-red-500/80 bg-red-50/40 dark:bg-red-950/25 ring-1 ring-red-500/30 shadow-md"
          : "border-[var(--color-border)] bg-[var(--color-canvas-elevated)] hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
      }`}
    >
      {/* ── Top Header: Badges & Relative Registration Time ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <ApprovalTypeBadge typeKey={item.type_key} typeLabel={item.type_label} />
          <ApprovalStatusBadge status={item.status} />
          {role && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              {role}
            </span>
          )}
          {item.priority >= 8 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              High Priority
            </span>
          )}
        </div>

        {/* Registration time ago */}
        <div
          className="flex items-center gap-1 shrink-0 text-[var(--color-ink-muted)] text-[11px] sm:text-xs font-medium tabular-nums ml-auto"
          title={`Submitted on ${item.created_at}`}
        >
          <Clock size={11} className="shrink-0 text-[var(--color-mute)]" />
          <span>{formatTinyRelativeTime(item.created_at)}</span>
        </div>
      </div>

      {/* ── Identity & Essential Info (Optimized for Mobile & Desktop) ── */}
      <div className="space-y-1.5">
        {/* Full Name & Emp ID */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-[var(--color-ink)] leading-snug">
            {fullName}
          </h3>
          {empId && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] font-mono font-semibold text-[var(--color-ink)]">
              <Hash size={10} className="text-purple-500 shrink-0" />
              <span>{empId}</span>
            </div>
          )}
        </div>

        {/* Contact details: Email, Phone Number, Machine Category */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[var(--color-ink-muted)]">
          {email && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail size={12} className="text-emerald-500 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-none">{email}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Phone size={12} className="text-amber-500 shrink-0" />
              <span className="font-mono">{phone}</span>
            </div>
          )}
          {machineCategory && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Wrench size={12} className="text-orange-500 shrink-0" />
              <span className="text-[var(--color-ink)] font-medium truncate">
                Fleet: {machineCategory}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Type-Specific Content Section (Feedback 6: Handle all approval types) ── */}

      {/* 1. Document Initial Verification (Single Document or Multi-Document Bound Card) */}
      {isDocVerify && (
        documents.length > 1 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5">
                <FileCheck2 size={12} className="text-sky-500" />
                Documents for Verification ({documents.length})
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {documents.map((doc) => {
                const isDocPending = doc.verification_status === "pending";
                const isDocVerified = doc.verification_status === "verified";
                const isDocRejected = doc.verification_status === "rejected";

                return (
                  <div
                    key={doc.id}
                    className="flex flex-col items-center gap-1 w-20 sm:w-24 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] p-1 shadow-xs hover:border-sky-500/50 transition-all duration-150"
                  >
                    {/* Thumbnail Image Container — Click to open lightbox */}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocumentLightbox?.(
                          doc,
                          fullName,
                          payload.user_id || item.requested_by || item.subject_id
                        )
                      }
                      className="relative w-full h-12 sm:h-14 rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] cursor-pointer group block shadow-2xs"
                      title={`Click to view ${doc.label}`}
                    >
                      <DocumentThumbnail
                        src={doc.thumb_signed_url || doc.signed_url}
                        alt={doc.label}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={14} />
                      </div>
                    </button>

                    {/* Document Label & Status Pill */}
                    <div className="w-full text-center px-0.5">
                      <span className="block text-[10px] sm:text-[11px] font-medium text-[var(--color-ink)] truncate leading-tight">
                        {doc.label}
                      </span>
                      <span
                        className={`inline-block mt-0.5 px-1 py-0.2 rounded-full text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider ${
                          isDocVerified
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isDocRejected
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {doc.verification_status}
                      </span>
                    </div>

                    {/* Quick Individual Document Actions (if pending & authorized) */}
                    {canDecide && isDocPending && onVerifyDocument && onRejectDocumentPrompt && (
                      <div className="flex items-center gap-1 w-full pt-1 border-t border-[var(--color-border)]/60 justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRejectDocumentPrompt(
                              doc,
                              payload.user_id || item.requested_by || item.subject_id
                            );
                          }}
                          disabled={isActionLoading || isRejectLoading}
                          className="p-1 rounded text-red-600 hover:bg-red-500/15 transition-colors cursor-pointer"
                          title={`Reject ${doc.label}`}
                        >
                          <X size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerifyDocument(
                              doc.id,
                              payload.user_id || item.requested_by || item.subject_id
                            );
                          }}
                          disabled={isActionLoading || isRejectLoading}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                          title={`Verify ${doc.label}`}
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : singleDocTarget ? (
          <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() =>
                  onOpenDocumentLightbox?.(
                    singleDocTarget,
                    fullName,
                    payload.user_id || item.requested_by || item.subject_id
                  )
                }
                className="relative w-16 sm:w-20 h-12 sm:h-14 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] cursor-pointer group shrink-0 shadow-2xs"
                title={`Click to inspect ${singleDocTarget.label}`}
              >
                <DocumentThumbnail
                  src={singleDocTarget.thumb_signed_url || singleDocTarget.signed_url}
                  alt={singleDocTarget.label}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye size={14} />
                </div>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                    {singleDocTarget.label}
                  </span>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider ${
                      singleDocTarget.verification_status === "verified"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : singleDocTarget.verification_status === "rejected"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {singleDocTarget.verification_status}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-muted)] truncate mt-0.5">
                  Statutory document verification pending review
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] flex items-center justify-center text-sky-500 shrink-0">
              <FileCheck2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                {item.subject_label || (payload.document_type_code || "").replace(/_/g, " ") || "Document Verification"}
              </div>
              <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                Statutory KYC document pending administrative review
              </p>
            </div>
          </div>
        )
      )}

      {/* 2. Document Replacement (Only Document Approval) */}
      {isDocReplace && (
        <div className="p-2.5 sm:p-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {singleDocTarget ? (
              <button
                type="button"
                onClick={() =>
                  onOpenDocumentLightbox?.(
                    singleDocTarget,
                    fullName,
                    payload.user_id || item.requested_by || item.subject_id
                  )
                }
                className="relative w-16 sm:w-20 h-12 sm:h-14 rounded-lg overflow-hidden border border-indigo-500/30 bg-[var(--color-canvas)] cursor-pointer group shrink-0 shadow-2xs"
                title="Click to inspect replacement"
              >
                <DocumentThumbnail
                  src={singleDocTarget.thumb_signed_url || singleDocTarget.signed_url}
                  alt="Replacement document"
                  fallbackIcon={<RefreshCw size={16} className="text-indigo-500" />}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye size={14} />
                </div>
              </button>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <RefreshCw size={18} />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">
                  Replacing: {(payload.document_type_code || singleDocTarget?.label || "Document").replace(/_/g, " ")}
                </span>
                <span className="inline-block px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Staged
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-muted)] truncate mt-0.5">
                Overwrites statutory file upon admin approval
              </p>
            </div>
          </div>

          {activeDocBeingReplaced && (
            <button
              type="button"
              onClick={() =>
                onOpenDocumentLightbox?.(
                  activeDocBeingReplaced,
                  `${fullName} (Current Active)`,
                  payload.user_id || item.requested_by || item.subject_id
                )
              }
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 cursor-pointer shrink-0 transition-colors hover:bg-indigo-500/15"
              title="Click to view current active approved document"
            >
              <Eye size={12} />
              <span>View Current Active</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Profile Change (No Document Approval) */}
      {isProfileChange && (
        <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-ink)]">
            <span className="flex items-center gap-1.5">
              <UserCog size={13} className="text-sky-500" />
              Profile Modifications Requested
            </span>
            {payload.reason && (
              <span className="text-[10px] text-[var(--color-ink-muted)] italic truncate max-w-[200px]">
                &ldquo;{payload.reason}&rdquo;
              </span>
            )}
          </div>

          {payload.changes && Object.keys(payload.changes).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(payload.changes).slice(0, 3).map(([field, val]: [string, any]) => {
                const oldVal =
                  val?.old_value !== undefined && val?.old_value !== null
                    ? String(val.old_value)
                    : "";
                const newVal =
                  val?.new_value !== undefined && val?.new_value !== null
                    ? String(val.new_value)
                    : String(val ?? "");
                return (
                  <div
                    key={field}
                    className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)]"
                  >
                    <span className="font-medium text-[var(--color-ink)] capitalize text-[11px]">
                      {field.replace(/_/g, " ")}:
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      {oldVal ? (
                        <span className="line-through text-red-500 truncate max-w-[120px]">{oldVal}</span>
                      ) : null}
                      {oldVal ? <span className="text-[var(--color-mute)]">&rarr;</span> : null}
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[140px]">
                        {newVal || "(empty)"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-ink-muted)]">
              {item.summary || "Sensitive profile changes pending review."}
            </p>
          )}
        </div>
      )}

      {/* 4. Account Deletion Request (No Document Approval) */}
      {isAccountDeletion && (
        <div className="p-2.5 sm:p-3 rounded-xl border border-red-500/25 bg-red-500/5 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400">
            <span className="flex items-center gap-1.5">
              <ShieldAlert size={14} className="shrink-0" />
              Account Deletion Request
            </span>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
              7-day grace
            </span>
          </div>
          <p className="text-xs text-[var(--color-ink)]">
            Reason: &ldquo;{payload.reason || item.summary || "Permanent deletion requested by user"}&rdquo;
          </p>
        </div>
      )}

      {/* 5. Shift Conflict (No Document Approval) */}
      {isShiftConflict && (
        <div className="p-2.5 sm:p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              Shift Conflict / Override
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-1.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)]">
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Machine</span>
              <span className="font-semibold text-[var(--color-ink)] truncate block text-xs">
                {payload.machine_code || payload.machine_id || "Fleet Machine"}
              </span>
            </div>
            <div className="p-1.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)]">
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-bold block">Date &amp; Shift</span>
              <span className="font-semibold text-[var(--color-ink)] truncate block text-xs">
                {payload.log_date || "—"} ({payload.shift_code || "—"})
              </span>
            </div>
          </div>
          {item.summary && (
            <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
              {item.summary}
            </p>
          )}
        </div>
      )}

      {/* 6. Registration KYC Documents (Multiple Attached Documents or Empty Placeholder) */}
      {isRegistration && (
        documents.length > 0 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5">
                <FileText size={12} className="text-sky-500" />
                Attached Documents ({documents.length})
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {documents.map((doc) => {
                const isDocPending = doc.verification_status === "pending";
                const isDocVerified = doc.verification_status === "verified";
                const isDocRejected = doc.verification_status === "rejected";

                return (
                  <div
                    key={doc.id}
                    className="flex flex-col items-center gap-1 w-20 sm:w-24 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] p-1 shadow-xs hover:border-sky-500/50 transition-all duration-150"
                  >
                    {/* Thumbnail Image Container — Click to open lightbox */}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocumentLightbox?.(
                          doc,
                          fullName,
                          payload.user_id || item.requested_by || item.subject_id
                        )
                      }
                      className="relative w-full h-12 sm:h-14 rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] cursor-pointer group block shadow-2xs"
                      title={`Click to view ${doc.label}`}
                    >
                      <DocumentThumbnail
                        src={doc.thumb_signed_url || doc.signed_url}
                        alt={doc.label}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={14} />
                      </div>
                    </button>

                    {/* Document Label & Status Pill */}
                    <div className="w-full text-center px-0.5">
                      <span className="block text-[10px] sm:text-[11px] font-medium text-[var(--color-ink)] truncate leading-tight">
                        {doc.label}
                      </span>
                      <span
                        className={`inline-block mt-0.5 px-1 py-0.2 rounded-full text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider ${
                          isDocVerified
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isDocRejected
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {doc.verification_status}
                      </span>
                    </div>

                    {/* Quick Individual Document Actions (if pending & authorized) */}
                    {canDecide && isDocPending && onVerifyDocument && onRejectDocumentPrompt && (
                      <div className="flex items-center gap-1 w-full pt-1 border-t border-[var(--color-border)]/60 justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRejectDocumentPrompt(doc);
                          }}
                          disabled={isActionLoading || isRejectLoading}
                          className="p-1 rounded text-red-600 hover:bg-red-500/15 transition-colors cursor-pointer"
                          title={`Reject ${doc.label}`}
                        >
                          <X size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerifyDocument(doc.id);
                          }}
                          disabled={isActionLoading || isRejectLoading}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                          title={`Approve ${doc.label}`}
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-canvas)]/40 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <FileText size={13} className="text-[var(--color-mute)] shrink-0" />
            <span>No KYC statutory documents attached yet</span>
          </div>
        )
      )}

      {/* 7. Fallback for any other custom type */}
      {!isDocVerify && !isDocReplace && !isProfileChange && !isAccountDeletion && !isShiftConflict && !isRegistration && (
        documents.length > 0 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5">
                <FileText size={12} className="text-sky-500" />
                Attached Documents ({documents.length})
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col items-center gap-1 w-20 sm:w-24 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] p-1 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDocumentLightbox?.(
                        doc,
                        fullName,
                        payload.user_id || item.requested_by || item.subject_id
                      )
                    }
                    className="relative w-full h-12 sm:h-14 rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] cursor-pointer group block shadow-2xs"
                  >
                    <DocumentThumbnail
                      src={doc.thumb_signed_url || doc.signed_url}
                      alt={doc.label}
                    />
                  </button>
                  <span className="block text-[10px] font-medium text-[var(--color-ink)] truncate w-full text-center">
                    {doc.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : item.summary ? (
          <div className="p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/50 text-xs text-[var(--color-ink-muted)]">
            {item.summary}
          </div>
        ) : null
      )}

      {/* ── Card Bottom Action Bar (Optimized for Mobile & Desktop) ── */}
      <div className="pt-2.5 border-t border-[var(--color-border)]/70 flex items-center justify-end gap-2">
        {/* Quick Approve / Reject Buttons (Strictly ONE loading spinner) */}
        {isApprovedExit ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-in zoom-in-95 duration-200">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>Approved</span>
          </div>
        ) : isRejectedExit ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold animate-in zoom-in-95 duration-200">
            <XCircle size={14} className="shrink-0" />
            <span>Rejected</span>
          </div>
        ) : showDecideActions ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<XCircle size={13} />}
              loading={isRejectLoading}
              disabled={isActionLoading || isRejectLoading}
              onClick={() => onRejectPrompt(item.id)}
              className="gap-1.5 h-9 min-h-[40px] sm:min-h-[36px] px-3 text-xs font-semibold text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 cursor-pointer justify-center"
            >
              <span>Reject</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<CheckCircle2 size={13} />}
              loading={isActionLoading}
              disabled={isActionLoading || isRejectLoading}
              onClick={() => onApprove(item.id)}
              className="gap-1.5 h-9 min-h-[40px] sm:min-h-[36px] px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer justify-center"
            >
              <span>Approve</span>
            </Button>
          </div>
        ) : null}

        {/* Status notice if not pending and not actively exiting */}
        {!isPending && !isApprovedExit && !isRejectedExit && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] ml-auto">
            {item.status === "approved" ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={13} />
                Approved
              </span>
            ) : item.status === "rejected" ? (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                <XCircle size={13} />
                Rejected
              </span>
            ) : (
              <span className="capitalize font-medium">{item.status}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
