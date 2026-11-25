"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  ShieldCheck,
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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

type View = { zoom: number; rotation: number; x: number; y: number };

const ICON_BUTTON_CLASS =
  "inline-flex items-center justify-center h-11 w-11 sm:h-9 sm:w-9 rounded-lg text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

function clampView(view: View, canvas: HTMLElement | null): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
  if (zoom <= 1) return { zoom, rotation: view.rotation, x: 0, y: 0 };
  let maxX = (zoom - 1) * 400 + 48;
  let maxY = (zoom - 1) * 400 + 48;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    maxX = ((zoom - 1) * rect.width) / 2 + 48;
    maxY = ((zoom - 1) * rect.height) / 2 + 48;
  }
  return {
    zoom,
    rotation: view.rotation,
    x: Math.max(-maxX, Math.min(maxX, view.x)),
    y: Math.max(-maxY, Math.min(maxY, view.y)),
  };
}

export function DocumentLightboxModal(props: DocumentLightboxModalProps) {
  if (!props.isOpen || !props.document) return null;
  return <DocumentLightboxModalInner key={props.document.id} {...props} />;
}

function DocumentLightboxModalInner({
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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [useThumbFallback, setUseThumbFallback] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    doc?.signed_url || doc?.thumb_signed_url || null
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<View>({ zoom: 1, rotation: 0, x: 0, y: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; mid: { x: number; y: number } } | null>(null);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const syncFrameRef = useRef<number | null>(null);

  // Always prioritize the full original document (signed_url); fall back to API lookup.
  useEffect(() => {
    if (!doc) return;
    if (doc.signed_url) return;
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
    }
  }, [doc, userId]);

  // ── Smooth, lightweight view engine ─────────────────────────────────────────
  // Gestures mutate the DOM transform imperatively (zero re-renders per move) and
  // only sync React state once per gesture / animation frame.
  const applyView = useCallback((view: View, smooth: boolean) => {
    const el = stageRef.current;
    if (!el) return;
    el.style.transition = smooth ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom}) rotate(${view.rotation}deg)`;
  }, []);

  const commitView = useCallback(
    (view: View, smooth: boolean) => {
      const next = clampView(view, canvasRef.current);
      viewRef.current = next;
      applyView(next, smooth);
      setZoom(next.zoom);
      setRotation(next.rotation);
      setOffset({ x: next.x, y: next.y });
    },
    [applyView]
  );

  const scheduleSync = useCallback(() => {
    if (syncFrameRef.current != null) return;
    syncFrameRef.current = requestAnimationFrame(() => {
      syncFrameRef.current = null;
      const v = viewRef.current;
      setZoom(v.zoom);
      setRotation(v.rotation);
      setOffset({ x: v.x, y: v.y });
    });
  }, []);

  useEffect(() => {
    closeBtnRef.current?.focus();
    return () => {
      if (syncFrameRef.current != null) cancelAnimationFrame(syncFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Wheel zoom (non-passive listener so the page behind never scrolls)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = clampView({ ...v, zoom: v.zoom * factor }, el);
      viewRef.current = next;
      applyView(next, false);
      scheduleSync();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyView, scheduleSync]);

  const handleZoomIn = () => commitView({ ...viewRef.current, zoom: viewRef.current.zoom + 0.25 }, true);
  const handleZoomOut = () => commitView({ ...viewRef.current, zoom: viewRef.current.zoom - 0.25 }, true);
  const handleRotate = () =>
    commitView({ ...viewRef.current, rotation: (viewRef.current.rotation + 90) % 360 }, true);
  const handleReset = () => commitView({ zoom: 1, rotation: 0, x: 0, y: 0 }, true);
  const toggleZoom = () =>
    commitView({ ...viewRef.current, zoom: viewRef.current.zoom > 1.05 ? 1 : 2 }, true);

  // ── Pointer gestures: one-finger / mouse drag-pan, two-finger pinch zoom ─────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    canvasRef.current?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      panLastRef.current = { x: e.clientX, y: e.clientY };
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: viewRef.current.zoom,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      panLastRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = clampView(
        {
          ...v,
          zoom: (pinchRef.current.zoom * dist) / pinchRef.current.dist,
          x: v.x + (mid.x - pinchRef.current.mid.x),
          y: v.y + (mid.y - pinchRef.current.mid.y),
        },
        canvasRef.current
      );
      pinchRef.current.mid = mid;
      viewRef.current = next;
      applyView(next, false);
      return;
    }

    if (pointersRef.current.size === 1 && panLastRef.current && v.zoom > 1) {
      const dx = e.clientX - panLastRef.current.x;
      const dy = e.clientY - panLastRef.current.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      const next = clampView({ ...v, x: v.x + dx, y: v.y + dy }, canvasRef.current);
      viewRef.current = next;
      applyView(next, false);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (pointersRef.current.size === 1) {
      const [rest] = Array.from(pointersRef.current.values());
      panLastRef.current = { ...rest };
      pointerStartRef.current = { ...rest };
      return;
    }
    if (pointersRef.current.size > 0) return;

    panLastRef.current = null;
    // Double-tap / double-click toggles zoom (unified for mouse, touch and pen)
    if (pointerStartRef.current) {
      const moved = Math.hypot(
        e.clientX - pointerStartRef.current.x,
        e.clientY - pointerStartRef.current.y
      );
      const now = Date.now();
      const last = lastTapRef.current;
      if (
        moved < 12 &&
        last &&
        now - last.time < 400 &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < 48
      ) {
        toggleZoom();
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }
    pointerStartRef.current = null;
    commitView(viewRef.current, true);
  };

  // ── Keyboard accessibility: pan / zoom / reset from the focused canvas ───────
  const onStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = viewRef.current;
    const step = e.shiftKey ? 96 : 40;
    switch (e.key) {
      case "ArrowLeft":
        commitView({ ...v, x: v.x - step }, true);
        break;
      case "ArrowRight":
        commitView({ ...v, x: v.x + step }, true);
        break;
      case "ArrowUp":
        commitView({ ...v, y: v.y - step }, true);
        break;
      case "ArrowDown":
        commitView({ ...v, y: v.y + step }, true);
        break;
      case "+":
      case "=":
        commitView({ ...v, zoom: v.zoom + 0.25 }, true);
        break;
      case "-":
      case "_":
        commitView({ ...v, zoom: v.zoom - 0.25 }, true);
        break;
      case "0":
        handleReset();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  if (!doc) return null;

  const originalUrl = resolvedUrl || doc.signed_url || null;
  const thumbnailUrl = doc.thumb_signed_url || null;
  // The original uploaded document is always shown; the verified thumbnail is
  // only a silent last-resort fallback if the original fails to render.
  const imageUrl = useThumbFallback
    ? thumbnailUrl || originalUrl
    : originalUrl || thumbnailUrl;

  const isPdf =
    doc.mime_type === "application/pdf" ||
    doc.label?.toLowerCase().endsWith(".pdf") ||
    Boolean(imageUrl && imageUrl.split("?")[0]?.toLowerCase().endsWith(".pdf"));

  // Loading / error state is derived from the active URL — no effect-driven resets.
  const imageError = imageUrl !== null && imageUrl === failedUrl;
  const imageLoading = imageUrl !== null && imageUrl !== loadedUrl && imageUrl !== failedUrl;

  const isPending = doc.verification_status === "pending";
  const isViewDirty = zoom !== 1 || rotation !== 0 || offset.x !== 0 || offset.y !== 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.label} Preview`}
      aria-describedby="doc-lightbox-help"
    >
      <p id="doc-lightbox-help" className="sr-only">
        Document preview. Drag or use arrow keys to pan when zoomed. Pinch, scroll, press plus or
        minus, or double-tap to zoom. Press 0 to reset the view and Escape to close.
      </p>

      <div className="relative flex flex-col w-full max-w-4xl max-h-[92dvh] bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
              <FileText size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] truncate">
                  {doc.label}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${
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

          {/* Controls: Zoom, Rotate, Close */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={handleZoomOut}
              className={ICON_BUTTON_CLASS}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className={ICON_BUTTON_CLASS}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className={ICON_BUTTON_CLASS}
              title="Rotate 90°"
              aria-label="Rotate 90 degrees"
            >
              <RotateCw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              ref={closeBtnRef}
              onClick={onClose}
              className={`${ICON_BUTTON_CLASS} ml-0.5 sm:ml-1`}
              title="Close preview"
              aria-label="Close preview"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Document Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 min-h-[240px] sm:min-h-[320px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {imageLoading && !imageError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 size={24} className="animate-spin text-sky-500" aria-hidden="true" />
              <span className="text-xs">Loading secure document...</span>
            </div>
          )}

          {imageError || !imageUrl ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-400 dark:text-neutral-500 space-y-2">
              <FileText size={48} className="opacity-30" aria-hidden="true" />
              <p className="text-xs font-medium">Document image unavailable or expired</p>
              <p className="text-[11px] text-neutral-500 max-w-xs">
                The document is securely encrypted in the vault. Please refresh or open via user
                profile.
              </p>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
              <iframe
                src={imageUrl}
                title={doc.label}
                className="w-full h-[60dvh] rounded-lg border-0 bg-white"
                onLoad={() => setLoadedUrl(imageUrl)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full p-4">
              <div
                ref={stageRef}
                role="group"
                tabIndex={0}
                aria-label={`${doc.label} document canvas`}
                onKeyDown={onStageKeyDown}
                className="cursor-grab active:cursor-grabbing outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-sky-500/60 will-change-transform"
                style={{ transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={doc.label}
                  className="max-w-full max-h-[58dvh] sm:max-h-[62dvh] object-contain rounded-lg shadow-xl"
                  draggable={false}
                  decoding="async"
                  onLoad={() => setLoadedUrl(imageUrl)}
                  onError={() => {
                    if (!useThumbFallback && thumbnailUrl && thumbnailUrl !== imageUrl) {
                      setUseThumbFallback(true);
                    } else {
                      setFailedUrl(imageUrl);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Status Overlay if already decided */}
          {!isPending && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-lg border ${
                  doc.verification_status === "verified"
                    ? "bg-emerald-950/85 text-emerald-300 border-emerald-500/40"
                    : "bg-red-950/85 text-red-300 border-red-500/40"
                }`}
              >
                {doc.verification_status === "verified" ? (
                  <CheckCircle2 size={14} className="text-emerald-400" aria-hidden="true" />
                ) : (
                  <XCircle size={14} className="text-red-400" aria-hidden="true" />
                )}
                <span className="capitalize">{doc.verification_status}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar: Metadata + Actions */}
        <div className="flex flex-col gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-[var(--color-border)] bg-[var(--color-canvas)] shrink-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" aria-hidden="true" />
              Encrypted statutory document in private vault
            </span>
            <span className="inline-flex items-center gap-2 text-[11px]">
              <span className="tabular-nums" aria-hidden="true">
                {Math.round(zoom * 100)}%
              </span>
              {isViewDirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Reset view
                </button>
              )}
            </span>
          </div>

          {/* Quick per-document action buttons (for authorized reviewers) */}
          {canDecide && isPending && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {onRejectDocumentPrompt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRejectDocumentPrompt(doc)}
                  disabled={isActionLoading}
                  className="gap-1.5 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 min-h-[44px] sm:min-h-[38px] w-full sm:w-auto"
                >
                  <XCircle size={14} aria-hidden="true" />
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
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] sm:min-h-[38px] w-full sm:w-auto"
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
