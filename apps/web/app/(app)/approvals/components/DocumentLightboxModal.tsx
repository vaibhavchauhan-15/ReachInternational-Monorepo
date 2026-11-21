"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import type { AttachedDocumentSummary } from "@reachinternational/types";
import { Button } from "@/components/ui/Button";

export interface DocumentLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: AttachedDocumentSummary | null;
  userName?: string | null;
  userId?: string | null;
  onVerifyDocument?: (docId: string) => Promise<void>;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary) => void;
  canDecide?: boolean;
  isActionLoading?: boolean;
}

export function DocumentLightboxModal({
  isOpen,
  onClose,
  document: doc,
  userName,
  userId,
  onVerifyDocument,
  onRejectDocumentPrompt,
  canDecide = false,
  isActionLoading = false,
}: DocumentLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  // Auto-detect black or corrupted original document (e.g. 7,508 bytes Android Chrome canvas drop)
  const isCorruptedOriginal = Boolean(
    doc?.file_size_bytes && doc.file_size_bytes <= 9000 && doc.thumb_signed_url
  );

  const [viewMode, setViewMode] = useState<"original" | "thumbnail">("original");

  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
    setZoom(1);
    setRotation(0);

    if (!doc) {
      setResolvedUrl(null);
      return;
    }

    // Auto-switch to thumbnail if the original is detected as a corrupted black file
    if (doc.file_size_bytes && doc.file_size_bytes <= 9000 && doc.thumb_signed_url) {
      setViewMode("thumbnail");
    } else {
      setViewMode("original");
    }

    // Always prioritize the full original document (signed_url)
    if (doc.signed_url) {
      setResolvedUrl(doc.signed_url);
      return;
    }

    // Fallback: fetch original document signed URL via API if userId and document_type_code are available
    if (userId && doc.document_type_code) {
      let active = true;
      fetch(`/api/admin/documents/${userId}/${doc.document_type_code}`)
        .then(async (res) => (res.ok ? ((await res.json()) as { signedUrl?: string }) : null))
        .then((data: { signedUrl?: string } | null) => {
          if (active && data?.signedUrl) {
            setResolvedUrl(data.signedUrl);
          } else if (active) {
            setResolvedUrl(doc.thumb_signed_url || null);
          }
        })
        .catch(() => {
          if (active) setResolvedUrl(doc.thumb_signed_url || null);
        });
      return () => {
        active = false;
      };
    } else {
      setResolvedUrl(doc.signed_url || doc.thumb_signed_url || null);
    }
  }, [doc, userId]);

  if (!isOpen || !doc) return null;

  const originalUrl = resolvedUrl || doc.signed_url;
  const thumbnailUrl = doc.thumb_signed_url;

  // Resolved active image URL depending on viewMode and fallback
  const imageUrl =
    viewMode === "thumbnail" && thumbnailUrl
      ? thumbnailUrl
      : originalUrl || thumbnailUrl || null;

  const isPdf =
    doc.mime_type === "application/pdf" ||
    doc.label?.toLowerCase().endsWith(".pdf") ||
    Boolean(imageUrl && imageUrl.split("?")[0]?.toLowerCase().endsWith(".pdf"));

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const isPending = doc.verification_status === "pending";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.label} Preview`}
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] truncate">
                  {doc.label}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                    doc.verification_status === "verified"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : doc.verification_status === "rejected"
                      ? "bg-red-500/10 text-red-600 border-red-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  }`}
                >
                  {doc.verification_status}
                </span>
              </div>
              {userName && (
                <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
                  User: <span className="font-medium text-[var(--color-ink)]">{userName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Controls: Mode Switcher, Zoom, Rotate, Open in Tab, Close */}
          <div className="flex items-center gap-1 shrink-0">
            {/* View Mode Toggle (Original vs Verified Thumbnail) */}
            {thumbnailUrl && originalUrl && (
              <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-0.5 text-xs mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("original");
                    setImageLoading(true);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === "original"
                      ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xs"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                  title="View original uploaded file"
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("thumbnail");
                    setImageLoading(true);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    viewMode === "thumbnail"
                      ? "bg-[var(--color-canvas-elevated)] text-sky-600 dark:text-sky-400 shadow-2xs"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  }`}
                  title="View verified high-resolution thumbnail preview"
                >
                  Thumbnail
                  {isCorruptedOriginal && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Rotate 90°"
            >
              <RotateCw size={16} />
            </button>
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-sky-600 hover:bg-[var(--color-canvas)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Open image in new tab"
              >
                <ExternalLink size={16} />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ml-1"
              title="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image Preview Canvas */}
        <div className="relative flex-1 min-h-[320px] max-h-[68vh] overflow-auto p-4 flex items-center justify-center bg-neutral-900/40 select-none">
          {/* Corrupted Original Auto-Switch Notification */}
          {isCorruptedOriginal && viewMode === "thumbnail" && (
            <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="truncate">
                  <strong>Verified Thumbnail View:</strong> Original mobile upload was a blank file ({doc.file_size_bytes} B). Displaying verified thumbnail photo.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewMode("original")}
                className="text-[11px] font-semibold underline hover:no-underline text-amber-800 dark:text-amber-200 shrink-0"
              >
                Show Original
              </button>
            </div>
          )}

          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 size={24} className="animate-spin text-sky-500" />
              <span className="text-xs">Loading secure document...</span>
            </div>
          )}

          {imageError || !imageUrl ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-400 space-y-2">
              <FileText size={48} className="opacity-30" />
              <p className="text-xs font-medium">Document image unavailable or expired</p>
              <p className="text-[11px] text-neutral-500 max-w-xs">
                The document is securely encrypted in the vault. Please refresh or open via user profile.
              </p>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full min-h-[500px] flex items-center justify-center">
              <iframe
                src={imageUrl}
                title={doc.label}
                className="w-full h-[62vh] rounded-lg border-0 bg-white"
                onLoad={() => setImageLoading(false)}
              />
            </div>
          ) : (
            <div
              className="transition-transform duration-200 ease-out origin-center cursor-grab active:cursor-grabbing"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={doc.label}
                className="max-w-full max-h-[62vh] object-contain rounded-lg shadow-xl"
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  if (viewMode === "original" && thumbnailUrl && thumbnailUrl !== imageUrl) {
                    // Smooth automatic fallback to thumbnail if original fails to render
                    setViewMode("thumbnail");
                    setImageLoading(true);
                  } else {
                    setImageLoading(false);
                    setImageError(true);
                  }
                }}
              />
            </div>
          )}

          {/* Status Overlay if already decided */}
          {!isPending && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-lg border ${
                  doc.verification_status === "verified"
                    ? "bg-emerald-950/85 text-emerald-300 border-emerald-500/40"
                    : "bg-red-950/85 text-red-300 border-red-500/40"
                }`}
              >
                {doc.verification_status === "verified" ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-red-400" />
                )}
                <span className="capitalize">{doc.verification_status}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar: Metadata + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-canvas)] shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Encrypted statutory document in private vault</span>
            {(zoom !== 1 || rotation !== 0) && (
              <button
                type="button"
                onClick={handleReset}
                className="ml-2 text-sky-600 hover:underline text-[11px] cursor-pointer"
              >
                Reset view
              </button>
            )}
          </div>

          {/* Quick per-document action buttons (for authorized reviewers) */}
          {canDecide && isPending && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {onRejectDocumentPrompt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRejectDocumentPrompt(doc)}
                  disabled={isActionLoading}
                  className="gap-1.5 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 min-h-[38px]"
                >
                  <XCircle size={14} />
                  Reject Document
                </Button>
              )}
              {onVerifyDocument && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 size={14} />}
                  loading={isActionLoading}
                  onClick={() => onVerifyDocument(doc.id)}
                  disabled={isActionLoading}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[38px]"
                >
                  Approve Document
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
