import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import type {
  ApprovalCounts,
  ApprovalRequestListItem,
  ApprovalStatus,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import { Text } from "../../components/ui/Text";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { PermissionDeniedView } from "../../components/ui/PermissionDeniedView";
import {
  DropdownFilterSelector,
  AppRefreshControl,
  showToast,
  type FilterOption,
} from "../../components/ui";
import { Pressable } from "../../components/ui/touch/Pressable";
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
  APPROVALS_PREFETCH_THRESHOLD,
  dedupeApprovalItems,
  mapApprovalDecisionError,
  useApprovalsListQuery,
  useApprovalCountsQuery,
  useApprovalDetailQuery,
  useDecideApprovalMutation,
  useApproveAllMutation,
  useVerifyDocumentMutation,
  useRejectDocumentMutation,
  useRefreshApprovalsQueue,
  useApprovalsRealtimeSync,
} from "../../lib/hooks/useApprovalsData";
import { useTheme } from "../../lib/theming";
import { useNetworkStatus } from "../../lib/offline/useNetworkStatus";
import { useReducedMotion } from "../../lib/preferences/useReducedMotion";
import { haptics } from "../../lib/haptics";
import { DUR } from "../../lib/motion";
import { Clock, CheckCheck, X, RotateCcw, WifiOff } from "lucide-react-native";

const BASE_TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Request Types" },
  { id: "registration", label: "New Registrations" },
  { id: "document_verify", label: "Document Verifications" },
  { id: "document_replace", label: "Document Replacements" },
  { id: "profile_change", label: "Profile Changes" },
  { id: "account_deletion", label: "Account Deletions" },
  { id: "shift_conflict", label: "Shift Conflicts" },
];

/** Skeleton queue shown while the first keyset page is in flight. */
const ApprovalsQueueSkeleton = React.memo(function ApprovalsQueueSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading approval requests">
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.skeletonCard,
            { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
          ]}
        >
          <View style={styles.skeletonHeaderRow}>
            <Skeleton width="42%" height={14} />
            <Skeleton width={54} height={18} borderRadius={9} />
          </View>
          <Skeleton width="70%" height={12} style={styles.skeletonLine} />
          <Skeleton width="52%" height={12} style={styles.skeletonLine} />
          <Skeleton width="100%" height={36} borderRadius={10} style={styles.skeletonAction} />
        </View>
      ))}
    </View>
  );
});

