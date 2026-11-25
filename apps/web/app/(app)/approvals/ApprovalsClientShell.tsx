"use client";

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef,
} from "react";
import type {
  ApprovalCounts,
  ApprovalRequestListItem,
  ApprovalStatus,
  AttachedDocumentSummary,
  ApprovalCursor,
} from "@reachinternational/types";
import type { User } from "@/lib/types/database";
import { ApprovalRow } from "./components/ApprovalRow";
import { ApprovalDetailPanel } from "./components/ApprovalDetailPanel";
import { DocumentLightboxModal } from "./components/DocumentLightboxModal";
import { ApprovalRejectModal } from "./components/ApprovalRejectModal";
import { ApproveAllConfirmModal } from "./components/ApproveAllConfirmModal";
import {
  decideApprovalAction,
  approveAllAction,
  getApprovalsListPageAction,
} from "@/app/actions/approvals";
import {
  verifyUserDocumentAction,
  rejectUserDocumentAction,
} from "@/app/actions/documents";
import { canDecideApproval } from "@reachinternational/permissions";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";
import {
  CheckCircle2,
  CheckCheck,
  AlertCircle,
  Loader2,
  Inbox,
  X,
  RotateCcw,
  Check,
  ChevronDown,
  Layers,
  UserPlus,
  FileCheck2,
  RefreshCw,
  UserCog,
  ShieldAlert,
  AlertTriangle,
  ArrowUp,
  Sparkles,
} from "lucide-react";

export interface ApprovalsClientShellProps {
  currentUser: User;
  initialItems: ApprovalRequestListItem[];
  initialCursor?: ApprovalCursor | null;
  initialHasMore?: boolean;
  initialPendingTotal?: number;
  initialCounts: ApprovalCounts;
  initialStatus?: ApprovalStatus | "all";
  initialType?: string;
  selectedRequestId?: string | null;
}

const STATUS_FILTER_OPTIONS: Array<{
  id: ApprovalStatus | "all";
  label: string;
  dotColor: string;
}> = [
  {
    id: "pending",
    label: "Pending",
    dotColor: "bg-amber-500",
  },
  {
    id: "approved",
    label: "Approved",
    dotColor: "bg-emerald-500",
  },
  {
    id: "rejected",
    label: "Rejected",
    dotColor: "bg-red-500",
  },
  {
    id: "all",
    label: "All Statuses",
    dotColor: "bg-neutral-400",
  },
];

const TYPE_FILTER_OPTIONS: Array<{
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "all", label: "All Request Types", icon: Layers },
  { id: "registration", label: "New Registrations", icon: UserPlus },
  { id: "document_verify", label: "Document Verifications", icon: FileCheck2 },
  { id: "document_replace", label: "Document Replacements", icon: RefreshCw },
  { id: "profile_change", label: "Profile Changes", icon: UserCog },
  { id: "account_deletion", label: "Account Deletions", icon: ShieldAlert },
  { id: "shift_conflict", label: "Shift Conflicts", icon: AlertTriangle },
];

/** Keyset page size for infinite scroll */
const PAGE_SIZE = 20;
/** Maximum rows rendered in the DOM before virtual windowing */
const VIRTUALIZATION_THRESHOLD = 200;

