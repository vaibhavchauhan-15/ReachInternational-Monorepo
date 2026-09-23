"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Download, FileText, Image as ImageIcon, Loader2, ExternalLink } from "lucide-react";

export interface ViewerDocument {
  id?: string;
  title: string;
  url: string;
  mimeType: string;
  fileSizeBytes?: number;
  fileName?: string;
}

interface DocumentViewerModalProps {
  document: ViewerDocument | null;
  onClose: () => void;
}

export function DocumentViewerModal({
  document: doc,
  onClose,
}: DocumentViewerModalProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!doc) return;
    setImageLoading(true);
    setImageError(false);
  }, [doc]);

  if (!doc) return null;

  const handleDownload = async () => {
    if (!doc?.url || downloading) return;
    setDownloading(true);
    try {
      let filename = doc.fileName || doc.title || "document";
      const ext =
        doc.fileName?.split(".").pop() ||
        (doc.mimeType === "application/pdf"
          ? "pdf"
          : doc.mimeType?.includes("png")
          ? "png"
          : doc.mimeType?.includes("jpeg") || doc.mimeType?.includes("jpg")
          ? "jpg"
          : doc.mimeType?.includes("webp")
          ? "webp"
          : "pdf");

      if (!filename.includes(".")) {
        filename = `${filename}.${ext}`;
      }

      // 1. If document is saved with an ID, use our high-reliability server download endpoint
      if (doc.id) {
        try {
          const res = await fetch(`/api/documents/${doc.id}/download`);
          if (res.ok) {
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            return;
          }
        } catch {
          // If fetch fails, proceed to anchor download trigger below
        }

        // Direct anchor download via download API route (attachment header forces download)
        const a = document.createElement("a");
        a.href = `/api/documents/${doc.id}/download`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 2. For locally selected files (blob: URLs)
      if (doc.url.startsWith("blob:")) {
        const a = document.createElement("a");
        a.href = doc.url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 3. Fallback: direct blob fetch from signed URL
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      // 4. Final fallback: open/download in new window
      const fallbackUrl = doc.id ? `/api/documents/${doc.id}/download` : doc.url;
      const a = document.createElement("a");
      a.href = fallbackUrl;
      a.target = "_blank";
      a.download = doc.fileName || doc.title || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  const isImage =
    doc.mimeType?.toLowerCase().startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.url || "") ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.fileName || "");

  const isPdf =
    doc.mimeType?.toLowerCase() === "application/pdf" ||
    /\.pdf$/i.test(doc.url || "") ||
    /\.pdf$/i.test(doc.fileName || "");

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc.title}
      size="xl"
      className="sm:max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      bodyClassName="flex-1 p-2 sm:p-5 overflow-y-auto flex flex-col items-center justify-center bg-[var(--color-canvas)]"
      headerClassName="pr-16 sm:pr-24"
      headerActions={
        doc.url ? (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 transition-colors cursor-pointer active:scale-95 disabled:opacity-60"
            title="Download document"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-link)]" />
            ) : (
              <Download className="h-3.5 w-3.5 text-[var(--color-link)]" />
            )}
            <span className="hidden sm:inline">
              {downloading ? "Downloading..." : "Download"}
            </span>
          </button>
        ) : null
      }
    >
      {/* 1. IMAGE PREVIEW */}
      {isImage && (
        <div className="w-full flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-auto p-1 relative">
          {imageLoading && !imageError && (
            <div className="flex flex-col items-center justify-center gap-2 text-[var(--color-mute)] py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-link)]" />
              <span className="text-xs">Loading image...</span>
            </div>
          )}

          {imageError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center max-w-sm">
              <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-[var(--color-mute)]">
                <ImageIcon className="h-8 w-8" />
              </div>
              <p className="text-xs text-[var(--color-body)]">
                Unable to display image preview directly.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-link)] hover:opacity-95 text-white transition-opacity disabled:opacity-60 cursor-pointer"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>{downloading ? "Downloading..." : "Download Image"}</span>
              </button>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={doc.url}
              alt={doc.title}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              className={`max-h-[68vh] w-auto max-w-full object-contain rounded-lg border border-[var(--color-hairline)] shadow-xs transition-opacity duration-200 ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
        </div>
      )}

      {/* 2. PDF PREVIEW */}
      {isPdf && (
        <div className="w-full h-[62vh] sm:h-[70vh] rounded-lg overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] relative flex flex-col">
          <iframe
            src={`${doc.url}#toolbar=1&navpanes=0`}
            title={doc.title}
            loading="lazy"
            className="w-full flex-1 border-0 bg-white"
          />
          {/* Mobile helper strip: On mobile browsers where inline PDF iframe might not be ideal or supported (e.g. Android Chrome), provide 1-tap download and open */}
          <div className="sm:hidden flex items-center justify-between px-3 py-2 bg-[var(--color-canvas-elevated)] border-t border-[var(--color-hairline)] text-[11px] text-[var(--color-mute)] shrink-0">
            <span>PDF Document</span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-link)] hover:underline cursor-pointer disabled:opacity-60"
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span>{downloading ? "Saving..." : "Download"}</span>
              </button>
              <span className="text-[var(--color-hairline)]">|</span>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:underline"
              >
                <span>Full View</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. OTHER / EXTERNAL DOCUMENTS (DOC, DOCX, XLS, TXT) */}
      {!isImage && !isPdf && (
        <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-center max-w-sm my-6">
          <div className="p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-link)]">
            <FileText className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-1">
              {doc.title}
            </h3>
            <p className="text-xs text-[var(--color-mute)] font-mono">
              {doc.fileName || "Uploaded Document"}
            </p>
            <p className="text-[11px] text-[var(--color-mute)] mt-1.5">
              This document format can be opened on your device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-link)] hover:opacity-95 text-white text-xs font-semibold shadow-xs transition-opacity mt-2 disabled:opacity-60 cursor-pointer"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{downloading ? "Downloading..." : "Download Document"}</span>
          </button>
        </div>
      )}
    </Modal>
  );
}
