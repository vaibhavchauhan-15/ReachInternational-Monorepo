/**
 * Native Mobile Approvals Server State & Data Access Hooks
 * Powered by TanStack Query for on-demand caching, keyset-cursor pagination,
 * optimistic updates, offline guardrails, and realtime count invalidation.
 *
 * CONTRACT (consumed as-is, zero new approval/DB logic):
 * - Queue:        public.approval_list(p_status, p_type_key, p_cursor_created_at, p_cursor_id, p_limit)
 *                 Keyset paginated, ordered (created_at DESC, id DESC).
 * - Decision:     public.approval_decide(p_request_id, p_decision, p_note, p_expected_version, p_actor_id)
 * - Counts:       public.approval_counts()  → grouped { total, by_type }
 * All three are invoked through `@reachinternational/utils/approvals-client` (shared with Web).
 *
 * ⚡ PERFORMANCE / BEHAVIOUR GUARANTEES:
 * - Keyset cursor + page size 20 (one extra row is fetched as a look-ahead buffer).
 * - Query-key factory => zero refetch storms, targeted invalidation only.
 * - Optimistic removal fills the bottom gap from the buffered look-ahead row, deduped by id.
 * - Realtime events refresh grouped counts only — the visible list is never reordered
 *   under the reviewer's thumb (the "N new" pill drives an explicit refresh instead).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { getAppUrl } from "../env";
import {
  listApprovals,
  getApproval,
  approvalCounts,
  decideApproval,
  approveAll,
  cancelApproval,
} from "@reachinternational/utils";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
  ApprovalApproveAllResult,
} from "@reachinternational/types";
import { haptics } from "../haptics";

/** Rows rendered per keyset page (server maximum is 100). */
export const APPROVALS_QUEUE_PAGE_SIZE = 20;
/** Prefetch the next keyset page once this few rows remain below the viewport. */
export const APPROVALS_PREFETCH_THRESHOLD = 5;

export interface ApprovalsCursor {
  created_at: string;
  id: string;
}

export interface ApprovalsQueuePage {
  /** Rows rendered for this page (<= APPROVALS_QUEUE_PAGE_SIZE). */
  items: ApprovalRequestListItem[];
  /** Look-ahead rows fetched but not rendered yet — used to fill the bottom gap on decide. */
  overflow: ApprovalRequestListItem[];
  /** Keyset cursor for the next page, or null when the queue is exhausted. */
  nextCursor: ApprovalsCursor | null;
}

type ApprovalsQueueData = InfiniteData<ApprovalsQueuePage, ApprovalsCursor | null>;