export function ApprovalsClientShell({
  currentUser,
  initialItems,
  initialCursor = null,
  initialHasMore = false,
  initialPendingTotal,
  initialCounts,
  initialStatus = "pending",
  initialType,
  selectedRequestId = null,
}: ApprovalsClientShellProps) {
  const prefersReducedMotion = useReducedMotion();

  // Navigation / Filter State
  const [status, setStatus] = useState<ApprovalStatus | "all">(initialStatus);
  const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data & Infinite Scroll State
  const [items, setItems] = useState<ApprovalRequestListItem[]>(initialItems);
  const [bufferItems, setBufferItems] = useState<ApprovalRequestListItem[]>([]);
  const [cursor, setCursor] = useState<ApprovalCursor | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [pendingTotal, setPendingTotal] = useState<number>(
    initialPendingTotal ?? initialItems.length
  );
  const [counts, setCounts] = useState<ApprovalCounts>(initialCounts);

  // Loading & Async Flags
  const [isPendingTransition, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Realtime "N new" pill state (never shifts active list)
  const [newIncomingCount, setNewIncomingCount] = useState<number>(0);

  // Sentinel ref for infinite scroll IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Stable refs for actions to avoid stale closures in callbacks
  const itemsRef = useRef(items);
  const bufferItemsRef = useRef(bufferItems);
  const cursorRef = useRef(cursor);
  const hasMoreRef = useRef(hasMore);
  const statusRef = useRef(status);
  const typeFilterRef = useRef(typeFilter);
  const isLoadingMoreRef = useRef(isLoadingMore);

  useEffect(() => {
    itemsRef.current = items;
    bufferItemsRef.current = bufferItems;
    cursorRef.current = cursor;
    hasMoreRef.current = hasMore;
    statusRef.current = status;
    typeFilterRef.current = typeFilter;
    isLoadingMoreRef.current = isLoadingMore;
  }, [items, bufferItems, cursor, hasMore, status, typeFilter, isLoadingMore]);

  // Deep-link auto-scroll when selectedRequestId is provided in searchParams
  useEffect(() => {
    if (!selectedRequestId) return;
    const el = document.getElementById(`approval-row-${selectedRequestId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedRequestId]);

  // ⚡ Debounced silent counts refresh
  const countsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCountsDebounced = useCallback(() => {
    if (countsRefreshTimerRef.current) {
      clearTimeout(countsRefreshTimerRef.current);
    }
    countsRefreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/approvals/counts");
        if (res.ok) {
          const countData = (await res.json()) as ApprovalCounts;
          if (countData) setCounts(countData);
        }
      } catch {
        // Non-blocking background revalidation
      }
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (countsRefreshTimerRef.current) {
        clearTimeout(countsRefreshTimerRef.current);
      }
    };
  }, []);

  // Document Lightbox Modal State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxDocument, setLightboxDocument] = useState<AttachedDocumentSummary | null>(null);
  const [lightboxUserName, setLightboxUserName] = useState<string | undefined>(undefined);
  const [lightboxUserId, setLightboxUserId] = useState<string | undefined>(undefined);

  // Detail Inspection Modal State
  const [detailModalRequest, setDetailModalRequest] = useState<ApprovalRequestListItem | null>(null);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<
    | { kind: "request"; requestId: string; summary: string; version?: number }
    | { kind: "document"; docId: string; userId: string; summary: string }
    | null
  >(null);

  // Per-request action loading states
  const [processingRequestIds, setProcessingRequestIds] = useState<
    Record<string, "approving" | "rejecting">
  >({});
  // Per-request exit animation transition state (150-250ms fade + collapse)
  const [exitStates, setExitStates] = useState<Record<string, "approved" | "rejected">>({});
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);

  // Bulk Approve All state
  const [approveAllModalOpen, setApproveAllModalOpen] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // Custom Dropdown Popover States
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Outside click & Escape listeners for custom dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(e.target as Node)
      ) {
        setTypeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatusDropdownOpen(false);
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (status !== "pending") count += 1;
    if (typeFilter !== "all") count += 1;
    if (searchQuery.trim() !== "") count += 1;
    return count;
  }, [status, typeFilter, searchQuery]);

  // ─── Fetch Helper: Reset & Load Page 1 on Filter Change ─────────────────
  const fetchListReset = useCallback(
    async (newStatus: ApprovalStatus | "all", newType: string) => {
      startTransition(async () => {
        setLoadError(null);
        setNewIncomingCount(0);
        try {
          const q = new URLSearchParams();
          if (newStatus !== "all") q.set("status", newStatus);
          if (newType !== "all") q.set("type_key", newType);
          q.set("limit", String(PAGE_SIZE));

          const [listRes, countRes] = await Promise.all([
            fetch(`/api/approvals?${q.toString()}`),
            fetch("/api/approvals/counts"),
          ]);

          if (listRes.ok) {
            const json = await listRes.json();
            const fetchedItems: ApprovalRequestListItem[] = Array.isArray(json)
              ? json
              : Array.isArray(json.items)
              ? json.items
              : [];
            setItems(fetchedItems);
            setBufferItems([]);
            setCursor(json.next_cursor || null);
            setHasMore(Boolean(json.has_more));
            setPendingTotal(
              typeof json.pending_total === "number"
                ? json.pending_total
                : fetchedItems.length
            );
          } else {
            const errJson = await listRes.json().catch(() => ({}));
            setLoadError(errJson.error || "Failed to load approval requests.");
          }

          if (countRes.ok) {
            const countData = (await countRes.json()) as ApprovalCounts;
            if (countData) setCounts(countData);
          }
        } catch (err) {
          setLoadError(sanitizeUserErrorMessage(err));
        }
      });
    },
    []
  );

  const handleStatusChange = (newStatus: ApprovalStatus | "all") => {
    setStatus(newStatus);
    fetchListReset(newStatus, typeFilter);
  };

  const handleTypeChange = (newType: string) => {
    setTypeFilter(newType);
    fetchListReset(status, newType);
  };

  const handleResetFilters = () => {
    setStatus("pending");
    setTypeFilter("all");
    setSearchQuery("");
    fetchListReset("pending", "all");
  };

  // ─── Infinite Scroll & Buffer Manager ──────────────────────────────────
  /**
   * Fetches the next page of rows from server into bufferItems or visibleItems.
   * If quiet=true, errors do not show full banners.
   */
  const fetchNextBatch = useCallback(async (quiet = false) => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const q = new URLSearchParams();
      if (statusRef.current !== "all") q.set("status", statusRef.current);
      if (typeFilterRef.current !== "all") q.set("type_key", typeFilterRef.current);
      q.set("cursor_created_at", cursorRef.current.created_at);
      q.set("cursor_id", cursorRef.current.id);
      q.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/approvals?${q.toString()}`);
      if (!res.ok) {
        // Fallback to Server Action
        const saResult = await getApprovalsListPageAction({
          status: statusRef.current,
          type_key: typeFilterRef.current !== "all" ? typeFilterRef.current : undefined,
          cursor_created_at: cursorRef.current.created_at,
          cursor_id: cursorRef.current.id,
          limit: PAGE_SIZE,
        });

        if (saResult.success && saResult.data) {
          const newRows = saResult.data.items || [];
          setCursor(saResult.data.next_cursor || null);
          setHasMore(Boolean(saResult.data.has_more));
          if (typeof saResult.data.pending_total === "number") {
            setPendingTotal(saResult.data.pending_total);
          }

          // Dedupe against visible items
          const existingIds = new Set(itemsRef.current.map((i) => i.id));
          const uniqueNew = newRows.filter((row) => !existingIds.has(row.id));

          setBufferItems((prev) => {
            const bufIds = new Set(prev.map((i) => i.id));
            const uniqueForBuffer = uniqueNew.filter((row) => !bufIds.has(row.id));
            return [...prev, ...uniqueForBuffer];
          });
          return;
        }

        if (!quiet) {
          setToastMessage({
            type: "error",
            text: "Could not load additional requests.",
          });
        }
        return;
      }

      const json = await res.json();
      const newRows: ApprovalRequestListItem[] = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : [];

      setCursor(json.next_cursor || null);
      setHasMore(Boolean(json.has_more));
      if (typeof json.pending_total === "number") {
        setPendingTotal(json.pending_total);
      }

      // Dedupe against currently visible items
      const existingIds = new Set(itemsRef.current.map((i) => i.id));
      const uniqueNew = newRows.filter((row) => !existingIds.has(row.id));

      setBufferItems((prev) => {
        const bufIds = new Set(prev.map((i) => i.id));
        const uniqueForBuffer = uniqueNew.filter((row) => !bufIds.has(row.id));
        return [...prev, ...uniqueForBuffer];
      });
    } catch {
      if (!quiet) {
        setToastMessage({
          type: "error",
          text: "Network error loading more requests.",
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // Pre-fetch lookahead buffer on mount if initial page is full and has more (once only)
  const hasPrefetchedLookaheadRef = useRef(false);
  useEffect(() => {
    if (initialHasMore && initialCursor && !hasPrefetchedLookaheadRef.current) {
      hasPrefetchedLookaheadRef.current = true;
      fetchNextBatch(true);
    }
  }, [initialHasMore, initialCursor, fetchNextBatch]);

  // ─── IntersectionObserver Sentinel with rootMargin Prefetch ────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        // If buffer has items, immediately shift up to PAGE_SIZE items into visible list
        if (bufferItemsRef.current.length > 0) {
          const sliceSize = Math.min(PAGE_SIZE, bufferItemsRef.current.length);
          const toAdd = bufferItemsRef.current.slice(0, sliceSize);
          const remainingBuffer = bufferItemsRef.current.slice(sliceSize);

          setItems((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const unique = toAdd.filter((item) => !seen.has(item.id));
            return [...prev, ...unique];
          });
          setBufferItems(remainingBuffer);

          // If remaining buffer is low, quietly prefetch next page
          if (remainingBuffer.length < 5 && hasMoreRef.current) {
            fetchNextBatch(true);
          }
        } else if (hasMoreRef.current && !isLoadingMoreRef.current) {
          // Buffer is empty: fetch next batch directly
          fetchNextBatch(false);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextBatch]);

  // ─── Realtime Subscription (DB-Authoritative, Zero List Shift) ──────────
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("approvals_queue_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "approval_requests" },
        (payload: any) => {
          const newRow = payload.new as any;
          // Only top-level pending items trigger notifications
          if (newRow && !newRow.parent_id && newRow.status === "pending") {
            const matchesType =
              typeFilterRef.current === "all" ||
              newRow.type_key === typeFilterRef.current;
            const matchesStatus =
              statusRef.current === "all" || statusRef.current === "pending";

            if (matchesType && matchesStatus) {
              setNewIncomingCount((prev) => prev + 1);
            }
            refreshCountsDebounced();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "approval_requests" },
        (payload: any) => {
          const updatedRow = payload.new as any;
          if (
            updatedRow &&
            (updatedRow.status === "approved" || updatedRow.status === "rejected")
          ) {
            // If someone else decided a request that is currently in view:
            setItems((prev) => {
              const match = prev.find((i) => i.id === updatedRow.id);
              if (match && match.status === "pending") {
                setToastMessage({
                  type: "info",
                  text: `Request for ${
                    match.requester_name || match.subject_label || "applicant"
                  } was decided by another administrator.`,
                });
                return prev.filter((i) => i.id !== updatedRow.id);
              }
              return prev;
            });
            refreshCountsDebounced();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshCountsDebounced]);

  // Action: User clicks the Realtime "N new requests available" floating pill
  const handleLoadNewRealtimeItems = useCallback(() => {
    setNewIncomingCount(0);
    fetchListReset(status, typeFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchListReset, status, typeFilter]);

  // ─── Memory Search Filter & Virtualization Safeguard ───────────────────
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((i) => {
      const summaryMatch = i.summary.toLowerCase().includes(q);
      const nameMatch = i.requester_name?.toLowerCase().includes(q);
      const labelMatch = i.subject_label?.toLowerCase().includes(q);
      const emailMatch = i.email?.toLowerCase().includes(q);
      const phoneMatch = i.phone?.toLowerCase().includes(q);
      const empIdMatch = i.employee_id?.toLowerCase().includes(q);
      const roleMatch = i.role?.toLowerCase().includes(q);
      return (
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

  // Windowed render if list grows past threshold
  const visibleRenderedItems = useMemo(() => {
    if (filteredItems.length > VIRTUALIZATION_THRESHOLD) {
      return filteredItems.slice(0, VIRTUALIZATION_THRESHOLD);
    }
    return filteredItems;
  }, [filteredItems]);

  // Open Document Lightbox
  const handleOpenDocumentLightbox = useCallback(
    (doc: AttachedDocumentSummary, userName?: string, userId?: string) => {
      setLightboxDocument(doc);
      setLightboxUserName(userName);
      setLightboxUserId(userId);
      setLightboxOpen(true);
    },
    []
  );

  // ─── Action: Approve Request (Optimistic Collapse + Bottom Buffer Append) ──
  const handleApproveRequest = useCallback(
    async (requestId: string) => {
      if (processingRequestIds[requestId]) return;
      setToastMessage(null);

      const targetItem = itemsRef.current.find((i) => i.id === requestId);
      const prevItems = itemsRef.current;
      const prevCounts = { ...counts, by_type: { ...counts.by_type } };
      const idempotencyKey = crypto.randomUUID();

      // ⚡ INSTANT OPTIMISTIC UI: Trigger exit transition and decrement counts
      if (statusRef.current === "pending") {
        setExitStates((prev) => ({ ...prev, [requestId]: "approved" }));
        if (targetItem) {
          setCounts((prev) => {
            const newByType = { ...prev.by_type };
            if (newByType[targetItem.type_key]) {
              newByType[targetItem.type_key] = Math.max(
                0,
                newByType[targetItem.type_key] - 1
              );
            }
            return {
              total: Math.max(0, prev.total - 1),
              by_type: newByType,
            };
          });
        }

        // After 200ms exit animation: remove row and append next item from lookahead buffer
        setTimeout(() => {
          setItems((prev) => {
            const nextList = prev.filter((i) => i.id !== requestId);
            // Append from buffer if available to keep the list full
            if (bufferItemsRef.current.length > 0) {
              const [nextBuffered, ...restBuffer] = bufferItemsRef.current;
              setBufferItems(restBuffer);
              if (!nextList.some((i) => i.id === nextBuffered.id)) {
                nextList.push(nextBuffered);
              }
              // Quietly replenish buffer if running low
              if (restBuffer.length < 5 && hasMoreRef.current) {
                fetchNextBatch(true);
              }
            }
            return nextList;
          });

          setExitStates((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });
        }, 200);
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === requestId ? { ...i, status: "approved" } : i))
        );
      }

      setProcessingRequestIds((prev) => ({ ...prev, [requestId]: "approving" }));

      try {
        const res = await fetch(`/api/approvals/${requestId}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "approve",
            expected_version: targetItem?.version,
            bound_request_ids: targetItem?.bound_request_ids,
            idempotency_key: idempotencyKey,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          // If already decided by someone else (P0004 or 409): inform user without rollback
          if (res.status === 409 || json.isAlreadyDecided || json.error?.includes("already")) {
            setToastMessage({
              type: "info",
              text: "This request was already decided by another administrator.",
            });
            refreshCountsDebounced();
            return;
          }
          throw new Error(json.error || "Failed to approve request.");
        }

        setToastMessage({
          type: "success",
          text: "Request approved successfully.",
        });
        refreshCountsDebounced();
      } catch (err: unknown) {
        // Fallback to Server Action
        try {
          const result = await decideApprovalAction({
            request_id: requestId,
            decision: "approve",
            expected_version: targetItem?.version,
            bound_request_ids: targetItem?.bound_request_ids,
            idempotency_key: idempotencyKey,
          });

          if (result.success) {
            setToastMessage({
              type: "success",
              text: "Request approved successfully.",
            });
            refreshCountsDebounced();
            return;
          }

          if (result.isAlreadyDecided || result.error?.includes("already")) {
            setToastMessage({
              type: "info",
              text: "This request was already decided by another administrator.",
            });
            refreshCountsDebounced();
            return;
          }

          throw new Error(result.error || "Failed to approve request.");
        } catch (fallbackErr: any) {
          // Roll back optimistic state on unexpected failure
          setItems(prevItems);
          setCounts(prevCounts);
          setExitStates((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });
          const msg =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr);
          setToastMessage({ type: "error", text: msg });
        }
      } finally {
        setProcessingRequestIds((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
      }
    },
    [counts, fetchNextBatch, processingRequestIds, refreshCountsDebounced]
  );

  // Action: Prompt Reject Request
  const handleRejectPromptRequest = useCallback((requestId: string) => {
    const item = itemsRef.current.find((i) => i.id === requestId);
    setRejectTarget({
      kind: "request",
      requestId,
      summary: item?.summary || "Approval Request",
      version: item?.version,
    });
    setRejectModalOpen(true);
  }, []);

  // Action: Verify Single Document
  const handleVerifyDocument = useCallback(
    async (documentId: string, userId?: string) => {
      setToastMessage(null);
      const prevItems = itemsRef.current;

      // ⚡ INSTANT OPTIMISTIC UI: Mark document verified in memory
      setItems((prev) =>
        prev.map((item) => {
          const docs = item.documents?.map((d) =>
            d.id === documentId
              ? { ...d, verification_status: "verified" as const }
              : d
          );
          return { ...item, documents: docs };
        })
      );
      setLightboxDocument((prev) =>
        prev && prev.id === documentId
          ? { ...prev, verification_status: "verified" as const }
          : prev
      );

      try {
        const res = await fetch("/api/approvals/documents/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, userId: userId || "" }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Failed to verify document.");
        }

        setToastMessage({ type: "success", text: "Document verified successfully." });
        refreshCountsDebounced();
      } catch (err: unknown) {
        try {
          const result = await verifyUserDocumentAction({
            documentId,
            userId: userId || "",
          });
          if (result.success) {
            setToastMessage({ type: "success", text: "Document verified successfully." });
            refreshCountsDebounced();
            return;
          }
          throw new Error(result.error || "Failed to verify document.");
        } catch (fallbackErr: any) {
          setItems(prevItems);
          setLightboxDocument((prev) =>
            prev && prev.id === documentId
              ? { ...prev, verification_status: "pending" as const }
              : prev
          );
          const msg =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr);
          setToastMessage({ type: "error", text: msg });
        }
      }
    },
    [refreshCountsDebounced]
  );

  // Action: Prompt Reject Single Document
  const handleRejectPromptDocument = useCallback(
    (doc: AttachedDocumentSummary, userId?: string) => {
      setRejectTarget({
        kind: "document",
        docId: doc.id,
        userId: userId || "",
        summary: `${doc.label} rejection`,
      });
      setRejectModalOpen(true);
    },
    []
  );

  // ─── Action: Confirm Rejection with Reason (Optimistic Collapse + Append) ──
  const handleConfirmRejection = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      const target = rejectTarget;
      setRejectTarget(null);
      setRejectModalOpen(false);
      setToastMessage(null);

      const prevItems = itemsRef.current;
      const prevCounts = { ...counts, by_type: { ...counts.by_type } };
      const idempotencyKey = crypto.randomUUID();

      try {
        if (target.kind === "request") {
          const requestId = target.requestId;
          const targetItem = itemsRef.current.find((i) => i.id === requestId);

          // ⚡ INSTANT OPTIMISTIC UI: Mark rejected / exit state immediately
          if (statusRef.current === "pending") {
            setExitStates((prev) => ({ ...prev, [requestId]: "rejected" }));
            if (targetItem) {
              setCounts((prev) => {
                const newByType = { ...prev.by_type };
                if (newByType[targetItem.type_key]) {
                  newByType[targetItem.type_key] = Math.max(
                    0,
                    newByType[targetItem.type_key] - 1
                  );
                }
                return {
                  total: Math.max(0, prev.total - 1),
                  by_type: newByType,
                };
              });
            }

            setTimeout(() => {
              setItems((prev) => {
                const nextList = prev.filter((i) => i.id !== requestId);
                if (bufferItemsRef.current.length > 0) {
                  const [nextBuffered, ...restBuffer] = bufferItemsRef.current;
                  setBufferItems(restBuffer);
                  if (!nextList.some((i) => i.id === nextBuffered.id)) {
                    nextList.push(nextBuffered);
                  }
                  if (restBuffer.length < 5 && hasMoreRef.current) {
                    fetchNextBatch(true);
                  }
                }
                return nextList;
              });

              setExitStates((prev) => {
                const next = { ...prev };
                delete next[requestId];
                return next;
              });
            }, 200);
          } else {
            setItems((prev) =>
              prev.map((i) => (i.id === requestId ? { ...i, status: "rejected" } : i))
            );
          }

          setProcessingRequestIds((prev) => ({ ...prev, [requestId]: "rejecting" }));

          try {
            const res = await fetch(`/api/approvals/${requestId}/decide`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                decision: "reject",
                note: reason,
                expected_version: target.version,
                bound_request_ids: targetItem?.bound_request_ids,
                idempotency_key: idempotencyKey,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (res.status === 409 || json.isAlreadyDecided || json.error?.includes("already")) {
                setToastMessage({
                  type: "info",
                  text: "This request was already decided by another administrator.",
                });
                refreshCountsDebounced();
                return;
              }
              throw new Error(json.error || "Failed to reject request.");
            }
            setToastMessage({ type: "success", text: "Request rejected." });
            refreshCountsDebounced();
          } catch (err: unknown) {
            try {
              const result = await decideApprovalAction({
                request_id: requestId,
                decision: "reject",
                note: reason,
                expected_version: target.version,
                bound_request_ids: targetItem?.bound_request_ids,
                idempotency_key: idempotencyKey,
              });
              if (result.success) {
                setToastMessage({ type: "success", text: "Request rejected." });
                refreshCountsDebounced();
                return;
              }
              if (result.isAlreadyDecided || result.error?.includes("already")) {
                setToastMessage({
                  type: "info",
                  text: "This request was already decided by another administrator.",
                });
                refreshCountsDebounced();
                return;
              }
              throw new Error(result.error || "Failed to reject request.");
            } catch (fallbackErr: any) {
              setItems(prevItems);
              setCounts(prevCounts);
              setExitStates((prev) => {
                const next = { ...prev };
                delete next[requestId];
                return next;
              });
              const msg =
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : String(fallbackErr);
              setToastMessage({ type: "error", text: msg });
            }
          } finally {
            setProcessingRequestIds((prev) => {
              const next = { ...prev };
              delete next[requestId];
              return next;
            });
          }
        } else if (target.kind === "document") {
          setIsModalSubmitting(true);
          try {
            const res = await fetch("/api/approvals/documents/reject", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId: target.docId,
                userId: target.userId,
                rejectionReason: reason,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.error || "Failed to reject document.");
            }
            setToastMessage({ type: "success", text: "Document rejected." });
            refreshCountsDebounced();
          } catch {
            const result = await rejectUserDocumentAction({
              documentId: target.docId,
              userId: target.userId,
              rejectionReason: reason,
            });
            if (result.success) {
              setToastMessage({ type: "success", text: "Document rejected." });
              refreshCountsDebounced();
            } else {
              setToastMessage({
                type: "error",
                text: result.error || "Failed to reject document.",
              });
            }
          } finally {
            setIsModalSubmitting(false);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setToastMessage({ type: "error", text: msg });
      }
    },
    [counts, fetchNextBatch, processingRequestIds, refreshCountsDebounced, rejectTarget]
  );

  // ─── Action: Bulk Approve All ──────────────────────────────────────────
  const handleApproveAll = useCallback(async () => {
    setIsApprovingAll(true);
    setToastMessage(null);
    try {
      const result = await approveAllAction({
        type_key: typeFilter !== "all" ? typeFilter : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Bulk approval failed.");
      }

      setApproveAllModalOpen(false);
      setToastMessage({
        type: "success",
        text: `Successfully approved all pending requests (${
          result.data?.approved_count || 0
        }).`,
      });

      // Refetch page 1 cleanly
      fetchListReset(status, typeFilter);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    } finally {
      setIsApprovingAll(false);
    }
  }, [fetchListReset, status, typeFilter]);

  // Authorization check: strictly admin users who can decide
  const canDecide = canDecideApproval(
    { id: currentUser.id, role: currentUser.role },
    null,
    "registration"
  );
  const pendingApprovalsCount =
    typeFilter !== "all" ? counts.by_type[typeFilter] || 0 : counts.total;
  const canApproveAll = status === "pending" && pendingApprovalsCount > 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 relative min-h-screen">
      {/* ── Toast Notification (Floating) ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-4 right-4 z-50 p-3.5 rounded-xl border text-xs font-semibold shadow-xl flex items-center gap-2.5 backdrop-blur-md ${
              toastMessage.type === "success"
                ? "bg-emerald-50/95 text-emerald-900 border-emerald-300 dark:bg-emerald-950/95 dark:text-emerald-100 dark:border-emerald-700"
                : toastMessage.type === "info"
                ? "bg-sky-50/95 text-sky-900 border-sky-300 dark:bg-sky-950/95 dark:text-sky-100 dark:border-sky-700"
                : "bg-red-50/95 text-red-900 border-red-300 dark:bg-red-950/95 dark:text-red-100 dark:border-red-700"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : toastMessage.type === "info" ? (
              <Sparkles size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className="ml-2 text-current opacity-70 hover:opacity-100 cursor-pointer p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Realtime "N new requests available" Floating Pill ── */}
      <AnimatePresence>
        {newIncomingCount > 0 && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-18 left-1/2 -translate-x-1/2 z-40"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLoadNewRealtimeItems}
              className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-xl text-xs font-semibold flex items-center gap-2 cursor-pointer border border-sky-400/40 backdrop-blur-md"
            >
              <ArrowUp size={13} className="animate-bounce" />
              <span>
                {newIncomingCount} new request{newIncomingCount > 1 ? "s" : ""}{" "}
                available · Click to view
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Header with Action Bar ── */}
      <div className="hidden sm:flex sm:items-center sm:justify-between pb-3 border-b border-[var(--color-border)] gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Approvals &amp; Verifications
          </h1>
          <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
            Single-transaction queue with server-enforced RBAC and keyset streaming
          </p>
        </div>

        {canDecide && (
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: prefersReducedMotion ? 1 : 0.98 }}
              disabled={!canApproveAll || isApprovingAll}
              onClick={() => setApproveAllModalOpen(true)}
              className="h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              title={
                canApproveAll
                  ? "Approve all pending user registrations"
                  : "No pending requests to approve"
              }
            >
              {isApprovingAll ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCheck size={15} />
              )}
              <span>
                Approve All
                {pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ""}
              </span>
            </motion.button>
          </div>
        )}
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by applicant name, emp id, email, phone, role..."
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        defaultOpen={false}
        isLoading={isPendingTransition}
      >
        <div className="flex flex-col gap-3 w-full">
          {/* Dropdown selectors for Status and Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {/* 1. Status Filter Dropdown */}
            <div className="space-y-1.5 relative" ref={statusDropdownRef}>
              <label
                htmlFor="approvals-status-select"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]"
              >
                Status
              </label>
              <div className="relative">
                <button
                  id="approvals-status-select"
                  type="button"
                  role="combobox"
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setStatusDropdownOpen((prev) => !prev);
                    setTypeDropdownOpen(false);
                  }}
                  className={`w-full h-10 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                    statusDropdownOpen
                      ? "border-sky-500 bg-[var(--color-canvas)] ring-2 ring-sky-500/20 text-[var(--color-ink)]"
                      : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[#0284c7]/40"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        STATUS_FILTER_OPTIONS.find((s) => s.id === status)?.dotColor ||
                        "bg-neutral-400"
                      }`}
                    />
                    <span className="truncate">
                      {STATUS_FILTER_OPTIONS.find((s) => s.id === status)?.label || "Status"}
                    </span>
                    {status === "pending" && counts.total > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {counts.total}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                      statusDropdownOpen ? "rotate-180 text-sky-500" : ""
                    }`}
                  />
                </button>

                {/* Popover Listbox */}
                <AnimatePresence>
                  {statusDropdownOpen && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar backdrop-blur-md"
                      role="listbox"
                    >
                      {STATUS_FILTER_OPTIONS.map((opt) => {
                        const isSelected = opt.id === status;
                        const optCount =
                          opt.id === "pending" && counts.total > 0 ? counts.total : undefined;

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              handleStatusChange(opt.id);
                              setStatusDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer min-h-[38px] ${
                              isSelected
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotColor}`} />
                              <span className="truncate">{opt.label}</span>
                              {optCount !== undefined && (
                                <span className="text-[10px] font-mono text-[var(--color-mute)]">
                                  ({optCount})
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check
                                size={14}
                                className="text-sky-600 dark:text-sky-400 shrink-0 ml-2"
                              />
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 2. Type Filter Dropdown */}
            <div className="space-y-1.5 relative" ref={typeDropdownRef}>
              <label
                htmlFor="approvals-type-select"
                className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]"
              >
                Request Type
              </label>
              <div className="relative">
                {(() => {
                  const currentTypeOption = TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter);
                  const TypeIcon = currentTypeOption?.icon || Layers;
                  const selectedTypeCount =
                    typeFilter !== "all" ? counts.by_type[typeFilter] : undefined;

                  return (
                    <>
                      <button
                        id="approvals-type-select"
                        type="button"
                        role="combobox"
                        aria-expanded={typeDropdownOpen}
                        aria-haspopup="listbox"
                        onClick={() => {
                          setTypeDropdownOpen((prev) => !prev);
                          setStatusDropdownOpen(false);
                        }}
                        className={`w-full h-10 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                          typeDropdownOpen
                            ? "border-sky-500 bg-[var(--color-canvas)] ring-2 ring-sky-500/20 text-[var(--color-ink)]"
                            : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[#0284c7]/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <TypeIcon size={14} className="text-sky-500 shrink-0" />
                          <span className="truncate">
                            {currentTypeOption?.label || "Request Type"}
                          </span>
                          {selectedTypeCount !== undefined && selectedTypeCount > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              {selectedTypeCount}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          size={14}
                          className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                            typeDropdownOpen ? "rotate-180 text-sky-500" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {typeDropdownOpen && (
                          <motion.div
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar backdrop-blur-md"
                            role="listbox"
                          >
                            {TYPE_FILTER_OPTIONS.map((opt) => {
                              const isSelected = opt.id === typeFilter;
                              const typeCount =
                                opt.id !== "all" ? counts.by_type[opt.id] : undefined;
                              const Icon = opt.icon;

                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    handleTypeChange(opt.id);
                                    setTypeDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer min-h-[38px] ${
                                    isSelected
                                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                      : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <Icon size={14} className="text-sky-500 shrink-0" />
                                    <span className="truncate">{opt.label}</span>
                                    {typeCount !== undefined && typeCount > 0 && (
                                      <span className="text-[10px] font-mono text-[var(--color-mute)]">
                                        ({typeCount})
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check
                                      size={14}
                                      className="text-sky-600 dark:text-sky-400 shrink-0 ml-2"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Active Filter Chips Strip */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-[var(--color-hairline)] text-xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-mute)]">
                Active ({activeFilterCount}):
              </span>
              {searchQuery.trim() !== "" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {status !== "pending" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Status: {STATUS_FILTER_OPTIONS.find((s) => s.id === status)?.label}</span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("pending")}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {typeFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]">
                  <span>Type: {TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter)?.label}</span>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("all")}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer ml-auto"
              >
                <RotateCcw size={12} />
                <span>Reset all</span>
              </button>
            </div>
          )}
        </div>
      </FilterToolbar>

      {/* ── Main Queue Content ── */}
      <div className="w-full">
        {/* Results Count Banner */}
        <div className="flex items-center justify-between pb-2 text-xs font-medium text-[var(--color-ink-muted)]">
          <span>
            Showing <strong className="text-[var(--color-ink)]">{filteredItems.length}</strong>
            {hasMore ? " (streaming)" : ""}{" "}
            of <strong className="text-[var(--color-ink)]">{pendingTotal}</strong> total requests
          </span>

          {canDecide && canApproveAll && (
            <motion.button
              type="button"
              whileTap={{ scale: prefersReducedMotion ? 1 : 0.98 }}
              disabled={isApprovingAll}
              onClick={() => setApproveAllModalOpen(true)}
              className="sm:hidden h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Approve all pending user registrations"
            >
              {isApprovingAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              <span>
                Approve All
                {pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ""}
              </span>
            </motion.button>
          )}
        </div>

        {/* Load Error Banner */}
        {loadError && (
          <div className="mb-4 p-3 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchListReset(status, typeFilter)}
              className="font-bold underline hover:no-underline cursor-pointer ml-3 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Initial Loading Skeleton */}
        {isPendingTransition && items.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="w-full rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-canvas-elevated)] space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-24 bg-[var(--color-border)] rounded-full" />
                  <div className="h-4 w-16 bg-[var(--color-border)] rounded-md" />
                </div>
                <div className="h-5 w-40 bg-[var(--color-border)] rounded-md" />
                <div className="h-4 w-56 bg-[var(--color-border)] rounded-md" />
                <div className="pt-2 border-t border-[var(--color-border)]/50 flex justify-end gap-2">
                  <div className="h-9 w-20 bg-[var(--color-border)] rounded-xl" />
                  <div className="h-9 w-20 bg-[var(--color-border)] rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] space-y-2">
            <div className="p-3 rounded-full bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-border)]">
              <Inbox size={32} />
            </div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              No approval requests found
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] max-w-sm">
              {status === "pending"
                ? "All onboarding applications and documents have been reviewed."
                : "No approval requests match your active search or filters."}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
              >
                Reset active filters
              </button>
            )}
          </div>
        ) : (
          /* Cards Grid with Framer Motion Tokens */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleRenderedItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout={!prefersReducedMotion}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 12, scale: 0.98 }
                  }
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.92,
                          y: -8,
                          transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                        }
                  }
                  transition={{
                    layout: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                    duration: 0.2,
                  }}
                  className="w-full flex"
                >
                  <ApprovalRow
                    item={item}
                    onApprove={handleApproveRequest}
                    onRejectPrompt={handleRejectPromptRequest}
                    onOpenDocumentLightbox={handleOpenDocumentLightbox}
                    onVerifyDocument={handleVerifyDocument}
                    onRejectDocumentPrompt={handleRejectPromptDocument}
                    canDecide={canDecide}
                    isActionLoading={processingRequestIds[item.id] === "approving"}
                    isRejectLoading={processingRequestIds[item.id] === "rejecting"}
                    exitState={exitStates[item.id] || null}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Infinite Scroll Sentinel & Streaming Indicator ── */}
        <div ref={sentinelRef} className="w-full py-6 flex items-center justify-center">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <Loader2 size={16} className="animate-spin text-sky-600" />
              <span>Loading more requests...</span>
            </div>
          ) : !hasMore && bufferItems.length === 0 && items.length > 0 ? (
            <div className="text-center text-xs text-[var(--color-mute)] border-t border-[var(--color-hairline)] pt-4 w-full">
              <span>You have reached the end of the queue.</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Document Full View Lightbox Modal ── */}
      {lightboxOpen && lightboxDocument && (
        <DocumentLightboxModal
          key={lightboxDocument.id}
          isOpen={lightboxOpen}
          onClose={() => {
            setLightboxOpen(false);
            setLightboxDocument(null);
            setLightboxUserName(undefined);
            setLightboxUserId(undefined);
          }}
          document={lightboxDocument}
          userName={lightboxUserName}
          userId={lightboxUserId}
          onVerifyDocument={
            canDecide
              ? async (docId) => {
                  const replaceItem = items.find(
                    (i) =>
                      i.type_key === "document_replace" &&
                      (i.id === docId ||
                        i.subject_id === docId ||
                        (i.documents && i.documents.some((d) => d.id === docId)))
                  );
                  if (replaceItem) {
                    setLightboxOpen(false);
                    await handleApproveRequest(replaceItem.id);
                  } else {
                    await handleVerifyDocument(docId, lightboxUserId);
                  }
                }
              : undefined
          }
          onRejectDocumentPrompt={
            canDecide
              ? (doc) => {
                  const replaceItem = items.find(
                    (i) =>
                      i.type_key === "document_replace" &&
                      (i.id === doc.id ||
                        i.subject_id === doc.id ||
                        (i.documents && i.documents.some((d) => d.id === doc.id)))
                  );
                  if (replaceItem) {
                    setLightboxOpen(false);
                    handleRejectPromptRequest(replaceItem.id);
                  } else {
                    handleRejectPromptDocument(doc, lightboxUserId);
                  }
                }
              : undefined
          }
          canDecide={canDecide}
          isActionLoading={isModalSubmitting}
        />
      )}

      {/* ── Rejection Reason Modal ── */}
      <ApprovalRejectModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectTarget(null);
        }}
        onConfirm={handleConfirmRejection}
        requestSummary={rejectTarget?.summary}
        isSubmitting={isModalSubmitting}
      />

      {/* ── Bulk Approve All Confirmation Modal ── */}
      <ApproveAllConfirmModal
        isOpen={approveAllModalOpen}
        onClose={() => setApproveAllModalOpen(false)}
        onConfirm={handleApproveAll}
        count={pendingApprovalsCount}
        typeLabel={
          typeFilter !== "all"
            ? TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter)?.label
            : undefined
        }
        isSubmitting={isApprovingAll}
      />

      {/* ── Detailed Review Panel / Modal ── */}
      {detailModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end p-4">
          <div className="w-full max-w-xl h-full bg-[var(--color-canvas)] rounded-2xl border border-[var(--color-hairline)] shadow-2xl overflow-hidden flex flex-col">
            <ApprovalDetailPanel
              request={detailModalRequest as any}
              onApprove={handleApproveRequest}
              onRejectPrompt={(req) => handleRejectPromptRequest(req.id)}
              onClose={() => setDetailModalRequest(null)}
              canDecide={canDecide}
              isActionLoading={Boolean(processingRequestIds[detailModalRequest.id])}
            />
          </div>
        </div>
      )}
    </div>
  );
}
