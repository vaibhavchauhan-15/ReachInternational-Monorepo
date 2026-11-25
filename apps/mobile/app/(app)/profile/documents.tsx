/**
 * Reach International Mobile — My Documents Screen
 *
 * Implements Phase 7:
 * - Direct zero-hop Supabase Storage signed URLs (via 3.2 policy)
 * - 45s TanStack Query cached thumbnails & metadata
 * - Verification status badges (verified, pending, rejected with reason)
 * - Replacement pending review status
 * - Full-screen viewer modal via direct on-demand full signed URL
 * - In-app mobile replacement via Camera / Gallery with adaptive compression
 * - Zero raw typography in StyleSheet.create; min 44px touch targets
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTheme,
  MobileHeader,
  Text,
  useToast,
} from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import {
  Building,
  CreditCard,
  FileCheck,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Upload,
  ImageIcon,
  X,
  ShieldCheck,
} from '../../../components/ui/icon';
import {
  useMobileMyDocuments,
  type MobileMyDocumentItem,
} from '../../../lib/hooks/useMobileMyDocuments';
import {
  pickMobileDocumentImage,
} from '../../../lib/utils/mobileImageCompression';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../../../components/documents/MobileDocumentViewerModal';
import { haptics } from '../../../lib/haptics';
import { DOC_UPLOAD, type DocType } from '@reachinternational/utils';

const DOC_METADATA: Record<
  DocType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }
> = {
  bank_document: {
    label: 'Bank Account / Cheque',
    description: 'Cancelled cheque or passbook with IFSC and account number.',
    icon: Building,
  },
  aadhaar: {
    label: 'Aadhaar Card',
    description: 'Front & back with clear 12-digit Aadhaar UID.',
    icon: CreditCard,
  },
  driving_license: {
    label: 'Driving License',
    description: 'Valid RTO-issued driving license with clear validity date.',
    icon: FileCheck,
  },
};

export default function MyDocumentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const {
    documents,
    isLoading,
    isRefetching,
    refetch,
    getFullImageUrl,
    replaceDocument,
    acknowledgeRejectedReplacement,
  } = useMobileMyDocuments();

  // Full-screen viewer state
  const [activeDoc, setActiveDoc] = useState<MobileViewerDoc | null>(null);
  const [openingDocCode, setOpeningDocCode] = useState<string | null>(null);
  const [acknowledgingDocCode, setAcknowledgingDocCode] = useState<string | null>(null);

  // Picker selection sheet state
  const [selectedDocTypeForReplace, setSelectedDocTypeForReplace] = useState<DocType | null>(null);
  const [processingDocCode, setProcessingDocCode] = useState<string | null>(null);

  const handleAcknowledge = async (changeRequestId: string, docType: DocType) => {
    try {
      haptics.select();
      setAcknowledgingDocCode(docType);
      await acknowledgeRejectedReplacement({ changeRequestId, docType });
      haptics.confirm();
      toast('success', 'Rejection Acknowledged', 'The rejected replacement document has been removed.');
    } catch (err: any) {
      haptics.reject();
      console.error('[MyDocumentsScreen] Acknowledge error:', err);
      toast('error', 'Acknowledgment Failed', err?.message || 'Failed to acknowledge rejected document.');
    } finally {
      setAcknowledgingDocCode(null);
    }
  };

  const handleOpenFullImage = async (doc: MobileMyDocumentItem, label: string) => {
    try {
      haptics.select();
      setOpeningDocCode(doc.document_type_code);
      const fullUrl = await getFullImageUrl(doc.storage_path, doc);
      setActiveDoc({
        id: doc.id,
        title: label,
        url: fullUrl,
        mimeType: doc.mime_type || 'image/jpeg',
        fileSizeBytes: doc.file_size_bytes,
        fileName: doc.file_name,
      });
    } catch (err: any) {
      haptics.reject();
      toast('error', 'Failed to Load Document', err?.message || 'Could not generate secure view URL.');
    } finally {
      setOpeningDocCode(null);
    }
  };

  const handlePickAndReplace = async (source: 'camera' | 'gallery') => {
    const docType = selectedDocTypeForReplace;
    setSelectedDocTypeForReplace(null);
    if (!docType) return;

    try {
      haptics.select();
      const asset = await pickMobileDocumentImage(source);
      if (!asset) return;

      setProcessingDocCode(docType);
      const res = await replaceDocument({ docType, uri: asset.uri });

      if (res.approvedImmediately) {
        haptics.confirm();
        toast('success', 'Document Updated', 'Your document has been verified and updated.');
      } else {
        haptics.confirm();
        toast(
          'success',
          'Replacement Submitted',
          'Your replacement is under administrator review. Current document remains active.'
        );
      }
    } catch (err: any) {
      haptics.reject();
      console.error('[MyDocumentsScreen] Replacement error:', err);
      toast('error', 'Replacement Failed', err?.message || 'Failed to submit document replacement.');
    } finally {
      setProcessingDocCode(null);
    }
  };

  const docsMap = new Map<string, MobileMyDocumentItem>();
  for (const doc of documents) {
    docsMap.set(doc.document_type_code, doc);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="My Documents"
        showBack={true}
        onPressBack={() => {
          haptics.select();
          router.back();
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              haptics.select();
              refetch();
            }}
            tintColor={theme.colors.mute}
          />
        }
      >
        {/* Banner / Info Header */}
        <View
          style={[
            styles.bannerCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.bannerIconRow}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: isDark ? '#082f49' : '#e0f2fe',
                  borderColor: isDark ? '#0369a1' : '#bae6fd',
                },
              ]}
            >
              <ShieldCheck size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.bannerTextCol}>
              <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                Encrypted Identity Storage
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 2 }}>
                Documents are transferred with end-to-end encryption directly to storage.
              </Text>
            </View>
          </View>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 8 }}>
              Loading documents...
            </Text>
          </View>
        )}

        {/* Document Cards */}
        {!isLoading &&
          DOC_UPLOAD.docTypes.map((code) => {
            const meta = DOC_METADATA[code];
            const doc = docsMap.get(code);
            const isOpening = openingDocCode === code;
            const isProcessing = processingDocCode === code;
            const Icon = meta.icon;

            const status = doc?.verification_status;
            const hasPendingReplacement = Boolean(doc?.hasPendingReplacement);

            return (
              <View
                key={code}
                style={[
                  styles.docCard,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                {/* Header Row: Icon + Title + Status Pill */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.docTypeIconBox,
                        {
                          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Icon size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
                    </View>
                    <View style={styles.docTypeTitleCol}>
                      <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                        {meta.label}
                      </Text>
                      {!doc && (
                        <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 1 }}>
                          Not uploaded
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Verification Status Pill */}
                  {status === 'verified' && (
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                          borderColor: isDark ? '#047857' : '#a7f3d0',
                        },
                      ]}
                    >
                      <CheckCircle2 size={12} color={isDark ? '#a7f3d0' : '#065f46'} />
                      <Text
                        variant="micro"
                        weight="bold"
                        style={{ color: isDark ? '#a7f3d0' : '#065f46', marginLeft: 4 }}
                      >
                        VERIFIED
                      </Text>
                    </View>
                  )}
                  {/* Verification Status Badges */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {status === 'verified' && (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                            borderColor: isDark ? '#047857' : '#a7f3d0',
                          },
                        ]}
                      >
                        <CheckCircle2 size={12} color={isDark ? '#6ee7b7' : '#059669'} />
                        <Text
                          variant="micro"
                          weight="bold"
                          style={{ color: isDark ? '#6ee7b7' : '#059669', marginLeft: 4 }}
                        >
                          VERIFIED
                        </Text>
                      </View>
                    )}
                    {status === 'pending' && (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isDark ? '#451a03' : '#fffbeb',
                            borderColor: isDark ? '#78350f' : '#fde68a',
                          },
                        ]}
                      >
                        <Clock size={12} color={isDark ? '#fde68a' : '#b45309'} />
                        <Text
                          variant="micro"
                          weight="bold"
                          style={{ color: isDark ? '#fde68a' : '#b45309', marginLeft: 4 }}
                        >
                          UNDER REVIEW
                        </Text>
                      </View>
                    )}
                    {status === 'rejected' && !doc?.hasRejectedReplacement && (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                            borderColor: isDark ? '#991b1b' : '#fecaca',
                          },
                        ]}
                      >
                        <AlertTriangle size={12} color={isDark ? '#fca5a5' : '#b91c1c'} />
                        <Text
                          variant="micro"
                          weight="bold"
                          style={{ color: isDark ? '#fca5a5' : '#b91c1c', marginLeft: 4 }}
                        >
                          REJECTED
                        </Text>
                      </View>
                    )}
                    {doc?.hasRejectedReplacement && (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                            borderColor: isDark ? '#991b1b' : '#fecaca',
                          },
                        ]}
                      >
                        <AlertTriangle size={12} color={isDark ? '#fca5a5' : '#b91c1c'} />
                        <Text
                          variant="micro"
                          weight="bold"
                          style={{ color: isDark ? '#fca5a5' : '#b91c1c', marginLeft: 4 }}
                        >
                          ACTION NEEDED
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Initial Upload Rejection Reason Alert (if active doc itself was rejected) */}
                {status === 'rejected' && !doc?.hasRejectedReplacement && doc?.rejection_reason && (
                  <View
                    style={[
                      styles.alertBox,
                      {
                        backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                        borderColor: isDark ? '#991b1b' : '#fecaca',
                      },
                    ]}
                  >
                    <View style={styles.alertHeaderRow}>
                      <AlertTriangle size={14} color={isDark ? '#fca5a5' : '#b91c1c'} />
                      <Text
                        variant="micro"
                        weight="bold"
                        style={{ color: isDark ? '#fca5a5' : '#b91c1c', marginLeft: 4 }}
                      >
                        Rejection Reason:
                      </Text>
                    </View>
                    <Text
                      variant="micro"
                      style={{ color: isDark ? '#fecaca' : '#7f1d1d', marginTop: 3 }}
                    >
                      {doc.rejection_reason}
                    </Text>
                  </View>
                )}

                {/* Refined Rejection Callout for Document Replacement */}
                {doc?.hasRejectedReplacement && doc.rejectedReplacement && (
                  <View
                    style={[
                      styles.alertBox,
                      {
                        backgroundColor: isDark ? '#271012' : '#fef2f2',
                        borderColor: isDark ? '#5c1d24' : '#fecaca',
                        marginBottom: 10,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={styles.alertHeaderRow}>
                        <AlertTriangle size={14} color={isDark ? '#fca5a5' : '#b91c1c'} />
                        <Text
                          variant="micro"
                          weight="bold"
                          style={{ color: isDark ? '#fca5a5' : '#b91c1c', marginLeft: 4 }}
                        >
                          Replacement Declined:
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleAcknowledge(doc.rejectedReplacement!.id, code)}
                        disabled={acknowledgingDocCode === code}
                        hitSlopToMin48
                        style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? '#5c1d24' : '#fecaca' }}
                        accessibilityLabel="Dismiss rejection notice"
                      >
                        {acknowledgingDocCode === code ? (
                          <ActivityIndicator size="small" color={isDark ? '#fca5a5' : '#b91c1c'} />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <X size={10} color={isDark ? '#fca5a5' : '#b91c1c'} />
                            <Text variant="micro" weight="semibold" style={{ color: isDark ? '#fca5a5' : '#b91c1c' }}>
                              Dismiss
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    </View>

                    <Text
                      variant="micro"
                      style={{ color: isDark ? '#fecaca' : '#7f1d1d', marginTop: 4 }}
                    >
                      {doc.rejectedReplacement.rejectionReason}
                    </Text>

                    <Text
                      variant="micro"
                      style={{ color: theme.colors.mute, marginTop: 4 }}
                    >
                      Your existing verified document remains active on file while you prepare a replacement.
                    </Text>
                  </View>
                )}

                {/* ─── Document Preview Gallery ─── */}
                {doc?.hasRejectedReplacement && doc.rejectedReplacement ? (
                  /* Dual Document Comparison Gallery (Active vs Rejected) */
                  <View style={styles.dualComparisonRow}>
                    {/* Tile 1: Current Active Document */}
                    <Pressable
                      style={[
                        styles.dualComparisonTile,
                        {
                          borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.45)',
                          backgroundColor: theme.colors.canvas,
                        },
                      ]}
                      onPress={() => handleOpenFullImage(doc, `${meta.label} (Current Active)`)}
                      accessibilityLabel={`View active ${meta.label}`}
                      disabled={isOpening}
                    >
                      <View style={styles.tileHeaderRow}>
                        <View
                          style={[
                            styles.tileStatusPill,
                            {
                              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                              borderColor: isDark ? '#047857' : '#a7f3d0',
                            },
                          ]}
                        >
                          <CheckCircle2 size={10} color={isDark ? '#6ee7b7' : '#059669'} />
                          <Text
                            variant="micro"
                            weight="bold"
                            style={{ color: isDark ? '#6ee7b7' : '#059669', marginLeft: 3 }}
                          >
                            ACTIVE
                          </Text>
                        </View>
                        <Text variant="micro" style={{ color: theme.colors.mute }}>
                          On file
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.dualThumbBox,
                          { backgroundColor: isDark ? '#1c1917' : '#f5f5f4' },
                        ]}
                      >
                        {doc.thumbSignedUrl ? (
                          <Image
                            source={{ uri: doc.thumbSignedUrl }}
                            style={styles.thumbImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.noThumbPlaceholder}>
                            <FileCheck size={20} color="#10b981" />
                            <Text variant="micro" style={{ color: '#10b981', marginTop: 2 }}>
                              Verified
                            </Text>
                          </View>
                        )}
                        <View style={styles.thumbHoverPill}>
                          <Eye size={10} color="#ffffff" />
                          <Text variant="micro" weight="bold" style={{ color: '#ffffff', marginLeft: 3 }}>
                            Active
                          </Text>
                        </View>
                      </View>

                      <Text
                        variant="micro"
                        weight="medium"
                        style={{ color: theme.colors.ink, textAlign: 'center' }}
                        numberOfLines={1}
                      >
                        Current Verified
                      </Text>
                    </Pressable>

                    {/* Tile 2: Rejected Replacement */}
                    <Pressable
                      style={[
                        styles.dualComparisonTile,
                        {
                          borderColor: isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.45)',
                          backgroundColor: theme.colors.canvas,
                        },
                      ]}
                      onPress={() => {
                        haptics.select();
                        setActiveDoc({
                          id: doc.rejectedReplacement!.id,
                          title: `${meta.label} (Declined Replacement)`,
                          url: doc.rejectedReplacement!.signedUrl || doc.rejectedReplacement!.thumbSignedUrl!,
                          mimeType: 'image/jpeg',
                          fileSizeBytes: 0,
                          fileName: `${code}_declined.jpg`,
                        });
                      }}
                      accessibilityLabel={`View declined ${meta.label}`}
                    >
                      <View style={styles.tileHeaderRow}>
                        <View
                          style={[
                            styles.tileStatusPill,
                            {
                              backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                              borderColor: isDark ? '#991b1b' : '#fecaca',
                            },
                          ]}
                        >
                          <X size={10} color={isDark ? '#fca5a5' : '#b91c1c'} />
                          <Text
                            variant="micro"
                            weight="bold"
                            style={{ color: isDark ? '#fca5a5' : '#b91c1c', marginLeft: 3 }}
                          >
                            REJECTED
                          </Text>
                        </View>
                        <Text variant="micro" style={{ color: isDark ? '#fca5a5' : '#b91c1c' }}>
                          Declined
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.dualThumbBox,
                          { backgroundColor: isDark ? '#1c1917' : '#f5f5f4' },
                        ]}
                      >
                        {doc.rejectedReplacement.thumbSignedUrl ? (
                          <Image
                            source={{ uri: doc.rejectedReplacement.thumbSignedUrl }}
                            style={styles.thumbImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.noThumbPlaceholder}>
                            <AlertTriangle size={20} color="#ef4444" />
                            <Text variant="micro" style={{ color: '#ef4444', marginTop: 2 }}>
                              Declined
                            </Text>
                          </View>
                        )}
                        <View style={styles.thumbHoverPill}>
                          <Eye size={10} color="#ffffff" />
                          <Text variant="micro" weight="bold" style={{ color: '#ffffff', marginLeft: 3 }}>
                            Rejected
                          </Text>
                        </View>
                      </View>

                      <Text
                        variant="micro"
                        weight="medium"
                        style={{ color: isDark ? '#fca5a5' : '#b91c1c', textAlign: 'center' }}
                        numberOfLines={1}
                      >
                        Declined Upload
                      </Text>
                    </Pressable>
                  </View>
                ) : doc ? (
                  /* Standard Single Thumbnail Preview Area */
                  <Pressable
                    style={[
                      styles.thumbContainer,
                      {
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                    onPress={() => handleOpenFullImage(doc, meta.label)}
                    accessibilityLabel={`Preview ${meta.label}`}
                    disabled={isOpening}
                  >
                    {doc.thumbSignedUrl ? (
                      <Image
                        source={{ uri: doc.thumbSignedUrl }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noThumbPlaceholder}>
                        <FileText size={24} color={theme.colors.mute} />
                        <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 4 }}>
                          Direct preview available
                        </Text>
                      </View>
                    )}

                    <View style={styles.thumbHoverPill}>
                      {isOpening ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Eye size={12} color="#ffffff" />
                          <Text
                            variant="micro"
                            weight="bold"
                            style={{ color: '#ffffff', marginLeft: 4 }}
                          >
                            View Full
                          </Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                ) : (
                  <View
                    style={[
                      styles.emptyThumbBox,
                      {
                        borderColor: theme.colors.hairline,
                        backgroundColor: theme.colors.canvas,
                      },
                    ]}
                  >
                    <FileText size={24} color={theme.colors.mute} />
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.mute, marginTop: 4 }}>
                      No document uploaded
                    </Text>
                  </View>
                )}

                {/* Card Action: Upload / Replace */}
                <View style={[styles.cardActionsRow, { borderTopColor: theme.colors.hairline, flexDirection: 'column', gap: 6 }]}>
                  {doc ? (
                    <Pressable
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: doc.hasRejectedReplacement ? (theme.colors.link || '#0284c7') : theme.colors.canvas,
                          borderColor: doc.hasRejectedReplacement ? 'transparent' : theme.colors.hairline,
                          width: '100%',
                        },
                      ]}
                      onPress={() => {
                        haptics.select();
                        setSelectedDocTypeForReplace(code);
                      }}
                      disabled={isProcessing}
                      accessibilityLabel={
                        doc.hasRejectedReplacement
                          ? `Upload new replacement for ${meta.label}`
                          : hasPendingReplacement
                            ? `Change image for ${meta.label}`
                            : `Replace ${meta.label}`
                      }
                    >
                      {isProcessing ? (
                        <>
                          <ActivityIndicator size="small" color={doc.hasRejectedReplacement ? '#ffffff' : theme.colors.link} />
                          <Text
                            variant="caption"
                            weight="semibold"
                            style={{ color: doc.hasRejectedReplacement ? '#ffffff' : theme.colors.ink, marginLeft: 6 }}
                          >
                            Uploading...
                          </Text>
                        </>
                      ) : (
                        <>
                          {doc.hasRejectedReplacement ? (
                            <Upload size={14} color="#ffffff" />
                          ) : (
                            <RefreshCw size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
                          )}
                          <Text
                            variant="caption"
                            weight="semibold"
                            style={{ color: doc.hasRejectedReplacement ? '#ffffff' : theme.colors.ink, marginLeft: 6 }}
                          >
                            {doc.hasRejectedReplacement
                              ? 'Upload New Replacement'
                              : hasPendingReplacement
                                ? 'Change Image'
                                : 'Replace'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.fullUploadButton,
                        {
                          backgroundColor: theme.colors.link,
                          width: '100%',
                        },
                      ]}
                      onPress={() => {
                        haptics.select();
                        setSelectedDocTypeForReplace(code);
                      }}
                      disabled={isProcessing}
                      accessibilityLabel={`Upload ${meta.label}`}
                    >
                      {isProcessing ? (
                        <>
                          <ActivityIndicator size="small" color="#ffffff" />
                          <Text
                            variant="caption"
                            weight="bold"
                            style={{ color: '#ffffff', marginLeft: 6 }}
                          >
                            Uploading...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Upload size={14} color="#ffffff" />
                          <Text
                            variant="caption"
                            weight="bold"
                            style={{ color: '#ffffff', marginLeft: 6 }}
                          >
                            Upload Photo
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {/* Secondary Dismiss Notice Button on Mobile */}
                  {doc?.hasRejectedReplacement && doc.rejectedReplacement && (
                    <Pressable
                      style={styles.secondaryAckButton}
                      onPress={() => handleAcknowledge(doc.rejectedReplacement!.id, code)}
                      disabled={acknowledgingDocCode === code}
                      hitSlopToMin48
                    >
                      {acknowledgingDocCode === code ? (
                        <ActivityIndicator size="small" color={theme.colors.mute} />
                      ) : (
                        <>
                          <CheckCircle2 size={12} color={theme.colors.mute} />
                          <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                            Dismiss Notice & Keep Current
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* ─── Source Picker Modal (Camera vs Gallery) ─── */}
      <Modal
        visible={Boolean(selectedDocTypeForReplace)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDocTypeForReplace(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedDocTypeForReplace(null)}
        >
          <View
            style={[
              styles.pickerSheet,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text variant="body" weight="bold" style={{ color: theme.colors.ink }}>
                Select Photo Source
              </Text>
              <Pressable
                onPress={() => setSelectedDocTypeForReplace(null)}
                style={styles.closeBtn}
                hitSlopToMin48
              >
                <X size={18} color={theme.colors.mute} />
              </Pressable>
            </View>

            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 16 }}>
              Choose whether to capture a document photo with your camera or select an existing one.
            </Text>

            <View style={styles.sheetActionCol}>
              <Pressable
                style={[
                  styles.sheetButton,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                onPress={() => handlePickAndReplace('camera')}
              >
                <Upload size={18} color={theme.colors.link} />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: theme.colors.ink, marginLeft: 10 }}
                >
                  Take Photo with Camera
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.sheetButton,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                    marginTop: 10,
                  },
                ]}
                onPress={() => handlePickAndReplace('gallery')}
              >
                <ImageIcon size={18} color={theme.colors.link} />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: theme.colors.ink, marginLeft: 10 }}
                >
                  Choose from Photo Library
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Fullscreen Document Viewer Modal ─── */}
      <MobileDocumentViewerModal
        document={activeDoc}
        onClose={() => setActiveDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  bannerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  bannerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docTypeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeTitleCol: {
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbContainer: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  noThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbHoverPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyThumbBox: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullUploadButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionCol: {
    marginBottom: 16,
  },
  sheetButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  ackButton: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dualComparisonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualComparisonTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  dualThumbBox: {
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAckButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 6,
  },
});
