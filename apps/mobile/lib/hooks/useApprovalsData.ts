/**
 * Native Mobile Approvals Server State & Data Access Hooks
 * Powered by TanStack Query for on-demand caching, optimistic updates,
 * offline synchronization, and realtime query invalidation.
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { getAppUrl } from "../env";
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
  list: (status: ApprovalStatus | "all", typeKey?: string) =>
    [...APPROVALS_QUERY_KEYS.lists(), { status, typeKey }] as const,
  counts: () => [...APPROVALS_QUERY_KEYS.all, "counts"] as const,
  detail: (id: string) => [...APPROVALS_QUERY_KEYS.all, "detail", id] as const,
};

export interface UseApprovalsListOptions {
  status?: ApprovalStatus | "all";
  typeKey?: string;
  enabled?: boolean;
}

export function useApprovalsListQuery(options: UseApprovalsListOptions = {}) {
  const { status = "pending", typeKey, enabled = true } = options;

  return useQuery({
    queryKey: APPROVALS_QUERY_KEYS.list(status, typeKey),
    queryFn: async (): Promise<ApprovalRequestListItem[]> => {
      // 1. Dual-Transport: Attempt rich Next.js API route with Bearer auth for pre-signed thumbnails
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const appUrl = getAppUrl();
          const q = new URLSearchParams();
          if (status && status !== "all") {
            q.set("status", status);
          } else if (status === "all") {
            q.set("status", "all");
          }
          if (typeKey && typeKey !== "all") {
            q.set("type_key", typeKey);
          }
          q.set("limit", "50");

          const res = await fetch(`${appUrl}/api/approvals?${q.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              return data;
            }
          }
        }
      } catch (err) {
        console.warn("[Approvals] Rich API fetch fallback to direct RPC:", err);
      }

      // 2. Direct RPC fallback
      const res = await listApprovals(supabase, {
        status: status === "all" ? "all" : status,
        type_key: typeKey === "all" ? undefined : typeKey,
        limit: 50,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      const items: ApprovalRequestListItem[] = res.data || [];

      // 3. Batch resolve signed URLs for thumbnails that need signing
      const pathsToSign: string[] = [];
      for (const item of items) {
        if (item.documents && Array.isArray(item.documents)) {
          for (const doc of item.documents) {
            if (!doc.thumb_signed_url && !doc.signed_url) {
              const p = (doc.thumb_path || doc.storage_path || "").replace(/^\/+/, "");
              if (p) pathsToSign.push(p);
            }
          }
        }
      }

      if (pathsToSign.length > 0) {
        try {
          const uniquePaths = Array.from(new Set(pathsToSign));
          const { data: signedUrls } = await supabase.storage
            .from("user_files")
            .createSignedUrls(uniquePaths, 3600);

          if (signedUrls && Array.isArray(signedUrls)) {
            const urlMap = new Map<string, string>();
            signedUrls.forEach((s, idx) => {
              if (s?.signedUrl) {
                if (s.path) urlMap.set(s.path, s.signedUrl);
                if (uniquePaths[idx]) urlMap.set(uniquePaths[idx], s.signedUrl);
              }
            });

            for (const item of items) {
              if (item.documents && Array.isArray(item.documents)) {
                for (const doc of item.documents) {
                  const p = (doc.thumb_path || doc.storage_path || "").replace(/^\/+/, "");
                  if (urlMap.has(p)) {
                    doc.thumb_signed_url = urlMap.get(p);
                    doc.signed_url = urlMap.get(p);
                  }
                }
              }
            }
          }
        } catch {
          // Non-blocking thumbnail signing
        }
      }

      return items;
    },
    staleTime: 30_000,
    enabled,
  });
}

export function useApprovalCountsQuery(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
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
    enabled,
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
      boundRequestIds,
    }: {
      requestId: string;
      decision: "approve" | "reject";
      note?: string;
      expectedVersion?: number;
      boundRequestIds?: string[];
    }) => {
      // 1. Dual-Transport: Try Next.js API route with Bearer auth for sub-second database execution & outbox trigger
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const appUrl = getAppUrl();
          const res = await fetch(`${appUrl}/api/approvals/${requestId}/decide`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              decision,
              note,
              expected_version: expectedVersion,
              bound_request_ids: boundRequestIds,
            }),
          });

          if (res.ok) {
            const json = await res.json();
            return json;
          } else if (res.status === 409) {
            const json = await res.json().catch(() => ({}));
            throw new Error(
              json.error || "Approval request was modified by another reviewer. Please refresh."
            );
          }
        }
      } catch (err: any) {
        if (err?.message?.includes("another reviewer")) throw err;
        console.warn("[useDecideApprovalMutation] Web API call fallback to direct RPC:", err);
      }

      // 2. Direct RPC fallback with p_actor_id
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData?.session?.user?.id || null;

      const res = await decideApproval(supabase, {
        request_id: requestId,
        decision,
        note,
        expected_version: expectedVersion,
        actor_id: actorId,
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
      const previousCounts = queryClient.getQueryData<ApprovalCounts>(
        APPROVALS_QUERY_KEYS.counts()
      );

      // Optimistically remove from pending lists or mark decided
      queryClient.setQueriesData<ApprovalRequestListItem[]>(
        { queryKey: APPROVALS_QUERY_KEYS.lists() },
        (old) => {
          if (!old) return [];
          return old.filter((item) => item.id !== requestId);
        }
      );

      // Optimistically decrement count
      queryClient.setQueryData<ApprovalCounts>(
        APPROVALS_QUERY_KEYS.counts(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            total: Math.max(0, old.total - 1),
          };
        }
      );

      return { previousLists, previousCounts };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(APPROVALS_QUERY_KEYS.counts(), context.previousCounts);
      }
    },
    onSettled: () => {
      // Invalidate queries to sync with backend truth
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
    },
  });
}

/**
 * Mutation to verify an individual document directly or via its approval request
 */
