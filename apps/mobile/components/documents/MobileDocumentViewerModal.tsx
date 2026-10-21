/**
 * ReachInternational Mobile — Native In-App Document Viewer Modal
 *
 * Implements the hybrid Document Viewer architecture:
 * - JPG / PNG / WEBP: In-app image viewer with smooth zoom, pan, and header rotation.
 * - PDF: In-app continuous multi-page PDF viewer with vertical scrolling
 *   (Native: @kishannareshpal/expo-pdf via iOS PDFKit & Android PDFium; Web: continuous browser object/iframe).
 *   Reuses the exact same local cached file across opening, downloading, and sharing.
 *   Zero Google Drive or browser redirects.
 * - DOC / DOCX / XLS: System / external viewer with share & download.
 *
 * Features:
 * - High-priority full-screen Modal portaling above bottom navbar and tab bars
 * - Reactive light/dark theme support using useTheme()
 * - Header: Title, Rotate button (for images only per feedback), Download button, Close button
 * - Zero flicker: Stable image source, direct URL resolution, stable key dependencies
 * - In-app fast downloads via Blob on Web and FileSystem on Native (no external browser redirects)
 * - Multipage continuous PDF scrolling on both Web and Native platforms
 * - Min 44px touch targets conforming to mobile responsive rules
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  RotateCw,
  FileText,
  Download,
} from '../ui/icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/components/ui/ThemeProvider';
import { Pressable } from '@/components/ui/touch/Pressable';
import { showToast } from '@/components/ui/overlay';
import { haptics } from '@/lib/haptics';
import {
  isDirectUrl,
  resolveDocumentUrl,
  ensureLocalDocumentFile,
  downloadDocumentInApp,
} from '@/lib/documentCache';
import { NativePdfViewer } from './NativePdfViewer';

export interface MobileViewerDoc {
  id?: string;
  title: string;
  url?: string;
  uri?: string;
  mimeType: string;
  fileSizeBytes?: number;
  fileSize?: number;
  fileName?: string;
  updatedAt?: string;
}

interface MobileDocumentViewerModalProps {
  document: MobileViewerDoc | null;
  onClose: () => void;
}

export function MobileDocumentViewerModal({
  document: doc,
  onClose,
}: MobileDocumentViewerModalProps) {
  const { theme, isDark } = useTheme();

  const [rotation, setRotation] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [localPdfUri, setLocalPdfUri] = useState<string>('');
  const [isCachingPdf, setIsCachingPdf] = useState(false);

  const rawDocUrl = doc?.url || doc?.uri || '';
  const docKey = doc ? `${doc.id || ''}_${doc.fileName || ''}_${rawDocUrl}` : '';

  // Synchronous URL initialization to prevent initial empty-state re-render flash
  const initialDirectUrl = isDirectUrl(rawDocUrl) ? rawDocUrl : '';
  const [resolvedDocUrl, setResolvedDocUrl] = useState<string>(initialDirectUrl);
  const [isResolvingUrl, setIsResolvingUrl] = useState<boolean>(!initialDirectUrl && Boolean(rawDocUrl));
  const prevDocKeyRef = useRef<string>('');

  const isPdf = Boolean(
    doc?.mimeType?.toLowerCase() === 'application/pdf' ||
    doc?.mimeType?.toLowerCase() === 'application/x-pdf' ||
    /\.pdf$/i.test(rawDocUrl) ||
    /\.pdf$/i.test(doc?.fileName || '')
  );

  const isImage = Boolean(
    doc?.mimeType?.toLowerCase().startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(rawDocUrl) ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc?.fileName || '')
  );

  // Synchronize and resolve secure Supabase storage URL when storage path is provided
  useEffect(() => {
    let isCancelled = false;

    if (!doc || !rawDocUrl) {
      setResolvedDocUrl('');
      setIsResolvingUrl(false);
      setLocalPdfUri('');
      return;
    }

    // Only reset rotation and loader states when document identity changes
    if (prevDocKeyRef.current !== docKey) {
      prevDocKeyRef.current = docKey;
      setRotation(0);
      setImageLoading(true);
      setLocalPdfUri('');
    }

    const prepareDocument = async () => {
      let finalUrl = rawDocUrl;

      // 1. Resolve storage path to signed URL if needed
      if (!isDirectUrl(rawDocUrl)) {
        setIsResolvingUrl(true);
        try {
          finalUrl = await resolveDocumentUrl(rawDocUrl);
          if (isCancelled) return;
          setResolvedDocUrl(finalUrl);
        } catch (err: any) {
          if (isCancelled) return;
          setIsResolvingUrl(false);
          showToast('error', 'Storage Access Error', err?.message || 'Unable to retrieve secure preview link.');
          return;
        } finally {
          if (!isCancelled) setIsResolvingUrl(false);
        }
      } else {
        setResolvedDocUrl(rawDocUrl);
        setIsResolvingUrl(false);
      }

      // 2. On native mobile for PDFs: preload and cache locally so rendering, downloading, and sharing reuse the exact same file
      if (isPdf && Platform.OS !== 'web' && finalUrl) {
        setIsCachingPdf(true);
        try {
          const cachedUri = await ensureLocalDocumentFile({
            url: finalUrl,
            fileName: doc.fileName,
            title: doc.title,
            mimeType: doc.mimeType,
          });
          if (!isCancelled) {
            setLocalPdfUri(cachedUri);
          }
        } catch {
          // If caching fails, fall back to direct URL
          if (!isCancelled) {
            setLocalPdfUri(finalUrl);
          }
        } finally {
          if (!isCancelled) setIsCachingPdf(false);
        }
      }
    };

    prepareDocument();

    return () => {
      isCancelled = true;
    };
  }, [docKey, rawDocUrl, isPdf]);

  const docUrl = resolvedDocUrl || rawDocUrl;
  const activeViewerPdfUri = Platform.OS === 'web' ? docUrl : (localPdfUri || docUrl);

  // Memoized image source to prevent re-instantiation across renders
  const imageSource = useMemo(() => ({ uri: docUrl }), [docUrl]);

  // Fast In-App Download (reuses cached files, zero browser redirects)
  const handleDownload = async () => {
    if (!docUrl || downloading || !doc) return;
    setDownloading(true);
    try {
      haptics.select();
      await downloadDocumentInApp({
        url: localPdfUri || docUrl,
        fileName: doc.fileName,
        title: doc.title,
        mimeType: doc.mimeType,
      });
    } catch (err: any) {
      showToast('error', 'Download Error', err?.message || 'Could not download document.');
    } finally {
      setDownloading(false);
    }
  };


  // Rotate document (90 degrees clockwise)
  const handleRotate = () => {
    haptics.select();
    setRotation((r) => (r + 90) % 360);
  };

  if (!doc) return null;

  return (
    <Modal
      visible={Boolean(doc)}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent
        />
        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}
        >
          {/* ─── Top Control Header (Title on left, Rotate/Download/Share/Close on right) ─── */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderBottomColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.headerTitleContainer}>
              <Text
                variant="heading"
                style={[styles.headerTitle, { color: theme.colors.ink }]}
                numberOfLines={1}
              >
                {doc.title}
              </Text>
              {doc.fileName ? (
                <Text
                  variant="caption"
                  style={[styles.headerSubtitle, { color: theme.colors.mute }]}
                  numberOfLines={1}
                >
                  {doc.fileName}
                </Text>
              ) : null}
            </View>

            {/* Header Action Buttons: Rotate (Images only per feedback, removed for PDFs), Download, and Close */}
            <View style={styles.headerActions}>
              {/* 1. Rotate Button (Images only, removed for PDFs) */}
              {isImage && (
                <Pressable
                  variant="plain"
                  hitSlopToMin48
                  onPress={handleRotate}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Rotate image 90 degrees"
                >
                  <RotateCw size={18} color={theme.colors.ink} />
                </Pressable>
              )}

              {/* 2. Download Icon Button */}
              <Pressable
                variant="plain"
                hitSlopToMin48
                onPress={handleDownload}
                disabled={downloading}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Download document"
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={theme.colors.ink} />
                ) : (
                  <Download size={18} color={theme.colors.ink} />
                )}
              </Pressable>

              {/* 3. Close Icon Button */}
              <Pressable
                variant="plain"
                hitSlopToMin48
                onPress={onClose}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Close viewer"
              >
                <X size={18} color={theme.colors.ink} />
              </Pressable>
            </View>
          </View>

          {/* ─── Main Content Canvas ─── */}
          <View style={[styles.body, { backgroundColor: theme.colors.canvas }]}>
            {/* 1. IMAGE VIEWER (Pinch-to-zoom, Pan, and Rotate) */}
            {isImage && (
              <View style={styles.imageWrapper}>
                {Platform.OS === 'web' ? (
                  /* Web Platform: Clean CSS transform zoom & rotation without ScrollView passive listener issues */
                  <View style={styles.webImageContainer}>
                    {React.createElement('img', {
                      key: docUrl,
                      src: docUrl,
                      alt: doc.title,
                      style: {
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease-out',
                        userSelect: 'none',
                      },
                      onLoad: () => setImageLoading(false),
                      onError: () => setImageLoading(false),
                    })}
                  </View>
                ) : (
                  /* Native Mobile: Hardware-accelerated ScrollView with native pinch-to-zoom & pan */
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    maximumZoomScale={4}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    centerContent
                    bouncesZoom
                  >
                    <Image
                      key={`${docUrl}_${rotation}`}
                      source={imageSource}
                      style={[
                        styles.image,
                        {
                          transform: [{ rotate: `${rotation}deg` }],
                        },
                      ]}
                      resizeMode="contain"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                    />
                  </ScrollView>
                )}

                {imageLoading && (
                  <View
                    style={[
                      styles.loaderOverlay,
                      {
                        backgroundColor: isDark
                          ? 'rgba(10, 10, 10, 0.45)'
                          : 'rgba(255, 255, 255, 0.45)',
                        pointerEvents: 'none',
                      },
                    ]}
                  >
                    <ActivityIndicator size="large" color={theme.colors.link} />
                    <Text
                      variant="caption"
                      style={[styles.loadingText, { color: theme.colors.mute }]}
                    >
                      Loading image...
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 2. IN-APP PDF VIEWER (Native @kishannareshpal/expo-pdf on iOS/Android & Continuous Browser Object on Web) */}
            {isPdf && (
              <View style={styles.pdfContainer}>
                {isResolvingUrl || isCachingPdf ? (
                  <View
                    style={[
                      styles.loaderOverlay,
                      {
                        backgroundColor: isDark
                          ? 'rgba(10, 10, 10, 0.75)'
                          : 'rgba(255, 255, 255, 0.75)',
                      },
                    ]}
                  >
                    <ActivityIndicator size="large" color={theme.colors.link} />
                    <Text
                      variant="caption"
                      style={[styles.loadingText, { color: theme.colors.mute }]}
                    >
                      {isCachingPdf ? 'Preparing in-app document...' : 'Loading document...'}
                    </Text>
                  </View>
                ) : (
                  <NativePdfViewer
                    uri={activeViewerPdfUri}
                    title={doc.title}
                    fileName={doc.fileName}
                    rotation={rotation}
                    onDownload={handleDownload}
                  />
                )}
              </View>
            )}

            {/* 3. EXTERNAL / SYSTEM DOCUMENTS (DOC, DOCX, XLS) */}
            {!isImage && !isPdf && (
              <View style={styles.externalCard}>
                <View
                  style={[
                    styles.externalIconBox,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <FileText size={40} color={theme.colors.link} />
                </View>
                <Text
                  variant="heading"
                  style={[styles.externalTitle, { color: theme.colors.ink }]}
                >
                  {doc.title}
                </Text>
                <Text
                  variant="caption"
                  style={[styles.externalSubtitle, { color: theme.colors.mute }]}
                >
                  {doc.fileName || 'Document'}
                </Text>
                <Text
                  variant="caption"
                  style={[styles.externalNotice, { color: theme.colors.mute }]}
                >
                  This file format can be downloaded to view in a compatible app on your device.
                </Text>
                <Pressable
                  variant="buttonPrimary"
                  onPress={handleDownload}
                  style={styles.primaryActionBtn}
                  accessibilityLabel="Download file"
                >
                  <Download
                    size={18}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text variant="label" style={styles.primaryActionText}>
                    Download Document
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
      } as any,
      default: {},
    }),
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {},
  headerSubtitle: {
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  webImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {},
  pdfContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  externalCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  externalIconBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  externalTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  externalSubtitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  externalNotice: {
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0284c7',
    minHeight: 44,
  },
  primaryActionText: {
    color: '#ffffff',
  },
});