export default function ApprovalsScreen() {
  const { colors } = useTheme();
  const { role: currentUserRole, isLoading: isAuthLoading } = useAuth();
  const { isOffline } = useNetworkStatus();
  const reduceMotion = useReducedMotion();

  const normalizedRole = (currentUserRole || "").toLowerCase();
  const canAccessApprovals = ["super_admin", "admin"].includes(normalizedRole);
  // Server is authoritative: review decisions are never queued offline.
  const canDecideNow = canAccessApprovals && !isOffline;

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
  const decidingIdsRef = useRef<Set<string>>(new Set());

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

  // ── Data: keyset-cursor queue + grouped counts ──────────────────────────
  const queue = useApprovalsListQuery({
    status,
    typeKey,
    enabled: Boolean(canAccessApprovals),
  });
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    isError,
    error,
    refetch,
  } = queue;

  const { refresh, isRefreshing } = useRefreshApprovalsQueue({ status, typeKey });

  const {
    data: counts = { total: 0, by_type: {} },
    refetch: refetchCounts,
    isLoading: isCountsLoading,
  } = useApprovalCountsQuery({ enabled: Boolean(canAccessApprovals) });

  const { data: selectedDetail, isLoading: isDetailLoading } =
    useApprovalDetailQuery(selectedRequestId);

  const decideMutation = useDecideApprovalMutation();
  const approveAllMutation = useApproveAllMutation();
  const verifyDocMutation = useVerifyDocumentMutation();
  const rejectDocMutation = useRejectDocumentMutation();

  // Stable refs for actions to avoid breaking callback memoization across list items
  const selectedDetailRef = useRef(selectedDetail);
  selectedDetailRef.current = selectedDetail;

  // Enable Realtime sync for authorized approvers (counts only — never reorders the list)
  useApprovalsRealtimeSync(Boolean(canAccessApprovals));

  // Flatten keyset pages and dedupe by id (page boundaries can overlap after a refresh)
  const items = useMemo(
    () => dedupeApprovalItems((queue.data?.pages ?? []).flatMap((page) => page.items)),
    [queue.data]
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Formatted Status Options with live badge counts (theme tokens only)
  const statusOptions: FilterOption[] = useMemo(
    () => [
      {
        id: "pending",
        label: counts.total > 0 ? `Pending (${counts.total})` : "Pending",
        dotColor: colors.warning,
      },
      { id: "approved", label: "Approved", dotColor: colors.success },
      { id: "rejected", label: "Rejected", dotColor: colors.error },
      { id: "all", label: "All Statuses", dotColor: colors.mute },
    ],
    [counts.total, colors.warning, colors.success, colors.error, colors.mute]
  );

  // Formatted Type Options with live badge counts per category
  const typeOptions: FilterOption[] = useMemo(
    () =>
      BASE_TYPE_OPTIONS.map((option) => {
        const typeCount = option.id !== "all" ? counts.by_type[option.id] : undefined;
        return {
          id: option.id,
          label:
            typeCount && typeCount > 0 ? `${option.label} (${typeCount})` : option.label,
        };
      }),
    [counts.by_type]
  );

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
      const summaryMatch = item.summary?.toLowerCase().includes(q);
      const nameMatch = item.requester_name?.toLowerCase().includes(q);
      const labelMatch = item.subject_label?.toLowerCase().includes(q);
      const emailMatch = item.email?.toLowerCase().includes(q);
      const phoneMatch = item.phone?.toLowerCase().includes(q);
      const empIdMatch = item.employee_id?.toLowerCase().includes(q);
      const roleMatch = item.role?.toLowerCase().includes(q);
      return Boolean(
        summaryMatch ||
          nameMatch ||
          labelMatch ||
          emailMatch ||
          phoneMatch ||
          empIdMatch ||
          roleMatch
      );
    });
  }, [items, searchQuery]);

  // ── "N new" pill (pending baseline captured at first sync / refresh) ─────
  const pendingTotalForFilters = useCallback(
    (data?: ApprovalCounts) => {
      if (!data) return 0;
      if (typeKey && typeKey !== "all") return data.by_type[typeKey] ?? 0;
      return data.total;
    },
    [typeKey]
  );

  const [baselinePending, setBaselinePending] = useState<number | null>(null);

  useEffect(() => {
    // New filter scope → rebase the pending baseline.
    setBaselinePending(null);
  }, [status, typeKey]);

  useEffect(() => {
    if (baselinePending !== null || isCountsLoading) return;
    setBaselinePending(pendingTotalForFilters(counts));
  }, [baselinePending, isCountsLoading, counts, pendingTotalForFilters]);

  const currentPending = pendingTotalForFilters(counts);
  const newCount =
    status === "pending" && baselinePending !== null
      ? Math.max(0, currentPending - baselinePending)
      : 0;

  const listRef = useRef<FlatList<ApprovalRequestListItem>>(null);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    haptics.select();
    setStatus("pending");
    setTypeKey(undefined);
    setSearchQuery("");
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
  }, [reduceMotion]);

  // ── Pull-to-refresh + "N new" pill (explicit, user-initiated sync) ───────
  const handleRefresh = useCallback(async () => {
    haptics.threshold();
    try {
      const [, freshCounts] = await Promise.all([refresh(), refetchCounts()]);
      setBaselinePending(pendingTotalForFilters(freshCounts.data));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast("error", "Refresh Failed", message || "Could not refresh the queue.");
    }
  }, [refresh, refetchCounts, pendingTotalForFilters]);

  const handleNewPillPress = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion });
    void handleRefresh();
  }, [handleRefresh, reduceMotion]);

  // Select Item for BottomSheet Detail
  const handleItemPress = useCallback((item: ApprovalRequestListItem) => {
    setSelectedRequestId(item.id);
    setIsDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailVisible(false);
  }, []);

  // Action: Approve Entire Request
  const handleApprove = useCallback(
    async (requestId: string) => {
      if (isOffline) {
        haptics.reject();
        showToast(
          "error",
          "Offline",
          "Approvals require a live server connection. Reconnect to record this decision."
        );
        return;
      }
      if (decidingIdsRef.current.has(requestId)) return;
      decidingIdsRef.current.add(requestId);
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
        const msg = mapApprovalDecisionError(err);
        showToast("error", "Approval Error", msg);
      } finally {
        decidingIdsRef.current.delete(requestId);
        setSubmittingRequestId(null);
      }
    },
    [decideMutation, isOffline]
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
    if (isOffline) {
      haptics.reject();
      showToast(
        "error",
        "Offline",
        "Approve All requires a live server connection. Reconnect to continue."
      );
      return;
    }
    setIsApprovingAll(true);
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
      const msg = mapApprovalDecisionError(err);
      showToast("error", "Approve All Error", msg);
    } finally {
      setIsApprovingAll(false);
    }
  }, [approveAllMutation, isApprovingAll, isOffline, pendingApprovalsCount]);

  // Action: Prompt Reject for Request
  const handleCardRejectPrompt = useCallback((cardItem: ApprovalRequestListItem) => {
    if (isOffline) {
      haptics.reject();
      showToast(
        "error",
        "Offline",
        "Rejections require a live server connection. Reconnect to continue."
      );
      return;
    }
    setSelectedRequestId(cardItem.id);
    setRejectTarget({
      kind: "request",
      requestId: cardItem.id,
      summary: cardItem.summary || "Approval Request",
      version: cardItem.version,
    });
    setRejectModalVisible(true);
  }, [isOffline]);

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
        const msg = mapApprovalDecisionError(err);
        showToast("error", "Verification Error", msg);
      }
    },
    [verifyDocMutation]
  );

  // Action: Prompt Reject for Individual Document
  const handleRejectDocumentPrompt = useCallback(
    (doc: AttachedDocumentSummary | MobileViewerDoc, userId?: string) => {
      if (isOffline) {
        haptics.reject();
        showToast(
          "error",
          "Offline",
          "Rejections require a live server connection. Reconnect to continue."
        );
        return;
      }
      const docLabel = (doc as any).label || (doc as any).title || "Document";
      setRejectTarget({
        kind: "document",
        docId: doc.id || "",
        userId,
        summary: `${docLabel} rejection`,
      });
      setRejectModalVisible(true);
    },
    [isOffline]
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
        if (decidingIdsRef.current.has(target.requestId)) return;
        decidingIdsRef.current.add(target.requestId);
        setRejectingRequestId(target.requestId);
        const targetItem = itemsRef.current.find((i) => i.id === target.requestId);
        const detail = selectedDetailRef.current;
        try {
          await decideMutation.mutateAsync({
            requestId: target.requestId,
            decision: "reject",
            note: reason,
            expectedVersion:
              detail?.id === target.requestId ? detail?.version : target.version,
            boundRequestIds: targetItem?.bound_request_ids,
          });
          showToast("success", "Request Rejected", "Approval request has been rejected.");
        } catch (err: unknown) {
          const msg = mapApprovalDecisionError(err);
          showToast("error", "Rejection Error", msg);
        } finally {
          decidingIdsRef.current.delete(target.requestId);
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
          const msg = mapApprovalDecisionError(err);
          showToast("error", "Rejection Error", msg);
        }
      }
    },
    [decideMutation, rejectDocMutation, rejectTarget]
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

  // ── Next-page prefetch: fires when ~5 rows remain below the viewport ─────
  // A client-side search slice would otherwise look "almost empty" and prefetch repeatedly.
  const searchActiveRef = useRef(false);
  searchActiveRef.current = searchQuery.trim().length > 0;

  const prefetchNextPageRef = useRef<() => void>(() => {});
  prefetchNextPageRef.current = () => {
    if (!hasNextPage || isFetchingNextPage || isOffline || searchActiveRef.current) return;
    void fetchNextPage();
  };

  const visibleItemCountRef = useRef(0);
  visibleItemCountRef.current = filteredItems.length;

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 20,
    minimumViewTime: 60,
  });

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const total = visibleItemCountRef.current;
      if (total <= 0 || viewableItems.length === 0) return;
      const lastVisible = viewableItems[viewableItems.length - 1];
      const lastIndex = typeof lastVisible?.index === "number" ? lastVisible.index : 0;
      if (total - 1 - lastIndex <= APPROVALS_PREFETCH_THRESHOLD) {
        prefetchNextPageRef.current();
      }
    }
  );

  const handleEndReached = useCallback(() => {
    prefetchNextPageRef.current();
  }, []);

  // Memoized FlatList renderItem to prevent full list re-renders on screen state updates
  const renderApprovalItem = useCallback(
    ({ item }: { item: ApprovalRequestListItem }) => (
      <Animated.View
        entering={FadeIn.duration(DUR.md).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(DUR.sm).reduceMotion(ReduceMotion.System)}
        style={styles.rowWrapper}
      >
        <MobileApprovalCard
          item={item}
          onPress={handleItemPress}
          onApprove={handleApprove}
          onRejectPrompt={handleCardRejectPrompt}
          onOpenDocViewer={handleCardDocViewer}
          onVerifyDocument={handleVerifyDocument}
          onRejectDocumentPrompt={handleRejectDocumentPrompt}
          canDecide={canDecideNow}
          isActionLoading={submittingRequestId === item.id}
          isRejectLoading={rejectingRequestId === item.id}
        />
      </Animated.View>
    ),
    [
      handleItemPress,
      handleApprove,
      handleCardRejectPrompt,
      handleCardDocViewer,
      handleVerifyDocument,
      handleRejectDocumentPrompt,
      canDecideNow,
      submittingRequestId,
      rejectingRequestId,
    ]
  );

  const keyExtractor = useCallback((item: ApprovalRequestListItem) => item.id, []);

  // Footer: loading-more spinner, scroll hint, or end-of-list confirmation
  const renderListFooter = useCallback(() => {
    if (filteredItems.length === 0) return null;

    if (isFetchingNextPage) {
      return (
        <View style={styles.footerRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption" style={{ color: colors.mute, marginLeft: 8 }}>
            Loading more approval requests...
          </Text>
        </View>
      );
    }

    if (hasNextPage) {
      return (
        <View style={styles.footerRow}>
          <Text variant="caption" style={{ color: colors.mute }}>
            Scroll to load more requests
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.footerRow, styles.endOfListRow]}>
        <View style={[styles.endOfListLine, { backgroundColor: colors.hairline }]} />
        <Text variant="caption" weight="medium" style={{ color: colors.mute }}>
          All {filteredItems.length} requests loaded
        </Text>
        <View style={[styles.endOfListLine, { backgroundColor: colors.hairline }]} />
      </View>
    );
  }, [
    filteredItems.length,
    isFetchingNextPage,
    hasNextPage,
    colors.primary,
    colors.mute,
    colors.hairline,
  ]);

  const renderListEmpty = useCallback(() => {
    if (isLoading) {
      return <ApprovalsQueueSkeleton />;
    }
    return (
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
    );
  }, [isLoading, status, activeFilterCount, handleResetFilters]);

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
            variant="buttonPrimary"
            accessibilityRole="button"
            accessibilityLabel="Approve All Pending Requests"
            accessibilityState={{ disabled: isApprovingAll || isOffline }}
            disabled={isApprovingAll || isOffline}
            haptic={false}
            pressScale={0.98}
            onPress={() => {
              haptics.select();
              setApproveAllModalVisible(true);
            }}
            style={[styles.approveAllBtn, { backgroundColor: colors.success }]}
          >
            {isApprovingAll ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <CheckCheck size={16} color={colors.onPrimary} />
            )}
            <Text variant="caption" style={{ color: colors.onPrimary }}>
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

        {/* Offline guardrail — decisions require the authoritative server */}
        {isOffline ? (
          <View style={[styles.offlineNote, { borderTopColor: colors.hairline }]}>
            <WifiOff size={13} color={colors.warningDeep} />
            <Text variant="micro" style={{ color: colors.warningDeep, marginLeft: 6 }}>
              Offline — approval decisions are disabled until the server is reachable.
            </Text>
          </View>
        ) : null}

        {/* Active Filter Chips Strip */}
        {activeFilterCount > 0 ? (
          <View style={[styles.activeFiltersStrip, { borderTopColor: colors.hairline }]}>
            <Text variant="micro" style={{ color: colors.mute }}>
              ACTIVE ({activeFilterCount}):
            </Text>
            {searchQuery.trim() !== "" ? (
              <Pressable
                variant="chip"
                haptic={false}
                onPress={() => setSearchQuery("")}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro" numberOfLines={1}>
                  &ldquo;{searchQuery}&rdquo;
                </Text>
                <X size={12} color={colors.mute} style={styles.pillIcon} />
              </Pressable>
            ) : null}
            {status !== "pending" ? (
              <Pressable
                variant="chip"
                haptic={false}
                onPress={() => setStatus("pending")}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro">
                  Status:{" "}
                  {statusOptions.find((option) => option.id === status)?.label}
                </Text>
                <X size={12} color={colors.mute} style={styles.pillIcon} />
              </Pressable>
            ) : null}
            {typeKey !== undefined && typeKey !== "all" ? (
              <Pressable
                variant="chip"
                haptic={false}
                onPress={() => setTypeKey(undefined)}
                style={[
                  styles.activeFilterPill,
                  { backgroundColor: colors.canvas, borderColor: colors.hairline },
                ]}
              >
                <Text variant="micro">
                  Type: {BASE_TYPE_OPTIONS.find((t) => t.id === typeKey)?.label}
                </Text>
                <X size={12} color={colors.mute} style={styles.pillIcon} />
              </Pressable>
            ) : null}

            <Pressable
              variant="buttonGhost"
              haptic={false}
              onPress={handleResetFilters}
              style={styles.resetFiltersBtn}
            >
              <RotateCcw size={12} color={colors.primary} />
              <Text variant="micro" style={{ color: colors.primary, marginLeft: 4 }}>
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
        {items.length > 0 && newCount === 0 && !isFetching ? (
          <View style={styles.pendingHint}>
            <Clock size={12} color={colors.mute} />
            <Text variant="micro" style={{ color: colors.mute, marginLeft: 4 }}>
              Live queue
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Main Approvals List ── */}
      {isError && items.length === 0 ? (
        <ErrorState
          title="Failed to Load Approvals"
          message={error?.message || "Could not retrieve approval queue."}
          onRetry={() => {
            haptics.threshold();
            void refetch();
          }}
        />
      ) : (
        <View style={styles.listContainer}>
          <FlatList
            ref={listRef}
            data={filteredItems}
            keyExtractor={keyExtractor}
            renderItem={renderApprovalItem}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            viewabilityConfig={viewabilityConfigRef.current}
            onViewableItemsChanged={onViewableItemsChangedRef.current}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <AppRefreshControl
                refreshing={isRefreshing}
                onRefresh={() => {
                  void handleRefresh();
                }}
              />
            }
            ListEmptyComponent={renderListEmpty}
            ListFooterComponent={renderListFooter}
          />

          {/* "N new" pill — new arrivals never reorder the list under the thumb */}
          {newCount > 0 ? (
            <Animated.View
              entering={FadeInDown.duration(DUR.sm).reduceMotion(ReduceMotion.System)}
              exiting={FadeOut.duration(DUR.xs).reduceMotion(ReduceMotion.System)}
              layout={LinearTransition.duration(DUR.sm).reduceMotion(ReduceMotion.System)}
              style={styles.newPillWrapper}
              pointerEvents="box-none"
            >
              <Pressable
                variant="chip"
                accessibilityRole="button"
                accessibilityLabel={`${newCount} new approval requests. Tap to refresh.`}
                haptic="select"
                onPress={handleNewPillPress}
                style={[
                  styles.newPill,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text variant="label" style={{ color: colors.onPrimary }}>
                  {newCount} new
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      )}

      {/* ── Bottom Sheet Detail (All 6 Types Supported) ── */}
      <ApprovalDetailBottomSheet
        visible={isDetailVisible}
        request={selectedDetail ?? null}
        isLoading={isDetailLoading}
        onClose={handleCloseDetail}
        onApprove={handleApprove}
        onRejectPrompt={handleBottomSheetRejectPrompt}
        isActionLoading={decideMutation.isPending}
        canDecide={canDecideNow}
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
          canDecide={canDecideNow}
          isPending={activeCardDoc.isPending}
          onVerifyDocument={
            canDecideNow && activeCardDoc.doc.id
              ? (docId) => handleVerifyDocument(docId)
              : undefined
          }
          onRejectDocumentPrompt={
            canDecideNow
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
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
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
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  pillIcon: {
    marginLeft: 4,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pendingHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  rowWrapper: {
    width: "100%",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    minHeight: 44,
  },
  endOfListRow: {
    gap: 10,
  },
  endOfListLine: {
    height: 1,
    flex: 1,
  },
  newPillWrapper: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  newPill: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonList: {
    paddingTop: 4,
  },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  skeletonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonLine: {
    marginTop: 10,
  },
  skeletonAction: {
    marginTop: 14,
  },
});
