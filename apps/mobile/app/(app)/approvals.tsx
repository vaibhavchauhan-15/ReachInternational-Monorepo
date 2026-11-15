import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type {
  ApprovalRequestListItem,
  ApprovalStatus,
} from "@reachinternational/types";
import { Text } from "../../components/ui/Text";
import { SearchInput } from "../../components/ui/SearchInput";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { MobileApprovalCard } from "../../components/approvals/MobileApprovalCard";
import { ApprovalDetailBottomSheet } from "../../components/approvals/ApprovalDetailBottomSheet";
import { RejectReasonModal } from "../../components/approvals/RejectReasonModal";
import {
  useApprovalsListQuery,
  useApprovalCountsQuery,
  useApprovalDetailQuery,
  useDecideApprovalMutation,
  useApprovalsRealtimeSync,
} from "../../lib/hooks/useApprovalsData";
import { useTheme } from "../../lib/theming";
import { haptics } from "../../lib/haptics";
import { Clock, CheckCircle2, XCircle } from "lucide-react-native";

const TYPE_FILTERS = [
  { key: undefined, label: "All Types" },
  { key: "document_verify", label: "Documents" },
  { key: "profile_change", label: "Profile" },
  { key: "registration", label: "Registrations" },
  { key: "document_replace", label: "Replacements" },
  { key: "account_deletion", label: "Deletions" },
];

export default function ApprovalsScreen() {
  const { colors } = useTheme();

  // Filter State
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [typeKey, setTypeKey] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  // Queries & Mutations
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useApprovalsListQuery({ status, typeKey });

  const { data: counts = { total: 0, by_type: {} }, refetch: refetchCounts } =
    useApprovalCountsQuery();

  const { data: selectedDetail, isLoading: isDetailLoading } =
    useApprovalDetailQuery(selectedRequestId);

  const decideMutation = useDecideApprovalMutation();

  // Enable Realtime sync
  useApprovalsRealtimeSync();

  const onRefresh = useCallback(async () => {
    haptics.threshold();
    await Promise.all([refetch(), refetchCounts()]);
  }, [refetch, refetchCounts]);

  // Filter items in memory by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.summary.toLowerCase().includes(q) ||
        (item.requester_name && item.requester_name.toLowerCase().includes(q)) ||
        (item.subject_label && item.subject_label.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Select Item
  const handleItemPress = (item: ApprovalRequestListItem) => {
    haptics.select();
    setSelectedRequestId(item.id);
    setIsDetailVisible(true);
  };

  // Actions
  const handleApprove = async (requestId: string) => {
    await decideMutation.mutateAsync({
      requestId,
      decision: "approve",
      expectedVersion: selectedDetail?.version,
    });
    setIsDetailVisible(false);
  };

  const handleRejectPrompt = () => {
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async (reason: string) => {
    if (!selectedRequestId) return;
    await decideMutation.mutateAsync({
      requestId: selectedRequestId,
      decision: "reject",
      note: reason,
      expectedVersion: selectedDetail?.version,
    });
    setRejectModalVisible(false);
    setIsDetailVisible(false);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.canvas }]}
      edges={["top"]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
        ]}
      >
        <View>
          <View style={styles.titleRow}>
            <Text variant="title">Approvals</Text>
            {counts.total > 0 && (
              <View style={styles.countBadge}>
                <Text variant="label" style={{ color: "#d97706" }}>
                  {counts.total}
                </Text>
              </View>
            )}
          </View>
          <Text variant="caption">Unified operational queue & verifications</Text>
        </View>
      </View>

      {/* Status Segmented Tabs */}
      <View
        style={[
          styles.tabsRow,
          { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
        ]}
      >
        <Pressable
          onPress={() => {
            haptics.select();
            setStatus("pending");
          }}
          style={[
            styles.tabItem,
            status === "pending" && [
              styles.tabActive,
              { backgroundColor: "rgba(245, 158, 11, 0.12)" },
            ],
          ]}
        >
          <Clock
            size={14}
            color={status === "pending" ? "#d97706" : colors.mute}
          />
          <Text
            variant="label"
            style={{
              color: status === "pending" ? "#d97706" : colors.mute,
            }}
          >
            Pending ({counts.total})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.select();
            setStatus("approved");
          }}
          style={[
            styles.tabItem,
            status === "approved" && [
              styles.tabActive,
              { backgroundColor: "rgba(16, 185, 129, 0.12)" },
            ],
          ]}
        >
          <CheckCircle2
            size={14}
            color={status === "approved" ? "#10b981" : colors.mute}
          />
          <Text
            variant="label"
            style={{
              color: status === "approved" ? "#10b981" : colors.mute,
            }}
          >
            Approved
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.select();
            setStatus("rejected");
          }}
          style={[
            styles.tabItem,
            status === "rejected" && [
              styles.tabActive,
              { backgroundColor: "rgba(239, 68, 68, 0.12)" },
            ],
          ]}
        >
          <XCircle
            size={14}
            color={status === "rejected" ? "#ef4444" : colors.mute}
          />
          <Text
            variant="label"
            style={{
              color: status === "rejected" ? "#ef4444" : colors.mute,
            }}
          >
            Rejected
          </Text>
        </Pressable>
      </View>

      {/* Type Filter Pills (Horizontal Scroll) */}
      <View style={styles.filterStripContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStrip}
        >
          {TYPE_FILTERS.map((f) => {
            const isSelected = typeKey === f.key;
            return (
              <Pressable
                key={f.label}
                onPress={() => {
                  haptics.select();
                  setTypeKey(f.key);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? "rgba(2, 132, 199, 0.12)"
                      : colors.canvasElevated,
                    borderColor: isSelected ? "#0284c7" : colors.hairline,
                  },
                ]}
              >
                <Text
                  variant="micro"
                  style={{
                    color: isSelected ? "#0284c7" : colors.mute,
                  }}
                >
                  {f.label}
                  {f.key && counts.by_type[f.key]
                    ? ` (${counts.by_type[f.key]})`
                    : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by title, requester..."
        />
      </View>

      {/* Main List */}
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
          renderItem={({ item }) => (
            <MobileApprovalCard item={item} onPress={handleItemPress} />
          )}
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
                    : "No requests matching the selected filters."
                }
              />
            ) : undefined
          }
        />
      )}

      {/* Bottom Sheet Detail */}
      <ApprovalDetailBottomSheet
        visible={isDetailVisible}
        request={selectedDetail ?? null}
        isLoading={isDetailLoading}
        onClose={() => setIsDetailVisible(false)}
        onApprove={handleApprove}
        onRejectPrompt={handleRejectPrompt}
        isActionLoading={decideMutation.isPending}
      />

      {/* Rejection Modal */}
      <RejectReasonModal
        visible={rejectModalVisible}
        onClose={() => setRejectModalVisible(false)}
        onConfirm={handleConfirmReject}
        requestSummary={selectedDetail?.summary}
        isSubmitting={decideMutation.isPending}
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
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
  },
  tabsRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
  },
  tabActive: {
    borderRadius: 8,
  },
  filterStripContainer: {
    paddingVertical: 8,
  },
  filterStrip: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
