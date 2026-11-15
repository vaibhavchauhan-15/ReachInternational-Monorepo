"use client";

import React, { useState } from "react";
import type { ApprovalRequest } from "@reachinternational/types";
import { ApprovalTypeBadge } from "./ApprovalTypeBadge";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { Button } from "@/components/ui/Button";
import {
  formatExactTimestamp,
  formatTinyRelativeTime,
} from "@reachinternational/utils";
import {
  Check,
  X,
  FileText,
  User,
  Clock,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Calendar,
} from "lucide-react";

export interface ApprovalDetailPanelProps {
  request: ApprovalRequest | null;
  isLoading?: boolean;
  onApprove: (requestId: string) => Promise<void>;
  onRejectPrompt: (request: ApprovalRequest) => void;
  isActionLoading?: boolean;
  onClose?: () => void;
  canDecide?: boolean;
}

export function ApprovalDetailPanel({
  request,
  isLoading = false,
  onApprove,
  onRejectPrompt,
  isActionLoading = false,
  onClose,
  canDecide = true,
}: ApprovalDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "payload">("detail");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-[var(--color-ink-muted)]">
        <Loader2 size={24} className="animate-spin mb-2 text-sky-600" />
        <p className="text-xs">Loading request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[var(--color-ink-muted)]">
        <div className="p-3 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-border)] mb-3">
          <FileText size={28} className="opacity-40" />
        </div>
        <p className="text-sm font-medium text-[var(--color-ink)]">Select an approval request</p>
        <p className="text-xs mt-1 max-w-xs">
          Choose a request from the list to inspect its proposed changes, metadata, and audit trail.
        </p>
      </div>
    );
  }

  const isPending = request.status === "pending";
  const payload = (request.payload || {}) as Record<string, any>;

  return (
    <div className="flex flex-col h-full bg-[var(--color-canvas-elevated)] border-l border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--color-border)] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ApprovalTypeBadge
              typeKey={request.type_key}
              typeLabel={request.type?.label}
            />
            <ApprovalStatusBadge status={request.status} />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-ink)] leading-snug">
            {request.summary}
          </h2>
          {request.subject_label && (
            <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
              Subject: <span className="font-medium text-[var(--color-ink)]">{request.subject_label}</span>
            </p>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
            <User size={13} className="shrink-0" />
            <span className="truncate">
              By: <span className="text-[var(--color-ink)] font-medium">{request.requester_name || "System"}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
            <Clock size={13} className="shrink-0" />
            <span>{formatTinyRelativeTime(request.created_at)}</span>
          </div>
          {request.expires_at && isPending && (
            <div className="col-span-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Calendar size={13} className="shrink-0" />
              <span>Expires: {formatExactTimestamp(request.expires_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs / Sub-header */}
      <div className="flex border-b border-[var(--color-border)] px-4 bg-[var(--color-canvas)]/50 shrink-0">
        <button
          onClick={() => setActiveTab("detail")}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "detail"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          }`}
        >
          Proposed Changes
        </button>
        <button
          onClick={() => setActiveTab("payload")}
          className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "payload"
              ? "border-sky-600 text-sky-600 font-semibold"
              : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          }`}
        >
          Raw Payload
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {activeTab === "detail" ? (
          <div>
            {/* 1. Document Verification */}
            {request.type_key === "document_verify" && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-2">
                  <div className="text-xs text-[var(--color-ink-muted)]">Document Type</div>
                  <div className="text-sm font-semibold capitalize text-[var(--color-ink)]">
                    {(payload.document_type_code || "").replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-[var(--color-ink-muted)] truncate">
                    Storage Path: <code className="text-xs">{payload.storage_path}</code>
                  </div>
                </div>

                {payload.storage_path && (
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] text-center space-y-2">
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      Document verified in secure vault
                    </p>
                    <a
                      href={`/api/admin/documents/${payload.user_id}/${payload.document_type_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium underline"
                    >
                      <ExternalLink size={13} />
                      Open Full Document
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 2. Profile Change Diff */}
            {request.type_key === "profile_change" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Proposed changes to user profile attributes:
                </p>
                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden divide-y divide-[var(--color-border)] bg-[var(--color-canvas)]">
                  {Object.entries(payload.changes || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="p-3 text-xs grid grid-cols-3 gap-2">
                      <div className="font-medium text-[var(--color-ink)] capitalize">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="text-red-600 dark:text-red-400 line-through truncate">
                        {val?.old_value !== undefined && val?.old_value !== null
                          ? String(val.old_value)
                          : "(empty)"}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                        {val?.new_value !== undefined && val?.new_value !== null
                          ? String(val.new_value)
                          : "(empty)"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. New User Registration */}
            {request.type_key === "registration" && (
              <div className="border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)] bg-[var(--color-canvas)] text-xs">
                <div className="p-3 flex justify-between">
                  <span className="text-[var(--color-ink-muted)]">Full Name</span>
                  <span className="font-semibold text-[var(--color-ink)]">{payload.full_name}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[var(--color-ink-muted)]">Email</span>
                  <span className="font-medium text-[var(--color-ink)]">{payload.email}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[var(--color-ink-muted)]">Assigned Role</span>
                  <span className="font-semibold uppercase text-sky-600">{payload.role}</span>
                </div>
                {payload.phone && (
                  <div className="p-3 flex justify-between">
                    <span className="text-[var(--color-ink-muted)]">Phone</span>
                    <span>{payload.phone}</span>
                  </div>
                )}
                {payload.machine_category && (
                  <div className="p-3 flex justify-between">
                    <span className="text-[var(--color-ink-muted)]">Machine Fleet</span>
                    <span>{payload.machine_category}</span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Document Replacement */}
            {request.type_key === "document_replace" && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-1.5">
                  <div className="text-[var(--color-ink-muted)]">Replacing Document</div>
                  <div className="font-semibold capitalize text-[var(--color-ink)]">
                    {(payload.document_type_code || "").replace(/_/g, " ")}
                  </div>
                  <div className="text-amber-600 dark:text-amber-400">
                    Staged: <code>{payload.staging_path}</code>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Account Deletion */}
            {request.type_key === "account_deletion" && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <ShieldAlert size={16} />
                  Account Deletion Request
                </div>
                <p className="text-[var(--color-ink)]">
                  User Reason: &ldquo;{payload.reason || "Not specified"}&rdquo;
                </p>
                <p className="text-[var(--color-ink-muted)]">
                  Cooling-off grace period: 7 days. Hard deletion will occur following the grace window.
                </p>
              </div>
            )}

            {/* Audit / Decision Note if decided */}
            {!isPending && (
              <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] text-xs space-y-1">
                <div className="font-medium text-[var(--color-ink)]">Decision Details</div>
                <p className="text-[var(--color-ink-muted)]">
                  Status: <span className="font-semibold capitalize">{request.status}</span>
                </p>
                {request.decided_at && (
                  <p className="text-[var(--color-ink-muted)]">
                    Decided on: {formatExactTimestamp(request.decided_at)}
                  </p>
                )}
                {request.decision_note && (
                  <p className="text-[var(--color-ink)] pt-1">
                    Note: &ldquo;{request.decision_note}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Action Bar (Sticky at bottom) */}
      {isPending && canDecide && (
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-canvas)]/80 backdrop-blur-xs flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRejectPrompt(request)}
            disabled={isActionLoading}
            className="gap-1.5"
          >
            <X size={14} />
            Reject
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onApprove(request.id)}
            disabled={isActionLoading}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isActionLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
