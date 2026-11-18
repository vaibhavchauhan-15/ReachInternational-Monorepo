/**
 * ReachInternational Mobile — Mobile Document Upload Card
 * Matches web mobile viewport 95% identically:
 * - Direct form field alignment matching Input/Select (no awkward double-nested card)
 * - Label with required asterisk
 * - Dashed upload box with Upload icon
 * - Attached document banner with thumbnail/icon, filename, size, and remove button
 * - 5% native optimizations (Haptics, smooth picking, tactile feedback).
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  type ViewStyle,
} from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { Pressable } from '../ui/touch/Pressable';
import {
  FileText,
  Upload,
  X,
  RotateCw,
  Check,
  AlertCircle,
  ImageIcon,
} from '../ui/icon';
import {
  MobilePickedDocument,
  UserDocumentInfo,
  pickIdentityDocument,
} from '../../lib/documents';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from './MobileDocumentViewerModal';
import { AppModal } from '../ui/AppModal';
import { type MobileDocumentUploadSlot } from '../../lib/hooks/useMobileSignupDocumentUploads';
import { haptics } from '../../lib/haptics';

export interface MobileDocumentUploadCardProps {
  title: string;
  subtitle?: string;
  docTypeCode: 'aadhaar' | 'driving_license' | 'bank_document' | 'bank_passbook' | string;
  required?: boolean;
  readOnly?: boolean;
  selectedDoc?: MobilePickedDocument | null;
  existingDoc?: UserDocumentInfo | null;
  onDocSelected?: (doc: MobilePickedDocument) => void;
  onDocRemoved?: () => void;
  uploading?: boolean;
  uploadProgress?: number;
  errorMessage?: string | null;
  style?: ViewStyle;
  // Phase 5 Zero-Byte Staging Upload Slot Integration
  slot?: MobileDocumentUploadSlot;
  onPickSlot?: (source: 'camera' | 'gallery') => void;
  onRetrySlot?: () => void;
  onRemoveSlot?: () => void;
}

export function MobileDocumentUploadCard({
  title,
  subtitle,
  docTypeCode,
  required = false,
  readOnly = false,
  selectedDoc,
  existingDoc,
  onDocSelected,
  onDocRemoved,
  uploading = false,
  uploadProgress = 0,
  errorMessage,
  style,
  slot,
  onPickSlot,
  onRetrySlot,
  onRemoveSlot,
}: MobileDocumentUploadCardProps) {
  const { theme, isDark } = useTheme();
  const [viewerDoc, setViewerDoc] = useState<MobileViewerDoc | null>(null);
  const [isPickerSheetOpen, setIsPickerSheetOpen] = useState(false);

  const cleanTitle = title.replace(/\s*\*+$/, '');

  // Legacy pick handler (when slot is not provided)
  const handlePickLegacy = async () => {
    try {
      haptics.select();
      const doc = await pickIdentityDocument();
      if (doc && onDocSelected) {
        onDocSelected(doc);
      }
    } catch {
      // Handled silently
    }
  };

  const handleRemoveLegacy = () => {
    haptics.select();
    if (onDocRemoved) {
      onDocRemoved();
    }
  };

  const hasLegacyFile = Boolean(selectedDoc || existingDoc);
  const isLegacyImage = selectedDoc?.mimeType?.startsWith('image/') || existingDoc?.mime_type?.startsWith('image/');

  const defaultPlaceholder = docTypeCode === 'bank_document' || docTypeCode === 'bank_passbook'
    ? 'Upload a clear photo (JPG or PNG)'
    : docTypeCode === 'aadhaar'
    ? 'Upload a clear photo (JPG or PNG)'
    : 'Upload a clear photo (JPG or PNG)';

  const openLegacyViewer = () => {
    if (selectedDoc) {
      setViewerDoc({
        title: cleanTitle,
        url: selectedDoc.uri,
        mimeType: selectedDoc.mimeType,
        fileName: selectedDoc.name,
      });
    } else if (existingDoc) {
      setViewerDoc({
        title: cleanTitle,
        url: existingDoc.storage_path,
        mimeType: existingDoc.mime_type,
        fileName: existingDoc.storage_path.split('/').pop(),
      });
    }
  };

  const openSlotViewer = () => {
    if (slot?.previewUri || slot?.mainUri) {
      setViewerDoc({
        title: cleanTitle,
        url: slot.previewUri || slot.mainUri!,
        mimeType: 'image/jpeg',
        fileName: `${docTypeCode}.jpg`,
      });
    }
  };

  return (
    <View style={[styles.fieldContainer, style]}>
      {/* Label Row */}
      <View style={styles.labelRow}>
        <Text variant="label" style={[styles.label, { color: isDark ? '#ffffff' : '#0f172a' }]}>
          {cleanTitle}
        </Text>
        {required && !readOnly && <Text variant="label" style={styles.requiredStar}>*</Text>}
      </View>

      {/* ========================================================
          SLOT-BASED ZERO-BYTE STAGING ARCHITECTURE (PHASE 5)
          ======================================================== */}
      {slot ? (
        <>
          {/* Slot: Idle state */}
          {slot.status === 'idle' && (
            readOnly ? (
              <View
                style={[
                  styles.dashedBox,
                  {
                    borderColor: isDark ? '#262626' : '#e2e8f0',
                    backgroundColor: isDark ? '#141414' : '#f4f4f5',
                    borderStyle: 'solid',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Not on file (View Only)
                </Text>
              </View>
            ) : (
              <Pressable
                variant="outline"
                haptic="tap"
                onPress={() => setIsPickerSheetOpen(true)}
                style={[
                  styles.dashedBox,
                  {
                    borderColor: errorMessage
                      ? '#ef4444'
                      : isDark
                      ? '#333333'
                      : '#d1d5db',
                    backgroundColor: isDark ? '#141414' : '#ffffff',
                  },
                ]}
              >
                <View style={styles.dashedInner}>
                  <Upload size={15} color={isDark ? '#737373' : '#9ca3af'} />
                  <Text
                    variant="caption"
                    style={[
                      styles.dashedText,
                      { color: isDark ? '#71717a' : '#9ca3af' },
                    ]}
                    numberOfLines={1}
                  >
                    {subtitle || defaultPlaceholder}
                  </Text>
                </View>
              </Pressable>
            )
          )}

          {/* Slot: Compressing state */}
          {slot.status === 'compressing' && (
            <View
              style={[
                styles.processingBox,
                {
                  backgroundColor: isDark ? '#141414' : '#f8fafc',
                  borderColor: isDark ? '#262626' : '#e2e8f0',
                },
              ]}
            >
              <ActivityIndicator size="small" color="#0284c7" />
              <View style={styles.processingDetails}>
                <Text variant="caption" weight="medium" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Optimizing photo...
                </Text>
                <Text variant="micro" style={{ color: theme.colors.mute }}>
                  Resizing to ≤1600px and compressing JPEG
                </Text>
              </View>
            </View>
          )}

          {/* Slot: Uploading state */}
          {slot.status === 'uploading' && (
            <View
              style={[
                styles.processingBox,
                {
                  backgroundColor: isDark ? '#141414' : '#f8fafc',
                  borderColor: isDark ? '#262626' : '#e2e8f0',
                },
              ]}
            >
              <ActivityIndicator size="small" color="#0284c7" />
              <View style={styles.processingDetails}>
                <Text variant="caption" weight="medium" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Streaming to storage...
                </Text>
                <Text variant="micro" style={{ color: slot.error ? '#f59e0b' : theme.colors.mute }}>
                  {slot.error || 'Direct background upload in progress'}
                </Text>
              </View>
            </View>
          )}

          {/* Slot: Ready state */}
          {slot.status === 'ready' && (
            <View
              style={[
                styles.attachedRow,
                {
                  backgroundColor: isDark ? '#0c2a4d' : '#f0f9ff',
                  borderColor: isDark ? '#0284c7' : '#bae6fd',
                },
              ]}
            >
              <Pressable
                variant="ghost"
                haptic="tap"
                onPress={openSlotViewer}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
              >
                {slot.thumbUri || slot.previewUri ? (
                  <Image
                    source={{ uri: slot.thumbUri || slot.previewUri! }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.fileIconBox,
                      { backgroundColor: isDark ? '#262626' : '#e2e8f0' },
                    ]}
                  >
                    <FileText size={18} color="#0284c7" />
                  </View>
                )}

                <View style={styles.fileDetails}>
                  <Text
                    variant="caption"
                    style={[
                      styles.fileName,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                    ]}
                    numberOfLines={1}
                  >
                    {cleanTitle}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Check size={12} color="#10b981" strokeWidth={2.5} />
                    <Text variant="mono" style={[styles.fileMeta, { color: isDark ? '#71717a' : '#9ca3af' }]}>
                      {slot.sizeBytes
                        ? `${(slot.sizeBytes / 1024).toFixed(0)} KB · Ready`
                        : 'Ready for registration'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {!readOnly && onRemoveSlot && (
                <Pressable
                  variant="iconButton"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={() => {
                    haptics.select();
                    onRemoveSlot();
                  }}
                  style={styles.removeBtn}
                  accessibilityLabel="Remove attached document"
                >
                  <X size={15} color={isDark ? '#a1a1aa' : '#6b7280'} />
                </Pressable>
              )}
            </View>
          )}

          {/* Slot: Failed state */}
          {slot.status === 'failed' && (
            <View
              style={[
                styles.failedBox,
                {
                  backgroundColor: isDark ? '#2d0606' : '#fef2f2',
                  borderColor: isDark ? '#7f1d1d' : '#fecaca',
                },
              ]}
            >
              <View style={styles.failedHeader}>
                <AlertCircle size={15} color="#ef4444" />
                <Text
                  variant="caption"
                  weight="medium"
                  style={{ color: '#ef4444', flex: 1, marginLeft: 6 }}
                >
                  {slot.error || errorMessage || 'Upload failed. Please try again.'}
                </Text>
              </View>
              <View style={styles.failedActions}>
                {/* Only show Retry when the error is retryable (network/server), not for
                    non-retryable issues like permission denied or resolution too low */}
                {onRetrySlot && (slot as any).retryable !== false && slot.mainUri && (
                  <Pressable
                    variant="outline"
                    haptic="tap"
                    onPress={() => {
                      haptics.select();
                      onRetrySlot();
                    }}
                    style={[styles.retryBtn, { borderColor: isDark ? '#38bdf8' : '#0284c7' }]}
                  >
                    <RotateCw size={13} color={isDark ? '#38bdf8' : '#0284c7'} />
                    <Text
                      variant="caption"
                      weight="medium"
                      style={{ color: isDark ? '#38bdf8' : '#0284c7', marginLeft: 4 }}
                    >
                      Retry Upload
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  variant="ghost"
                  haptic="tap"
                  onPress={() => {
                    haptics.select();
                    setIsPickerSheetOpen(true);
                  }}
                  style={styles.replaceBtn}
                >
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Choose Another Photo
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Camera vs Gallery Selection Sheet */}
          <AppModal
            visible={isPickerSheetOpen}
            onClose={() => setIsPickerSheetOpen(false)}
            variant="bottom"
            showHandle
          >
            <View style={styles.sheetContent}>
              <Text variant="heading" style={styles.sheetTitle}>Select Document Source</Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 16 }}>
                Upload a clear photo (JPG or PNG) for {cleanTitle}
              </Text>

              <Pressable
                variant="outline"
                haptic="tap"
                onPress={() => {
                  haptics.select();
                  setIsPickerSheetOpen(false);
                  onPickSlot?.('camera');
                }}
                style={[styles.sheetOptionBtn, { borderColor: isDark ? '#333333' : '#e2e8f0' }]}
              >
                <Upload size={18} color="#0284c7" />
                <View style={{ flex: 1 }}>
                  <Text variant="label">Take Photo with Camera</Text>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Capture document directly</Text>
                </View>
              </Pressable>

              <Pressable
                variant="outline"
                haptic="tap"
                onPress={() => {
                  haptics.select();
                  setIsPickerSheetOpen(false);
                  onPickSlot?.('gallery');
                }}
                style={[styles.sheetOptionBtn, { borderColor: isDark ? '#333333' : '#e2e8f0' }]}
              >
                <ImageIcon size={18} color="#0284c7" />
                <View style={{ flex: 1 }}>
                  <Text variant="label">Choose from Photo Library</Text>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Select from device gallery</Text>
                </View>
              </Pressable>

              <Pressable
                variant="ghost"
                haptic="tap"
                onPress={() => setIsPickerSheetOpen(false)}
                style={styles.sheetCancelBtn}
              >
                <Text variant="label" style={{ color: theme.colors.mute }}>Cancel</Text>
              </Pressable>
            </View>
          </AppModal>
        </>
      ) : (
        /* ========================================================
            LEGACY DIRECT ATTACHMENT FLOW (BACKWARD COMPATIBLE)
            ======================================================== */
        <>
          {/* Progress Bar (when uploading) */}
          {uploading && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#262626' : '#e5e7eb' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(Math.max(uploadProgress, 5), 100)}%`, backgroundColor: '#0284c7' },
                  ]}
                />
              </View>
              <Text variant="caption" style={[styles.progressText, { color: theme.colors.mute }]}>
                Uploading... {uploadProgress}%
              </Text>
            </View>
          )}

          {/* Empty State: Dashed Upload Box or Read Only Placeholder */}
          {!hasLegacyFile ? (
            readOnly ? (
              <View
                style={[
                  styles.dashedBox,
                  {
                    borderColor: isDark ? '#262626' : '#e2e8f0',
                    backgroundColor: isDark ? '#141414' : '#f4f4f5',
                    borderStyle: 'solid',
                  },
                ]}
              >
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Not on file (View Only)
                </Text>
              </View>
            ) : (
              <Pressable
                variant="outline"
                haptic="tap"
                onPress={handlePickLegacy}
                disabled={uploading}
                style={[
                  styles.dashedBox,
                  {
                    borderColor: errorMessage
                      ? '#ef4444'
                      : isDark
                      ? '#333333'
                      : '#d1d5db',
                    backgroundColor: isDark ? '#141414' : '#ffffff',
                  },
                ]}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#0284c7" />
                ) : (
                  <View style={styles.dashedInner}>
                    <Upload size={15} color={isDark ? '#737373' : '#9ca3af'} />
                    <Text
                      variant="caption"
                      style={[
                        styles.dashedText,
                        { color: isDark ? '#71717a' : '#9ca3af' },
                      ]}
                      numberOfLines={1}
                    >
                      {subtitle || defaultPlaceholder}
                    </Text>
                  </View>
                )}
              </Pressable>
            )
          ) : (
            /* Attached Document Banner */
            <View
              style={[
                styles.attachedRow,
                {
                  backgroundColor: isDark ? '#0c2a4d' : '#f0f9ff',
                  borderColor: isDark ? '#0284c7' : '#bae6fd',
                },
              ]}
            >
              {/* Thumbnail / Icon clickable for viewer */}
              <Pressable variant="ghost" haptic="tap" onPress={openLegacyViewer} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                {isLegacyImage && selectedDoc?.uri ? (
                  <Image
                    source={{ uri: selectedDoc.uri }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.fileIconBox,
                      { backgroundColor: isDark ? '#262626' : '#e2e8f0' },
                    ]}
                  >
                    <FileText size={18} color="#0284c7" />
                  </View>
                )}

                {/* Details */}
                <View style={styles.fileDetails}>
                  <Text
                    variant="caption"
                    style={[
                      styles.fileName,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedDoc?.name || existingDoc?.storage_path.split('/').pop() || 'Document attached'}
                  </Text>
                  <Text variant="mono" style={[styles.fileMeta, { color: isDark ? '#71717a' : '#9ca3af' }]}>
                    {selectedDoc?.size
                      ? `${(selectedDoc.size / 1024).toFixed(0)} KB · Attached`
                      : existingDoc?.file_size_bytes
                      ? `${(existingDoc.file_size_bytes / 1024).toFixed(0)} KB · Uploaded`
                      : 'Attached'}
                  </Text>
                </View>
              </Pressable>

              {/* Remove Button — only if editable */}
              {!readOnly && (
                <Pressable
                  variant="iconButton"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={handleRemoveLegacy}
                  disabled={uploading}
                  style={styles.removeBtn}
                  accessibilityLabel="Remove attached document"
                >
                  <X size={15} color={isDark ? '#a1a1aa' : '#6b7280'} />
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      {/* Error Message */}
      {errorMessage ? (
        <Text variant="caption" style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {/* In-App Mobile Document Viewer Modal */}
      <MobileDocumentViewerModal
        document={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    width: '100%',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 3,
  },
  label: {},
  requiredStar: {
    color: '#ef4444',
  },
  dashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dashedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedText: {},
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 50,
  },
  processingDetails: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  thumbnail: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    marginBottom: 2,
  },
  fileMeta: {},
  removeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  failedBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  failedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  failedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  replaceBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  errorText: {
    color: '#ef4444',
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 6,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    marginTop: 2,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetTitle: {
    marginBottom: 4,
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    minHeight: 52,
    gap: 12,
  },
  sheetCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    minHeight: 48,
  },
});