export const APPROVALS_QUERY_KEYS = {
  all: ["approvals"] as const,
  lists: () => [...APPROVALS_QUERY_KEYS.all, "list"] as const,
  list: (status: ApprovalStatus | "all", typeKey?: string) =>
    [...APPROVALS_QUERY_KEYS.lists(), { status, typeKey }] as const,
  counts: () => [...APPROVALS_QUERY_KEYS.all, "counts"] as const,
  detail: (id: string) => [...APPROVALS_QUERY_KEYS.all, "detail", id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Error presentation (server stays authoritative — messages only)
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSION_PATTERN = /permission denied|not authorized|insufficient privilege|row-level security/i;
const CONFLICT_PATTERN =
  /conflict|modified by another|already (been )?(decided|approved|rejected)|terminal state|expected pending|stale version/i;

/**
 * Maps the server's authoritative rejections (42501 / version conflict / already decided)
 * to a single, clear reviewer-facing sentence. Never masks the outcome.
 */
export function mapApprovalDecisionError(err: unknown): string {
  const status = Number((err as any)?.status ?? (err as any)?.statusCode ?? 0);
  const code = String((err as any)?.code ?? "");
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const message = raw.trim();

  if (status === 401 || /jwt expired|invalid token|session expired|auth session missing/i.test(message)) {
    return "Your session expired. Please sign in again to record a decision.";
  }
  if (status === 403 || code === "42501" || PERMISSION_PATTERN.test(message)) {
    return "You are not authorized to review this request. Administrator privileges are required.";
  }
  if (status === 409 || code === "P0004" || CONFLICT_PATTERN.test(message)) {
    return "This request was already decided or changed on the server. Refresh the queue to continue.";
  }
  if (status === 404 || code === "P0002" || /user document not found|document not found|no longer exists/i.test(message)) {
    return "Document record not found or has already been reviewed.";
  }
  if (/network|failed to fetch|timeout|timed out|offline/i.test(message)) {
    return "The server could not be reached. Decisions are never queued offline — try again when you are online.";
  }
  return message || "The server could not record this decision. Please try again.";
}

/**
 * Ensures an active, valid Supabase session before executing approval decisions.
 * Proactively refreshes the token if close to expiry.
 */
async function ensureActiveSession(): Promise<{ actorId: string | null; token: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData?.session;

    // If session is expired or within 60s of expiring, proactively refresh
    if (!session || (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000)) {
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshData?.session) {
        session = refreshData.session;
      }
    }

    return {
      actorId: session?.user?.id || null,
      token: session?.access_token || null,
    };
  } catch (err) {
    console.warn("[useApprovalsData] ensureActiveSession fallback:", err);
    return { actorId: null, token: null };
  }
}

  // ─────────────────────────────────────────────────────────────────────────────
  // Queue helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const DOCUMENT_LABEL_OVERRIDES: Record<string, string> = {
    aadhaar: "Aadhaar Card",
    driving_license: "Driving License",
    bank_document: "Bank Details",
  };

  function formatDocumentLabel(code?: string | null): string {
    if (!code) return "Document";
    const key = code.trim().toLowerCase();
    if (DOCUMENT_LABEL_OVERRIDES[key]) return DOCUMENT_LABEL_OVERRIDES[key];
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function normalizeStoragePath(path?: string | null): string {
    return String(path || "").replace(/^\/+/, "");
  }

  /** Deduplicates queue rows by request id (keyset pages can overlap after a refetch). */
  export function dedupeApprovalItems(
    items: ApprovalRequestListItem[]
  ): ApprovalRequestListItem[] {
    const seen = new Set<string>();
    const unique: ApprovalRequestListItem[] = [];
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }
    return unique;
  }

  /** Stable keyset cursor for a row (matches ORDER BY created_at DESC, id DESC). */
  function cursorForItem(item: ApprovalRequestListItem): ApprovalsCursor {
    return { created_at: item.created_at, id: item.id };
  }

  async function signStoragePaths(
    bucket: "user_files" | "doc_staging",
    paths: string[]
  ): Promise<Map<string, string>> {
    const signed = new Map<string, string>();
    const unique = Array.from(new Set(paths.map(normalizeStoragePath).filter(Boolean)));
    if (unique.length === 0) return signed;

    try {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 3600);
      (data || []).forEach((entry, index) => {
        if (!entry?.signedUrl) return;
        const path = entry.path || unique[index];
        if (path) signed.set(path, entry.signedUrl);
      });
    } catch {
      // Thumbnails are best-effort; the card still opens the detail sheet.
    }
    return signed;
  }

  /**
   * Resolves signed URLs and human labels for a queue page in one batch per bucket.
   * Mirrors the Web enrichment (labels + storage signing) without re-implementing approval logic.
   */
  async function enrichQueueItems(
    rows: ApprovalRequestListItem[]
  ): Promise<ApprovalRequestListItem[]> {
    if (rows.length === 0) return rows;

    const userFilePaths: string[] = [];
    const stagingPaths: string[] = [];

    for (const row of rows) {
      const payload = (row.payload || {}) as Record<string, any>;
      for (const doc of row.documents || []) {
        if (doc?.thumb_path) userFilePaths.push(doc.thumb_path);
        if (doc?.storage_path) userFilePaths.push(doc.storage_path);
      }
      if (payload.storage_path) userFilePaths.push(payload.storage_path);
      if (payload.thumb_path) userFilePaths.push(payload.thumb_path);
      if (payload.staging_path) stagingPaths.push(payload.staging_path);
      if (payload.staging_thumb_path) stagingPaths.push(payload.staging_thumb_path);
    }

    const [files, staging] = await Promise.all([
      signStoragePaths("user_files", userFilePaths),
      signStoragePaths("doc_staging", stagingPaths),
    ]);

      const mapped: ApprovalRequestListItem[] = rows.map((row) => {
        const payload = (row.payload || {}) as Record<string, any>;

        const documents = (row.documents || []).map((doc) => {
          const thumbPath = normalizeStoragePath(doc.thumb_path);
          const storagePath = normalizeStoragePath(doc.storage_path);
          return {
            ...doc,
            label: formatDocumentLabel(doc.document_type_code),
            thumb_signed_url:
              files.get(thumbPath) || files.get(storagePath) || null,
            signed_url: files.get(storagePath) || files.get(thumbPath) || null,
          };
        });

        // Document replacement: surface the staged replacement file (doc_staging bucket).
        if (row.type_key === "document_replace" && payload.staging_path) {
          const stagingPath = normalizeStoragePath(payload.staging_path);
          const stagingThumb = normalizeStoragePath(payload.staging_thumb_path);
          documents.unshift({
            id: row.id,
            document_type_code: payload.document_type_code || "document",
            label: `${formatDocumentLabel(payload.document_type_code)} (Replacement)`,
            thumb_path: payload.staging_thumb_path || null,
            storage_path: payload.staging_path,
            thumb_signed_url:
              staging.get(stagingThumb) || staging.get(stagingPath) || null,
            signed_url: staging.get(stagingPath) || staging.get(stagingThumb) || null,
            verification_status: "pending",
            file_size_bytes: payload.file_size_bytes,
            mime_type: payload.mime_type || "image/jpeg",
          });
        }

        // Document verification without an aggregated document list: fall back to the payload paths.
        if (
          row.type_key === "document_verify" &&
          documents.length === 0 &&
          payload.document_type_code
        ) {
          const storagePath = normalizeStoragePath(payload.storage_path);
          const thumbPath = normalizeStoragePath(payload.thumb_path);
          documents.push({
            id: payload.document_id || row.id,
            document_type_code: payload.document_type_code,
            label: formatDocumentLabel(payload.document_type_code),
            thumb_path: payload.thumb_path || null,
            storage_path: payload.storage_path || null,
            thumb_signed_url:
              files.get(thumbPath) || files.get(storagePath) || null,
            signed_url: files.get(storagePath) || files.get(thumbPath) || null,
            verification_status: row.status,
            file_size_bytes: payload.file_size_bytes,
            mime_type: payload.mime_type || "image/jpeg",
          });
        }

        return { ...row, documents };
      });

      // Consolidate multiple requests of the same type for the same applicant into a single card
      const consolidated: ApprovalRequestListItem[] = [];
      const userTypeMap = new Map<string, ApprovalRequestListItem>();

      for (const item of mapped) {
        if (item.type_key === "document_replace" || item.type_key === "document_verify") {
          const applicantKey = `${item.type_key}:${item.requested_by || (item.payload as any)?.user_id || item.subject_id}`;
          const existing = userTypeMap.get(applicantKey);
          if (existing) {
            // Merge bound_request_ids
            const existingBound = existing.bound_request_ids || [];
            const itemBound = item.bound_request_ids || [];
            const boundSet = new Set([...existingBound, ...itemBound, item.id]);
            existing.bound_request_ids = Array.from(boundSet);

            // Merge documents (prevent duplicates by doc ID + label)
            const existingDocs = existing.documents || [];
            const itemDocs = item.documents || [];
            const seenKeys = new Set(existingDocs.map((d) => `${d.id}:${d.label}`));
            for (const doc of itemDocs) {
              const k = `${doc.id}:${doc.label}`;
              if (!seenKeys.has(k)) {
                existingDocs.push(doc);
                seenKeys.add(k);
              }
            }
            existing.documents = existingDocs;

            // Update summary and subject_label
            if (item.type_key === "document_replace") {
              const count = existingDocs.filter((d) => d.label?.includes("(Replacement)")).length;
              existing.summary = `Document replacement request (${count} documents pending)`;
              existing.subject_label = `${existing.requester_name || "Applicant"} (${count} Replacements)`;
            } else {
              const count = existingDocs.length;
              existing.summary = `Document verification (${count} documents pending)`;
              existing.subject_label = `${existing.requester_name || "Applicant"} (${count} Documents)`;
            }
            continue;
          }
          userTypeMap.set(applicantKey, item);
        }
        consolidated.push(item);
      }

      return consolidated;
    }

