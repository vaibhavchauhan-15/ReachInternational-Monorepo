/**
 * ReachInternational Mobile — Native In-App Document Viewer Modal
 *
 * Implements the hybrid Document Viewer architecture:
 * - JPG / PNG / WEBP: In-app image viewer with pinch-to-zoom, pan, and rotation.
 * - PDF: In-app WebView viewer with native rendering.
 * - DOC / DOCX / XLS: System / external viewer with share & download.
 *
 * Features:
 * - Reactive light/dark theme support using useTheme()
 * - Clean header: Document title, Share/Download button, and Close button only
 * - Short-lived signed URL integration
 * - Pinch-to-zoom & Pan via native ScrollView
 * - Min 44px touch targets conforming to mobile responsive rules
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
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
  Image as ImageIcon,
  Download,
} from 'lucide-react-native';
import { useTheme } from '@/components/ui/ThemeProvider';

export interface MobileViewerDoc {
  id?: string;
  title: string;
  url: string;
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
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (doc) {
      setRotation(0);
      setImageLoading(true);
    }
  }, [doc]);

  if (!doc) return null;

  const isImage =
    doc.mimeType?.toLowerCase().startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.url || '') ||
    /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.fileName || '');

  const isPdf =
    doc.mimeType?.toLowerCase() === 'application/pdf' ||
    /\.pdf$/i.test(doc.url || '') ||
    /\.pdf$/i.test(doc.fileName || '');

  const handleShare = async () => {
    if (!doc.url || sharing) return;
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && FileSystem.cacheDirectory) {
        const ext =
          doc.fileName?.split('.').pop() ||
          (doc.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
        const tempUri = `${FileSystem.cacheDirectory}shared_doc_${Date.now()}.${ext}`;
        const downloadRes = await FileSystem.downloadAsync(doc.url, tempUri);
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        await Linking.openURL(doc.url);
      }
    } catch {
      await Linking.openURL(doc.url).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleResetRotation = () => {
    setRotation(0);
  };

  // Google Docs viewer URL for Android PDF in WebView
  const pdfViewerUri =
    Platform.OS === 'android'
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
          doc.url
        )}`
      : doc.url;

  return (
    <Modal
      visible={!!doc}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.canvasElevated}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.canvas }]}
      >
        {/* ─── Top Control Header (Title on left, Download/Share & Close on right) ─── */}
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
              style={[styles.headerTitle, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {doc.title}
            </Text>
          </View>

          {/* Action Buttons: Only Share/Download and Close */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleShare}
              disabled={sharing}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Share or download document"
              hitSlop={8}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={theme.colors.ink} />
              ) : (
                <Share2 size={18} color={theme.colors.ink} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Close viewer"
              hitSlop={8}
            >
              <X size={18} color={theme.colors.ink} />
            </TouchableOpacity>
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
                  source={{ uri: doc.url }}
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
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <TouchableOpacity
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
                    style={[
                      styles.floatingBtnText,
                      { color: theme.colors.ink },
                    ]}
                  >
                    Rotate
                  </Text>
                </TouchableOpacity>

                {rotation !== 0 && (
                  <TouchableOpacity
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
                      style={[
                        styles.floatingBtnText,
                        { color: theme.colors.ink },
                      ]}
                    >
                      Reset
                    </Text>
                  </TouchableOpacity>
                )}

                <Text
                  style={[styles.zoomNotice, { color: theme.colors.mute }]}
                >
                  Pinch to zoom & pan
                </Text>
              </View>
            </View>
          )}

          {/* 2. PDF VIEWER (In-App WebView, no cluttered footer) */}
          {isPdf && (
            <View style={styles.webViewWrapper}>
              <WebView
                source={{ uri: pdfViewerUri }}
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
                      style={[styles.loadingText, { color: theme.colors.mute }]}
                    >
                      Loading PDF...
                    </Text>
                  </View>
                )}
                scalesPageToFit
                originWhitelist={['*']}
              />
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
                style={[styles.externalTitle, { color: theme.colors.ink }]}
              >
                {doc.title}
              </Text>
              <Text
                style={[styles.externalSubtitle, { color: theme.colors.mute }]}
              >
                {doc.fileName || 'Document'}
              </Text>
              <Text
                style={[styles.externalNotice, { color: theme.colors.mute }]}
              >
                This file format can be opened or shared to a compatible app on
                your device.
              </Text>
              <TouchableOpacity
                onPress={handleShare}
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: theme.colors.link },
                ]}
              >
                <Download
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryActionText}>Download & Open</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
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
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  floatingBar: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    minHeight: 36,
  },
  floatingBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  zoomNotice: {
    fontSize: 11,
  },
  webViewWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  externalSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  externalNotice: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
    minHeight: 44,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
