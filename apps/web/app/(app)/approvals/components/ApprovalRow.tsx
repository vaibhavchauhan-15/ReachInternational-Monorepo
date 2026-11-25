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

// ─────────────────────────────────────────────────────────────────────
// Shared card context — every approval type renders through the same
// reusable primitives below, so the visual language stays identical.
// ─────────────────────────────────────────────────────────────────────

interface CardCtx {
  item: ApprovalRequestListItem;
  fullName: string;
  payload: Record<string, any>;
  userId?: string;
  canDecide: boolean;
  isActionLoading: boolean;
  isRejectLoading: boolean;
  onOpenDocumentLightbox?: ApprovalRowProps["onOpenDocumentLightbox"];
  onVerifyDocument?: ApprovalRowProps["onVerifyDocument"];
  onRejectDocumentPrompt?: ApprovalRowProps["onRejectDocumentPrompt"];
}

// ── Primitives ──────────────────────────────────────────────────────

function DocumentThumbnail({
  src,
  alt,
  fallbackIcon,
}: {
  src?: string | null;
  alt: string;
  fallbackIcon?: React.ReactNode;
}) {
  return <DocumentThumbnailInner key={src || "none"} src={src} alt={alt} fallbackIcon={fallbackIcon} />;
}

function DocumentThumbnailInner({
  src,
  alt,
  fallbackIcon,
}: {
  src?: string | null;
  alt: string;
  fallbackIcon?: React.ReactNode;
}) {
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
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

/** Uniform content panel used by every approval type. */
function SectionPanel({
  icon,
  title,
  rightSlot,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]/60 space-y-2">
      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink)]">
          <span className="text-sky-500 shrink-0">{icon}</span>
          {title}
        </span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

