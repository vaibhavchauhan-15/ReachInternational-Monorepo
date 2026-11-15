"use client";

import React from "react";
import type { DocType } from "@reachinternational/utils";
import type { DocumentUploadSlot } from "@/lib/hooks/useSignupDocumentUploads";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { AnimatedUpload } from "@/components/ui/animated-icons";

export interface DocumentUploadCardProps {
  title: string;
  required?: boolean;
  helperText?: string;
  docType: DocType;
  slot: DocumentUploadSlot;
  onFileSelect: (file: File | null) => void;
  onRetry: () => void;
  fieldError?: string;
}

export function DocumentUploadCard({
  title,
  required = false,
  helperText = "Upload a clear photo (JPG or PNG)",
  docType: _docType,
  slot,
  onFileSelect,
  onRetry,
  fieldError,
}: DocumentUploadCardProps) {
  const hasError = Boolean(fieldError || (slot.status === "failed" && slot.error));

  return (
    <div
      id={`doc-upload-${_docType}`}
      className={`rounded-xl border ${
        hasError
          ? "border-rose-500 dark:border-rose-400 bg-rose-500/5"
          : "border-[var(--color-hairline)] bg-[var(--color-canvas)]"
      } p-3 space-y-2 transition-colors hover:border-sky-500/30`}
    >
      <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] sm:text-[13.5px] font-semibold text-[var(--color-ink)]">
            {title}
          </span>
          {required && <span className="text-rose-500 font-semibold shrink-0">*</span>}
          {!required && (
            <span className="text-[11px] font-normal text-[var(--color-mute)] shrink-0">
              (Optional)
            </span>
          )}
        </div>
        <span className="text-[10px] text-[var(--color-mute)] font-mono whitespace-nowrap ml-auto sm:ml-0">
          1 MB max · JPG/PNG
        </span>
      </div>

      {slot.status === "idle" && (
        <label className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-[var(--color-hairline)] hover:border-sky-500/50 cursor-pointer transition-colors group min-h-[48px]">
          <AnimatedUpload
            size={15}
            className="h-[15px] w-[15px] text-[var(--color-mute)] group-hover:text-sky-600 transition-colors shrink-0"
          />
          <span className="text-[12px] sm:text-[13px] text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
            {helperText}
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
          />
        </label>
      )}

      {slot.status === "compressing" && (
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/20 min-h-[48px]">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
              {slot.file?.name || "Compressing photo..."}
            </p>
            <p className="text-[10px] text-sky-600 font-mono">
              Optimizing image resolution & size...
            </p>
          </div>
        </div>
      )}

      {slot.status === "uploading" && (
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/20 min-h-[48px]">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
              {slot.file?.name}
            </p>
            <p className="text-[10px] text-sky-600 font-mono">
              Streaming directly to secure storage...
            </p>
          </div>
        </div>
      )}

      {slot.status === "ready" && (
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-sky-500/5 border border-sky-500/20 min-h-[48px]">
          {slot.previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={slot.previewUrl}
              alt={`${title} preview`}
              className="h-10 w-10 rounded-lg object-cover border border-[var(--color-hairline)] shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
              {slot.file?.name || "Document attached"}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 inline shrink-0" />
              <span>{slot.mainBlob ? `${(slot.mainBlob.size / 1024).toFixed(0)} KB · Ready` : "Ready"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onFileSelect(null)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-rose-500 transition-colors cursor-pointer"
            title="Remove document"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {slot.status === "failed" && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 min-h-[48px]">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 truncate">
              {slot.file?.name || "Upload failed"}
            </p>
            <p className="text-[10px] text-rose-500 leading-tight truncate">
              {slot.error || "Failed to upload to storage"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
          <button
            type="button"
            onClick={() => onFileSelect(null)}
            className="p-1 rounded-md hover:bg-rose-500/20 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {(fieldError || (slot.status !== "failed" && slot.error)) && (
        <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{fieldError || slot.error}</span>
        </p>
      )}
    </div>
  );
}
