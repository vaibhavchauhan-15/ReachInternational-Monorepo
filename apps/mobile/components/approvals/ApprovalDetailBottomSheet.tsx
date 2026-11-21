import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Pressable,
} from "react-native";
import type { ApprovalRequest } from "@reachinternational/types";
import { Text } from "../ui/Text";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useTheme } from "../../lib/theming";
import { formatExactTimestamp, formatTinyRelativeTime } from "@reachinternational/utils";
import {
  X,
  Check,
  FileText,
  User,
  Clock,
  ShieldAlert,
  Eye,
  CreditCard,
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Wrench,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from "../documents/MobileDocumentViewerModal";

export interface ApprovalDetailBottomSheetProps {
  visible: boolean;
  request: ApprovalRequest | null;
  isLoading?: boolean;
  onClose: () => void;
  onApprove: (requestId: string) => Promise<void>;
  onRejectPrompt: (request: ApprovalRequest) => void;
  isActionLoading?: boolean;
  canDecide?: boolean;
}

interface AttachedUserDoc {
  id: string;
  document_type_code: string;
  storage_path: string;
  thumb_path: string | null;
  verification_status: string;
  signedUrl?: string | null;
  thumbUrl?: string | null;
}

export function ApprovalDetailBottomSheet({
  visible,
  request,
  isLoading = false,
  onClose,
  onApprove,
  onRejectPrompt,
  isActionLoading = false,
  canDecide = true,
}: ApprovalDetailBottomSheetProps) {
  const { colors } = useTheme();

  // Full-screen viewer state
  const [activeViewerDoc, setActiveViewerDoc] = useState<MobileViewerDoc | null>(null);

  // Single-document signed URL state (for document_verify & document_replace)
  const [docSignedUrl, setDocSignedUrl] = useState<string | null>(null);
  const [isSigningDoc, setIsSigningDoc] = useState(false);

  // Registration attached documents state
  const [regDocs, setRegDocs] = useState<AttachedUserDoc[]>([]);
  const [isLoadingRegDocs, setIsLoadingRegDocs] = useState(false);

  const payload = (request?.payload || {}) as Record<string, any>;
  const isPending = request?.status === "pending";

  // Resolve signed URL for single document verification or replacement
  useEffect(() => {
    if (!visible || !request) {
      setDocSignedUrl(null);
      setRegDocs([]);
      return;
    }

    let isMounted = true;

    async function loadSingleDocUrl() {
      const storagePath =
        request?.type_key === "document_replace"
          ? payload.staging_path
          : payload.storage_path;

      if (!storagePath) {
        setDocSignedUrl(null);
        return;
      }

      setIsSigningDoc(true);
      try {
        const bucket =
          request?.type_key === "document_replace" ? "doc_staging" : "user_files";
        const cleanPath = String(storagePath).replace(/^\/+/, "");
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 3600);

        if (isMounted) {
          if (!error && data?.signedUrl) {
            setDocSignedUrl(data.signedUrl);
          } else {
            setDocSignedUrl(null);
          }
        }
      } catch {
        if (isMounted) setDocSignedUrl(null);
      } finally {
        if (isMounted) setIsSigningDoc(false);
      }
    }

    async function loadRegistrationDocs() {
      const targetUserId = payload.user_id || request?.subject_id;
      if (!targetUserId || request?.type_key !== "registration") {
        setRegDocs([]);
        return;
      }

      // If request item already has pre-signed attached documents, hydrate immediately
      const initialDocs = (request as any)?.documents;
      if (Array.isArray(initialDocs) && initialDocs.length > 0) {
        setRegDocs(
          initialDocs.map((d: any) => ({
            id: d.id,
            document_type_code: d.document_type_code,
            storage_path: d.storage_path,
            thumb_path: d.thumb_path || null,
            verification_status: d.verification_status,
            signedUrl: d.signed_url || d.thumb_signed_url || null,
            thumbUrl: d.thumb_signed_url || d.signed_url || null,
          }))
        );
      }

      setIsLoadingRegDocs(true);
      try {
        const { data: docs, error } = await supabase
          .from("user_documents")
          .select("id, document_type_code, storage_path, thumb_path, verification_status")
          .eq("user_id", targetUserId);

        if (error || !docs || docs.length === 0) {
          if (isMounted && (!initialDocs || initialDocs.length === 0)) {
            setRegDocs([]);
          }
          return;
        }

        // Batch resolve signed URLs for both full document and thumbnail
        const pathsToSign: string[] = [];
        docs.forEach((d) => {
          if (d.storage_path) pathsToSign.push(d.storage_path.replace(/^\/+/, ""));
          if (d.thumb_path) pathsToSign.push(d.thumb_path.replace(/^\/+/, ""));
        });

        const { data: signedUrls } = await supabase.storage
          .from("user_files")
          .createSignedUrls(pathsToSign, 3600);

        const urlMap = new Map<string, string>();
        if (signedUrls && Array.isArray(signedUrls)) {
          signedUrls.forEach((item, idx) => {
            if (item?.signedUrl) {
              if (item.path) urlMap.set(item.path, item.signedUrl);
              if (pathsToSign[idx]) urlMap.set(pathsToSign[idx], item.signedUrl);
            }
          });
        }

        const enriched: AttachedUserDoc[] = docs.map((d) => {
          const cleanP = d.storage_path ? d.storage_path.replace(/^\/+/, "") : "";
          const cleanThumb = d.thumb_path ? d.thumb_path.replace(/^\/+/, "") : "";
          const signedUrl = cleanP ? urlMap.get(cleanP) || null : null;
          const thumbUrl = cleanThumb ? urlMap.get(cleanThumb) || null : null;
          return {
            ...d,
            signedUrl: signedUrl || thumbUrl || null,
            thumbUrl: thumbUrl || signedUrl || null,
          };
        });

        if (isMounted) setRegDocs(enriched);
      } catch {
        if (isMounted && (!initialDocs || initialDocs.length === 0)) {
          setRegDocs([]);
        }
      } finally {
        if (isMounted) setIsLoadingRegDocs(false);
      }
    }

    if (request.type_key === "document_verify" || request.type_key === "document_replace") {
      void loadSingleDocUrl();
    } else if (request.type_key === "registration") {
      void loadRegistrationDocs();
    }

    return () => {
      isMounted = false;
    };
  }, [visible, request, payload.storage_path, payload.staging_path, payload.user_id]);

  const handleOpenDocViewer = useCallback((title: string, url: string, fileName?: string) => {
    setActiveViewerDoc({
      title,
      url,
      uri: url,
      mimeType: "image/jpeg",
      fileName: fileName || "document.jpg",
    });
  }, []);

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.canvas }]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
            ]}
          >
            <View style={styles.headerLeft}>
              {request && (
                <View style={styles.badgeRow}>
                  <Badge variant="outline">
                    <Text variant="micro">{request.type?.label || request.type_key}</Text>
                  </Badge>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    <Text variant="micro">{request.status.toUpperCase()}</Text>
                  </Badge>
                </View>
              )}
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={colors.ink} />
            </Button>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text variant="caption" style={styles.loadingText}>
                Loading request details...
              </Text>
            </View>
          ) : !request ? (
            <View style={styles.loadingContainer}>
              <Text variant="body">Request details not available.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Title & Metadata */}
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                ]}
              >
                <Text variant="heading" style={styles.title}>
                  {request.summary}
                </Text>
                {request.subject_label ? (
                  <Text variant="subheading" style={styles.subtitle}>
                    Subject: {request.subject_label}
                  </Text>
                ) : null}

                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <User size={13} color={colors.mute} />
                    <Text variant="caption" numberOfLines={1}>
                      By: {request.requester_name || "System"}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={colors.mute} />
                    <Text variant="caption">
                      {formatTinyRelativeTime(request.created_at)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 1. Document Initial Verification */}
              {request.type_key === "document_verify" && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    DOCUMENT PREVIEW
                  </Text>
                  <View style={styles.detailRow}>
                    <Text variant="caption">Type</Text>
                    <Text variant="body" style={styles.detailValue}>
                      {String(payload.document_type_code || "").replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>

                  {/* Document Image Thumbnail & In-App Viewer Action */}
                  <View
                    style={[
                      styles.previewBox,
                      { backgroundColor: colors.canvas, borderColor: colors.hairline },
                    ]}
                  >
                    {isSigningDoc ? (
                      <View style={styles.previewPlaceholder}>
                        <ActivityIndicator size="small" color="#0284c7" />
                        <Text variant="micro" style={{ marginTop: 6, color: colors.mute }}>
                          Loading document preview...
                        </Text>
                      </View>
                    ) : docSignedUrl ? (
                      <Pressable
                        onPress={() =>
                          handleOpenDocViewer(
                            `${String(payload.document_type_code || "DOCUMENT").replace(/_/g, " ").toUpperCase()}`,
                            docSignedUrl,
                            payload.storage_path?.split("/").pop()
                          )
                        }
                        style={styles.thumbnailPressable}
                      >
                        <Image
                          source={{ uri: docSignedUrl }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                        <View style={styles.inspectOverlay}>
                          <Eye size={16} color="#ffffff" />
                          <Text variant="micro" style={{ color: "#ffffff", marginLeft: 4 }}>
                            Inspect Full Document
                          </Text>
                        </View>
                      </Pressable>
                    ) : (
                      <View style={styles.previewPlaceholder}>
                        <FileText size={28} color={colors.mute} />
                        <Text variant="caption" style={{ marginTop: 6 }}>
                          Document stored in vault
                        </Text>
                        <Text variant="micro" style={{ color: colors.mute, marginTop: 2 }}>
                          Path: {payload.storage_path}
                        </Text>
                      </View>
                    )}
                  </View>

                  {docSignedUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        handleOpenDocViewer(
                          `${String(payload.document_type_code || "DOCUMENT").replace(/_/g, " ").toUpperCase()}`,
                          docSignedUrl,
                          payload.storage_path?.split("/").pop()
                        )
                      }
                      style={styles.inspectBtn}
                    >
                      <Eye size={16} color="#0284c7" />
                      <Text variant="label" style={{ color: "#0284c7", marginLeft: 6 }}>
                        Open in Fullscreen Viewer
                      </Text>
                    </Button>
                  )}
                </View>
              )}

              {/* 2. Document Replacement Request */}
              {request.type_key === "document_replace" && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    REPLACEMENT DOCUMENT
                  </Text>
                  <View style={styles.detailRow}>
                    <Text variant="caption">Replacing Document</Text>
                    <Text variant="body" style={styles.detailValue}>
                      {String(payload.document_type_code || "").replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.previewBox,
                      { backgroundColor: colors.canvas, borderColor: colors.hairline },
                    ]}
                  >
                    {isSigningDoc ? (
                      <View style={styles.previewPlaceholder}>
                        <ActivityIndicator size="small" color="#0284c7" />
                        <Text variant="micro" style={{ marginTop: 6, color: colors.mute }}>
                          Loading replacement preview...
                        </Text>
                      </View>
                    ) : docSignedUrl ? (
                      <Pressable
                        onPress={() =>
                          handleOpenDocViewer(
                            `REPLACEMENT: ${String(payload.document_type_code || "DOCUMENT").replace(/_/g, " ").toUpperCase()}`,
                            docSignedUrl,
                            payload.staging_path?.split("/").pop()
                          )
                        }
                        style={styles.thumbnailPressable}
                      >
                        <Image
                          source={{ uri: docSignedUrl }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                        />
                        <View style={styles.inspectOverlay}>
                          <Eye size={16} color="#ffffff" />
                          <Text variant="micro" style={{ color: "#ffffff", marginLeft: 4 }}>
                            Inspect Replacement
                          </Text>
                        </View>
                      </Pressable>
                    ) : (
                      <View style={styles.previewPlaceholder}>
                        <FileText size={28} color={colors.mute} />
                        <Text variant="caption" style={{ marginTop: 6 }}>
                          Replacement file staged
                        </Text>
                      </View>
                    )}
                  </View>

                  {docSignedUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        handleOpenDocViewer(
                          `REPLACEMENT: ${String(payload.document_type_code || "DOCUMENT").replace(/_/g, " ").toUpperCase()}`,
                          docSignedUrl,
                          payload.staging_path?.split("/").pop()
                        )
                      }
                      style={styles.inspectBtn}
                    >
                      <Eye size={16} color="#0284c7" />
                      <Text variant="label" style={{ color: "#0284c7", marginLeft: 6 }}>
                        Inspect Staged Replacement
                      </Text>
                    </Button>
                  )}
                </View>
              )}

              {/* 3. New User Registration */}
              {request.type_key === "registration" && (
                <>
                  <View
                    style={[
                      styles.sectionCard,
                      { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                    ]}
                  >
                    <Text variant="label" style={styles.sectionHeader}>
                      APPLICANT PROFILE
                    </Text>
                    <View style={styles.detailList}>
                      <View style={styles.detailItem}>
                        <View style={styles.detailItemLabel}>
                          <User size={14} color={colors.mute} />
                          <Text variant="caption">Full Name</Text>
                        </View>
                        <Text variant="body">{payload.full_name || "—"}</Text>
                      </View>

                      <View style={styles.detailItem}>
                        <View style={styles.detailItemLabel}>
                          <Mail size={14} color={colors.mute} />
                          <Text variant="caption">Email</Text>
                        </View>
                        <Text variant="body">{payload.email || "—"}</Text>
                      </View>

                      {payload.phone ? (
                        <View style={styles.detailItem}>
                          <View style={styles.detailItemLabel}>
                            <Phone size={14} color={colors.mute} />
                            <Text variant="caption">Phone</Text>
                          </View>
                          <Text variant="body">{payload.phone}</Text>
                        </View>
                      ) : null}

                      <View style={styles.detailItem}>
                        <View style={styles.detailItemLabel}>
                          <ShieldCheck size={14} color="#0284c7" />
                          <Text variant="caption">Assigned Role</Text>
                        </View>
                        <Text variant="heading" style={{ color: "#0284c7" }}>
                          {String(payload.role || "operator").toUpperCase()}
                        </Text>
                      </View>

                      {payload.machine_category ? (
                        <View style={styles.detailItem}>
                          <View style={styles.detailItemLabel}>
                            <Wrench size={14} color={colors.mute} />
                            <Text variant="caption">Machine Fleet</Text>
                          </View>
                          <Text variant="body">{payload.machine_category}</Text>
                        </View>
                      ) : null}

                      {payload.city || payload.state ? (
                        <View style={styles.detailItem}>
                          <View style={styles.detailItemLabel}>
                            <MapPin size={14} color={colors.mute} />
                            <Text variant="caption">Location</Text>
                          </View>
                          <Text variant="body">
                            {[payload.street, payload.city, payload.district, payload.state]
                              .filter(Boolean)
                              .join(", ")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Attached Documents for this Registration */}
                  <View
                    style={[
                      styles.sectionCard,
                      { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                    ]}
                  >
                    <Text variant="label" style={styles.sectionHeader}>
                      ATTACHED DOCUMENTS
                    </Text>

                    {isLoadingRegDocs ? (
                      <View style={styles.docsLoadingBox}>
                        <ActivityIndicator size="small" color="#0284c7" />
                        <Text variant="micro" style={{ marginTop: 6, color: colors.mute }}>
                          Loading user documents...
                        </Text>
                      </View>
                    ) : regDocs.length === 0 ? (
                      <View style={styles.docsEmptyBox}>
                        <FileText size={20} color={colors.mute} />
                        <Text variant="caption" style={{ marginTop: 4 }}>
                          Documents will finalize upon registration approval.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.regDocsGrid}>
                        {regDocs.map((rd) => {
                          const docLabel = rd.document_type_code
                            .replace(/_/g, " ")
                            .toUpperCase();
                          return (
                            <Pressable
                              key={rd.id}
                              onPress={() => {
                                if (rd.signedUrl) {
                                  handleOpenDocViewer(
                                    docLabel,
                                    rd.signedUrl,
                                    rd.storage_path?.split("/").pop()
                                  );
                                }
                              }}
                              style={[
                                styles.regDocCard,
                                {
                                  backgroundColor: colors.canvas,
                                  borderColor: colors.hairline,
                                },
                              ]}
                            >
                              <View style={styles.regDocThumbWrapper}>
                                {rd.signedUrl ? (
                                  <Image
                                    source={{ uri: rd.signedUrl }}
                                    style={styles.regDocThumb}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <FileText size={24} color={colors.mute} />
                                )}
                              </View>
                              <View style={styles.regDocInfo}>
                                <Text variant="label" numberOfLines={1}>
                                  {docLabel}
                                </Text>
                                <Badge
                                  variant={
                                    rd.verification_status === "verified"
                                      ? "default"
                                      : "outline"
                                  }
                                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                                >
                                  <Text variant="micro">
                                    {rd.verification_status.toUpperCase()}
                                  </Text>
                                </Badge>
                              </View>
                              {rd.signedUrl && (
                                <Eye size={16} color={colors.mute} style={{ marginRight: 6 }} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* 4. Profile Sensitive Change */}
              {request.type_key === "profile_change" && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    PROPOSED PROFILE CHANGES
                  </Text>
                  <View style={styles.diffContainer}>
                    {Object.entries(payload.changes || {}).map(([key, val]: [string, any]) => (
                      <View
                        key={key}
                        style={[styles.diffRow, { borderColor: colors.hairline }]}
                      >
                        <Text variant="label" style={styles.diffKey}>
                          {key.replace(/_/g, " ")}
                        </Text>
                        <Text variant="caption" style={styles.diffOld}>
                          {val?.old_value !== undefined ? String(val.old_value) : "(empty)"}
                        </Text>
                        <Text variant="body" style={styles.diffNew}>
                          {val?.new_value !== undefined ? String(val.new_value) : "(empty)"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 5. Account Deletion Request */}
              {request.type_key === "account_deletion" && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    ACCOUNT DELETION
                  </Text>
                  <View style={styles.deletionBox}>
                    <ShieldAlert size={18} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                      <Text variant="label" style={{ color: "#ef4444" }}>
                        Reason for Deletion
                      </Text>
                      <Text variant="body" style={{ marginTop: 2 }}>
                        &ldquo;{payload.reason || "No reason specified"}&rdquo;
                      </Text>
                      <Text variant="micro" style={{ color: colors.mute, marginTop: 4 }}>
                        A 7-day cooling off period applies upon approval.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 6. Shift Overlap / Conflict */}
              {request.type_key === "shift_conflict" && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    SHIFT CONFLICT OVERRIDE
                  </Text>
                  <View style={styles.detailList}>
                    <View style={styles.detailItem}>
                      <Text variant="caption">Machine</Text>
                      <Text variant="body">{payload.machine_code || payload.machine_id || "—"}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text variant="caption">Operator</Text>
                      <Text variant="body">{payload.operator_name || payload.operator_id || "—"}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text variant="caption">Date & Shift</Text>
                      <Text variant="body">
                        {payload.log_date || "—"} ({payload.shift_code || "—"})
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Decision History if resolved */}
              {!isPending && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
                  ]}
                >
                  <Text variant="label" style={styles.sectionHeader}>
                    DECISION HISTORY
                  </Text>
                  <Text variant="body">Status: {request.status.toUpperCase()}</Text>
                  {request.decided_at && (
                    <Text variant="caption" style={{ marginTop: 2 }}>
                      Decided on: {formatExactTimestamp(request.decided_at)}
                    </Text>
                  )}
                  {request.decision_note && (
                    <Text variant="caption" style={{ marginTop: 4 }}>
                      Note: &ldquo;{request.decision_note}&rdquo;
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Sticky Action Footer */}
          {isPending && canDecide && (
            <View
              style={[
                styles.footer,
                { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
              ]}
            >
              <Button
                variant="destructive"
                size="sm"
                onPress={() => onRejectPrompt(request)}
                disabled={isActionLoading}
                style={styles.actionBtn}
              >
                <X size={16} color="#ffffff" />
                <Text variant="label" style={{ color: "#ffffff", marginLeft: 6 }}>
                  Reject
                </Text>
              </Button>

              <Button
                variant="default"
                size="sm"
                onPress={() => onApprove(request.id)}
                disabled={isActionLoading}
                style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
              >
                {isActionLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={16} color="#ffffff" />
                    <Text variant="label" style={{ color: "#ffffff", marginLeft: 6 }}>
                      Approve
                    </Text>
                  </>
                )}
              </Button>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Embedded High-Priority Fullscreen Document Viewer */}
      {activeViewerDoc && (
        <MobileDocumentViewerModal
          document={activeViewerDoc}
          onClose={() => setActiveViewerDoc(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 10,
  },
  metaGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionHeader: {
    marginBottom: 10,
    opacity: 0.65,
  },
  detailRow: {
    gap: 4,
    marginBottom: 10,
  },
  detailValue: {
    marginTop: 2,
  },
  previewBox: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 8,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  thumbnailPressable: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  inspectOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  inspectBtn: {
    marginTop: 6,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  diffContainer: {
    gap: 8,
  },
  diffRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  diffKey: {
    textTransform: "capitalize",
  },
  diffOld: {
    textDecorationLine: "line-through",
    color: "#ef4444",
  },
  diffNew: {
    color: "#10b981",
  },
  detailList: {
    gap: 10,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailItemLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docsLoadingBox: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  docsEmptyBox: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  regDocsGrid: {
    gap: 8,
  },
  regDocCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 56,
  },
  regDocThumbWrapper: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  regDocThumb: {
    width: 44,
    height: 44,
  },
  regDocInfo: {
    flex: 1,
  },
  deletionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
});
