"use client";

import { useState, useCallback, useRef } from "react";
import {
  FileText,
  Image as ImageIcon,
  Upload,
  X,
  Check,
  AlertCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  uploadFileWithProgress,
  validateDocumentFile,
  buildDocumentPath,
} from "@/lib/upload";
import {
  confirmDocumentUploadAction,
  deleteDocumentAction,
  getDocumentViewUrlAction,
  type UserDocument,
  type DocumentType,
} from "@/app/actions/documents";
import {
  DocumentViewerModal,
  type ViewerDocument,
} from "./DocumentViewerModal";

// ─── Types ──────────────────────────────────────────────────────────

interface DocumentUploadSectionProps {
  userId: string;
  mode: "edit" | "view";
  documentTypes: DocumentType[];
  existingDocuments: UserDocument[];
  onDocumentChange?: () => void;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface DocState {
  file: File | null;
  previewUrl: string | null;
  progress: number;
  status: UploadStatus;
  error: string | null;
}

// ─── Document Format Icon Helper ────────────────────────────────────

function DocumentFormatIcon({
  mimeType,
  fileName,
  className,
}: {
  mimeType?: string;
  fileName?: string;
  className?: string;
}) {
  const normMime = (mimeType || "").toLowerCase();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";

  if (normMime === "application/pdf" || ext === "pdf") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold font-mono shrink-0 shadow-xs",
          className
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span>PDF</span>
      </div>
    );
  }

  if (normMime.includes("png") || ext === "png") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold font-mono shrink-0 shadow-xs",
          className
        )}
      >
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        <span>PNG</span>
      </div>
    );
  }

  if (
    normMime.includes("jpeg") ||
    normMime.includes("jpg") ||
    ext === "jpg" ||
    ext === "jpeg"
  ) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-600 dark:text-sky-400 text-xs font-semibold font-mono shrink-0 shadow-xs",
          className
        )}
      >
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        <span>JPG</span>
      </div>
    );
  }

  if (normMime.includes("webp") || ext === "webp") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-semibold font-mono shrink-0 shadow-xs",
          className
        )}
      >
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
        <span>WEBP</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-500/10 border border-neutral-500/25 text-neutral-600 dark:text-neutral-400 text-xs font-semibold font-mono shrink-0 shadow-xs uppercase",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span>{ext || "DOC"}</span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function DocumentUploadSection({
  userId,
  mode,
  documentTypes,
  existingDocuments,
  onDocumentChange,
}: DocumentUploadSectionProps) {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Full-screen document viewer state
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(
    null
  );

  // Per-type upload state
  const [docStates, setDocStates] = useState<Record<string, DocState>>({});

  // Track which document slot is in "replace" mode
  const [replacingCode, setReplacingCode] = useState<string | null>(null);

  const getDocState = (code: string): DocState =>
    docStates[code] || {
      file: null,
      previewUrl: null,
      progress: 0,
      status: "idle",
      error: null,
    };

  const setDocField = useCallback((code: string, patch: Partial<DocState>) => {
    setDocStates((prev) => ({
      ...prev,
      [code]: { ...getDocState(code), ...prev[code], ...patch },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getExistingDoc = (code: string) =>
    existingDocuments.find((d) => d.document_type_code === code);

  // ─── File selection ───────────────────────────────────────────────

  const handleFileSelect = (code: string, docType: DocumentType, file: File) => {
    // Revoke old preview URL
    const old = getDocState(code);
    if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);

    // Validate (Max 2MB, all document formats)
    const validation = validateDocumentFile(
      file,
      docType.allowed_mime_types,
      docType.max_size_bytes || 2 * 1024 * 1024
    );
    if (!validation.valid) {
      setDocField(code, {
        file: null,
        previewUrl: null,
        status: "error",
        error: validation.error || "Invalid file",
        progress: 0,
      });
      return;
    }

    // Show preview if image or pdf
    const previewUrl =
      file.type.startsWith("image/") || file.type === "application/pdf"
        ? URL.createObjectURL(file)
        : null;

    setDocField(code, { file, previewUrl, status: "idle", error: null, progress: 0 });
  };

  // ─── Upload ───────────────────────────────────────────────────────

  const handleUpload = async (code: string, docType: DocumentType) => {
    const state = getDocState(code);
    if (!state.file) return;

    setDocField(code, { status: "uploading", progress: 0, error: null });

    try {
      const storagePath = buildDocumentPath(userId, code, state.file);

      await uploadFileWithProgress(
        "user_files",
        storagePath,
        state.file,
        (percent) => setDocField(code, { progress: percent })
      );

      // Confirm in DB
      const result = await confirmDocumentUploadAction({
        documentTypeCode: code,
        storagePath,
        mimeType: state.file.type,
        fileSizeBytes: state.file.size,
      });

      if (!result.success) {
        setDocField(code, {
          status: "error",
          error: result.error || "Failed to save document record",
        });
        return;
      }

      setDocField(code, { status: "success", progress: 100 });
      setReplacingCode(null);
      toast("success", `${docType.label} uploaded successfully`);
      onDocumentChange?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setDocField(code, { status: "error", error: msg });
      toast("error", msg);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────

  const handleDelete = async (code: string, docType: DocumentType) => {
    const result = await deleteDocumentAction(code);
    if (result.success) {
      setDocField(code, {
        file: null,
        previewUrl: null,
        status: "idle",
        error: null,
        progress: 0,
      });
      setReplacingCode(null);
      toast("success", `${docType.label} removed`);
      onDocumentChange?.();
    } else {
      toast("error", result.error || "Failed to remove document");
    }
  };

  // ─── Clear selected file ──────────────────────────────────────────

  const handleClear = (code: string) => {
    const old = getDocState(code);
    if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
    setDocField(code, {
      file: null,
      previewUrl: null,
      status: "idle",
      error: null,
      progress: 0,
    });
    setReplacingCode(null);
    if (fileInputRefs.current[code]) {
      fileInputRefs.current[code]!.value = "";
    }
  };

  // ─── Full-Screen Document Viewer Triggers ─────────────────────────

  const openExistingPreview = async (docType: DocumentType, existing: UserDocument) => {
    // Open modal immediately with existing signed URL or empty URL to trigger skeleton loader without click lag
    setActiveViewerDoc({
      id: existing.id,
      title: docType.label,
      url: existing.signed_url || "",
      mimeType: existing.mime_type,
      fileSizeBytes: existing.file_size_bytes,
      fileName: existing.storage_path.split("/").pop(),
    });

    try {
      // Secure on-demand short-lived signed URL generation with audit logging
      const res = await getDocumentViewUrlAction({
        documentId: existing.id,
        documentTypeCode: docType.code,
        targetUserId: userId,
      });

      if (res.success && res.signedUrl) {
        setActiveViewerDoc({
          id: existing.id,
          title: res.title || docType.label,
          url: res.signedUrl,
          mimeType: res.mimeType || existing.mime_type,
          fileSizeBytes: res.fileSizeBytes || existing.file_size_bytes,
          fileName: res.fileName || existing.storage_path.split("/").pop(),
        });
        return;
      }
    } catch {
      // Gracefully fall back to pre-signed URL if available
    }

    if (existing.signed_url) {
      setActiveViewerDoc({
        id: existing.id,
        title: docType.label,
        url: existing.signed_url,
        mimeType: existing.mime_type,
        fileSizeBytes: existing.file_size_bytes,
        fileName: existing.storage_path.split("/").pop(),
      });
    } else {
      toast("error", "Document preview link is not available yet. Please refresh.");
    }
  };

  const openLocalPreview = (docType: DocumentType, state: DocState) => {
    if (!state.previewUrl || !state.file) return;
    setActiveViewerDoc({
      title: docType.label,
      url: state.previewUrl,
      mimeType: state.file.type,
      fileSizeBytes: state.file.size,
      fileName: state.file.name,
    });
  };

  if (documentTypes.length === 0) return null;

  return (
    <>
      <section
        aria-label="Identity Documents"
        className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs select-none"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Identity Documents
            </h2>
            <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
              Upload Aadhaar and Driving Licence for identity verification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentTypes.map((docType) => {
            const existing = getExistingDoc(docType.code);
            const state = getDocState(docType.code);
            const hasFile = !!state.file;
            const hasExisting = !!existing;
            const isUploading = state.status === "uploading";
            const isReplacing = replacingCode === docType.code;

            return (
              <div
                key={docType.code}
                className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 sm:p-4 space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-ink)]">
                    {docType.label}
                  </span>
                </div>

                {/* 1. Existing Document Display (When uploaded and not replacing) */}
                {hasExisting && !isReplacing && state.status !== "success" && (
                  <div
                    onClick={() => openExistingPreview(docType, existing)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openExistingPreview(docType, existing);
                      }
                    }}
                    title="Click card to view document"
                    className="flex items-center justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 hover:shadow-xs cursor-pointer transition-all group"
                  >
                    {/* Left: Large Placeholder + Uploaded Status Label */}
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <DocumentFormatIcon
                        mimeType={existing.mime_type}
                        fileName={existing.storage_path}
                      />

                      {/* Middle Label: Only Uploaded Status */}
                      <div className="min-w-0 flex flex-col justify-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit">
                          <Check className="h-3 w-3" /> Uploaded
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions (Replace, Delete) — View button removed */}
                    <div
                      className="flex items-center gap-1.5 sm:gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Replace Button (reveals upload dropzone for this slot) */}
                      {mode === "edit" && (
                        <button
                          type="button"
                          onClick={() => setReplacingCode(docType.code)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-canvas)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 transition-colors active:scale-95 cursor-pointer"
                          title="Replace with another document"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-[var(--color-mute)] group-hover:text-[var(--color-ink)]" />
                          <span className="hidden sm:inline">Replace</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      {mode === "edit" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(docType.code, docType)}
                          className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[34px] min-w-[40px] sm:min-w-[34px] p-2 rounded-lg bg-[var(--color-canvas)] hover:bg-rose-500/10 text-[var(--color-mute)] hover:text-rose-600 border border-[var(--color-hairline)] hover:border-rose-500/20 transition-colors active:scale-95 cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Upload Success Banner */}
                {state.status === "success" && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {docType.label} uploaded successfully
                      </span>
                    </div>
                    {onDocumentChange && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setDocField(docType.code, { status: "idle" });
                          onDocumentChange();
                        }}
                        className="text-[11px] h-7 px-2.5"
                      >
                        Done
                      </Button>
                    )}
                  </div>
                )}

                {/* 3. Upload Picker / Dropzone (Shown ONLY when no document exists, OR user clicked Replace) */}
                {mode === "edit" &&
                  state.status !== "success" &&
                  (!hasExisting || isReplacing) && (
                    <>
                      {!hasFile ? (
                        <div className="space-y-2">
                          <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-[var(--color-hairline)] hover:border-[var(--color-link)]/50 bg-[var(--color-canvas-elevated)] cursor-pointer transition-colors group min-h-[72px]">
                            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-mute)] group-hover:text-[var(--color-link)] transition-colors">
                              <Upload className="h-4 w-4 text-[var(--color-mute)] group-hover:text-[var(--color-link)] transition-colors" />
                              <span>{isReplacing ? "Select replacement file" : "Choose file to upload"}</span>
                            </div>
                            <span className="text-[10px] text-[var(--color-mute)] font-mono">
                              PDF, PNG, JPG, WEBP, or DOC
                            </span>
                            <input
                              ref={(el) => {
                                fileInputRefs.current[docType.code] = el;
                              }}
                              type="file"
                              multiple={false}
                              className="hidden"
                              accept="image/*,application/pdf,.doc,.docx,.txt"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileSelect(docType.code, docType, f);
                              }}
                            />
                          </label>

                          {/* Cancel replace button */}
                          {isReplacing && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setReplacingCode(null)}
                                className="text-[11px] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:underline"
                              >
                                Cancel replace
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                          {/* File Details & Click to Preview */}
                          <div
                            onClick={() => openLocalPreview(docType, state)}
                            className="flex items-center gap-3 cursor-pointer group"
                            title="Click preview to view in full screen"
                          >
                            <DocumentFormatIcon
                              mimeType={state.file?.type}
                              fileName={state.file?.name}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-link)] transition-colors truncate">
                                {state.file?.name}
                              </p>
                            </div>

                            {/* Clear Selection */}
                            {!isUploading && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClear(docType.code);
                                }}
                                className="p-1.5 rounded-lg hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                                title="Remove selected file"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Upload Progress Bar */}
                          {isUploading && (
                            <div className="space-y-1">
                              <div className="h-1.5 rounded-full bg-[var(--color-hairline)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--color-link)] transition-[width] duration-150"
                                  style={{ width: `${state.progress}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-[var(--color-mute)] font-mono text-right">
                                {state.progress}%
                              </p>
                            </div>
                          )}

                          {/* Upload Actions */}
                          {!isUploading && (
                            <div className="flex items-center gap-2 pt-1 w-full">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                icon={<Upload className="h-3.5 w-3.5 shrink-0" />}
                                onClick={() => handleUpload(docType.code, docType)}
                                className="flex-1 min-w-0 h-9 text-xs font-semibold justify-center"
                              >
                                Upload
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => handleClear(docType.code)}
                                className="h-9 px-4 text-xs shrink-0"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                {/* Error Banner */}
                {state.error && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400 p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{state.error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Full-Screen In-App Document Viewer Modal ─── */}
      <DocumentViewerModal
        document={activeViewerDoc}
        onClose={() => setActiveViewerDoc(null)}
      />
    </>
  );
}
