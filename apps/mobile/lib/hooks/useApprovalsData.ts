/**
 * Native Mobile Approvals Server State & Data Access Hooks
 * Powered by TanStack Query for on-demand caching, optimistic updates,
 * offline synchronization, and realtime query invalidation.
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import {
  listApprovals,
  getApproval,
  approvalCounts,
  decideApproval,
  cancelApproval,
} from "@reachinternational/utils";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
} from "@reachinternational/types";
import { haptics } from "../haptics";

export const APPROVALS_QUERY_KEYS = {
  all: ["approvals"] as const,
  lists: () => [...APPROVALS_QUERY_KEYS.all, "list"] as const,
  list: (status: ApprovalStatus, typeKey?: string) =>
    [...APPROVALS_QUERY_KEYS.lists(), { status, typeKey }] as const,
  counts: () => [...APPROVALS_QUERY_KEYS.all, "counts"] as const,
  detail: (id: string) => [...APPROVALS_QUERY_KEYS.all, "detail", id] as const,
};

export interface UseApprovalsListOptions {
  status?: ApprovalStatus;
  typeKey?: string;
  enabled?: boolean;
}

export function useApprovalsListQuery(options: UseApprovalsListOptions = {}) {
  const { status = "pending", typeKey, enabled = true } = options;

  return useQuery({
    queryKey: APPROVALS_QUERY_KEYS.list(status, typeKey),
    queryFn: async (): Promise<ApprovalRequestListItem[]> => {
      const res = await listApprovals(supabase, {
        status,
        type_key: typeKey,
        limit: 30,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useApprovalCountsQuery() {
  return useQuery({
    queryKey: APPROVALS_QUERY_KEYS.counts(),
    queryFn: async (): Promise<ApprovalCounts> => {
      const res = await approvalCounts(supabase);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || { total: 0, by_type: {} };
    },
    staleTime: 30_000,
  });
}

export function useApprovalDetailQuery(requestId: string | null) {
  return useQuery({
    queryKey: APPROVALS_QUERY_KEYS.detail(requestId || ""),
    queryFn: async (): Promise<ApprovalRequest | null> => {
      if (!requestId) return null;
      const res = await getApproval(supabase, requestId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: !!requestId,
    staleTime: 30_000,
  });
}

export function useDecideApprovalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      decision,
      note,
      expectedVersion,
    }: {
      requestId: string;
      decision: "approve" | "reject";
      note?: string;
      expectedVersion?: number;
    }) => {
      const res = await decideApproval(supabase, {
        request_id: requestId,
        decision,
        note,
        expected_version: expectedVersion,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onMutate: async ({ requestId, decision }) => {
      // Optimistic haptic feedback
      if (decision === "approve") {
        haptics.confirm();
      } else {
        haptics.reject();
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });

      // Snapshot previous state
      const previousLists = queryClient.getQueriesData({
        queryKey: APPROVALS_QUERY_KEYS.lists(),
      });

      // Optimistically remove from pending lists
      queryClient.setQueriesData<ApprovalRequestListItem[]>(
        { queryKey: APPROVALS_QUERY_KEYS.lists() },
        (old) => (old ? old.filter((item) => item.id !== requestId) : [])
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      // Invalidate queries to sync with backend truth
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
    },
  });
}

export function useCancelApprovalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      note,
    }: {
      requestId: string;
      note?: string;
    }) => {
      const res = await cancelApproval(supabase, {
        request_id: requestId,
        note,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
    },
  });
}

/**
 * Realtime hook subscribing to approval_requests updates
 */
export function useApprovalsRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("approval_requests_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
