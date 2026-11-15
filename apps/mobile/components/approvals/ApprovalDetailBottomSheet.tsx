import React from "react";
import {
  View,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import type { ApprovalRequest } from "@reachinternational/types";
import { Text } from "../ui/Text";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useTheme } from "../../lib/theming";
import { formatExactTimestamp, formatTinyRelativeTime } from "@reachinternational/utils";
import { X, Check, FileText, User, Clock, ShieldAlert } from "lucide-react-native";

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

  if (!visible) return null;

  const isPending = request?.status === "pending";
  const payload = (request?.payload || {}) as Record<string, any>;

  return (
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

            {/* Type-Specific Content */}
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
              ]}
            >
              <Text variant="label" style={styles.sectionHeader}>
                PROPOSED DETAILS
              </Text>

              {request.type_key === "document_verify" && (
                <View style={styles.detailRow}>
                  <Text variant="caption">Document Type</Text>
                  <Text variant="body" style={styles.detailValue}>
                    {payload.document_type_code?.replace(/_/g, " ").toUpperCase()}
                  </Text>
                  <Text variant="micro" style={{ color: colors.mute, marginTop: 4 }}>
                    Storage: {payload.storage_path}
                  </Text>
                </View>
              )}

              {request.type_key === "profile_change" && (
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
              )}

              {request.type_key === "registration" && (
                <View style={styles.detailList}>
                  <View style={styles.detailItem}>
                    <Text variant="caption">Name</Text>
                    <Text variant="body">{payload.full_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text variant="caption">Email</Text>
                    <Text variant="body">{payload.email}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text variant="caption">Role</Text>
                    <Text variant="heading" style={{ color: "#0284c7" }}>
                      {payload.role?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {request.type_key === "account_deletion" && (
                <View style={styles.deletionBox}>
                  <ShieldAlert size={16} color="#ef4444" />
                  <Text variant="body" style={{ color: "#ef4444" }}>
                    Reason: &ldquo;{payload.reason}&rdquo;
                  </Text>
                </View>
              )}
            </View>

            {/* Decision Status if resolved */}
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
                  <Text variant="caption">
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
  },
  detailValue: {
    marginTop: 2,
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
  deletionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
