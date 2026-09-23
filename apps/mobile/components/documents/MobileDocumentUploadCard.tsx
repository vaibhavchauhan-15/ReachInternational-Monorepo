/**
 * ReachInternational Mobile — Mobile Document Upload Card
 * Reusable card for uploading, viewing, and replacing identity documents (Aadhaar, Licence).
 * Strictly adheres to Vercel Geist design tokens, min 44px touch targets, and real progress.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useTheme } from '../ui/ThemeProvider';
import {
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Image as ImageIcon,
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
  docTypeCode: 'aadhaar' | 'driving_license';
  required?: boolean;
  selectedDoc: MobilePickedDocument | null;
  existingDoc?: UserDocumentInfo | null;
  onDocSelected: (doc: MobilePickedDocument) => void;
  onDocRemoved: () => void;
  uploading?: boolean;
  uploadProgress?: number;
  errorMessage?: string | null;
}

export function MobileDocumentUploadCard({
  title,
  subtitle = 'PDF, PNG, JPG, WEBP, or DOC',
  docTypeCode,
  required = false,
  selectedDoc,
  existingDoc,
  onDocSelected,
  onDocRemoved,
  uploading = false,
  uploadProgress = 0,
  errorMessage,
}: MobileDocumentUploadCardProps) {
  const { theme, isDark } = useTheme();

  const [viewerDoc, setViewerDoc] = useState<MobileViewerDoc | null>(null);

  const handlePick = async () => {
    try {
      const doc = await pickIdentityDocument();
      if (doc) {
        onDocSelected(doc);
      }
    } catch (err: any) {
      // Error handled via parent or prompt
    }
  };

  const handleOpenViewer = () => {
    if (isExisting && existingDoc?.signed_url) {
      setViewerDoc({
        id: existingDoc.id,
        title,
        url: existingDoc.signed_url,
        mimeType: existingDoc.mime_type,
        fileSizeBytes: existingDoc.file_size_bytes,
        fileName: existingDoc.storage_path.split('/').pop(),
      });
    } else if (selectedDoc?.uri) {
      setViewerDoc({
        title,
        url: selectedDoc.uri,
        mimeType: selectedDoc.mimeType,
        fileSizeBytes: selectedDoc.size,
        fileName: selectedDoc.name,
      });
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasFile = !!selectedDoc || !!existingDoc;
  const isExisting = !selectedDoc && !!existingDoc;

  const cardBg = isDark ? '#141414' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const accentBlue = '#0ea5e9';

  const docMime = (selectedDoc?.mimeType || existingDoc?.mime_type || '').toLowerCase();
  const isPdf = docMime === 'application/pdf' || (selectedDoc?.name || existingDoc?.storage_path || '').endsWith('.pdf');
  const isPng = docMime.includes('png');
  const isJpg = docMime.includes('jpg') || docMime.includes('jpeg');

  const formatIconColor = isPdf ? '#f43f5e' : isPng ? '#10b981' : isJpg ? '#0ea5e9' : theme.colors.mute;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>
              {title}
            </Text>
            {required && <Text style={styles.requiredStar}>*</Text>}
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            {subtitle}
          </Text>
        </View>

        {/* Status Badge */}
        {existingDoc && !selectedDoc && (
          <View style={[styles.badge, { backgroundColor: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
            <CheckCircle size={12} color="#16a34a" />
            <Text style={[styles.badgeText, { color: '#16a34a' }]}>Uploaded</Text>
          </View>
        )}
        {selectedDoc && (
          <View style={[styles.badge, { backgroundColor: 'rgba(14, 165, 233, 0.12)', borderColor: 'rgba(14, 165, 233, 0.3)' }]}>
            <FileCheck size={12} color={accentBlue} />
            <Text style={[styles.badgeText, { color: accentBlue }]}>Selected</Text>
          </View>
        )}
      </View>

      {/* Progress Bar (when uploading) */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#262626' : '#e5e7eb' }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(Math.max(uploadProgress, 5), 100)}%`, backgroundColor: accentBlue },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.mute }]}>
            Uploading... {uploadProgress}%
          </Text>
        </View>
      )}

      {/* Error message */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <AlertCircle size={14} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Content Area */}
      {hasFile ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleOpenViewer}
          style={[
            styles.fileRow,
            {
              backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
              borderColor: cardBorder,
            },
          ]}
        >
          {/* Format-specific Icon Placeholder */}
          <View
            style={[
              styles.fileIconBox,
              {
                backgroundColor: isPdf
                  ? 'rgba(244, 63, 94, 0.1)'
                  : isPng
                  ? 'rgba(16, 185, 129, 0.1)'
                  : isJpg
                  ? 'rgba(14, 165, 233, 0.1)'
                  : 'rgba(156, 163, 175, 0.1)',
                borderColor: isPdf
                  ? 'rgba(244, 63, 94, 0.25)'
                  : isPng
                  ? 'rgba(16, 185, 129, 0.25)'
                  : isJpg
                  ? 'rgba(14, 165, 233, 0.25)'
                  : 'rgba(156, 163, 175, 0.25)',
              },
            ]}
          >
            {isPng || isJpg ? (
              <ImageIcon size={16} color={formatIconColor} />
            ) : (
              <FileText size={16} color={formatIconColor} />
            )}
            <Text style={[styles.formatBadgeText, { color: formatIconColor }]}>
              {isPdf ? 'PDF' : isPng ? 'PNG' : isJpg ? 'JPG' : 'DOC'}
            </Text>
          </View>

          <View style={{ flex: 1, marginRight: 8, justifyContent: 'center' }}>
            {selectedDoc ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: 'rgba(14, 165, 233, 0.12)',
                    borderColor: 'rgba(14, 165, 233, 0.3)',
                    alignSelf: 'flex-start',
                  },
                ]}
              >
                <FileCheck size={11} color={accentBlue} />
                <Text style={[styles.badgeText, { color: accentBlue }]}>Selected</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    alignSelf: 'flex-start',
                  },
                ]}
              >
                <CheckCircle size={11} color="#16a34a" />
                <Text style={[styles.badgeText, { color: '#16a34a' }]}>Uploaded</Text>
              </View>
            )}
          </View>

          {/* Action Buttons: Replace & Delete (View button removed as card is clickable) */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.iconButton, { borderColor: cardBorder }]}
              onPress={handlePick}
              disabled={uploading}
              accessibilityLabel="Replace document"
              hitSlop={8}
            >
              <Upload size={16} color={theme.colors.mute} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}
              onPress={onDocRemoved}
              disabled={uploading}
              accessibilityLabel="Remove document"
              hitSlop={8}
            >
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.uploadButton,
            {
              backgroundColor: isDark ? '#1a1a1a' : '#f4f4f5',
              borderColor: cardBorder,
            },
          ]}
          onPress={handlePick}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={accentBlue} />
          ) : (
            <>
              <Upload size={18} color={theme.colors.ink} style={{ marginRight: 8 }} />
              <Text style={[styles.uploadButtonText, { color: theme.colors.ink }]}>
                Choose File (PDF, PNG, JPG, DOC)
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* In-App Mobile Document Viewer Modal */}
      <MobileDocumentViewerModal
        document={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  requiredStar: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'right',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    flex: 1,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  fileIconBox: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginRight: 10,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fileName: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    height: 44, // Minimum 44px touch target per responsive rules
    paddingHorizontal: 14,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
