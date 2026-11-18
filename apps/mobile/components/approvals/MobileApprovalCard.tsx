import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import type {
  ApprovalRequestListItem,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import { Text } from "../ui/Text";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import {
  ChevronRight,
  Clock,
  User,
  Hash,
  Mail,
  Phone,
  Wrench,
  FileText,
  FileCheck2,
  RefreshCw,
  UserCog,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Check,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react-native";
import { useTheme } from "../../lib/theming";
import { haptics } from "../../lib/haptics";

export interface MobileApprovalCardProps {
  item: ApprovalRequestListItem;
  onPress: (item: ApprovalRequestListItem) => void;
  onApprove?: (requestId: string) => Promise<void> | void;
  onRejectPrompt?: (item: ApprovalRequestListItem) => void;
  onOpenDocViewer?: (
    title: string,
    url: string,
    fileName?: string,
    docId?: string,
    isPending?: boolean
  ) => void;
  onVerifyDocument?: (docId: string, userId?: string) => Promise<void> | void;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary, userId?: string) => void;
  canDecide?: boolean;
  isActionLoading?: boolean;
  isRejectLoading?: boolean;
}

export const MobileApprovalCard = React.memo(function MobileApprovalCard({
  item,
  onPress,
  onApprove,
  onRejectPrompt,
  onOpenDocViewer,
  onVerifyDocument,
  onRejectDocumentPrompt,
  canDecide = false,
  isActionLoading = false,
  isRejectLoading = false,
}: MobileApprovalCardProps) {
  const { colors, isDark } = useTheme();

  const isPending = item.status === "pending";
  const showDecideActions = isPending && canDecide && Boolean(onApprove) && Boolean(onRejectPrompt);

  const fullName = item.requester_name || item.subject_label || "Applicant";
  const role = item.role;
  const empId = item.employee_id;
  const email = item.email;
  const phone = item.phone;
  const machineCategory = item.machine_category;
  const documents = item.documents || [];
  const payload = (item.payload || {}) as Record<string, any>;

  // Type categorization
  const isRegistration = item.type_key === "registration";
  const isDocVerify = item.type_key === "document_verify";
  const isDocReplace = item.type_key === "document_replace";
  const isProfileChange = item.type_key === "profile_change";
  const isAccountDeletion = item.type_key === "account_deletion";
  const isShiftConflict = item.type_key === "shift_conflict";

  // Target document resolution for document-specific approval types
  const singleDocTarget =
    documents.find(
      (d) =>
        d.id === item.subject_id ||
        d.document_type_code === payload.document_type_code
    ) ||
    documents[0] ||
    null;

  const handleCardPress = () => {
    haptics.select();
    onPress(item);
  };

  const handleApprovePress = () => {
    if (onApprove) {
      haptics.confirm();
      void onApprove(item.id);
    }
  };

  const handleRejectPress = () => {
    if (onRejectPrompt) {
      haptics.reject();
      onRejectPrompt(item);
    }
  };

  const handleDocThumbPress = (doc: AttachedDocumentSummary) => {
    haptics.select();
    const docUrl = doc.signed_url || doc.thumb_signed_url;
    if (docUrl && onOpenDocViewer) {
      onOpenDocViewer(
        doc.label || "DOCUMENT",
        docUrl,
        `${doc.document_type_code}.jpg`,
        doc.id,
        doc.verification_status === "pending"
      );
    } else {
      onPress(item);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.canvasElevated,
          borderColor: colors.hairline,
        },
      ]}
    >
      {/* ── Top Header: Badges & Relative Registration Time ── */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Badge variant="outline">
            <Text variant="micro">{item.type_label}</Text>
          </Badge>
          <Badge
            variant={
              item.status === "approved"
                ? "default"
                : item.status === "rejected"
                ? "destructive"
                : "secondary"
            }
          >
            <Text variant="micro">{item.status.toUpperCase()}</Text>
          </Badge>
          {role ? (
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: "rgba(2, 132, 199, 0.12)",
                  borderColor: "rgba(2, 132, 199, 0.25)",
                },
              ]}
            >
              <Text variant="micro" style={{ color: "#0284c7" }}>
                {role.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {item.priority >= 8 ? (
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderColor: "rgba(239, 68, 68, 0.25)",
                },
              ]}
            >
              <Text variant="micro" style={{ color: "#ef4444" }}>
                HIGH
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.timeRow}>
          <Clock size={12} color={colors.mute} />
          <Text variant="micro" style={{ color: colors.mute }}>
            {formatTinyRelativeTime(item.created_at)}
          </Text>
        </View>
      </View>

      {/* ── Identity & Essential Info (Clean Header, No redundant summary) ── */}
      <Pressable
        onPress={handleCardPress}
        style={({ pressed }) => [
          styles.identityContainer,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`View ${fullName} approval details`}
      >
        <View style={styles.nameRow}>
          <Text variant="heading" numberOfLines={1} style={styles.fullName}>
            {fullName}
          </Text>
          {empId ? (
            <View
              style={[
                styles.empBadge,
                {
                  backgroundColor: colors.canvas,
                  borderColor: colors.hairline,
                },
              ]}
            >
              <Hash size={11} color="#a855f7" />
              <Text variant="mono">{empId}</Text>
            </View>
          ) : null}
        </View>

        {/* Contact Info (Email, Phone & Machine Category) */}
        <View style={styles.contactGrid}>
          {email ? (
            <View style={styles.contactItem}>
              <Mail size={12} color="#10b981" />
              <Text variant="caption" numberOfLines={1} style={styles.contactText}>
                {email}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.contactItem}>
              <Phone size={12} color="#f59e0b" />
              <Text variant="caption" numberOfLines={1} style={styles.contactText}>
                {phone}
              </Text>
            </View>
          ) : null}
          {machineCategory ? (
            <View style={styles.contactItemFull}>
              <Wrench size={12} color="#f97316" />
              <Text variant="caption" numberOfLines={1} style={styles.contactText}>
                Fleet: {machineCategory}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* ── Type-Specific Content Section (100% Parity for all 6 types) ── */}

      {/* 1. Document Initial Verification (Single Document or Multi-Document Bound Card) */}
      {isDocVerify && (
        documents.length > 1 ? (
          <View
            style={[
              styles.docsContainer,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View style={styles.docsHeader}>
              <View style={styles.docsHeaderLeft}>
                <FileCheck2 size={13} color="#0284c7" />
                <Text variant="label" style={{ color: colors.ink }}>
                  Documents for Verification ({documents.length})
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.docsScroll}
            >
              {documents.map((doc) => {
                const docUrl = doc.thumb_signed_url || doc.signed_url;
                const isDocPending = doc.verification_status === "pending";
                const isVerified = doc.verification_status === "verified";
                const isRejected = doc.verification_status === "rejected";

                return (
                  <View
                    key={doc.id}
                    style={[
                      styles.docCard,
                      {
                        backgroundColor: colors.canvasElevated,
                        borderColor: colors.hairline,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleDocThumbPress(doc)}
                      style={styles.docThumbContainer}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${doc.label} document`}
                    >
                      {docUrl ? (
                        <Image
                          source={{ uri: docUrl }}
                          style={styles.docThumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.docThumbFallback}>
                          <FileText size={20} color={colors.mute} />
                        </View>
                      )}
                      <View style={styles.docThumbOverlay}>
                        <Eye size={12} color="#ffffff" />
                      </View>
                    </Pressable>

                    <Text variant="micro" numberOfLines={1} style={styles.docLabel}>
                      {doc.label}
                    </Text>

                    <View
                      style={[
                        styles.docStatusPill,
                        {
                          backgroundColor: isVerified
                            ? "rgba(16, 185, 129, 0.12)"
                            : isRejected
                            ? "rgba(239, 68, 68, 0.12)"
                            : "rgba(245, 158, 11, 0.12)",
                        },
                      ]}
                    >
                      <Text
                        variant="micro"
                        style={{
                          color: isVerified
                            ? "#10b981"
                            : isRejected
                            ? "#ef4444"
                            : "#d97706",
                        }}
                      >
                        {doc.verification_status.toUpperCase()}
                      </Text>
                    </View>

                    {canDecide && isDocPending && Boolean(onVerifyDocument) && Boolean(onRejectDocumentPrompt) ? (
                      <View
                        style={[
                          styles.docActionRow,
                          { borderTopColor: colors.hairline },
                        ]}
                      >
                        <Pressable
                          onPress={() => onRejectDocumentPrompt?.(doc, payload.user_id || item.requested_by)}
                          disabled={isActionLoading || isRejectLoading}
                          style={({ pressed }) => [
                            styles.docActionBtn,
                            { backgroundColor: pressed ? "rgba(239, 68, 68, 0.15)" : "transparent" },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Reject ${doc.label}`}
                        >
                          <X size={13} color="#ef4444" />
                        </Pressable>
                        <Pressable
                          onPress={() => onVerifyDocument?.(doc.id, payload.user_id || item.requested_by)}
                          disabled={isActionLoading || isRejectLoading}
                          style={({ pressed }) => [
                            styles.docActionBtn,
                            { backgroundColor: pressed ? "rgba(16, 185, 129, 0.15)" : "transparent" },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Verify ${doc.label}`}
                        >
                          <Check size={13} color="#10b981" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : singleDocTarget ? (
          <View
            style={[
              styles.showcaseCard,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View style={styles.showcaseContent}>
              <Pressable
                onPress={() => handleDocThumbPress(singleDocTarget)}
                style={styles.showcaseThumbContainer}
                accessibilityRole="button"
                accessibilityLabel={`Inspect ${singleDocTarget.label}`}
              >
                {singleDocTarget.thumb_signed_url || singleDocTarget.signed_url ? (
                  <Image
                    source={{
                      uri: (singleDocTarget.thumb_signed_url || singleDocTarget.signed_url)!,
                    }}
                    style={styles.showcaseThumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.showcaseThumbFallback}>
                    <FileText size={20} color={colors.mute} />
                  </View>
                )}
                <View style={styles.showcaseThumbOverlay}>
                  <Eye size={12} color="#ffffff" />
                </View>
              </Pressable>

              <View style={styles.showcaseInfo}>
                <View style={styles.showcaseLabelRow}>
                  <Text variant="label" numberOfLines={1} style={{ color: colors.ink }}>
                    {singleDocTarget.label}
                  </Text>
                  <View
                    style={[
                      styles.docStatusPill,
                      {
                        backgroundColor:
                          singleDocTarget.verification_status === "verified"
                            ? "rgba(16, 185, 129, 0.12)"
                            : singleDocTarget.verification_status === "rejected"
                            ? "rgba(239, 68, 68, 0.12)"
                            : "rgba(245, 158, 11, 0.12)",
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      style={{
                        color:
                          singleDocTarget.verification_status === "verified"
                            ? "#10b981"
                            : singleDocTarget.verification_status === "rejected"
                            ? "#ef4444"
                            : "#d97706",
                      }}
                    >
                      {singleDocTarget.verification_status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" style={{ color: colors.mute, marginTop: 2 }}>
                  Statutory document verification pending review
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.showcaseFallback,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View
              style={[
                styles.iconBadgeBox,
                { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
              ]}
            >
              <FileCheck2 size={18} color="#0284c7" />
            </View>
            <View style={styles.showcaseInfo}>
              <Text variant="label" numberOfLines={1}>
                {item.subject_label || (payload.document_type_code || "").replace(/_/g, " ") || "Document Verification"}
              </Text>
              <Text variant="caption" style={{ color: colors.mute, marginTop: 2 }}>
                Statutory KYC document pending administrative review
              </Text>
            </View>
          </View>
        )
      )}

      {/* 2. Document Replacement */}
      {isDocReplace && (
        <View
          style={[
            styles.showcaseCard,
            {
              backgroundColor: "rgba(99, 102, 241, 0.05)",
              borderColor: "rgba(99, 102, 241, 0.25)",
            },
          ]}
        >
          <View style={styles.showcaseContent}>
            {singleDocTarget && (singleDocTarget.thumb_signed_url || singleDocTarget.signed_url) ? (
              <Pressable
                onPress={() => handleDocThumbPress(singleDocTarget)}
                style={styles.showcaseThumbContainer}
              >
                <Image
                  source={{
                    uri: (singleDocTarget.thumb_signed_url || singleDocTarget.signed_url)!,
                  }}
                  style={styles.showcaseThumbImage}
                  resizeMode="cover"
                />
                <View style={styles.showcaseThumbOverlay}>
                  <Eye size={12} color="#ffffff" />
                </View>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.iconBadgeBox,
                  { backgroundColor: "rgba(99, 102, 241, 0.1)", borderColor: "rgba(99, 102, 241, 0.2)" },
                ]}
              >
                <RefreshCw size={18} color="#6366f1" />
              </View>
            )}

            <View style={styles.showcaseInfo}>
              <View style={styles.showcaseLabelRow}>
                <Text variant="label" numberOfLines={1} style={{ color: colors.ink }}>
                  Replacing: {(payload.document_type_code || singleDocTarget?.label || "Document").replace(/_/g, " ")}
                </Text>
                <View
                  style={[
                    styles.docStatusPill,
                    {
                      backgroundColor: "rgba(99, 102, 241, 0.12)",
                    },
                  ]}
                >
                  <Text variant="micro" style={{ color: "#6366f1" }}>
                    STAGED
                  </Text>
                </View>
              </View>
              <Text variant="caption" style={{ color: colors.mute, marginTop: 2 }}>
                Overwrites statutory file upon admin approval
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 3. Profile Sensitive Change */}
      {isProfileChange && (
        <View
          style={[
            styles.typeSectionBox,
            {
              backgroundColor: colors.canvas,
              borderColor: colors.hairline,
            },
          ]}
        >
          <View style={styles.typeHeaderRow}>
            <View style={styles.typeHeaderLeft}>
              <UserCog size={13} color="#0284c7" />
              <Text variant="label" style={{ color: colors.ink }}>
                Profile Modifications Requested
              </Text>
            </View>
            {payload.reason ? (
              <Text variant="micro" numberOfLines={1} style={styles.reasonText}>
                &ldquo;{payload.reason}&rdquo;
              </Text>
            ) : null}
          </View>

          {payload.changes && Object.keys(payload.changes).length > 0 ? (
            <View style={styles.diffStack}>
              {Object.entries(payload.changes).slice(0, 3).map(([field, val]: [string, any]) => {
                const oldVal =
                  val?.old_value !== undefined && val?.old_value !== null
                    ? String(val.old_value)
                    : "";
                const newVal =
                  val?.new_value !== undefined && val?.new_value !== null
                    ? String(val.new_value)
                    : String(val ?? "");

                return (
                  <View
                    key={field}
                    style={[
                      styles.diffRow,
                      {
                        backgroundColor: colors.canvasElevated,
                        borderColor: colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="caption" style={styles.diffField}>
                      {field.replace(/_/g, " ")}:
                    </Text>
                    <View style={styles.diffValuesRow}>
                      {oldVal ? (
                        <Text variant="mono" numberOfLines={1} style={styles.diffOld}>
                          {oldVal}
                        </Text>
                      ) : null}
                      {oldVal ? (
                        <Text variant="caption" style={{ color: colors.mute, marginHorizontal: 4 }}>
                          &rarr;
                        </Text>
                      ) : null}
                      <Text variant="mono" numberOfLines={1} style={styles.diffNew}>
                        {newVal || "(empty)"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text variant="caption" style={{ color: colors.mute }}>
              {item.summary || "Sensitive profile changes pending review."}
            </Text>
          )}
        </View>
      )}

      {/* 4. Account Deletion Request */}
      {isAccountDeletion && (
        <View
          style={[
            styles.typeSectionBox,
            {
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              borderColor: "rgba(239, 68, 68, 0.25)",
            },
          ]}
        >
          <View style={styles.typeHeaderRow}>
            <View style={styles.typeHeaderLeft}>
              <ShieldAlert size={14} color="#ef4444" />
              <Text variant="label" style={{ color: "#ef4444" }}>
                Account Deletion Request
              </Text>
            </View>
            <View
              style={[
                styles.docStatusPill,
                { backgroundColor: "rgba(239, 68, 68, 0.12)" },
              ]}
            >
              <Text variant="micro" style={{ color: "#ef4444" }}>
                7-DAY GRACE
              </Text>
            </View>
          </View>
          <Text variant="caption" style={{ color: colors.ink, marginTop: 4 }}>
            Reason: &ldquo;{payload.reason || item.summary || "Permanent deletion requested by user"}&rdquo;
          </Text>
        </View>
      )}

      {/* 5. Shift Conflict / Override */}
      {isShiftConflict && (
        <View
          style={[
            styles.typeSectionBox,
            {
              backgroundColor: "rgba(245, 158, 11, 0.05)",
              borderColor: "rgba(245, 158, 11, 0.25)",
            },
          ]}
        >
          <View style={styles.typeHeaderRow}>
            <View style={styles.typeHeaderLeft}>
              <AlertTriangle size={14} color="#f59e0b" />
              <Text variant="label" style={{ color: "#d97706" }}>
                Shift Conflict / Override
              </Text>
            </View>
          </View>
          <View style={styles.shiftConflictGrid}>
            <View
              style={[
                styles.shiftConflictBox,
                { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
              ]}
            >
              <Text variant="micro" style={{ color: colors.mute }}>
                MACHINE
              </Text>
              <Text variant="label" numberOfLines={1} style={{ color: colors.ink, marginTop: 2 }}>
                {payload.machine_code || payload.machine_id || "Fleet Machine"}
              </Text>
            </View>
            <View
              style={[
                styles.shiftConflictBox,
                { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
              ]}
            >
              <Text variant="micro" style={{ color: colors.mute }}>
                DATE &amp; SHIFT
              </Text>
              <Text variant="label" numberOfLines={1} style={{ color: colors.ink, marginTop: 2 }}>
                {payload.log_date || "—"} ({payload.shift_code || "—"})
              </Text>
            </View>
          </View>
          {item.summary ? (
            <Text variant="caption" numberOfLines={1} style={{ color: colors.mute, marginTop: 4 }}>
              {item.summary}
            </Text>
          ) : null}
        </View>
      )}

      {/* 6. Registration KYC Documents (Multiple Attached Documents or Empty Placeholder) */}
      {isRegistration && (
        documents.length > 0 ? (
          <View
            style={[
              styles.docsContainer,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View style={styles.docsHeader}>
              <View style={styles.docsHeaderLeft}>
                <FileText size={13} color="#0284c7" />
                <Text variant="label" style={{ color: colors.ink }}>
                  Attached Documents ({documents.length})
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.docsScroll}
            >
              {documents.map((doc) => {
                const docUrl = doc.thumb_signed_url || doc.signed_url;
                const isDocPending = doc.verification_status === "pending";
                const isVerified = doc.verification_status === "verified";
                const isRejected = doc.verification_status === "rejected";

                return (
                  <View
                    key={doc.id}
                    style={[
                      styles.docCard,
                      {
                        backgroundColor: colors.canvasElevated,
                        borderColor: colors.hairline,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleDocThumbPress(doc)}
                      style={styles.docThumbContainer}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${doc.label} document`}
                    >
                      {docUrl ? (
                        <Image
                          source={{ uri: docUrl }}
                          style={styles.docThumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.docThumbFallback}>
                          <FileText size={20} color={colors.mute} />
                        </View>
                      )}
                      <View style={styles.docThumbOverlay}>
                        <Eye size={12} color="#ffffff" />
                      </View>
                    </Pressable>

                    <Text variant="micro" numberOfLines={1} style={styles.docLabel}>
                      {doc.label}
                    </Text>

                    <View
                      style={[
                        styles.docStatusPill,
                        {
                          backgroundColor: isVerified
                            ? "rgba(16, 185, 129, 0.12)"
                            : isRejected
                            ? "rgba(239, 68, 68, 0.12)"
                            : "rgba(245, 158, 11, 0.12)",
                        },
                      ]}
                    >
                      <Text
                        variant="micro"
                        style={{
                          color: isVerified
                            ? "#10b981"
                            : isRejected
                            ? "#ef4444"
                            : "#d97706",
                        }}
                      >
                        {doc.verification_status.toUpperCase()}
                      </Text>
                    </View>

                    {/* Quick per-document action icons if authorized & document is pending */}
                    {canDecide && isDocPending && onVerifyDocument && onRejectDocumentPrompt ? (
                      <View style={[styles.docActionRow, { borderColor: colors.hairline }]}>
                        <Pressable
                          onPress={() => onRejectDocumentPrompt(doc, payload.user_id || item.requested_by)}
                          disabled={isActionLoading || isRejectLoading}
                          style={styles.docActionBtn}
                          accessibilityLabel={`Reject ${doc.label}`}
                        >
                          <X size={12} color="#ef4444" />
                        </Pressable>
                        <Pressable
                          onPress={() => void onVerifyDocument(doc.id, payload.user_id || item.requested_by)}
                          disabled={isActionLoading || isRejectLoading}
                          style={styles.docActionBtn}
                          accessibilityLabel={`Approve ${doc.label}`}
                        >
                          <Check size={12} color="#10b981" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View
            style={[
              styles.dashedEmptyCard,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <FileText size={14} color={colors.mute} />
            <Text variant="caption" style={{ color: colors.mute, marginLeft: 6 }}>
              No KYC statutory documents attached yet
            </Text>
          </View>
        )
      )}

      {/* 7. Fallback for custom approval types */}
      {!isDocVerify && !isDocReplace && !isProfileChange && !isAccountDeletion && !isShiftConflict && !isRegistration && (
        documents.length > 0 ? (
          <View
            style={[
              styles.docsContainer,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <View style={styles.docsHeader}>
              <View style={styles.docsHeaderLeft}>
                <FileText size={13} color="#0284c7" />
                <Text variant="label" style={{ color: colors.ink }}>
                  Attached Documents ({documents.length})
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.docsScroll}
            >
              {documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => handleDocThumbPress(doc)}
                  style={[
                    styles.docCard,
                    {
                      backgroundColor: colors.canvasElevated,
                      borderColor: colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.docThumbContainer}>
                    {doc.thumb_signed_url || doc.signed_url ? (
                      <Image
                        source={{ uri: (doc.thumb_signed_url || doc.signed_url)! }}
                        style={styles.docThumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.docThumbFallback}>
                        <FileText size={20} color={colors.mute} />
                      </View>
                    )}
                  </View>
                  <Text variant="micro" numberOfLines={1} style={styles.docLabel}>
                    {doc.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : item.summary ? (
          <View
            style={[
              styles.fallbackSummaryBox,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.hairline,
              },
            ]}
          >
            <Text variant="caption" numberOfLines={2}>
              {item.summary}
            </Text>
          </View>
        ) : null
      )}

      {/* ── Bottom Action Bar (View Details on left, Quick Actions on right) ── */}
      <View style={[styles.actionBar, { borderTopColor: colors.hairline }]}>
        <Button
          variant="outline"
          size="sm"
          onPress={handleCardPress}
          style={styles.detailsBtn}
        >
          <Text variant="label">View Details</Text>
          <ChevronRight size={14} color={colors.ink} style={{ marginLeft: 4 }} />
        </Button>

        {showDecideActions ? (
          <View style={styles.decideGroup}>
            {/* Quick Reject Button (Single Spinner) */}
            <Button
              variant="outline"
              size="sm"
              onPress={handleRejectPress}
              disabled={isActionLoading || isRejectLoading}
              style={[
                styles.rejectBtn,
                {
                  borderColor: "rgba(239, 68, 68, 0.35)",
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.06)",
                },
              ]}
            >
              {isRejectLoading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <XCircle size={14} color="#ef4444" />
                  <Text variant="label" style={{ color: "#ef4444", marginLeft: 4 }}>
                    Reject
                  </Text>
                </>
              )}
            </Button>

            {/* Quick Approve Button (Single Spinner) */}
            <Button
              variant="default"
              size="sm"
              onPress={handleApprovePress}
              disabled={isActionLoading || isRejectLoading}
              style={styles.approveBtn}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <CheckCircle2 size={14} color="#ffffff" />
                  <Text variant="label" style={{ color: "#ffffff", marginLeft: 4 }}>
                    Approve
                  </Text>
                </>
              )}
            </Button>
          </View>
        ) : !isPending ? (
          <View style={styles.decidedNotice}>
            {item.status === "approved" ? (
              <View style={styles.decidedRow}>
                <CheckCircle2 size={14} color="#10b981" />
                <Text variant="label" style={{ color: "#10b981", marginLeft: 4 }}>
                  Approved
                </Text>
              </View>
            ) : item.status === "rejected" ? (
              <View style={styles.decidedRow}>
                <XCircle size={14} color="#ef4444" />
                <Text variant="label" style={{ color: "#ef4444", marginLeft: 4 }}>
                  Rejected
                </Text>
              </View>
            ) : (
              <Text variant="label" style={{ color: colors.mute }}>
                {item.status.toUpperCase()}
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  identityContainer: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  fullName: {
    flex: 1,
  },
  empBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 6,
    maxWidth: "48%",
  },
  contactItemFull: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  contactText: {
    flex: 1,
  },
  showcaseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  showcaseContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  showcaseThumbContainer: {
    width: 72,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  showcaseThumbImage: {
    width: "100%",
    height: "100%",
  },
  showcaseThumbFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  showcaseThumbOverlay: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 8,
    padding: 3,
  },
  showcaseInfo: {
    flex: 1,
    minWidth: 0,
  },
  showcaseLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  showcaseFallback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  iconBadgeBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  typeSectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  typeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 6,
  },
  typeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  reasonText: {
    fontStyle: "italic",
    maxWidth: 160,
  },
  diffStack: {
    gap: 4,
    marginTop: 4,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  diffField: {
    textTransform: "capitalize",
  },
  diffValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  diffOld: {
    textDecorationLine: "line-through",
    color: "#ef4444",
    maxWidth: 90,
  },
  diffNew: {
    color: "#10b981",
    maxWidth: 100,
  },
  shiftConflictGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  shiftConflictBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  docsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  docsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  docsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  docCard: {
    width: 96,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
  },
  docThumbContainer: {
    width: 82,
    height: 54,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    position: "relative",
    marginBottom: 4,
  },
  docThumbImage: {
    width: "100%",
    height: "100%",
  },
  docThumbFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  docThumbOverlay: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 10,
    padding: 3,
  },
  docLabel: {
    width: "100%",
    textAlign: "center",
    marginBottom: 2,
  },
  docStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  docActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
  },
  docActionBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  dashedEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 10,
    marginBottom: 12,
  },
  fallbackSummaryBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 12,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  decideGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rejectBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  approveBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: "#10b981",
  },
  decidedNotice: {
    marginLeft: "auto",
  },
  decidedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
