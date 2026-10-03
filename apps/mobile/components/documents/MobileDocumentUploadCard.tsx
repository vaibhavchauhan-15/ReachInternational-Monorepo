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
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/ThemeProvider';
import {
  FileText,
  Upload,
  X,
} from 'lucide-react-native';
import {
  MobilePickedDocument,
  UserDocumentInfo,
  pickIdentityDocument,
} from '../../lib/documents';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from './MobileDocumentViewerModal';

export interface MobileDocumentUploadCardProps {
  title: string;
  subtitle?: string;
  docTypeCode: 'aadhaar' | 'driving_license' | 'bank_document' | 'bank_passbook' | string;
  required?: boolean;
  selectedDoc: MobilePickedDocument | null;
  existingDoc?: UserDocumentInfo | null;
  onDocSelected: (doc: MobilePickedDocument) => void;
  onDocRemoved: () => void;
  uploading?: boolean;
  uploadProgress?: number;
  errorMessage?: string | null;
  style?: ViewStyle;
}

export function MobileDocumentUploadCard({
  title,
  subtitle,
  docTypeCode,
  required = false,
  selectedDoc,
  existingDoc,
  onDocSelected,
  onDocRemoved,
  uploading = false,
  uploadProgress = 0,
  errorMessage,
  style,
}: MobileDocumentUploadCardProps) {
  const { theme, isDark } = useTheme();
  const [viewerDoc, setViewerDoc] = useState<MobileViewerDoc | null>(null);

  const handlePick = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      const doc = await pickIdentityDocument();
      if (doc) {
        onDocSelected(doc);
      }
    } catch (err: any) {
      // Handled by parent or silent catch
    }
  };

  const handleRemove = () => {
    Haptics.selectionAsync().catch(() => {});
    onDocRemoved();
  };

  const hasFile = Boolean(selectedDoc || existingDoc);
  const isImage = selectedDoc?.mimeType?.startsWith('image/') || existingDoc?.mime_type?.startsWith('image/');

  const defaultPlaceholder = docTypeCode === 'bank_document' || docTypeCode === 'bank_passbook'
    ? 'Upload Passbook / Cheque / Statement (JPG, PNG, PDF)'
    : docTypeCode === 'aadhaar'
    ? 'Upload Aadhaar (JPG, PNG, PDF)'
    : 'Upload Licence (JPG, PNG, PDF)';

  const cleanTitle = title.replace(/\s*\*+$/, '');

  const openViewer = () => {
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

  return (
    <View style={[styles.fieldContainer, style]}>
      {/* Label Row */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: isDark ? '#ffffff' : '#0f172a' }]}>
          {cleanTitle}
        </Text>
        {required && <Text style={styles.requiredStar}>*</Text>}
      </View>

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
          <Text style={[styles.progressText, { color: theme.colors.mute }]}>
            Uploading... {uploadProgress}%
          </Text>
        </View>
      )}

      {/* Empty State: Dashed Upload Box */}
      {!hasFile ? (
        <TouchableOpacity
          onPress={handlePick}
          activeOpacity={0.7}
          disabled={uploading}
          style={[
            styles.dashedBox,
            {
              borderColor: errorMessage
                ? '#ef4444'
                : isDark
                ? '#333333'
                : '#d1d5db',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#0284c7" />
          ) : (
            <View style={styles.dashedInner}>
              <Upload size={15} color={isDark ? '#737373' : '#9ca3af'} />
              <Text
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
        </TouchableOpacity>
      ) : (
        /* Attached Document Banner */
        <View
          style={[
            styles.attachedRow,
            {
              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.1)' : 'rgba(2, 132, 199, 0.05)',
              borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : 'rgba(2, 132, 199, 0.2)',
            },
          ]}
        >
          {/* Thumbnail / Icon clickable for viewer */}
          <TouchableOpacity onPress={openViewer} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            {isImage && selectedDoc?.uri ? (
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
                style={[
                  styles.fileName,
                  { color: isDark ? '#f8fafc' : '#0f172a' },
                ]}
                numberOfLines={1}
              >
                {selectedDoc?.name || existingDoc?.storage_path.split('/').pop() || 'Document attached'}
              </Text>
              <Text style={[styles.fileMeta, { color: isDark ? '#71717a' : '#9ca3af' }]}>
                {selectedDoc?.size
                  ? `${(selectedDoc.size / 1024).toFixed(0)} KB · Attached`
                  : existingDoc?.file_size_bytes
                  ? `${(existingDoc.file_size_bytes / 1024).toFixed(0)} KB · Uploaded`
                  : 'Attached'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Remove Button */}
          <TouchableOpacity
            onPress={handleRemove}
            disabled={uploading}
            hitSlop={10}
            style={styles.removeBtn}
            accessibilityLabel="Remove attached document"
          >
            <X size={15} color={isDark ? '#a1a1aa' : '#6b7280'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  requiredStar: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
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
  dashedText: {
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  removeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
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
    fontSize: 10,
    marginTop: 2,
  },
});
