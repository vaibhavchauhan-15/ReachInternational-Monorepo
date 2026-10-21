import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import * as pdfjsLib from 'pdfjs-dist';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/components/ui/ThemeProvider';
import { Pressable } from '@/components/ui/touch/Pressable';
import { Download, FileText } from '../ui/icon';

// Configure Mozilla PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface NativePdfViewerProps {
  uri: string;
  title?: string;
  fileName?: string;
  rotation?: number;
  onLoadStart?: () => void;
  onLoadComplete?: (pageCount: number) => void;
  onPageChanged?: (currentPage: number, pageCount: number) => void;
  onError?: (error: Error) => void;
  onDownload?: () => void;
  onShare?: () => void;
}

/**
 * Web Platform In-App PDF Viewer (Mozilla PDF.js Canvas Engine)
 *
 * Renders PDF pages directly to HTML5 <canvas> elements without external Google Drive
 * or browser plugin toolbars (eliminating the black Chrome PDF viewer bar).
 *
 * Supports:
 * - Continuous vertical multipage scrolling
 * - Fit-to-width auto scaling with HiDPI / devicePixelRatio sharpness
 * - Smooth rotation
 * - Zero Google Drive, Google Docs, or Chrome extension chrome
 */
export function NativePdfViewer({
  uri,
  title,
  fileName,
  rotation = 0,
  onLoadStart,
  onLoadComplete,
  onPageChanged,
  onError,
  onDownload,
  onShare,
}: NativePdfViewerProps) {
  const { theme, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasksRef = useRef<any[]>([]);

  // Render all pages to canvases
  const renderPdfPages = useCallback(async () => {
    if (!uri || typeof window === 'undefined') return;

    setLoading(true);
    setHasError(false);
    setErrorMessage('');
    onLoadStart?.();

    // Cancel any previous in-flight render tasks
    renderTasksRef.current.forEach((task) => {
      try {
        task?.cancel?.();
      } catch {}
    });
    renderTasksRef.current = [];

    try {
      // 1. Fetch authenticated PDF bytes
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch document (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // 2. Parse PDF document with Mozilla PDF.js
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setPageCount(numPages);
      onLoadComplete?.(numPages);

      // Wait for React to render the canvas DOM elements
      await new Promise((resolve) => setTimeout(resolve, 50));

      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const targetWidth = Math.max(containerWidth - 32, 280);
      const pixelRatio = window.devicePixelRatio || 1;

      // 3. Render each page sequentially into its canvas
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale * pixelRatio });

        const canvas = canvasRefs.current[pageNum - 1];
        if (canvas) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / pixelRatio}px`;
          canvas.style.height = `${viewport.height / pixelRatio}px`;

          const canvasContext = canvas.getContext('2d');
          if (canvasContext) {
            const renderContext = {
              canvasContext,
              canvas,
              viewport,
            };
            const renderTask = page.render(renderContext);
            renderTasksRef.current.push(renderTask);
            await renderTask.promise;
          }
        }
      }

      setLoading(false);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        return;
      }
      setLoading(false);
      setHasError(true);
      setErrorMessage(err?.message || 'Unable to render PDF document.');
      onError?.(err instanceof Error ? err : new Error(err?.message || 'PDF render failed'));
    }
  }, [uri, onLoadStart, onLoadComplete, onError]);

  useEffect(() => {
    renderPdfPages();

    return () => {
      renderTasksRef.current.forEach((task) => {
        try {
          task?.cancel?.();
        } catch {}
      });
      renderTasksRef.current = [];
    };
  }, [renderPdfPages]);

  // Track current visible page on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const totalHeight = container.scrollHeight;
    if (pageCount > 1 && totalHeight > 0) {
      const pageHeight = totalHeight / pageCount;
      const visiblePage = Math.min(Math.max(Math.floor(scrollTop / pageHeight) + 1, 1), pageCount);
      if (visiblePage !== currentPage) {
        setCurrentPage(visiblePage);
        onPageChanged?.(visiblePage, pageCount);
      }
    }
  };

  if (!uri || hasError) {
    return (
      <View style={[styles.fallbackContainer, { backgroundColor: theme.colors.canvas }]}>
        <View
          style={[
            styles.fallbackIconBox,
            {
              backgroundColor: isDark ? '#262626' : '#f4f4f5',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <FileText size={36} color={theme.colors.link} />
        </View>
        <Text variant="heading" style={[styles.fallbackTitle, { color: theme.colors.ink }]}>
          {title || 'PDF Document'}
        </Text>
        <Text variant="caption" style={[styles.fallbackSubtitle, { color: theme.colors.mute }]}>
          {fileName || 'document.pdf'}
        </Text>
        <Text variant="caption" style={[styles.fallbackNotice, { color: theme.colors.mute }]}>
          {errorMessage || 'PDF preview is unavailable. You can download the file directly.'}
        </Text>
        <View style={styles.actionRow}>
          {onDownload && (
            <Pressable
              variant="buttonPrimary"
              onPress={onDownload}
              style={styles.actionBtnPrimary}
              accessibilityLabel="Download PDF document"
            >
              <Download size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text variant="label" style={styles.btnTextWhite}>
                Download PDF
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.webContainer, { backgroundColor: theme.colors.canvas }]}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          backgroundColor: isDark ? '#121212' : '#f4f4f5',
          transform: rotation ? `rotate(${rotation}deg)` : 'none',
          transition: 'transform 0.2s ease-out',
        }}
      >
        {Array.from({ length: pageCount }).map((_, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[idx] = el;
              }}
              style={{
                maxWidth: '100%',
                borderRadius: 4,
                boxShadow: isDark
                  ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                  : '0 2px 8px rgba(0, 0, 0, 0.08)',
                backgroundColor: '#ffffff',
                display: 'block',
              }}
            />
          </div>
        ))}
      </div>

      {/* Floating Multipage Indicator Pill */}
      {pageCount > 1 && (
        <View
          style={[
            styles.pageIndicator,
            {
              backgroundColor: isDark ? '#262626' : '#ffffff',
              borderColor: theme.colors.hairline,
            },
          ]}
          pointerEvents="none"
        >
          <Text
            variant="micro"
            weight="semibold"
            style={{ color: theme.colors.ink }}
          >
            {currentPage} / {pageCount}
          </Text>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View
          style={[
            styles.loaderOverlay,
            {
              backgroundColor: isDark ? 'rgba(10, 10, 10, 0.65)' : 'rgba(255, 255, 255, 0.65)',
            },
          ]}
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color={theme.colors.link} />
          <Text variant="caption" style={[styles.loaderText, { color: theme.colors.mute }]}>
            Rendering document pages...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  pageIndicator: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  loaderText: {
    marginTop: 4,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackIconBox: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  fallbackTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    marginBottom: 10,
    textAlign: 'center',
  },
  fallbackNotice: {
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 280,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0284c7',
    minHeight: 44,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  btnTextWhite: {
    color: '#ffffff',
  },
});
