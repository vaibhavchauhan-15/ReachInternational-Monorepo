import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/components/ui/ThemeProvider';
import { Pressable } from '@/components/ui/touch/Pressable';
import { Download, FileText } from '../ui/icon';

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

// Lazy-loaded native PdfView reference (avoids crashing at module evaluation if KJExpoPdf is unlinked)
let cachedPdfView: React.ComponentType<any> | null = null;
let isNativePdfChecked = false;

function getNativePdfView(): React.ComponentType<any> | null {
  if (isNativePdfChecked) {
    return cachedPdfView;
  }
  isNativePdfChecked = true;

  try {
    // 1. Safely check if the native module 'KJExpoPdf' is installed in the current native runtime
    // Using requireOptionalNativeModule from 'expo' ensures zero exceptions when running in Expo Go or dev clients without the module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expo = require('expo');
    const hasNativeModule =
      typeof expo.requireOptionalNativeModule === 'function'
        ? expo.requireOptionalNativeModule('KJExpoPdf')
        : null;

    if (hasNativeModule) {
      // 2. Only require @kishannareshpal/expo-pdf if the native module is actually present in the binary
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const expoPdf = require('@kishannareshpal/expo-pdf');
      cachedPdfView = expoPdf?.PdfView || null;
    } else {
      cachedPdfView = null;
    }
  } catch {
    cachedPdfView = null;
  }

  return cachedPdfView;
}

/**
 * Native Mobile In-App PDF Viewer (iOS & Android)
 *
 * Built with @kishannareshpal/expo-pdf:
 * - iOS: Apple PDFKit native rendering engine (or Safari WebView fallback)
 * - Android: Native PDFium rendering engine (or safe fallback card when native module is unlinked)
 *
 * Supports:
 * - Continuous vertical multipage scrolling (horizontal={false}, pagingEnabled={false})
 * - Fit-to-width auto scaling (fitMode="width", autoScale={true})
 * - Smooth double-tap zoom & pinch gestures (doubleTapToZoom={true})
 * - Multipage position tracking (onPageChanged, onLoadComplete)
 * - Safe fallback handling when native module is unavailable (e.g. Expo Go / uncompiled dev clients)
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  const PdfViewComponent = useMemo(() => getNativePdfView(), []);

  useEffect(() => {
    setLoading(true);
    setHasError(false);
    setErrorMessage('');
    setCurrentPage(1);
    setPageCount(0);
    onLoadStart?.();
  }, [uri]);

  const handleLoadComplete = (payload: { pageCount: number }) => {
    setLoading(false);
    setPageCount(payload.pageCount);
    onLoadComplete?.(payload.pageCount);
  };

  const handlePageChanged = (payload: { pageIndex: number; pageCount: number }) => {
    const pageNum = payload.pageIndex + 1;
    setCurrentPage(pageNum);
    setPageCount(payload.pageCount);
    onPageChanged?.(pageNum, payload.pageCount);
  };

  const handleError = (payload: { code: string; message: string }) => {
    setLoading(false);
    setHasError(true);
    setErrorMessage(payload.message || 'Unable to open PDF document.');
    onError?.(new Error(payload.message || 'Unable to open PDF document.'));
  };

  // iOS Safari / WebKit native PDF rendering fallback when KJExpoPdf native module is not compiled into the binary
  if (Platform.OS === 'ios' && !PdfViewComponent && uri && !hasError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <View
          style={[
            styles.viewerWrapper,
            rotation
              ? {
                  transform: [{ rotate: `${rotation}deg` }],
                }
              : null,
          ]}
        >
          <WebView
            source={{ uri }}
            style={styles.pdfView}
            originWhitelist={['*']}
            onLoadStart={() => {
              setLoading(true);
              onLoadStart?.();
            }}
            onLoadEnd={() => {
              setLoading(false);
              onLoadComplete?.(1);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              handleError({ code: 'WEBVIEW_ERROR', message: nativeEvent.description });
            }}
          />
        </View>

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
              Loading PDF document...
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (!uri || hasError || !PdfViewComponent) {
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
          {errorMessage ||
            (!PdfViewComponent
              ? 'PDF preview requires a native build with PDF modules enabled. You can download the PDF to view it in an external app.'
              : 'PDF preview could not be displayed directly. You can download the file to view it in an external app.')}
        </Text>
        <View style={styles.actionRow}>
          {onDownload && (
            <Pressable
              variant="buttonPrimary"
              onPress={onDownload}
              style={styles.actionBtnPrimary}
              accessibilityLabel="Download PDF"
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
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <View
        style={[
          styles.viewerWrapper,
          rotation
            ? {
                transform: [{ rotate: `${rotation}deg` }],
              }
            : null,
        ]}
      >
        <PdfViewComponent
          uri={uri}
          fitMode="width"
          horizontal={false}
          pagingEnabled={false}
          doubleTapToZoom={true}
          autoScale={true}
          pageGap={12}
          style={styles.pdfView}
          onLoadComplete={handleLoadComplete}
          onPageChanged={handlePageChanged}
          onError={handleError}
        />
      </View>

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
            Loading PDF document...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  viewerWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pdfView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