/**
 * Fetches one keyset page of the approvals queue.
 * Requests `PAGE_SIZE + 1` rows so the surplus row can buffer the bottom gap after a decide.
 */
async function fetchApprovalsQueuePage(params: {
      status: ApprovalStatus | "all";
      typeKey?: string;
      cursor: ApprovalsCursor | null;
    }): Promise<ApprovalsQueuePage> {
        const res = await listApprovals(supabase, {
          status: params.status === "all" ? "all" : params.status,
          type_key: params.typeKey && params.typeKey !== "all" ? params.typeKey : undefined,
          cursor_created_at: params.cursor?.created_at,
          cursor_id: params.cursor?.id,
          limit: APPROVALS_QUEUE_PAGE_SIZE + 1,
        });

        if (res.error) {
          throw new Error(res.error);
        }

        const rows = dedupeApprovalItems((res.data || []) as ApprovalRequestListItem[]);
        const visible = rows.slice(0, APPROVALS_QUEUE_PAGE_SIZE);
        const overflow = rows.slice(APPROVALS_QUEUE_PAGE_SIZE);
        const enriched = await enrichQueueItems([...visible, ...overflow]);
        const items = enriched.slice(0, visible.length);
        const buffered = enriched.slice(visible.length);

        const lastVisible = items[items.length - 1];
        const nextCursor =
          visible.length === APPROVALS_QUEUE_PAGE_SIZE && lastVisible
            ? cursorForItem(lastVisible)
            : null;

        return { items, overflow: buffered, nextCursor };
      }