/** Compact empty-state row inside a SectionPanel. */
function PanelEmptyNote({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="p-2.5 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-canvas)]/40 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
      {icon || <FileText size={13} className="text-[var(--color-mute)] shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

/** Single identity fact — muted icon, ink value (semantic colors reserved for status). */
function Fact({
  icon,
  value,
  title,
  mono = false,
}: {
  icon: React.ReactNode;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title}>
      <span className="text-[var(--color-mute)] shrink-0">{icon}</span>
      <span
        className={`truncate text-[var(--color-ink)] font-medium ${mono ? "font-mono text-[11px]" : "text-xs"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Document chip (shared by every type that shows documents) ───────

interface DocumentChipProps {
  doc: AttachedDocumentSummary;
  fullName: string;
  userId?: string;
  canDecide: boolean;
  isActionLoading: boolean;
  isRejectLoading: boolean;
  onOpenDocumentLightbox?: CardCtx["onOpenDocumentLightbox"];
  onVerifyDocument?: CardCtx["onVerifyDocument"];
  onRejectDocumentPrompt?: CardCtx["onRejectDocumentPrompt"];
  isCurrentActive?: boolean;
}

const DocumentChip = React.memo(function DocumentChip({
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
}: DocumentChipProps) {
  const isDocPending = doc.verification_status === "pending";
  const isDocVerified = doc.verification_status === "verified";
  const isDocRejected = doc.verification_status === "rejected";
  const showInlineActions =
    canDecide && isDocPending && Boolean(onVerifyDocument) && Boolean(onRejectDocumentPrompt);

  return (
    <div className="flex flex-col items-center justify-between gap-1.5 w-28 sm:w-32 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-2xs hover:border-sky-500/40 hover:shadow-sm transition-all duration-150">
      {/* Thumbnail — click opens the lightbox */}
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

      {/* Document label */}
      <span
        className="block text-[11px] font-semibold text-[var(--color-ink)] truncate w-full text-center px-0.5 leading-tight"
        title={doc.label}
      >
        {doc.label}
      </span>

      {/* Footer: inline actions for pending docs, otherwise a status pill */}
      {isCurrentActive ? (
        <div className="w-full pt-1 border-t border-[var(--color-border)]/60 flex justify-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <CheckCircle2 size={11} className="shrink-0" />
            <span>Active</span>
          </span>
        </div>
      ) : showInlineActions ? (
        <div className="flex items-center gap-1.5 w-full pt-1 border-t border-[var(--color-border)]/60 justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRejectDocumentPrompt?.(doc, userId);
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
              onVerifyDocument?.(doc.id, userId);
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
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${isDocVerified
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
});

/** Horizontal document strip used by every document-bearing approval type. */
function DocumentStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
      {children}
    </div>
  );
}

// ── Type-driven content renderers (one per approval type) ───────────

function DocumentsBody({
  ctx,
  docs,
  chipsCanDecide,
  emptyNote,
}: {
  ctx: CardCtx;
  docs: AttachedDocumentSummary[];
  chipsCanDecide: boolean;
  emptyNote: string;
}) {
  return docs.length > 0 ? (
    <DocumentStrip>
      {docs.map((doc) => (
        <DocumentChip
          key={doc.id}
          doc={doc}
          fullName={ctx.fullName}
          userId={ctx.userId}
          canDecide={chipsCanDecide}
          isActionLoading={ctx.isActionLoading}
          isRejectLoading={ctx.isRejectLoading}
          onOpenDocumentLightbox={ctx.onOpenDocumentLightbox}
          onVerifyDocument={ctx.onVerifyDocument}
          onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
        />
      ))}
    </DocumentStrip>
  ) : (
    <PanelEmptyNote text={emptyNote} />
  );
}

function RegistrationBody({ ctx }: { ctx: CardCtx }) {
  const docs = ctx.item.documents || [];
  return (
    <SectionPanel
      icon={<FileText size={12} />}
      title={`Attached Documents (${docs.length})`}
    >
      <DocumentsBody
        ctx={ctx}
        docs={docs}
        chipsCanDecide={ctx.canDecide}
        emptyNote="No KYC statutory documents attached yet"
      />
    </SectionPanel>
  );
}

function DocumentVerifyBody({ ctx }: { ctx: CardCtx }) {
  const docs = ctx.item.documents || [];
  const payload = ctx.payload;
  const singleDocTarget =
    docs.find(
      (d) =>
        d.id === ctx.item.subject_id ||
        d.document_type_code === payload.document_type_code
    ) ||
    docs[0] ||
    null;

  if (docs.length > 1) {
    return (
      <SectionPanel
        icon={<FileCheck2 size={12} />}
        title={`Documents for Verification (${docs.length})`}
      >
        <DocumentsBody
          ctx={ctx}
          docs={docs}
          chipsCanDecide={ctx.canDecide}
          emptyNote="Statutory KYC document pending administrative review"
        />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel icon={<FileCheck2 size={12} />} title="Document for Verification">
      {singleDocTarget ? (
        <DocumentStrip>
          <DocumentChip
            doc={singleDocTarget}
            fullName={ctx.fullName}
            userId={ctx.userId}
            canDecide={false}
            isActionLoading={ctx.isActionLoading}
            isRejectLoading={ctx.isRejectLoading}
            onOpenDocumentLightbox={ctx.onOpenDocumentLightbox}
            onVerifyDocument={ctx.onVerifyDocument}
            onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
          />
        </DocumentStrip>
      ) : (
        <PanelEmptyNote text="Statutory KYC document pending administrative review" />
      )}
    </SectionPanel>
  );
}

function DocumentReplaceBody({ ctx }: { ctx: CardCtx }) {
  const { item, payload } = ctx;
  const docs = item.documents || [];

  const replacementDocs = docs.filter(
    (d) => d.id === item.id || d.label?.includes("(Replacement)")
  );
  if (replacementDocs.length === 0 && docs.length > 0) {
    replacementDocs.push(docs[0]);
  }
  const isMultiReplacement = replacementDocs.length > 1;

  const activeDocBeingReplaced = !isMultiReplacement
    ? docs.find(
      (d) =>
        !replacementDocs.includes(d) &&
        d.document_type_code === payload.document_type_code
    ) || null
    : null;

  const docTypeName = (payload.document_type_code || replacementDocs[0]?.label || "Document").replace(
    /_/g,
    " "
  );

  return (
    <SectionPanel
      icon={<RefreshCw size={12} />}
      title={
        isMultiReplacement
          ? `Replacement Documents (${replacementDocs.length})`
          : `Replacement: ${docTypeName}`
      }
      rightSlot={
        activeDocBeingReplaced ? (
          <button
            type="button"
            onClick={() =>
              ctx.onOpenDocumentLightbox?.(
                activeDocBeingReplaced,
                `${ctx.fullName} (Current Active)`,
                ctx.userId
              )
            }
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            title="Click to view current active approved document"
          >
            <Eye size={12} />
            <span>View Current Active</span>
          </button>
        ) : null
      }
    >
      <DocumentStrip>
        {replacementDocs.map((rDoc) => (
          <DocumentChip
            key={rDoc.id}
            doc={{
              ...rDoc,
              label: rDoc.label?.includes("(Replacement)")
                ? rDoc.label
                : `${rDoc.label || docTypeName} (Replacement)`,
            }}
            fullName={ctx.fullName}
            userId={ctx.userId}
            canDecide={ctx.canDecide && isMultiReplacement}
            isActionLoading={ctx.isActionLoading}
            isRejectLoading={ctx.isRejectLoading}
            onOpenDocumentLightbox={ctx.onOpenDocumentLightbox}
            onVerifyDocument={ctx.onVerifyDocument}
            onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
          />
        ))}
        {activeDocBeingReplaced && (
          <DocumentChip
            key={activeDocBeingReplaced.id}
            doc={{
              ...activeDocBeingReplaced,
              label: `${activeDocBeingReplaced.label || docTypeName} (Active)`,
            }}
            fullName={ctx.fullName}
            userId={ctx.userId}
            canDecide={false}
            isActionLoading={false}
            isRejectLoading={false}
            onOpenDocumentLightbox={ctx.onOpenDocumentLightbox}
            isCurrentActive={true}
          />
        )}
      </DocumentStrip>
    </SectionPanel>
  );
}

function ProfileChangeBody({ ctx }: { ctx: CardCtx }) {
  const { payload, item } = ctx;
  const changes: [string, any][] = payload.changes
    ? Object.entries(payload.changes)
    : [];
  const visibleChanges = changes.slice(0, 3);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <SectionPanel
      icon={<UserCog size={12} />}
      title="Profile Modifications Requested"
      rightSlot={
        payload.reason ? (
          <span className="text-[10px] text-[var(--color-ink-muted)] italic truncate max-w-[200px]">
            &ldquo;{payload.reason}&rdquo;
          </span>
        ) : null
      }
    >
      {visibleChanges.length > 0 ? (
        <div className="space-y-1">
          {visibleChanges.map(([field, val]) => {
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
          {hiddenCount > 0 && (
            <p className="text-[10px] text-[var(--color-mute)] px-2.5">
              +{hiddenCount} more change{hiddenCount > 1 ? "s" : ""} in request details
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-ink-muted)]">
          {item.summary || "Sensitive profile changes pending review."}
        </p>
      )}
    </SectionPanel>
  );
}

function AccountDeletionBody({ ctx }: { ctx: CardCtx }) {
  const { payload, item } = ctx;
  return (
    <SectionPanel
      icon={<ShieldAlert size={12} className="text-red-500" />}
      title="Account Deletion Request"
      rightSlot={
        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
          7-day grace
        </span>
      }
    >
      <div className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-ink)]">
        Reason: &ldquo;{payload.reason || item.summary || "Permanent deletion requested by user"}&rdquo;
      </div>
    </SectionPanel>
  );
}

function ShiftConflictBody({ ctx }: { ctx: CardCtx }) {
  const { payload, item } = ctx;
  return (
    <SectionPanel
      icon={<AlertTriangle size={12} className="text-amber-500" />}
      title="Shift Conflict / Override"
    >
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
    </SectionPanel>
  );
}

function FallbackBody({ ctx }: { ctx: CardCtx }) {
  const docs = ctx.item.documents || [];
  if (docs.length > 0) {
    return (
      <SectionPanel icon={<FileText size={12} />} title={`Attached Documents (${docs.length})`}>
        <DocumentsBody
          ctx={ctx}
          docs={docs}
          chipsCanDecide={ctx.canDecide}
          emptyNote="No documents attached"
        />
      </SectionPanel>
    );
  }
  if (ctx.item.summary) {
    return (
      <SectionPanel icon={<FileText size={12} />} title="Request Details">
        <div className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-ink-muted)]">
          {ctx.item.summary}
        </div>
      </SectionPanel>
    );
  }
  return null;
}

// ── Registry: type_key → content body ───────────────────────────────

const TYPE_BODY: Record<string, React.ComponentType<{ ctx: CardCtx }>> = {
  registration: RegistrationBody,
  document_verify: DocumentVerifyBody,
  document_replace: DocumentReplaceBody,
  profile_change: ProfileChangeBody,
  account_deletion: AccountDeletionBody,
  shift_conflict: ShiftConflictBody,
};

// ── Registry: type_key → which user-data facts are relevant ─────────

type FactKey = "email" | "phone" | "fleet" | "supervisor";

const TYPE_FACTS: Record<string, FactKey[]> = {
  registration: ["email", "phone", "fleet", "supervisor"],
  document_verify: ["email", "phone"],
  document_replace: ["email", "phone"],
  profile_change: ["email"],
  account_deletion: ["email"],
  shift_conflict: ["fleet", "supervisor"],
};

const FALLBACK_FACTS: FactKey[] = ["email", "phone", "fleet", "supervisor"];

// ─────────────────────────────────────────────────────────────────────
// The single reusable approval card — every approval type renders
// through this shell (header → identity → type body → action footer).
// ─────────────────────────────────────────────────────────────────────

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
  const showDecideActions = isPending && canDecide && Boolean(onApprove) && Boolean(onRejectPrompt);
  const isApprovedExit = exitState === "approved";
  const isRejectedExit = exitState === "rejected";

  // Identity resolution
  const payload = item.payload || {};
  const fullName = item.requester_name || item.subject_label || "Applicant";
  const empId = item.employee_id;
  const role = item.role;

  const isOperator =
    role?.toLowerCase() === "operator" ||
    payload.role?.toLowerCase() === "operator";
  const supervisorName =
    item.supervisor_name ||
    payload.supervisor_name ||
    payload.supervisorName ||
    null;

  // Type-driven content + user-data facts ("show the data the approval needs")
  const TypeBody = TYPE_BODY[item.type_key] || FallbackBody;
  const factKeys = TYPE_FACTS[item.type_key] || FALLBACK_FACTS;

  const ctx: CardCtx = {
    item,
    fullName,
    payload,
    userId: payload.user_id || item.requested_by || item.subject_id || undefined,
    canDecide,
    isActionLoading,
    isRejectLoading,
    onOpenDocumentLightbox,
    onVerifyDocument,
    onRejectDocumentPrompt,
  };

  return (
    <div
      id={`approval-row-${item.id}`}
      className={`w-full relative flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-all duration-300 gap-3 ${isApprovedExit
          ? "border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/25 ring-1 ring-emerald-500/30 shadow-md"
          : isRejectedExit
            ? "border-red-500/80 bg-red-50/40 dark:bg-red-950/25 ring-1 ring-red-500/30 shadow-md"
            : "border-[var(--color-border)] bg-[var(--color-canvas-elevated)] hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-md"
        }`}
    >
      {/* ── Header: type / status / role / priority chips ── */}
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

      {/* ── Identity: name + employee chip + per-type user-data facts ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3
            className={`text-sm sm:text-base font-bold tracking-tight text-[var(--color-ink)] leading-snug ${onSelect ? "cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors" : ""}`}
            onClick={onSelect ? () => onSelect(item) : undefined}
          >
            {fullName}
          </h3>
          {empId && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] text-[11px] font-mono font-semibold text-[var(--color-ink)]">
              <Hash size={10} className="text-purple-500 shrink-0" />
              <span>{empId}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {factKeys.includes("email") && item.email && (
            <Fact icon={<Mail size={12} />} value={item.email} />
          )}
          {factKeys.includes("phone") && item.phone && (
            <Fact icon={<Phone size={12} />} value={item.phone} mono />
          )}
          {factKeys.includes("fleet") && item.machine_category && (
            <Fact
              icon={<Wrench size={12} />}
              value={`Fleet: ${item.machine_category}`}
            />
          )}
          {factKeys.includes("supervisor") && isOperator && (
            <Fact
              icon={<UserCheck size={12} />}
              value={`Supervisor: ${supervisorName || "Unassigned"}`}
              title={`Supervisor: ${supervisorName || "Unassigned"}`}
            />
          )}
        </div>
      </div>

      {/* ── Type-specific content (same panel + primitives for every type) ── */}
      <TypeBody ctx={ctx} />

      {/* ── Footer: submitted time + decision controls ── */}
      <div className="pt-3 border-t border-[var(--color-border)]/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mt-auto">
        <div
          className="flex items-center gap-1.5 text-[var(--color-ink-muted)] text-[11px] sm:text-xs font-medium tabular-nums"
          title={`Submitted on ${item.created_at}`}
        >
          <Clock size={12} className="shrink-0 text-[var(--color-mute)]" />
          <span>{formatTinyRelativeTime(item.created_at)}</span>
        </div>

        {/* Quick Approve / Reject (Strictly ONE loading spinner) */}
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
              onClick={() => onRejectPrompt?.(item.id)}
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
              onClick={() => onApprove?.(item.id)}
              className="flex-1 sm:flex-initial gap-1.5 h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer justify-center rounded-xl"
            >
              <span>Approve</span>
            </Button>
          </div>
        ) : null}

        {/* Status notice for terminal states without an exit animation */}
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
