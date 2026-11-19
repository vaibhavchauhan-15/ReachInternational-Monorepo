import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type {
  ApprovalRequestListItem,
  ApprovalStatus,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import { Text } from "../../components/ui/Text";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { PermissionDeniedView } from "../../components/ui/PermissionDeniedView";
import {
  DropdownFilterSelector,
  type FilterOption,
  showToast,
} from "../../components/ui";
import { useAuth } from "../../lib/auth/useAuth";
import { MobileApprovalCard } from "../../components/approvals/MobileApprovalCard";
import { ApprovalDetailBottomSheet } from "../../components/approvals/ApprovalDetailBottomSheet";
import { RejectReasonModal } from "../../components/approvals/RejectReasonModal";
import { ApproveAllConfirmModal } from "../../components/approvals/ApproveAllConfirmModal";
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from "../../components/documents/MobileDocumentViewerModal";
import {
  useApprovalsListQuery,
  useApprovalCountsQuery,
  useApprovalDetailQuery,
  useDecideApprovalMutation,
  useApproveAllMutation,
  useVerifyDocumentMutation,
  useRejectDocumentMutation,
  useApprovalsRealtimeSync,
} from "../../lib/hooks/useApprovalsData";
import { useTheme } from "../../lib/theming";
import { haptics } from "../../lib/haptics";
import {
  Clock,
  CheckCircle2,
  CheckCheck,
  XCircle,
  X,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react-native";

const BASE_STATUS_OPTIONS: Array<{ id: ApprovalStatus | "all"; label: string; dotColor: string }> = [
  { id: "pending", label: "Pending", dotColor: "#f59e0b" },
  { id: "approved", label: "Approved", dotColor: "#10b981" },
  { id: "rejected", label: "Rejected", dotColor: "#ef4444" },
  { id: "all", label: "All Statuses", dotColor: "#a3a3a3" },
];

const BASE_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Request Types" },
  { id: "registration", label: "New Registrations" },
  { id: "document_verify", label: "Document Verifications" },
  { id: "document_replace", label: "Document Replacements" },
  { id: "profile_change", label: "Profile Changes" },
  { id: "account_deletion", label: "Account Deletions" },
  { id: "shift_conflict", label: "Shift Conflicts" },
];

export default function ApprovalsScreen() {
  const { colors, isDark } = useTheme();
  const { role: currentUserRole, isLoading: isAuthLoading } = useAuth();

  const normalizedRole = (currentUserRole || "").toLowerCase();
  const canAccessApprovals = ["super_admin", "admin"].includes(normalizedRole);

  // Filter State (Matching Web ApprovalsClientShell)
  const [status, setStatus] = useState<ApprovalStatus | "all">("pending");
  const [typeKey, setTypeKey] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & Selection State
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [activeCardDoc, setActiveCardDoc] = useState<{
    doc: MobileViewerDoc;
    isPending: boolean;
  } | null>(null);

  // Per-action loading indicators (Strictly single spinner per clicked item)
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);

  // Polymorphic Rejection Target State (Request vs Document)
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<
    | { kind: "request"; requestId: string; summary: string; version?: number }
    | { kind: "document"; docId: string; userId?: string; summary: string }
    | null
  >(null);

  // Bulk Approve All State
  const [approveAllModalVisible, setApproveAllModalVisible] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // Queries & Mutations (disabled if not authorized)
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useApprovalsListQuery({
    status,
    typeKey,
    enabled: Boolean(canAccessApprovals),
  });

  const { data: counts = { total: 0, by_type: {} }, refetch: refetchCounts } =
    useApprovalCountsQuery({ enabled: Boolean(canAccessApprovals) });

  const { data: selectedDetail, isLoading: isDetailLoading } =
    useApprovalDetailQuery(selectedRequestId);

  const decideMutation = useDecideApprovalMutation();
  const approveAllMutation = useApproveAllMutation();
  const verifyDocMutation = useVerifyDocumentMutation();
  const rejectDocMutation = useRejectDocumentMutation();

  // Stable refs for actions to avoid breaking callback memoization across list items
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedDetailRef = useRef(selectedDetail);
  selectedDetailRef.current = selectedDetail;

  // Enable Realtime sync for authorized approvers
  useApprovalsRealtimeSync(Boolean(canAccessApprovals));

  const onRefresh = useCallback(async () => {
    haptics.threshold();
    await Promise.all([refetch(), refetchCounts()]);
  }, [refetch, refetchCounts]);

  // Formatted Status Options with live badge counts
  const statusOptions: FilterOption[] = useMemo(() => {
    return BASE_STATUS_OPTIONS.map((opt) => ({
      id: opt.id,
      label:
        opt.id === "pending" && counts.total > 0
          ? `${opt.label} (${counts.total})`
          : opt.label,
      dotColor: opt.dotColor,
    }));
  }, [counts.total]);

  // Formatted Type Options with live badge counts per category
  const typeOptions: FilterOption[] = useMemo(() => {
    return BASE_TYPE_OPTIONS.map((opt) => {
      const typeCount = opt.id !== "all" ? counts.by_type[opt.id] : undefined;
      return {
        id: opt.id,
        label:
          typeCount && typeCount > 0
            ? `${opt.label} (${typeCount})`
            : opt.label,
      };
    });
  }, [counts.by_type]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (status !== "pending") count += 1;
    if (typeKey !== undefined && typeKey !== "all") count += 1;
    if (searchQuery.trim() !== "") count += 1;
    return count;
  }, [status, typeKey, searchQuery]);

  // Filter items in memory by search query (Matching Web ApprovalsClientShell)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const summaryMatch = item.summary.toLowerCase().includes(q);
      const nameMatch = item.requester_name?.toLowerCase().includes(q);
      const labelMatch = item.subject_label?.toLowerCase().includes(q);
      const emailMatch = item.email?.toLowerCase().includes(q);
      const phoneMatch = item.phone?.toLowerCase().includes(q);
      const empIdMatch = item.employee_id?.toLowerCase().includes(q);
      const roleMatch = item.role?.toLowerCase().includes(q);
      return (
        summaryMatch ||
        Boolean(nameMatch) ||
        Boolean(labelMatch) ||
        Boolean(emailMatch) ||
        Boolean(phoneMatch) ||
        Boolean(empIdMatch) ||
        Boolean(roleMatch)
      );
    });
  }, [items, searchQuery]);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    haptics.select();
    setStatus("pending");
    setTypeKey(undefined);
    setSearchQuery("");
  }, []);

  // Select Item for BottomSheet Detail
  const handleItemPress = useCallback((item: ApprovalRequestListItem) => {
    haptics.select();
    setSelectedRequestId(item.id);
    setIsDetailVisible(true);
  }, []);

  // Action: Approve Entire Request
  const handleApprove = useCallback(
    async (requestId: string) => {
      setSubmittingRequestId(requestId);
      const targetItem = itemsRef.current.find((i) => i.id === requestId);
      const detail = selectedDetailRef.current;
      try {
        await decideMutation.mutateAsync({
          requestId,
          decision: "approve",
          expectedVersion:
            detail?.id === requestId ? detail?.version : targetItem?.version,
          boundRequestIds: targetItem?.bound_request_ids,
        });
        showToast("success", "Approved", "Request approved successfully.");
        setIsDetailVisible(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast("error", "Approval Error", msg);
      } finally {
        setSubmittingRequestId(null);
      }
    },
    [decideMutation, showToast]
  );

  // Pending approvals count for Approve All button badge
  const pendingApprovalsCount = useMemo(() => {
    if (typeKey && typeKey !== "all") {
      const typeCount = counts.by_type[typeKey];
      if (typeCount !== undefined && typeCount > 0) return typeCount;
      return items.filter((i) => i.status === "pending" && i.type_key === typeKey).length;
    }
    const regCount = counts.by_type["registration"];
    if (regCount !== undefined && regCount > 0) return regCount;
    return counts.total || items.filter((i) => i.status === "pending").length;
  }, [counts, items, typeKey]);

  const canApproveAll =
    canAccessApprovals &&
    (pendingApprovalsCount > 0 || items.some((i) => i.status === "pending"));

  // Action: Approve All Pending Requests
  const handleApproveAll = useCallback(async () => {
    if (isApprovingAll) return;
    setIsApprovingAll(true);
    haptics.confirm();
    try {
      const res = await approveAllMutation.mutateAsync({
        typeKey: typeKey && typeKey !== "all" ? typeKey : undefined,
      });
      const approvedCount = res?.approved_count ?? pendingApprovalsCount;
      showToast(
        "success",
        "Approved All",
        `Activated ${approvedCount} user account${approvedCount === 1 ? "" : "s"}. Documents remain pending verification.`
      );
      setApproveAllModalVisible(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("error", "Approve All Error", msg);
    } finally {
      setIsApprovingAll(false);
    }
  }, [approveAllMutation, isApprovingAll, pendingApprovalsCount, showToast, typeKey]);

  // Action: Prompt Reject for Request
  const handleCardRejectPrompt = useCallback((cardItem: ApprovalRequestListItem) => {
    setSelectedRequestId(cardItem.id);
    setRejectTarget({
      kind: "request",
      requestId: cardItem.id,
      summary: cardItem.summary || "Approval Request",
      version: cardItem.version,
    });
    setRejectModalVisible(true);
  }, []);

  // Action: Prompt Reject for BottomSheet
  const handleBottomSheetRejectPrompt = useCallback(() => {
    const detail = selectedDetailRef.current;
    if (!detail) return;
    setRejectTarget({
      kind: "request",
      requestId: detail.id,
      summary: detail.summary || "Approval Request",
      version: detail.version,
    });
    setRejectModalVisible(true);
  }, []);

  // Action: Verify Individual Document
  const handleVerifyDocument = useCallback(
    async (documentId: string, userId?: string) => {
      try {
        await verifyDocMutation.mutateAsync({ documentId, userId });
        showToast("success", "Document Verified", "Document marked as verified.");
        setActiveCardDoc((prev) => (prev?.doc.id === documentId ? null : prev));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast("error", "Verification Error", msg);
      }
    },
    [verifyDocMutation, showToast]
  );

  // Action: Prompt Reject for Individual Document
  const handleRejectDocumentPrompt = useCallback(
    (doc: AttachedDocumentSummary | MobileViewerDoc, userId?: string) => {
      const docLabel = (doc as any).label || (doc as any).title || "Document";
      setRejectTarget({
        kind: "document",
        docId: doc.id || "",
        userId,
        summary: `${docLabel} rejection`,
      });
      setRejectModalVisible(true);
    },
    []
  );

  // Action: Confirm Rejection with Reason (Request or Document)
  const handleConfirmReject = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;

      const target = rejectTarget;
      // ⚡ INSTANT OPTIMISTIC FEEDBACK: Dismiss modal immediately (0ms delay)
      setRejectModalVisible(false);
      setIsDetailVisible(false);
      setRejectTarget(null);

      if (target.kind === "request") {
        setRejectingRequestId(target.requestId);
        const targetItem = itemsRef.current.find((i) => i.id === target.requestId);
        const detail = selectedDetailRef.current;
        try {
          await decideMutation.mutateAsync({
            requestId: target.requestId,
            decision: "reject",
            note: reason,
            expectedVersion:
              detail?.id === target.requestId
                ? detail?.version
                : target.version,
            boundRequestIds: targetItem?.bound_request_ids,
          });
          showToast("success", "Request Rejected", "Approval request has been rejected.");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          showToast("error", "Rejection Error", msg);
        } finally {
          setRejectingRequestId(null);
        }
      } else if (target.kind === "document") {
        setActiveCardDoc((prev) => (prev?.doc.id === target.docId ? null : prev));
        try {
          await rejectDocMutation.mutateAsync({
            documentId: target.docId,
            rejectionReason: reason,
            userId: target.userId,
          });
          showToast("success", "Document Rejected", "Document has been marked as rejected.");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          showToast("error", "Rejection Error", msg);
        }
      }
    },
    [decideMutation, rejectDocMutation, rejectTarget, showToast]
  );

  // Card Document Thumbnail Fullscreen Inspection
  const handleCardDocViewer = useCallback(
    (
      title: string,
      url: string,
      fileName?: string,
      docId?: string,
      isDocPending?: boolean
    ) => {
      setActiveCardDoc({
        doc: {
          id: docId,
          title,
          url,
          uri: url,
          mimeType: "image/jpeg",
          fileName: fileName || "document.jpg",
        },
        isPending: Boolean(isDocPending),
      });
    },
    []
  );

  // Memoized FlatList renderItem to prevent full list re-renders on screen state updates
  const renderApprovalItem = useCallback(
    ({ item }: { item: ApprovalRequestListItem }) => (
      <MobileApprovalCard
        item={item}
        onPress={handleItemPress}
        onApprove={handleApprove}
        onRejectPrompt={handleCardRejectPrompt}
        onOpenDocViewer={handleCardDocViewer}
        onVerifyDocument={handleVerifyDocument}
        onRejectDocumentPrompt={handleRejectDocumentPrompt}
        canDecide={canAccessApprovals}
        isActionLoading={submittingRequestId === item.id}
        isRejectLoading={rejectingRequestId === item.id}
      />
    ),
    [
      handleItemPress,
      handleApprove,
      handleCardRejectPrompt,
      handleCardDocViewer,
      handleVerifyDocument,
      handleRejectDocumentPrompt,
      canAccessApprovals,
      submittingRequestId,
      rejectingRequestId,
    ]
  );

  if (!isAuthLoading && currentUserRole && !canAccessApprovals) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.canvas }]}
        edges={["top"]}
      >
        <MobileHeader
          title="Approvals & Verifications"
          showBack={true}
          backRoute="/dashboard"
        />
        <PermissionDeniedView
          featureName="Approvals"
          currentRole={currentUserRole}
          requiredRoles={["super_admin", "admin"]}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.canvas }]}
      edges={["top"]}
    >
      {/* ── Top Clean Header (Matching Web: Clean Title & Approve All Action) ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
        ]}
      >
        <Text variant="title">Approvals &amp; Verifications</Text>
        {canApproveAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Approve All Pending Requests"
            disabled={isApprovingAll}
            onPress={() => {
              haptics.select();
              setApproveAllModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.approveAllBtn,
              {
                backgroundColor: isApprovingAll ? colors.mute : "#10b981",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {isApprovingAll ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <CheckCheck size={16} color="#ffffff" />
            )}
            <Text variant="caption" style={styles.approveAllBtnText}>
              Approve All {pendingApprovalsCount > 0 ? `(${pendingApprovalsCount})` : ""}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Filter Toolbar with Custom Dropdowns (Matching Web Feedback 4 & 5) ── */}
      <View
        style={[
          styles.filterSection,
          { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
        ]}
      >
        {/* Dual Custom Dropdowns Row */}
        <View style={styles.dropdownsRow}>
          <View style={styles.dropdownCol}>
            <DropdownFilterSelector
              label="Status"
              value={status}
              options={statusOptions}
              onChange={(val) => {
                setStatus(val as ApprovalStatus | "all");
              }}
              minMenuWidth={180}
            />
          </View>
          <View style={styles.dropdownCol}>
            <DropdownFilterSelector
              label="Request Type"
              value={typeKey || "all"}
              options={typeOptions}
              onChange={(val) => {
                setTypeKey(val === "all" ? undefined : val);
              }}
              minMenuWidth={220}
            />
          </View>
        </View>

        {/* Search Input (Matching Web Search Across All Fields) */}
        <View style={styles.searchContainer}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, emp id, email, phone, role..."
          />
        </View>

        {/* Active Filter Chips Strip */}
        {activeFilterCount > 0 ? (
          <View style={[styles.activeFiltersStrip, { borderTopColor: colors.hairline }]}>
            <Text variant="micro" style={{ color: colors.mute }}>
              ACTIVE ({activeFilterCount}):
            </Text>
            {searchQuery.trim() !== "" ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro" numberOfLines={1}>
                  &ldquo;{searchQuery}&rdquo;
                </Text>
                <X size={12} color={colors.mute} style={{ marginLeft: 4 }} />
              </Pressable>
            ) : null}
            {status !== "pending" ? (
              <Pressable
                onPress={() => setStatus("pending")}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro">
                  Status: {BASE_STATUS_OPTIONS.find((s) => s.id === status)?.label}
                </Text>
                <X size={12} color={colors.mute} style={{ marginLeft: 4 }} />
              </Pressable>
            ) : null}
            {typeKey !== undefined && typeKey !== "all" ? (
              <Pressable
                onPress={() => setTypeKey(undefined)}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro">
                  Type: {BASE_TYPE_OPTIONS.find((t) => t.id === typeKey)?.label}
                </Text>
                <X size={12} color={colors.mute} style={{ marginLeft: 4 }} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleResetFilters}
              style={styles.resetFiltersBtn}
            >
              <RotateCcw size={12} color="#0284c7" />
              <Text variant="micro" style={{ color: "#0284c7", marginLeft: 4 }}>
                Reset all
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* ── Results Count Banner ── */}
      <View style={styles.resultsBanner}>
        <Text variant="caption" style={{ color: colors.mute }}>
          Showing{" "}
          <Text variant="label" style={{ color: colors.ink }}>
            {filteredItems.length}
          </Text>{" "}
          approval requests
        </Text>
      </View>

      {/* ── Main Approvals List ── */}
      {isError ? (
        <ErrorState
          title="Failed to Load Approvals"
          message={error?.message || "Could not retrieve approval queue."}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderApprovalItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              colors={["#0284c7"]}
              tintColor="#0284c7"
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                title="No Approvals Found"
                description={
                  status === "pending"
                    ? "Great job! All approval requests have been reviewed."
                    : status === "approved"
                    ? "No approved requests found matching your active filters."
                    : status === "rejected"
                    ? "No rejected requests found matching your active filters."
                    : "No requests matching the selected filters."
                }
                actionLabel={activeFilterCount > 0 ? "Reset active filters" : undefined}
                onAction={activeFilterCount > 0 ? handleResetFilters : undefined}
              />
            ) : undefined
          }
        />
      )}

      {/* ── Bottom Sheet Detail (All 6 Types Supported) ── */}
      <ApprovalDetailBottomSheet
        visible={isDetailVisible}
        request={selectedDetail ?? null}
        isLoading={isDetailLoading}
        onClose={() => setIsDetailVisible(false)}
        onApprove={handleApprove}
        onRejectPrompt={handleBottomSheetRejectPrompt}
        isActionLoading={decideMutation.isPending}
      />

      {/* ── Polymorphic Rejection Reason Modal (Mandatory reason captured) ── */}
      <RejectReasonModal
        visible={rejectModalVisible}
        onClose={() => {
          setRejectModalVisible(false);
          setRejectTarget(null);
        }}
        onConfirm={handleConfirmReject}
        title={rejectTarget?.kind === "document" ? "Reject Document" : "Reject Request"}
        requestSummary={rejectTarget?.summary}
        isSubmitting={decideMutation.isPending || rejectDocMutation.isPending}
      />

      {/* ── Fullscreen Document Viewer with In-Viewer Verification Actions ── */}
      {activeCardDoc ? (
        <MobileDocumentViewerModal
          document={activeCardDoc.doc}
          onClose={() => setActiveCardDoc(null)}
          canDecide={canAccessApprovals}
          isPending={activeCardDoc.isPending}
          onVerifyDocument={
            canAccessApprovals && activeCardDoc.doc.id
              ? (docId) => handleVerifyDocument(docId)
              : undefined
          }
          onRejectDocumentPrompt={
            canAccessApprovals
              ? (doc) => handleRejectDocumentPrompt(doc)
              : undefined
          }
          isActionLoading={verifyDocMutation.isPending || rejectDocMutation.isPending}
        />
      ) : null}

      {/* ── Bulk Approve All Confirmation Modal ── */}
      <ApproveAllConfirmModal
        visible={approveAllModalVisible}
        onClose={() => setApproveAllModalVisible(false)}
        onConfirm={handleApproveAll}
        count={pendingApprovalsCount}
        typeLabel={
          typeKey && typeKey !== "all"
            ? BASE_TYPE_OPTIONS.find((t) => t.id === typeKey)?.label
            : undefined
        }
        isSubmitting={isApprovingAll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  approveAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  approveAllBtnText: {
    color: "#ffffff",
  },
  filterSection: {
    borderBottomWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
  },
  dropdownsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  dropdownCol: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  activeFiltersStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  resetFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: "auto",
    minHeight: 44,
  },
  resultsBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
});
