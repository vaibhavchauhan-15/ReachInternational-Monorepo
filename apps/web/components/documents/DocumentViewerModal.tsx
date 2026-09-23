"use client";

import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

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

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDataRef = useRef<{
    dist: number;
    scale: number;
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  // Reset zoom, position, and loading states on document change
  useEffect(() => {
    if (!doc) return;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    setImageLoading(true);
    setImageError(false);
  }, [doc?.id, doc?.url]);

  const isImage = Boolean(
    doc?.mimeType?.toLowerCase().startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc?.url || "") ||
      /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc?.fileName || "")
  );

  const isPdf = Boolean(
    doc?.mimeType?.toLowerCase() === "application/pdf" ||
      /\.pdf$/i.test(doc?.url || "") ||
      /\.pdf$/i.test(doc?.fileName || "")
  );

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 1);
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Desktop mouse wheel zoom with non-passive listener to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isImage) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setScale((prev) => {
        const next = Math.min(Math.max(Number((prev + delta).toFixed(2)), 1), 4);
        if (next === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return next;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isImage]);

  // Desktop mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile touch two-finger pinch-to-zoom & pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDataRef.current = {
        dist,
        scale,
        startX: 0,
        startY: 0,
        posX: position.x,
        posY: position.y,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      touchDataRef.current = {
        dist: 0,
        scale,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        posX: position.x,
        posY: position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDataRef.current) return;

    if (e.touches.length === 2 && touchDataRef.current.dist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDataRef.current.dist;
      const nextScale = Math.min(
        Math.max(Number((touchDataRef.current.scale * factor).toFixed(2)), 1),
        4
      );
      setScale(nextScale);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1 && touchDataRef.current.dist === 0) {
      const dx = e.touches[0].clientX - touchDataRef.current.startX;
      const dy = e.touches[0].clientY - touchDataRef.current.startY;
      setPosition({
        x: touchDataRef.current.posX + dx,
        y: touchDataRef.current.posY + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      touchDataRef.current = null;
      if (scale <= 1) {
        setPosition({ x: 0, y: 0 });
        setScale(1);
      }
    }
  };

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

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc.title}
      size="xl"
      className="sm:max-w-4xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      bodyClassName="flex-1 p-2 sm:p-5 overflow-y-auto flex flex-col items-center justify-center bg-[var(--color-canvas)]"
      headerClassName="pr-16 sm:pr-48"
      headerActions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom In & Out Buttons (ONLY for desktop view) */}
          {isImage && (
            <div className="hidden sm:inline-flex items-center gap-0.5 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg p-0.5 shadow-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 1}
                className="p-1 rounded-md hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5 text-[var(--color-mute)] hover:text-[var(--color-ink)]" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                title="Reset zoom (100%)"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="p-1 rounded-md hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5 text-[var(--color-mute)] hover:text-[var(--color-ink)]" />
              </button>
            </div>
          )}

          {/* Download Button */}
          {doc.url ? (
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
          ) : null}
        </div>
      }
    >
      {/* 1. IMAGE PREVIEW */}
      {isImage && (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleResetZoom}
          className="w-full flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden p-1 relative select-none"
        >
          {/* Shimmering Skeleton Loader while document data or image loads */}
          {imageLoading && !imageError && (
            <div className="w-full max-w-2xl h-[420px] sm:h-[540px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] relative overflow-hidden flex flex-col items-center justify-center p-6 animate-pulse select-none">
              {/* Shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 dark:via-white/5 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />

              {/* Top skeleton header line */}
              <div className="absolute top-4 left-5 right-5 flex items-center justify-between opacity-50">
                <div className="h-3 w-28 bg-[var(--color-hairline)] rounded-md" />
                <div className="h-3 w-14 bg-[var(--color-hairline)] rounded-md" />
              </div>

              {/* Center placeholder icon + spinner */}
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center shadow-xs">
                  <ImageIcon className="h-8 w-8 text-[var(--color-mute)]" />
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-mute)] font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-link)]" />
                  <span>Loading document preview...</span>
                </div>
              </div>

              {/* Bottom skeleton stripes */}
              <div className="absolute bottom-5 left-5 right-5 space-y-2 opacity-40">
                <div className="h-2.5 w-2/3 bg-[var(--color-hairline)] rounded-md" />
                <div className="h-2 w-1/3 bg-[var(--color-hairline)] rounded-md" />
              </div>
            </div>
          )}

          {/* Error State */}
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
          ) : doc.url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={doc.url}
              alt={doc.title}
              draggable={false}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
                transition: isDragging ? "none" : "transform 0.15s ease-out",
                willChange: "transform",
                touchAction: scale > 1 ? "none" : "auto",
              }}
              className={`max-h-[68vh] w-auto max-w-full object-contain rounded-lg border border-[var(--color-hairline)] shadow-xs select-none ${
                imageLoading ? "hidden" : "block"
              } ${
                scale > 1
                  ? isDragging
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : "cursor-default"
              }`}
            />
          ) : null}
        </div>
      )}

      {/* 2. PDF PREVIEW */}
      {isPdf && (
        <div className="w-full h-[62vh] sm:h-[70vh] rounded-lg overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] relative flex flex-col">
          {/* Skeleton loader for PDF while loading */}
          {doc.url ? (
            <iframe
              src={`${doc.url}#toolbar=1&navpanes=0`}
              title={doc.title}
              loading="lazy"
              className="w-full flex-1 border-0 bg-white"
            />
          ) : (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-6 animate-pulse select-none bg-[var(--color-canvas-elevated)]">
              <div className="h-16 w-16 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] flex items-center justify-center shadow-xs mb-3">
                <FileText className="h-8 w-8 text-[var(--color-mute)]" />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-mute)] font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-link)]" />
                <span>Loading PDF document...</span>
              </div>
            </div>
          )}

          {/* Mobile helper strip */}
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
