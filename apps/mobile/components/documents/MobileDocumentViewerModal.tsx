/**
 * ReachInternational Mobile — Native In-App Document Viewer Modal
 *
 * Implements the hybrid Document Viewer architecture:
 * - JPG / PNG / WEBP: In-app image viewer with pinch-to-zoom, pan, and rotation.
 * - PDF: In-app native browser <iframe> (Web) or hardware-accelerated WebView (iOS/Android) with fallback.
 * - DOC / DOCX / XLS: System / external viewer with share & download.
 *
 * Features:
 * - High-priority full-screen Modal portaling above bottom navbar and tab bars
 * - Reactive light/dark theme support using useTheme()
 * - Header: Document title, Download button, Share button, and Close button
 * - Zero flicker: Stabilized image and document key dependencies
 * - Pinch-to-zoom & Pan via native ScrollView
 * - Min 44px touch targets conforming to mobile responsive rules
 */

import React, { useState, useEffect } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  X,
  Share2,
  RotateCw,
  RotateCcw,
  FileText,
  Download,
  ExternalLink,
} from '../ui/icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/components/ui/ThemeProvider';
import { Pressable } from '@/components/ui/touch/Pressable';
import { useToast } from '@/components/ui/overlay';
import { haptics } from '@/lib/haptics';

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
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const [rotation, setRotation] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const docUrl = doc?.url || doc?.uri || '';
  const docKey = doc ? `${doc.id || ''}_${doc.fileName || ''}_${docUrl}` : '';

  // Reset rotation and loading strictly when the active document identity changes
  useEffect(() => {
    if (doc) {
      setRotation(0);
      setImageLoading(true);
      setPdfError(false);
    }
  }, [docKey]);

  if (!doc) return null;

  const isImage = Boolean(
    doc.mimeType?.toLowerCase().startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(docUrl) ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.fileName || '')
  );

  const isPdf = Boolean(
    doc.mimeType?.toLowerCase() === 'application/pdf' ||
    doc.mimeType?.toLowerCase() === 'application/x-pdf' ||
    /\.pdf$/i.test(docUrl) ||
    /\.pdf$/i.test(doc.fileName || '')
  );

  // Dedicated Download Action
  const handleDownload = async () => {
    if (!docUrl || downloading) return;
    setDownloading(true);
    try {
      haptics.select();
      let filename = doc.fileName || doc.title || 'document';
      const ext =
        doc.fileName?.split('.').pop() ||
        (isPdf ? 'pdf' : isImage ? 'jpg' : 'pdf');
      if (!filename.includes('.')) {
        filename = `${filename}.${ext}`;
      }

      // Web platform: native browser download via anchor click
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = docUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('success', 'Download Started', `Downloading ${filename}`);
        return;
      }

      // Native mobile: FileSystem download + Sharing dialog
      const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const localUri = `${targetDir}${filename}`;
      const downloadRes = await FileSystem.downloadAsync(docUrl, localUri);

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(downloadRes.uri, {
          dialogTitle: `Download ${doc.title}`,
          UTI: isPdf ? 'com.adobe.pdf' : 'public.image',
          mimeType: doc.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
        });
        toast('success', 'Document Saved', `${doc.title} saved.`);
      } else {
        await Linking.openURL(docUrl);
      }
    } catch (err: any) {
      if (docUrl) {
        Linking.openURL(docUrl).catch(() => {});
      }
      toast('error', 'Download Error', err?.message || 'Could not download document.');
    } finally {
      setDownloading(false);
    }
  };

  // Dedicated Share Action
  const handleShare = async () => {
    if (!docUrl || sharing) return;
    setSharing(true);
    try {
      haptics.select();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && FileSystem.cacheDirectory) {
        const ext =
          doc.fileName?.split('.').pop() ||
          (isPdf ? 'pdf' : 'jpg');
        const tempUri = `${FileSystem.cacheDirectory}shared_doc_${Date.now()}.${ext}`;
        const downloadRes = await FileSystem.downloadAsync(docUrl, tempUri);
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        await Linking.openURL(docUrl);
      }
    } catch {
      if (docUrl) {
        await Linking.openURL(docUrl).catch(() => {});
      }
    } finally {
      setSharing(false);
    }
  };

  const handleRotate = () => {
    haptics.select();
    setRotation((r) => (r + 90) % 360);
  };

  const handleResetRotation = () => {
    haptics.select();
    setRotation(0);
  };

  // Google Docs viewer URL for Android PDF in WebView
  const pdfViewerUri: string = docUrl
    ? Platform.OS === 'android'
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(docUrl)}`
      : docUrl
    : '';

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
          {/* ─── Top Control Header (Title on left, Download, Share & Close on right) ─── */}
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

            {/* Header Action Buttons: Download, Share, and Close */}
            <View style={styles.headerActions}>
              {/* 1. Download Icon Button */}
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

              {/* 2. Share Icon Button */}
              <Pressable
                variant="plain"
                hitSlopToMin48
                onPress={handleShare}
                disabled={sharing}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Share document"
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={theme.colors.ink} />
                ) : (
                  <Share2 size={18} color={theme.colors.ink} />
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
            {/* 1. IMAGE VIEWER (Pinch-to-zoom, Pan, Rotate) */}
            {isImage && (
              <View style={styles.imageWrapper}>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  centerContent
                >
                  <Image
                    source={{ uri: docUrl }}
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

                {imageLoading && (
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
                      Loading image...
                    </Text>
                  </View>
                )}

                {/* Floating Bottom Rotate Control Bar */}
                <View
                  style={[
                    styles.floatingBar,
                    {
                      bottom: Math.max(insets.bottom, 16) + 16,
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Pressable
                    variant="buttonSecondary"
                    onPress={handleRotate}
                    style={[
                      styles.floatingBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Rotate 90 degrees"
                  >
                    <RotateCw size={16} color={theme.colors.ink} />
                    <Text
                      variant="label"
                      style={[
                        styles.floatingBtnText,
                        { color: theme.colors.ink },
                      ]}
                    >
                      Rotate
                    </Text>
                  </Pressable>

                  {rotation !== 0 && (
                    <Pressable
                      variant="buttonSecondary"
                      onPress={handleResetRotation}
                      style={[
                        styles.floatingBtn,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      accessibilityLabel="Reset rotation"
                    >
                      <RotateCcw size={16} color={theme.colors.ink} />
                      <Text
                        variant="label"
                        style={[
                          styles.floatingBtnText,
                          { color: theme.colors.ink },
                        ]}
                      >
                        Reset
                      </Text>
                    </Pressable>
                  )}

                  <Text
                    variant="caption"
                    style={[styles.zoomNotice, { color: theme.colors.mute }]}
                  >
                    Pinch to zoom & pan
                  </Text>
                </View>
              </View>
            )}

            {/* 2. PDF VIEWER (Smooth Web <iframe> & Native WebView with Error Fallback) */}
            {isPdf && (
              <View style={styles.pdfContainer}>
                {Platform.OS === 'web' ? (
                  /* Native browser PDF iframe on web for 60fps smooth zooming and rendering */
                  <View style={styles.webPdfWrapper}>
                    {React.createElement('iframe', {
                      src: `${docUrl}#toolbar=1&navpanes=0&view=FitH`,
                      title: doc.title,
                      style: {
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        backgroundColor: '#ffffff',
                      },
                    })}
                  </View>
                ) : pdfError ? (
                  /* PDF Fallback Card if preview fails to load on native */
                  <View style={styles.pdfFallbackCard}>
                    <View
                      style={[
                        styles.pdfFallbackIconBox,
                        {
                          backgroundColor: 'rgba(225, 29, 72, 0.1)',
                          borderColor: 'rgba(225, 29, 72, 0.25)',
                        },
                      ]}
                    >
                      <FileText size={40} color="#e11d48" />
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
                      {doc.fileName || 'PDF Document'}
                    </Text>
                    <Text
                      variant="caption"
                      style={[styles.externalNotice, { color: theme.colors.mute }]}
                    >
                      Preview could not be displayed directly in-app. You can open it in your device's PDF app or download it.
                    </Text>
                    <View style={styles.fallbackActionsRow}>
                      <Pressable
                        variant="buttonPrimary"
                        onPress={() => Linking.openURL(docUrl)}
                        style={styles.primaryActionBtn}
                        accessibilityLabel="Open in device PDF app"
                      >
                        <ExternalLink size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text variant="label" style={styles.primaryActionText}>
                          Open in PDF App
                        </Text>
                      </Pressable>
                      <Pressable
                        variant="buttonSecondary"
                        onPress={handleDownload}
                        style={[
                          styles.secondaryActionBtn,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                        accessibilityLabel="Download PDF"
                      >
                        <Download size={16} color={theme.colors.ink} style={{ marginRight: 6 }} />
                        <Text variant="label" style={{ color: theme.colors.ink }}>
                          Download
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  /* Native iOS/Android WebView */
                  <View style={styles.webViewWrapper}>
                    <WebView
                      source={{ uri: pdfViewerUri || 'about:blank' } as any}
                      style={styles.webView}
                      startInLoadingState
                      renderLoading={() => (
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
                            Loading PDF...
                          </Text>
                        </View>
                      )}
                      scalesPageToFit
                      originWhitelist={['*']}
                      mixedContentMode="always"
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      allowFileAccess={true}
                      allowUniversalAccessFromFileURLs={true}
                      onError={() => setPdfError(true)}
                      onHttpError={() => setPdfError(true)}
                    />

                    {/* Quick action bar to open in external device viewer */}
                    <View
                      style={[
                        styles.pdfFloatingBar,
                        {
                          bottom: Math.max(insets.bottom, 16) + 16,
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Pressable
                        variant="buttonSecondary"
                        onPress={() => Linking.openURL(docUrl)}
                        style={[
                          styles.floatingBtn,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                        accessibilityLabel="Open in device PDF app"
                      >
                        <ExternalLink size={15} color={theme.colors.ink} />
                        <Text
                          variant="label"
                          style={[styles.floatingBtnText, { color: theme.colors.ink }]}
                        >
                          Open in Device PDF App
                        </Text>
                      </Pressable>
                    </View>
                  </View>
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
                  This file format can be opened or shared to a compatible app on your device.
                </Text>
                <Pressable
                  variant="buttonPrimary"
                  onPress={handleDownload}
                  style={styles.primaryActionBtn}
                  accessibilityLabel="Download and open file"
                >
                  <Download
                    size={18}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text variant="label" style={styles.primaryActionText}>
                    Download & Open
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
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
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
  floatingBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  floatingBtnText: {},
  zoomNotice: {},
  pdfContainer: {
    flex: 1,
  },
  webPdfWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  pdfFloatingBar: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  pdfFallbackCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pdfFallbackIconBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  fallbackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
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