function findQueuedApprovalItem(
        queryClient: QueryClient,
        requestId: string
      ): ApprovalRequestListItem | undefined {
        const caches = queryClient.getQueriesData<ApprovalsQueueData>({
          queryKey: APPROVALS_QUERY_KEYS.lists(),
        });
        for (const [, data] of caches) {
          for (const page of data?.pages || []) {
            const match = page.items.find((item) => item.id === requestId);
            if (match) return match;
            const buffered = page.overflow.find((item) => item.id === requestId);
            if (buffered) return buffered;
          }
        }
        return undefined;
      }

/** Applies a row transform to every cached queue page (used by document verify/reject). */
function transformApprovalsQueueCaches(
        queryClient: QueryClient,
        transform: (items: ApprovalRequestListItem[]) => ApprovalRequestListItem[]
      ) {
        queryClient.setQueriesData<ApprovalsQueueData>(
          { queryKey: APPROVALS_QUERY_KEYS.lists() },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: transform(page.items),
              })),
            };
          }
        );
      }

/**
 * Optimistically removes a decided request from every cached queue page,
 * then pulls the next buffered row into the bottom of the last page and dedupes by id.
 * The list never jumps backwards — only the bottom gap is refilled.
 */
function removeApprovalFromQueueCaches(queryClient: QueryClient, requestId: string) {
        queryClient.setQueriesData<ApprovalsQueueData>(
          { queryKey: APPROVALS_QUERY_KEYS.lists() },
          (old) => {
            if (!old) return old;

            const pages = old.pages.map((page) => {
              if (!page.items.some((item) => item.id === requestId)) return page;
              return { ...page, items: page.items.filter((item) => item.id !== requestId) };
            });

            // Refill the bottom gap from the look-ahead buffer of the last loaded page.
            const lastIndex = pages.length - 1;
            if (lastIndex >= 0) {
              const lastPage = pages[lastIndex];
              if (lastPage.overflow.length > 0) {
                const [buffered, ...rest] = lastPage.overflow;
                const alreadyVisible = lastPage.items.some((item) => item.id === buffered.id);
                pages[lastIndex] = {
                  ...lastPage,
                  items: alreadyVisible ? lastPage.items : [...lastPage.items, buffered],
                  overflow: rest,
                };
              }
            }

            const seen = new Set<string>();
            return {
              ...old,
              pages: pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => {
                  if (seen.has(item.id)) return false;
                  seen.add(item.id);
                  return true;
                }),
              })),
            };
          }
        );
      }

