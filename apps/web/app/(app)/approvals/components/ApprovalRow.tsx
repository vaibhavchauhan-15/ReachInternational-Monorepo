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
  UserCheck,
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

function DocumentThumbnail(props: DocumentThumbnailProps) {
  return <DocumentThumbnailInner key={props.src || "none"} {...props} />;
}

function DocumentThumbnailInner({
  src,
  alt,
  className,
  fallbackIcon,
}: DocumentThumbnailProps) {
  const [hasError, setHasError] = React.useState(false);

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
interface AttachedDocCardProps {
  doc: AttachedDocumentSummary;
  fullName: string;
  userId?: string;
  canDecide: boolean;
  isActionLoading: boolean;
  isRejectLoading: boolean;
  onOpenDocumentLightbox?: (
    doc: AttachedDocumentSummary,
    userName?: string,
    userId?: string
  ) => void;
  onVerifyDocument?: (docId: string, userId?: string) => Promise<void> | void;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary, userId?: string) => void;
  isCurrentActive?: boolean;
}

function AttachedDocCard({
  doc,
  fullName,
  userId,
  canDecide,
  isActionLoading,
  isRejectLoading,
  onOpenDocumentLightbox,
  onVerifyDocument,
  onRejectDocumentPrompt,
  isCurrentActive = false,
}: AttachedDocCardProps) {
  const isDocPending = doc.verification_status === "pending";
  const isDocVerified = doc.verification_status === "verified";
  const isDocRejected = doc.verification_status === "rejected";

  return (
    <div className="flex flex-col items-center justify-between gap-1.5 w-28 sm:w-32 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-2xs hover:border-sky-500/50 transition-all duration-150">
      {/* Thumbnail Image Container — Click to open lightbox */}
      <button
        type="button"
        onClick={() => onOpenDocumentLightbox?.(doc, fullName, userId)}
        className="relative w-full h-16 sm:h-18 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] cursor-pointer group block shadow-2xs shrink-0"
        title={`Click to view ${doc.label}`}
      >
        <DocumentThumbnail
          src={doc.thumb_signed_url || doc.signed_url}
          alt={doc.label}
        />
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Eye size={15} />
        </div>
      </button>

      {/* Document Label */}
      <span
        className="block text-[11px] font-semibold text-[var(--color-ink)] truncate w-full text-center px-0.5 leading-tight"
        title={doc.label}
      >
        {doc.label}
      </span>

      {/* Either show icon-only Approve/Reject action buttons OR show the verified/rejected/active status badge */}
      {isCurrentActive ? (
        <div className="w-full pt-1 border-t border-[var(--color-border)]/60 flex justify-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <CheckCircle2 size={11} className="shrink-0" />
            <span>Active</span>
          </span>
        </div>
      ) : canDecide && isDocPending && onVerifyDocument && onRejectDocumentPrompt ? (
        <div className="flex items-center gap-1.5 w-full pt-1 border-t border-[var(--color-border)]/60 justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRejectDocumentPrompt(doc, userId);
            }}
            disabled={isActionLoading || isRejectLoading}
            className="flex-1 h-7 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Reject ${doc.label}`}
            aria-label={`Reject ${doc.label}`}
          >
            <X size={13} strokeWidth={2.5} className="shrink-0" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVerifyDocument(doc.id, userId);
            }}
            disabled={isActionLoading || isRejectLoading}
            className="flex-1 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Approve ${doc.label}`}
            aria-label={`Approve ${doc.label}`}
          >
            <Check size={13} strokeWidth={2.5} className="shrink-0" />
          </button>
        </div>
      ) : (
        <div className="w-full pt-1 border-t border-[var(--color-border)]/60 flex justify-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              isDocVerified
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : isDocRejected
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {isDocVerified ? (
              <>
                <CheckCircle2 size={11} className="shrink-0" />
                <span>Approved</span>
              </>
            ) : isDocRejected ? (
              <>
                <XCircle size={11} className="shrink-0" />
                <span>Rejected</span>
              </>
            ) : (
              <>
                <Clock size={11} className="shrink-0" />
                <span>Pending</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

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

  const isOperator =
    role?.toLowerCase() === "operator" ||
    payload.role?.toLowerCase() === "operator";
  const supervisorName =
    item.supervisor_name ||
    payload.supervisor_name ||
    payload.supervisorName ||
    null;

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
      id={`approval-row-${item.id}`}
      className={`w-full relative flex flex-col justify-between rounded-xl border p-3.5 sm:p-4 shadow-xs transition-all duration-300 gap-3 ${
        isApprovedExit
          ? "border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/25 ring-1 ring-emerald-500/30 shadow-md"
          : isRejectedExit
          ? "border-red-500/80 bg-red-50/40 dark:bg-red-950/25 ring-1 ring-red-500/30 shadow-md"
          : "border-[var(--color-border)] bg-[var(--color-canvas-elevated)] hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
      }`}
    >
      {/* ── Top Header: Badges ── */}
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

        {/* Contact details: Email, Phone Number, Machine Category & Operator Supervisor */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-[var(--color-ink-muted)]">
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
          {isOperator && (
            <div
              className="flex items-center gap-1.5 min-w-0"
              title={`Supervisor: ${supervisorName || "Unassigned"}`}
            >
              <UserCheck size={12} className="text-sky-500 shrink-0" />
              <span className="text-[var(--color-ink)] font-medium truncate">
                Supervisor: {supervisorName || "Unassigned"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Type-Specific Content Section: All Approval Cards Use Identical Container & Layout ── */}

      {/* 1. Document Initial Verification (Single Document or Multi-Document Bound Card) */}
      {isDocVerify && (
        documents.length > 1 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileCheck2 size={12} className="text-sky-500" />
                Documents for Verification ({documents.length})
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              {documents.map((doc) => (
                <AttachedDocCard
                  key={doc.id}
                  doc={doc}
                  fullName={fullName}
                  userId={payload.user_id || item.requested_by || item.subject_id}
                  canDecide={canDecide}
                  isActionLoading={isActionLoading}
                  isRejectLoading={isRejectLoading}
                  onOpenDocumentLightbox={onOpenDocumentLightbox}
                  onVerifyDocument={onVerifyDocument}
                  onRejectDocumentPrompt={onRejectDocumentPrompt}
                />
              ))}
            </div>
          </div>
        ) : singleDocTarget ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileCheck2 size={12} className="text-sky-500" />
                Documents for Verification ({documents.length || 1})
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              <AttachedDocCard
                key={singleDocTarget.id}
                doc={singleDocTarget}
                fullName={fullName}
                userId={payload.user_id || item.requested_by || item.subject_id}
                canDecide={canDecide}
                isActionLoading={isActionLoading}
                isRejectLoading={isRejectLoading}
                onOpenDocumentLightbox={onOpenDocumentLightbox}
                onVerifyDocument={onVerifyDocument}
                onRejectDocumentPrompt={onRejectDocumentPrompt}
              />
            </div>
          </div>
        ) : (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileCheck2 size={12} className="text-sky-500" />
                Document Verification
              </span>
            </div>
            <div className="p-2.5 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-canvas)]/40 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <FileText size={13} className="text-[var(--color-mute)] shrink-0" />
              <span>Statutory KYC document pending administrative review</span>
            </div>
          </div>
        )
      )}

      {/* 2. Document Replacement */}
      {isDocReplace && (
        <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-muted)] font-medium">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
              <RefreshCw size={12} className="text-sky-500" />
              Replacement: {(payload.document_type_code || singleDocTarget?.label || "Document").replace(/_/g, " ")}
            </span>
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
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                title="Click to view current active approved document"
              >
                <Eye size={12} />
                <span>View Current Active</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
            {replacementDocTarget ? (
              <AttachedDocCard
                key={replacementDocTarget.id}
                doc={{
                  ...replacementDocTarget,
                  label: replacementDocTarget.label?.includes("(Replacement)")
                    ? replacementDocTarget.label
                    : `${replacementDocTarget.label || (payload.document_type_code || "Document").replace(/_/g, " ")} (Replacement)`,
                }}
                fullName={fullName}
                userId={payload.user_id || item.requested_by || item.subject_id}
                canDecide={canDecide}
                isActionLoading={isActionLoading}
                isRejectLoading={isRejectLoading}
                onOpenDocumentLightbox={onOpenDocumentLightbox}
                onVerifyDocument={onVerifyDocument}
                onRejectDocumentPrompt={onRejectDocumentPrompt}
              />
            ) : singleDocTarget ? (
              <AttachedDocCard
                key={singleDocTarget.id}
                doc={singleDocTarget}
                fullName={fullName}
                userId={payload.user_id || item.requested_by || item.subject_id}
                canDecide={canDecide}
                isActionLoading={isActionLoading}
                isRejectLoading={isRejectLoading}
                onOpenDocumentLightbox={onOpenDocumentLightbox}
                onVerifyDocument={onVerifyDocument}
                onRejectDocumentPrompt={onRejectDocumentPrompt}
              />
            ) : null}

            {activeDocBeingReplaced && (
              <AttachedDocCard
                key={activeDocBeingReplaced.id}
                doc={{
                  ...activeDocBeingReplaced,
                  label: `${activeDocBeingReplaced.label || (payload.document_type_code || "Document").replace(/_/g, " ")} (Active)`,
                }}
                fullName={fullName}
                userId={payload.user_id || item.requested_by || item.subject_id}
                canDecide={false}
                isActionLoading={false}
                isRejectLoading={false}
                onOpenDocumentLightbox={onOpenDocumentLightbox}
                isCurrentActive={true}
              />
            )}
          </div>
        </div>
      )}

      {/* 3. Profile Change */}
      {isProfileChange && (
        <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-ink)]">
            <span className="flex items-center gap-1.5">
              <UserCog size={12} className="text-sky-500" />
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

      {/* 4. Account Deletion Request */}
      {isAccountDeletion && (
        <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink)]">
            <span className="flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-red-500 shrink-0" />
              Account Deletion Request
            </span>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
              7-day grace
            </span>
          </div>
          <div className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-ink)]">
            Reason: &ldquo;{payload.reason || item.summary || "Permanent deletion requested by user"}&rdquo;
          </div>
        </div>
      )}

      {/* 5. Shift Conflict */}
      {isShiftConflict && (
        <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink)]">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
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

      {/* 6. Registration KYC Documents */}
      {isRegistration && (
        documents.length > 0 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileText size={12} className="text-sky-500" />
                Attached Documents ({documents.length})
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              {documents.map((doc) => (
                <AttachedDocCard
                  key={doc.id}
                  doc={doc}
                  fullName={fullName}
                  userId={payload.user_id || item.requested_by || item.subject_id}
                  canDecide={canDecide}
                  isActionLoading={isActionLoading}
                  isRejectLoading={isRejectLoading}
                  onOpenDocumentLightbox={onOpenDocumentLightbox}
                  onVerifyDocument={onVerifyDocument}
                  onRejectDocumentPrompt={onRejectDocumentPrompt}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileText size={12} className="text-sky-500" />
                Attached Documents
              </span>
            </div>
            <div className="p-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-canvas)]/40 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <FileText size={13} className="text-[var(--color-mute)] shrink-0" />
              <span>No KYC statutory documents attached yet</span>
            </div>
          </div>
        )
      )}

      {/* 7. Fallback for any other custom type */}
      {!isDocVerify && !isDocReplace && !isProfileChange && !isAccountDeletion && !isShiftConflict && !isRegistration && (
        documents.length > 0 ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileText size={12} className="text-sky-500" />
                Attached Documents ({documents.length})
              </span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              {documents.map((doc) => (
                <AttachedDocCard
                  key={doc.id}
                  doc={doc}
                  fullName={fullName}
                  userId={payload.user_id || item.requested_by || item.subject_id}
                  canDecide={canDecide}
                  isActionLoading={isActionLoading}
                  isRejectLoading={isRejectLoading}
                  onOpenDocumentLightbox={onOpenDocumentLightbox}
                  onVerifyDocument={onVerifyDocument}
                  onRejectDocumentPrompt={onRejectDocumentPrompt}
                />
              ))}
            </div>
          </div>
        ) : item.summary ? (
          <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-1.5">
            <div className="flex items-center text-[11px] text-[var(--color-ink-muted)] font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                <FileText size={12} className="text-sky-500" />
                Request Details
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-ink-muted)]">
              {item.summary}
            </div>
          </div>
        ) : null
      )}

      {/* ── Card Bottom Action Bar (Optimized for Mobile & Desktop) ── */}
      <div className="pt-3 border-t border-[var(--color-border)]/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mt-auto">
        {/* Registration time ago (Bottom Left) */}
        <div
          className="flex items-center gap-1.5 text-[var(--color-ink-muted)] text-[11px] sm:text-xs font-medium tabular-nums"
          title={`Submitted on ${item.created_at}`}
        >
          <Clock size={12} className="shrink-0 text-[var(--color-mute)]" />
          <span>{formatTinyRelativeTime(item.created_at)}</span>
        </div>

        {/* Quick Approve / Reject Buttons (Strictly ONE loading spinner) */}
        {isApprovedExit ? (
          <div className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-in zoom-in-95 duration-200">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>Approved</span>
          </div>
        ) : isRejectedExit ? (
          <div className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold animate-in zoom-in-95 duration-200">
            <XCircle size={15} className="shrink-0" />
            <span>Rejected</span>
          </div>
        ) : showDecideActions ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<XCircle size={14} />}
              loading={isRejectLoading}
              disabled={isActionLoading || isRejectLoading}
              onClick={() => onRejectPrompt(item.id)}
              className="flex-1 sm:flex-initial gap-1.5 h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] px-3.5 text-xs font-semibold text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 cursor-pointer justify-center rounded-xl"
            >
              <span>Reject</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<CheckCircle2 size={14} />}
              loading={isActionLoading}
              disabled={isActionLoading || isRejectLoading}
              onClick={() => onApprove(item.id)}
              className="flex-1 sm:flex-initial gap-1.5 h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer justify-center rounded-xl"
            >
              <span>Approve</span>
            </Button>
          </div>
        ) : null}

        {/* Status notice if not pending and not actively exiting */}
        {!isPending && !isApprovedExit && !isRejectedExit && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] sm:ml-auto">
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