export function useVerifyDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      userId,
    }: {
      documentId: string;
      userId?: string;
    }) => {
      // 1. Check if unified approval engine has a pending request for this document
      const { data: appReq } = await supabase
        .from("approval_requests")
        .select("id, version")
        .eq("type_key", "document_verify")
        .eq("subject_id", documentId)
        .eq("status", "pending")
        .maybeSingle();

      if (appReq) {
        const { data: sessionData } = await supabase.auth.getSession();
        const actorId = sessionData?.session?.user?.id || null;
        const res = await decideApproval(supabase, {
          request_id: appReq.id,
          decision: "approve",
          expected_version: appReq.version,
          actor_id: actorId,
        });
        if (res.error) throw new Error(res.error);
        return res.data;
      }

      // 2. Direct document verification update
      const { data: sessionData } = await supabase.auth.getSession();
      const reviewerId = sessionData?.session?.user?.id || null;

      const { data, error } = await supabase
        .from("user_documents")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: reviewerId,
        })
        .eq("id", documentId)
        .select();

      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async ({ documentId }) => {
      haptics.confirm();
      await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
      const previousLists = queryClient.getQueriesData({
        queryKey: APPROVALS_QUERY_KEYS.lists(),
      });

      // Optimistically update document verification status in cached lists
      queryClient.setQueriesData<ApprovalRequestListItem[]>(
        { queryKey: APPROVALS_QUERY_KEYS.lists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (!item.documents) return item;
            const updatedDocs = item.documents.map((doc) =>
              doc.id === documentId ? { ...doc, verification_status: "verified" as const } : doc
            );
            return { ...item, documents: updatedDocs };
          });
        }
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
    },
  });
}

/**
 * Mutation to reject an individual document with a required reason
 */
export function useRejectDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      rejectionReason,
      userId,
    }: {
      documentId: string;
      rejectionReason: string;
      userId?: string;
    }) => {
      if (!rejectionReason.trim()) {
        throw new Error("A rejection reason is required.");
      }

      // 1. Check if unified approval engine has a pending request for this document
      const { data: appReq } = await supabase
        .from("approval_requests")
        .select("id, version")
        .eq("type_key", "document_verify")
        .eq("subject_id", documentId)
        .eq("status", "pending")
        .maybeSingle();

      if (appReq) {
        const { data: sessionData } = await supabase.auth.getSession();
        const actorId = sessionData?.session?.user?.id || null;
        const res = await decideApproval(supabase, {
          request_id: appReq.id,
          decision: "reject",
          note: rejectionReason.trim(),
          expected_version: appReq.version,
          actor_id: actorId,
        });
        if (res.error) throw new Error(res.error);
        return res.data;
      }

      // 2. Direct document rejection update
      const { data: sessionData } = await supabase.auth.getSession();
      const reviewerId = sessionData?.session?.user?.id || null;

      const { data, error } = await supabase
        .from("user_documents")
        .update({
          verification_status: "rejected",
          rejection_reason: rejectionReason.trim(),
          verified_by: reviewerId,
        })
        .eq("id", documentId)
        .select();

      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async ({ documentId }) => {
      haptics.reject();
      await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
      const previousLists = queryClient.getQueriesData({
        queryKey: APPROVALS_QUERY_KEYS.lists(),
      });

      // Optimistically update document verification status in cached lists
      queryClient.setQueriesData<ApprovalRequestListItem[]>(
        { queryKey: APPROVALS_QUERY_KEYS.lists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (!item.documents) return item;
            const updatedDocs = item.documents.map((doc) =>
              doc.id === documentId ? { ...doc, verification_status: "rejected" as const } : doc
            );
            return { ...item, documents: updatedDocs };
          });
        }
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
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
export function useApprovalsRealtimeSync(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

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
  }, [queryClient, enabled]);
}
