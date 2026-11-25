"use client";

import React, { useState, useEffect } from "react";
import type { ApprovalRequest } from "@reachinternational/types";
import { ApprovalTypeBadge } from "./ApprovalTypeBadge";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  ShieldCheck,
  Loader2,
  Calendar,
  Wrench,
  MapPin,
  Phone,
  Mail,
  Eye,
  AlertTriangle,
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

interface AttachedUserDoc {
  id: string;
  document_type_code: string;
  storage_path: string;
  thumb_path: string | null;
  verification_status: string;
  signedUrl?: string | null;
}

export function ApprovalDetailPanel(props: ApprovalDetailPanelProps) {
  return <ApprovalDetailPanelInner key={props.request?.id || "empty"} {...props} />;
}

function ApprovalDetailPanelInner({
  request,
  isLoading = false,
  onApprove,
  onRejectPrompt,
  isActionLoading = false,
  onClose,
  canDecide = true,
}: ApprovalDetailPanelProps) {
  // Single document URL state (for document_verify & document_replace)
  const [docSignedUrl, setDocSignedUrl] = useState<string | null>(null);
  const [isSigningDoc, setIsSigningDoc] = useState(false);

  // Registration attached documents state
  const [regDocs, setRegDocs] = useState<AttachedUserDoc[]>([]);
  const [isLoadingRegDocs, setIsLoadingRegDocs] = useState(false);

  const payload = (request?.payload || {}) as Record<string, any>;
  const isPending = request?.status === "pending";

  useEffect(() => {
    if (!request) {
      return;
    }

    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    // 1. Resolve signed URL for single document verification or replacement
    async function resolveSingleDocUrl() {
      const storagePath =
        request?.type_key === "document_replace"
          ? payload.staging_path
          : payload.storage_path;

      if (!storagePath) {
        setDocSignedUrl(null);
        return;
      }

      setIsSigningDoc(true);
      try {
        const bucket =
          request?.type_key === "document_replace" ? "doc_staging" : "user_files";
        const cleanPath = String(storagePath).replace(/^\/+/, "");
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 3600);

        if (isMounted) {
          if (!error && data?.signedUrl) {
            setDocSignedUrl(data.signedUrl);
          } else {
            setDocSignedUrl(null);
          }
        }
      } catch {
        if (isMounted) setDocSignedUrl(null);
      } finally {
        if (isMounted) setIsSigningDoc(false);
      }
    }

    // 2. Resolve attached documents for registration approval
    async function resolveRegistrationDocs() {
      const targetUserId = payload.user_id || request?.subject_id;
      if (!targetUserId || request?.type_key !== "registration") {
        setRegDocs([]);
        return;
      }

      setIsLoadingRegDocs(true);
      try {
        const { data: rawDocs, error } = await supabase
          .from("user_documents")
          .select("id, document_type_code, storage_path, thumb_path, verification_status")
          .eq("user_id", targetUserId);

        const docs = (rawDocs || []) as AttachedUserDoc[];

        if (error || docs.length === 0) {
          if (isMounted) setRegDocs([]);
          return;
        }

        const pathsToSign = docs
          .map((d: AttachedUserDoc) => d.storage_path)
          .filter((p: string | null): p is string => Boolean(p))
          .map((p: string) => p.replace(/^\/+/, ""));

        const urlMap: Record<string, string> = {};
        if (pathsToSign.length > 0) {
          const { data: signedResults } = await supabase.storage
            .from("user_files")
            .createSignedUrls(pathsToSign, 3600);

          if (signedResults) {
            for (const item of signedResults) {
              if (item?.path && item.signedUrl && !item.error) {
                urlMap[item.path] = item.signedUrl;
              }
            }
          }
        }

        if (isMounted) {
          setRegDocs(
            docs.map((d: AttachedUserDoc) => {
              const clean = d.storage_path ? d.storage_path.replace(/^\/+/, "") : "";
              return {
                ...d,
                signedUrl: clean ? urlMap[clean] || null : null,
              };
            })
          );
        }
      } catch {
        if (isMounted) setRegDocs([]);
      } finally {
        if (isMounted) setIsLoadingRegDocs(false);
      }
    }

    if (request.type_key === "document_verify" || request.type_key === "document_replace") {
      resolveSingleDocUrl();
    } else if (request.type_key === "registration") {
      resolveRegistrationDocs();
    }

    return () => {
      isMounted = false;
    };
  }, [request?.id, request?.type_key, payload.storage_path, payload.staging_path, payload.user_id]);

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

  return (
    <div className="flex flex-col h-full bg-[var(--color-canvas-elevated)] overflow-hidden">
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* 1. Document Verification */}
        {request.type_key === "document_verify" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-2">
              <div className="text-xs text-[var(--color-ink-muted)]">Document Type</div>
              <div className="text-sm font-semibold capitalize text-[var(--color-ink)]">
                {(payload.document_type_code || "").replace(/_/g, " ")}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-3">
              <div className="text-xs font-semibold text-[var(--color-ink)] tracking-wide uppercase">
                Document Preview
              </div>

              {isSigningDoc ? (
                <div className="flex flex-col items-center justify-center p-8 text-[var(--color-ink-muted)]">
                  <Loader2 size={20} className="animate-spin mb-2 text-sky-600" />
                  <p className="text-xs">Generating secure preview...</p>
                </div>
              ) : docSignedUrl ? (
                <div className="space-y-3">
                  <div className="relative mx-auto max-w-sm h-52 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] group">
                    <img
                      src={docSignedUrl}
                      alt="Document preview"
                      className="w-full h-full object-contain"
                    />
                    <a
                      href={docSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium gap-1.5 transition-opacity"
                    >
                      <Eye size={16} />
                      View Fullscreen
                    </a>
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={docSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
                    >
                      <ExternalLink size={14} />
                      Open Full Document
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[var(--color-canvas-elevated)] text-center text-xs text-[var(--color-ink-muted)]">
                  <FileText size={24} className="mx-auto mb-1.5 opacity-50" />
                  <p>Document securely held in user_files vault.</p>
                  {payload.storage_path && (
                    <p className="mt-1 font-mono text-[11px] opacity-70 truncate">
                      {payload.storage_path}
                    </p>
                  )}
                </div>
              )}
            </div>
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
          <div className="space-y-4 text-xs">
            {/* Applicant Profile Card */}
            <div className="border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)] bg-[var(--color-canvas)]">
              <div className="p-3 flex justify-between items-center">
                <span className="text-[var(--color-ink-muted)]">Full Name</span>
                <span className="font-semibold text-[var(--color-ink)]">{payload.full_name}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-[var(--color-ink-muted)]">Email</span>
                <span className="font-medium text-[var(--color-ink)]">{payload.email}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-[var(--color-ink-muted)]">Assigned Role</span>
                <Badge variant="info" className="font-semibold uppercase">
                  {payload.role || "OPERATOR"}
                </Badge>
              </div>
              {payload.phone && (
                <div className="p-3 flex justify-between items-center">
                  <span className="text-[var(--color-ink-muted)]">Phone</span>
                  <span>{payload.phone}</span>
                </div>
              )}
              {payload.machine_category && (
                <div className="p-3 flex justify-between items-center">
                  <span className="text-[var(--color-ink-muted)]">Machine Fleet</span>
                  <span>{payload.machine_category}</span>
                </div>
              )}
              {(payload.role === "operator" || (request as any).role === "operator") && (
                <div className="p-3 flex justify-between items-center">
                  <span className="text-[var(--color-ink-muted)]">Supervisor</span>
                  <span className="font-medium text-[var(--color-ink)]">
                    {(request as any).supervisor_name || payload.supervisor_name || payload.supervisorName || "Unassigned"}
                  </span>
                </div>
              )}
              {(payload.city || payload.state) && (
                <div className="p-3 flex justify-between items-center">
                  <span className="text-[var(--color-ink-muted)]">Location</span>
                  <span>
                    {[payload.street, payload.city, payload.district, payload.state]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              {request.subject_id && (
                <div className="p-3 flex justify-end">
                  <a
                    href={`/users/${request.subject_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium"
                  >
                    <ExternalLink size={13} />
                    View Full Profile & Activity
                  </a>
                </div>
              )}
            </div>

            {/* Attached KYC Documents */}
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-3">
              <div className="text-xs font-semibold text-[var(--color-ink)] tracking-wide uppercase">
                Attached Documents
              </div>

              {isLoadingRegDocs ? (
                <div className="flex flex-col items-center justify-center p-6 text-[var(--color-ink-muted)]">
                  <Loader2 size={20} className="animate-spin mb-2 text-sky-600" />
                  <p className="text-xs">Loading applicant documents...</p>
                </div>
              ) : regDocs.length === 0 ? (
                <div className="p-4 rounded-lg bg-[var(--color-canvas-elevated)] text-center text-xs text-[var(--color-ink-muted)]">
                  <FileText size={20} className="mx-auto mb-1 opacity-50" />
                  <p>Documents will finalize upon registration approval.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {regDocs.map((rd) => {
                    const docLabel = rd.document_type_code.replace(/_/g, " ").toUpperCase();
                    return (
                      <div
                        key={rd.id}
                        className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] space-y-2 flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-12 h-12 rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas)] shrink-0 flex items-center justify-center">
                            {rd.signedUrl ? (
                              <img
                                src={rd.signedUrl}
                                alt={docLabel}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText size={18} className="text-[var(--color-ink-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--color-ink)] truncate text-xs">
                              {docLabel}
                            </p>
                            <Badge
                              variant={rd.verification_status === "verified" ? "success" : "neutral"}
                              className="mt-1 text-[10px]"
                            >
                              {rd.verification_status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        {rd.signedUrl && (
                          <a
                            href={rd.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-[11px] font-medium bg-[var(--color-canvas)] border border-[var(--color-border)] hover:bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] transition-colors"
                          >
                            <Eye size={12} />
                            View Full Document
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Document Replacement */}
        {request.type_key === "document_replace" && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-1.5">
              <div className="text-[var(--color-ink-muted)]">Replacing Document</div>
              <div className="font-semibold capitalize text-sm text-[var(--color-ink)]">
                {(payload.document_type_code || "").replace(/_/g, " ")}
              </div>
              <p className="text-[var(--color-ink-muted)] text-[11px]">
                Upon approval, this staged file will overwrite the canonical user document.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] space-y-3">
              <div className="text-xs font-semibold text-[var(--color-ink)] tracking-wide uppercase">
                Staged Replacement Preview
              </div>

              {isSigningDoc ? (
                <div className="flex flex-col items-center justify-center p-6 text-[var(--color-ink-muted)]">
                  <Loader2 size={20} className="animate-spin mb-2 text-sky-600" />
                  <p className="text-xs">Generating secure preview...</p>
                </div>
              ) : docSignedUrl ? (
                <div className="space-y-3">
                  <div className="relative mx-auto max-w-sm h-48 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] group">
                    <img
                      src={docSignedUrl}
                      alt="Staged document preview"
                      className="w-full h-full object-contain"
                    />
                    <a
                      href={docSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium gap-1.5 transition-opacity"
                    >
                      <Eye size={16} />
                      Inspect Fullscreen
                    </a>
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={docSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                    >
                      <ExternalLink size={14} />
                      Inspect Staged Replacement
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[var(--color-canvas-elevated)] text-center text-xs text-[var(--color-ink-muted)]">
                  <FileText size={20} className="mx-auto mb-1 opacity-50" />
                  <p>Staged document held in doc_staging.</p>
                  {payload.staging_path && (
                    <p className="mt-1 font-mono text-[11px] opacity-70 truncate">
                      {payload.staging_path}
                    </p>
                  )}
                </div>
              )}
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

        {/* 6. Shift Conflict */}
        {request.type_key === "shift_conflict" && (
          <div className="border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)] bg-[var(--color-canvas)] text-xs">
            <div className="p-3.5 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle size={16} />
              Shift Conflict / Override Request
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[var(--color-ink-muted)]">Machine</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {payload.machine_code || payload.machine_id || "—"}
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[var(--color-ink-muted)]">Operator</span>
              <span className="font-medium text-[var(--color-ink)]">
                {payload.operator_name || payload.operator_id || "—"}
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[var(--color-ink-muted)]">Date & Shift</span>
              <span>
                {payload.log_date || "—"} ({payload.shift_code || "—"})
              </span>
            </div>
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

      {/* Action Bar (Sticky at bottom) */}
      {isPending && canDecide && (
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-canvas)]/80 backdrop-blur-xs flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            icon={<X size={14} />}
            onClick={() => onRejectPrompt(request)}
            disabled={isActionLoading}
            className="gap-1.5"
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Check size={14} />}
            loading={isActionLoading}
            onClick={() => onApprove(request.id)}
            disabled={isActionLoading}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