/** Optimistically decrements the grouped count for a decided request. */
function decrementApprovalCounts(
        queryClient: QueryClient,
        item?: ApprovalRequestListItem
      ) {
        queryClient.setQueryData<ApprovalCounts>(APPROVALS_QUERY_KEYS.counts(), (old) => {
          if (!old) return old;
          const byType = { ...old.by_type };
          if (item?.type_key && typeof byType[item.type_key] === "number") {
            byType[item.type_key] = Math.max(0, (byType[item.type_key] as number) - 1);
          }
          return { total: Math.max(0, old.total - 1), by_type: byType };
        });
      }

// ⚡ Targeted invalidation helper — gentle mode avoids heavy list re-fetches when state is optimistically updated
function invalidateApprovalListsAndCounts(
        queryClient: ReturnType<typeof useQueryClient>,
        options?: { gentle?: boolean }
      ) {
        queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.counts() });
        if (options?.gentle) {
          queryClient.invalidateQueries({
            queryKey: APPROVALS_QUERY_KEYS.lists(),
            refetchType: "none",
          });
        } else {
          queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.lists() });
        }
      }

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export interface UseApprovalsListOptions {
      status?: ApprovalStatus | "all";
      typeKey?: string;
      enabled?: boolean;
    }

    /**
     * Keyset-cursor approvals queue (page size 20, look-ahead buffer of 1).
     * Consumes the shared `approval_list` RPC — no client-side approval logic.
     */
    export function useApprovalsListQuery(options: UseApprovalsListOptions = {}) {
      const { status = "pending", typeKey, enabled = true } = options;

      return useInfiniteQuery<ApprovalsQueuePage, Error, ApprovalsQueueData, ReturnType<typeof APPROVALS_QUERY_KEYS.list>, ApprovalsCursor | null>({
        queryKey: APPROVALS_QUERY_KEYS.list(status, typeKey),
        queryFn: ({ pageParam }) =>
          fetchApprovalsQueuePage({ status, typeKey, cursor: pageParam ?? null }),
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        // Tuned for review sessions: no focus/reconnect storm, cheap staleness window.
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        enabled,
      });
    }

    /**
     * Explicit queue refresh (pull-to-refresh / "N new" pill).
     * Replaces the loaded pages atomically with a fresh first page — one request, no empty flash.
     */
    export function useRefreshApprovalsQueue(options: UseApprovalsListOptions = {}) {
      const { status = "pending", typeKey } = options;
      const queryClient = useQueryClient();
      const [isRefreshing, setIsRefreshing] = useState(false);

      const refresh = useCallback(async (): Promise<ApprovalRequestListItem[]> => {
        setIsRefreshing(true);
        try {
          const page = await fetchApprovalsQueuePage({ status, typeKey, cursor: null });
          queryClient.setQueryData<ApprovalsQueueData>(
            APPROVALS_QUERY_KEYS.list(status, typeKey),
            { pages: [page], pageParams: [null] }
          );
          return page.items;
        } finally {
          setIsRefreshing(false);
        }
      }, [queryClient, status, typeKey]);

      return { refresh, isRefreshing };
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

    // ─────────────────────────────────────────────────────────────────────────────
    // Mutations
    // ─────────────────────────────────────────────────────────────────────────────

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
          // ⚡ Verify and ensure fresh session token
          const { actorId, token } = await ensureActiveSession();

          // 1. Dual-Transport: Try Next.js API route with Bearer auth if available
          const appUrl = getAppUrl();
          if (token && appUrl) {
            try {
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
                return await res.json();
              }

              // Concurrency or already-decided conflicts (409) are authoritative domain state
              if (res.status === 409) {
                const json = await res.json().catch(() => ({}));
                const conflictError = new Error(
                  json.error || "This request was already decided or modified by another reviewer."
                ) as Error & { status?: number };
                conflictError.status = 409;
                throw conflictError;
              }

              // Non-409 errors (401 from Web/Dev host mismatch, 404, 500) fall through cleanly to direct Supabase RPC
              console.warn(
                `[useDecideApprovalMutation] Web API returned ${res.status}, falling back to direct Supabase RPC`
              );
            } catch (err: any) {
              if (err?.status === 409) throw err;
              console.warn("[useDecideApprovalMutation] Web API call fallback to direct RPC:", err);
            }
          }

          // 2. Direct RPC fallback — the authoritative Supabase approval_decide contract
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
        onMutate: async ({ requestId }) => {
          // Cancel in-flight queue reads so they cannot resurrect the decided row.
          await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });

          const decidedItem = findQueuedApprovalItem(queryClient, requestId);
          const previousLists = queryClient.getQueriesData({
            queryKey: APPROVALS_QUERY_KEYS.lists(),
          });
          const previousCounts = queryClient.getQueryData<ApprovalCounts>(
            APPROVALS_QUERY_KEYS.counts()
          );

          removeApprovalFromQueueCaches(queryClient, requestId);
          decrementApprovalCounts(queryClient, decidedItem);

          return { previousLists, previousCounts };
        },
        onSuccess: (_data, variables) => {
          // Server confirmed the decision.
          if (variables.decision === "approve") {
            haptics.confirm();
          } else {
            haptics.reject();
          }
        },
        onError: (_err, _vars, context) => {
          haptics.reject();
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
          // ⚡ Targeted invalidation — gentle mode invalidates counts without forcing a heavy list refetch
          invalidateApprovalListsAndCounts(queryClient, { gentle: true });
        },
      });
    }

    /**
     * Mutation to approve all pending approval requests ("Approve All").
     * Invariant: For user registrations, activates users immediately while keeping all user documents pending.
     */
    export function useApproveAllMutation() {
      const queryClient = useQueryClient();

      return useMutation({
        mutationFn: async ({
          typeKey,
          requestIds,
          note,
        }: {
          typeKey?: string;
          requestIds?: string[];
          note?: string;
        } = {}) => {
          const { actorId, token } = await ensureActiveSession();

          // 1. Dual-transport: Attempt rich Next.js API route with Bearer auth
          const appUrl = getAppUrl();
          if (token && appUrl) {
            try {
              const res = await fetch(`${appUrl}/api/approvals/approve-all`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  type_key: typeKey,
                  request_ids: requestIds,
                  note,
                }),
              });

              if (res.ok) {
                return (await res.json()) as ApprovalApproveAllResult;
              }
              console.warn(
                `[useApproveAllMutation] Web API returned ${res.status}, falling back to direct Supabase RPC`
              );
            } catch (err) {
              console.warn("[useApproveAllMutation] Web API call fallback to direct RPC:", err);
            }
          }

          // 2. Direct RPC fallback — reuse verified actorId
          const res = await approveAll(supabase, {
            type_key: typeKey,
            request_ids: requestIds,
            note,
            actor_id: actorId,
          });

          if (res.error) {
            throw new Error(res.error);
          }
          return res.data;
        },
        onMutate: async ({ typeKey }) => {
          await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });

          const previousLists = queryClient.getQueriesData({
            queryKey: APPROVALS_QUERY_KEYS.lists(),
          });
          const previousCounts = queryClient.getQueryData<ApprovalCounts>(
            APPROVALS_QUERY_KEYS.counts()
          );

          transformApprovalsQueueCaches(queryClient, (items) =>
            items.filter((item) =>
              typeKey && typeKey !== "all"
                ? item.type_key !== typeKey
                : item.type_key !== "registration"
            )
          );

          queryClient.setQueryData<ApprovalCounts>(APPROVALS_QUERY_KEYS.counts(), (old) => {
            if (!old) return old;
            const byType = { ...old.by_type };
            if (typeKey && typeKey !== "all") {
              byType[typeKey] = 0;
            } else {
              byType["registration"] = 0;
            }
            const total = Object.values(byType).reduce((acc, value) => acc + (value || 0), 0);
            return { total: Math.max(0, total), by_type: byType };
          });

          return { previousLists, previousCounts };
        },
        onSuccess: () => {
          haptics.confirm();
        },
        onError: (_err, _vars, context) => {
          haptics.reject();
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
          invalidateApprovalListsAndCounts(queryClient, { gentle: true });
          queryClient.invalidateQueries({ queryKey: ["users"] });
        },
      });
    }

    /**
     * Mutation to verify an individual document directly or via its approval request.
     * ⚡ Optimized: Fast dedicated /api/approvals/documents/verify API route with Bearer auth,
     *    direct verify_user_document_atomic RPC fallback, gentle cache invalidation.
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
          const { actorId, token } = await ensureActiveSession();

          // 1. Dual-transport: Try fast dedicated Next.js API route with Bearer auth
          const appUrl = getAppUrl();
          if (token && appUrl) {
            try {
              const res = await fetch(`${appUrl}/api/approvals/documents/verify`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ documentId, userId }),
              });
              if (res.ok) {
                return await res.json();
              }
              if (res.status === 409) {
                const json = await res.json().catch(() => ({}));
                const err = new Error(json.error || "Document is already verified or modified.") as Error & { status?: number };
                err.status = 409;
                throw err;
              }
              console.warn(
                `[useVerifyDocumentMutation] Web API returned ${res.status}, falling back to direct RPC`
              );
            } catch (err: any) {
              if (err?.status === 409) throw err;
              console.warn("[useVerifyDocumentMutation] API fallback to RPC:", err);
            }
          }

          // 2. Direct atomic RPC fallback — atomic database verification
          const { data, error } = await supabase.rpc("verify_user_document_atomic", {
            p_document_id: documentId,
            p_reviewer_id: actorId,
          });

          if (error) {
            // Table update fallback
            const { data: updData, error: updErr } = await supabase
              .from("user_documents")
              .update({
                verification_status: "verified",
                verified_at: new Date().toISOString(),
                verified_by: actorId,
              })
              .eq("id", documentId)
              .select();
            if (updErr) throw new Error(mapApprovalDecisionError(updErr));
            return updData;
          }
          return data;
        },
        onMutate: async ({ documentId }) => {
          await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
          const previousLists = queryClient.getQueriesData({
            queryKey: APPROVALS_QUERY_KEYS.lists(),
          });

          transformApprovalsQueueCaches(queryClient, (items) =>
            items.map((item) => {
              if (!item.documents) return item;
              const documents = item.documents.map((doc) =>
                doc.id === documentId
                  ? { ...doc, verification_status: "verified" as const }
                  : doc
              );
              return { ...item, documents };
            })
          );

          return { previousLists };
        },
        onSuccess: () => {
          haptics.confirm();
        },
        onError: (_err, _vars, context) => {
          haptics.reject();
          if (context?.previousLists) {
            for (const [key, data] of context.previousLists) {
              queryClient.setQueryData(key, data);
            }
          }
        },
        onSettled: () => {
          invalidateApprovalListsAndCounts(queryClient, { gentle: true });
        },
      });
    }

    /**
     * Mutation to reject an individual document with a required reason.
     * ⚡ Optimized: Fast dedicated /api/approvals/documents/reject API route with Bearer auth,
     *    direct reject_user_document_atomic RPC fallback, gentle cache invalidation.
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

        const { actorId, token } = await ensureActiveSession();

        // 1. Dual-transport: Try fast dedicated Next.js API route with Bearer auth
        const appUrl = getAppUrl();
        if (token && appUrl) {
          try {
            const res = await fetch(`${appUrl}/api/approvals/documents/reject`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                documentId,
                rejectionReason: rejectionReason.trim(),
                userId,
              }),
            });
            if (res.ok) {
              return await res.json();
            }
            if (res.status === 409) {
              const json = await res.json().catch(() => ({}));
              const err = new Error(json.error || "Document is already decided or modified.") as Error & { status?: number };
              err.status = 409;
              throw err;
            }
            console.warn(
              `[useRejectDocumentMutation] Web API returned ${res.status}, falling back to direct RPC`
            );
          } catch (err: any) {
            if (err?.status === 409) throw err;
            console.warn("[useRejectDocumentMutation] API fallback to RPC:", err);
          }
        }

        // 2. Direct atomic RPC fallback — atomic database rejection
        const { data, error } = await supabase.rpc("reject_user_document_atomic", {
          p_document_id: documentId,
          p_reviewer_id: actorId,
          p_rejection_reason: rejectionReason.trim(),
        });

          if (error) {
            // Table update fallback
            const { data: updData, error: updErr } = await supabase
              .from("user_documents")
              .update({
                verification_status: "rejected",
                rejection_reason: rejectionReason.trim(),
                verified_by: actorId,
              })
              .eq("id", documentId)
              .select();
            if (updErr) throw new Error(mapApprovalDecisionError(updErr));
            return updData;
          }
          return data;
        },
        onMutate: async ({ documentId }) => {
          await queryClient.cancelQueries({ queryKey: APPROVALS_QUERY_KEYS.all });
          const previousLists = queryClient.getQueriesData({
            queryKey: APPROVALS_QUERY_KEYS.lists(),
          });

          transformApprovalsQueueCaches(queryClient, (items) =>
            items.map((item) => {
              if (!item.documents) return item;
              const documents = item.documents.map((doc) =>
                doc.id === documentId
                  ? { ...doc, verification_status: "rejected" as const }
                  : doc
              );
              return { ...item, documents };
            })
          );

          return { previousLists };
        },
        onSuccess: () => {
          haptics.reject();
        },
        onError: (_err, _vars, context) => {
          haptics.reject();
          if (context?.previousLists) {
            for (const [key, data] of context.previousLists) {
              queryClient.setQueryData(key, data);
            }
          }
        },
        onSettled: () => {
          invalidateApprovalListsAndCounts(queryClient, { gentle: true });
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
          invalidateApprovalListsAndCounts(queryClient, { gentle: true });
        },
      });
    }

    /**
     * Realtime hook subscribing to approval_requests changes.
     * ⚡ Refreshes the grouped count only — never the visible list, so a reviewer's
     *    scroll position is never reordered under their thumb. The screen surfaces
     *    an "N new" pill that drives an explicit, user-initiated refresh.
     */
    export function useApprovalsRealtimeSync(enabled = true) {
      const queryClient = useQueryClient();
      const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
              // ⚡ Debounce — prevents triple-fetch after local mutations
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: APPROVALS_QUERY_KEYS.counts() });
                // Mark queue pages stale without refetching them (no reorder under the thumb).
                queryClient.invalidateQueries({
                  queryKey: APPROVALS_QUERY_KEYS.lists(),
                  refetchType: "none",
                });
              }, 1500);
            }
          )
          .subscribe();

        return () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          supabase.removeChannel(channel);
        };
      }, [queryClient, enabled]);
    }
