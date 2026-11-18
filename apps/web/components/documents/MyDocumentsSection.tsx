"use client";

import { useState, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  FileText,
  Upload,
  ShieldCheck,
  Building,
  CreditCard,
  FileCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useMyDocuments, type MyDocumentItem } from "@/lib/hooks/useMyDocuments";
import { DOC_UPLOAD, type DocType } from "@reachinternational/utils";
import { DocumentViewerModal, type ViewerDocument } from "./DocumentViewerModal";
import { useToast } from "@/components/ui";

const DOC_METADATA: Record<
  DocType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    required: boolean;
  }
> = {
  bank_document: {
    label: "Bank Account / Cheque",
    description: "Cancelled cheque, bank passbook, or account statement with clear IFSC and account number.",
    icon: Building,
    required: true,
  },
  aadhaar: {
    label: "Aadhaar Card",
    description: "Front & back of your Aadhaar card with legible 12-digit UID number.",
    icon: CreditCard,
    required: true,
  },
  driving_license: {
    label: "Driving License",
    description: "Valid driving license issued by RTO with legible license number and validity date.",
    icon: FileCheck,
    required: true,
  },
};

export function MyDocumentsSection() {
  const { data: documents, isLoading, isError, error, refetch, getFullImageUrl, replaceMutation } =
    useMyDocuments();
  const { toast } = useToast();

  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null);
  const [openingDocCode, setOpeningDocCode] = useState<string | null>(null);
  const [processingDocCode, setProcessingDocCode] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleOpenFullImage = async (doc: MyDocumentItem, title: string) => {
    try {
      setOpeningDocCode(doc.document_type_code);
      // If we already have a signedUrl in doc, use it; otherwise generate on demand
      const signedUrl = doc.signedUrl || (await getFullImageUrl(doc.storage_path, doc.id, doc.isPendingChangeRequest));
      setActiveViewerDoc({
        id: doc.id,
        title,
        url: signedUrl,
        mimeType: doc.mime_type || "image/jpeg",
        fileSizeBytes: doc.file_size_bytes,
        fileName: doc.file_name,
      });
    } catch (err: any) {
      console.error("[MyDocumentsSection] Failed to load full document image:", err);
      toast("error", "Failed to Load Document", err?.message || "Could not generate secure view URL.");
    } finally {
      setOpeningDocCode(null);
    }
  };

  const handleFileChange = async (docType: DocType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file fires change
    event.target.value = "";

    // 1. Instant local preview
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviews((prev) => ({ ...prev, [docType]: objectUrl }));

    try {
      setProcessingDocCode(docType);
      const res = await replaceMutation.mutateAsync({ docType, file });

      if (res.approvedImmediately) {
        toast(
          "success",
          "Document Updated",
          "Your replacement document has been verified and updated immediately."
        );
      } else {
        toast(
          "success",
          "Replacement Submitted",
          "Your replacement document is now pending administrator review. Your existing document remains active."
        );
      }
    } catch (err: any) {
      console.error("[MyDocumentsSection] Replacement error:", err);
      toast("error", "Replacement Failed", err?.message || "Failed to submit document replacement.");
      // Rollback local preview on error
      setLocalPreviews((prev) => {
        const copy = { ...prev };
        delete copy[docType];
        return copy;
      });
    } finally {
      setProcessingDocCode(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
          <div className="h-4 w-32 bg-[var(--color-hairline)] animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 space-y-3 animate-pulse"
            >
              <div className="h-28 bg-[var(--color-hairline)]/50 rounded-xl" />
              <div className="h-4 w-3/4 bg-[var(--color-hairline)] rounded" />
              <div className="h-3 w-1/2 bg-[var(--color-hairline)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 border border-rose-500/20 bg-rose-500/5 rounded-2xl text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-[var(--color-ink)]">Failed to load documents</h3>
        <p className="text-xs text-[var(--color-mute)]">
          {error instanceof Error ? error.message : "An error occurred while loading your documents."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-ink)] text-[var(--color-canvas)] hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  const docsMap = new Map<string, MyDocumentItem>();
  for (const doc of documents || []) {
    docsMap.set(doc.document_type_code, doc);
  }

  return (
    <div className="space-y-4">
      {/* ─── Section Header ─── */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
            My Verification Documents
          </h2>
        </div>
        <span className="text-[10px] text-[var(--color-mute)] font-medium">
          Zero-hop direct encrypted storage
        </span>
      </div>

      {/* ─── Document Cards Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DOC_UPLOAD.docTypes.map((code) => {
          const meta = DOC_METADATA[code];
          const doc = docsMap.get(code);
          const isOpening = openingDocCode === code;
          const isProcessing = processingDocCode === code || replaceMutation.isPending && processingDocCode === code;
          const Icon = meta?.icon || FileText;

          const status = doc?.verification_status;
          const hasPendingReplacement = Boolean(doc?.hasPendingReplacement);

          return (
            <div
              key={code}
              className="flex flex-col justify-between border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 shadow-xs transition-colors hover:border-[var(--color-link)]/40"
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                        {meta.label}
                      </h3>
                      <p className="text-[10px] text-[var(--color-mute)] truncate">
                        {doc ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB • JPEG` : "Not uploaded"}
                      </p>
                    </div>
                  </div>

                  {/* Verification Status Badge */}
                  {status === "verified" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                  {status === "pending" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase shrink-0">
                      <Clock className="h-3 w-3" />
                      Under Review
                    </span>
                  )}
                  {status === "rejected" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      Rejected
                    </span>
                  )}
                </div>

                {/* Rejection Reason Alert */}
                {status === "rejected" && doc?.rejection_reason && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Rejection Reason:</span>
                    </div>
                    <p className="pl-5 leading-snug">{doc.rejection_reason}</p>
                  </div>
                )}

                {/* Pending Replacement Callout */}
                {hasPendingReplacement && (
                  <div
                    onClick={() => {
                      if (doc) handleOpenFullImage(doc, `${meta.label} (Replacement)`);
                    }}
                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-500/15 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="truncate">Replacement image under review. Tap to preview.</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
                      Pending
                    </span>
                  </div>
                )}

                {/* Thumbnail / Preview Area */}
                {(doc || localPreviews[code]) ? (
                  <div
                    onClick={() => {
                      if (doc) handleOpenFullImage(doc, meta.label);
                    }}
                    className="relative group/thumb rounded-xl overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-canvas)] aspect-video flex items-center justify-center cursor-pointer"
                    title="Click to view full document"
                  >
                    {(localPreviews[code] || doc?.thumbSignedUrl) ? (
                      <img
                        src={(localPreviews[code] || doc?.thumbSignedUrl)!}
                        alt={meta.label}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[var(--color-mute)] gap-1">
                        <FileText className="h-6 w-6" />
                        <span className="text-[10px] font-medium">Preview available</span>
                      </div>
                    )}

                    {/* Processing overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1.5 z-10">
                        <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                        <span className="text-[10px] font-semibold tracking-wide">Processing Upload...</span>
                      </div>
                    )}

                    {/* Hover Overlay with View Action */}
                    {!isProcessing && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 shadow-md">
                          {isOpening ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          <span>View Full</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] aspect-video flex flex-col items-center justify-center text-[var(--color-mute)] p-3 text-center">
                    <Upload className="h-5 w-5 mb-1 opacity-50" />
                    <span className="text-[11px] font-medium text-[var(--color-ink)]">
                      No document on file
                    </span>
                    <span className="text-[9px] text-[var(--color-mute)] mt-0.5">
                      Upload required for verification
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 mt-3 border-t border-[var(--color-hairline)] flex items-center justify-between gap-2">
                {/* Hidden File Input */}
                <input
                  ref={(el) => {
                    fileInputRefs.current[code] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileChange(code, e)}
                  disabled={isProcessing}
                />

                {(doc || localPreviews[code]) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (doc) handleOpenFullImage(doc, meta.label);
                      }}
                      disabled={isOpening || !doc}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-ink)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline)] transition-colors py-2 px-3 rounded-lg border border-[var(--color-hairline)] focus:outline-none focus:ring-1 focus:ring-sky-500/30 cursor-pointer min-h-[44px] flex-1 sm:flex-initial"
                    >
                      {isOpening ? (
                        <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-[var(--color-mute)]" />
                      )}
                      <span>View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[code]?.click()}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline)] border-[var(--color-hairline)] shadow-2xs cursor-pointer min-h-[44px] flex-1 sm:flex-initial"
                      title={hasPendingReplacement ? "Upload a different image for your pending replacement" : "Upload replacement document"}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <span>{hasPendingReplacement ? "Change Image" : "Replace"}</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[code]?.click()}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-2xs transition-all cursor-pointer min-h-[44px]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload Document</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Direct In-App Fullscreen Document Viewer Modal ─── */}
      <DocumentViewerModal
        document={activeViewerDoc}
        onClose={() => setActiveViewerDoc(null)}
      />
    </div>
  );
}
