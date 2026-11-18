"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback, useRef } from "react";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import type { User } from "@/lib/types/database";
import { ApprovalRow } from "./components/ApprovalRow";
import { ApprovalDetailPanel } from "./components/ApprovalDetailPanel";
import { DocumentLightboxModal } from "./components/DocumentLightboxModal";
import { ApprovalRejectModal } from "./components/ApprovalRejectModal";
import { ApproveAllConfirmModal } from "./components/ApproveAllConfirmModal";
import { decideApprovalAction, approveAllAction } from "@/app/actions/approvals";
import {
  verifyUserDocumentAction,
  rejectUserDocumentAction,
} from "@/app/actions/documents";
import { canDecideApproval } from "@reachinternational/permissions";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";

export interface ApprovalsClientShellProps {
  currentUser: User;
  initialItems: ApprovalRequestListItem[];
  initialCounts: ApprovalCounts;
  initialStatus?: ApprovalStatus;
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

export function ApprovalsClientShell({
  currentUser,
  initialItems,
  initialCounts,
  initialStatus = "pending",
  initialType,
  selectedRequestId = null,
}: ApprovalsClientShellProps) {
  // Navigation / Filter State
  const [status, setStatus] = useState<ApprovalStatus | "all">(initialStatus);
  const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [items, setItems] = useState<ApprovalRequestListItem[]>(initialItems);
  const [counts, setCounts] = useState<ApprovalCounts>(initialCounts);
  const [isPendingTransition, startTransition] = useTransition();

  // Document Lightbox Modal State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxDocument, setLightboxDocument] = useState<AttachedDocumentSummary | null>(null);
  const [lightboxUserName, setLightboxUserName] = useState<string | undefined>(undefined);
  const [lightboxUserId, setLightboxUserId] = useState<string | undefined>(undefined);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<
    | { kind: "request"; requestId: string; summary: string; version?: number }
    | { kind: "document"; docId: string; userId: string; summary: string }
    | null
  >(null);

  // Per-request independent action loading states (Feedback 1)
  const [processingRequestIds, setProcessingRequestIds] = useState<
    Record<string, "approving" | "rejecting">
  >({});
  // Per-request exit animation transition state (Feedback 2)
  const [exitStates, setExitStates] = useState<Record<string, "approved" | "rejected">>({});
  // Modal-only submitting state (does not block grid cards)
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  // Bulk Approve All modal and submitting state
  const [approveAllModalOpen, setApproveAllModalOpen] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // Custom Dropdown Popover States (Feedback 4 & 5)
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

  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Auto-dismiss toast after 5 seconds (Feedback 3)
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

  // Refetch list and counts in parallel when status or typeFilter changes
  const fetchList = useCallback(
    async (currentStatus: ApprovalStatus | "all", currentType: string) => {
      startTransition(async () => {
        const q = new URLSearchParams();
        if (currentStatus !== "all") q.set("status", currentStatus);
        if (currentType !== "all") q.set("type_key", currentType);
        q.set("limit", "50");

        try {
          const [listRes, countRes] = await Promise.all([
            fetch(`/api/approvals?${q.toString()}`),
            fetch("/api/approvals/counts"),
          ]);

          if (listRes.ok) {
            const data: ApprovalRequestListItem[] = await listRes.json();
            setItems(data);
          }
          if (countRes.ok) {
            const countData = (await countRes.json()) as ApprovalCounts;
            setCounts(countData);
          }
        } catch {
          // Handled via offline notification
        }
      });
    },
    []
  );

  const handleStatusChange = (newStatus: ApprovalStatus | "all") => {
    setStatus(newStatus);
    fetchList(newStatus, typeFilter);
  };

  const handleTypeChange = (newType: string) => {
    setTypeFilter(newType);
    fetchList(status, newType);
  };

  const handleResetFilters = () => {
    setStatus("pending");
    setTypeFilter("all");
    setSearchQuery("");
    fetchList("pending", "all");
  };

  // Filter items in memory by search query
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

  // Open Document Lightbox
  const handleOpenDocumentLightbox = (
    doc: AttachedDocumentSummary,
    userName?: string,
    userId?: string
  ) => {
    setLightboxDocument(doc);
    setLightboxUserName(userName);
    setLightboxUserId(userId);
    setLightboxOpen(true);
  };

  // Action: Approve Request (e.g. registration, document verify, replacement)
  const handleApproveRequest = async (requestId: string) => {
    if (processingRequestIds[requestId]) return;
    setProcessingRequestIds((prev) => ({ ...prev, [requestId]: "approving" }));
    setToastMessage(null);

    const targetItem = items.find((i) => i.id === requestId);

    try {
      const result = await decideApprovalAction({
        request_id: requestId,
        decision: "approve",
        expected_version: targetItem?.version,
        bound_request_ids: targetItem?.bound_request_ids,
      });

      if (!result.success) {
        setProcessingRequestIds((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
        setToastMessage({
          type: "error",
          text: result.error || "Failed to approve request.",
        });
        if (result.isVersionConflict) {
          fetchList(status, typeFilter);
        }
      } else {
        setToastMessage({
          type: "success",
          text: "Request approved successfully.",
        });

        // Optimistically update counts
        if (targetItem) {
          setCounts((prev) => {
            const newByType = { ...prev.by_type };
            if (newByType[targetItem.type_key]) {
              newByType[targetItem.type_key] = Math.max(0, newByType[targetItem.type_key] - 1);
            }
            return {
              total: Math.max(0, prev.total - 1),
              by_type: newByType,
            };
          });
        }

        // Silently revalidate counts in background without unmounting or refreshing list
        fetch("/api/approvals/counts")
          .then(async (res) => (res.ok ? ((await res.json()) as ApprovalCounts) : null))
          .then((countData: ApprovalCounts | null) => {
            if (countData) setCounts(countData);
          })
          .catch(() => {});

        // If viewing pending items, show brief approved state then smoothly exit
        if (status === "pending") {
          setExitStates((prev) => ({ ...prev, [requestId]: "approved" }));
          setProcessingRequestIds((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });

          // Wait 350ms so user sees smooth approval transition, then remove from items for Framer Motion exit
          setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== requestId));
            setExitStates((prev) => {
              const next = { ...prev };
              delete next[requestId];
              return next;
            });
          }, 350);
        } else {
          // In 'all' or other status view, mark item as approved in place
          setItems((prev) =>
            prev.map((i) => (i.id === requestId ? { ...i, status: "approved" } : i))
          );
          setProcessingRequestIds((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });
        }
      }
    } catch (err: unknown) {
      setProcessingRequestIds((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    }
  };

  // Action: Prompt Reject Request
  const handleRejectPromptRequest = (requestId: string) => {
    const item = items.find((i) => i.id === requestId);
    setRejectTarget({
      kind: "request",
      requestId,
      summary: item?.summary || "Approval Request",
      version: item?.version,
    });
    setRejectModalOpen(true);
  };

  // Action: Verify Single Document
  const handleVerifyDocument = async (documentId: string, userId?: string) => {
    setIsModalSubmitting(true);
    setToastMessage(null);

    try {
      const result = await verifyUserDocumentAction({
        documentId,
        userId: userId || "",
      });

      if (!result.success) {
        setToastMessage({
          type: "error",
          text: result.error || "Failed to verify document.",
        });
      } else {
        setToastMessage({
          type: "success",
          text: "Document verified successfully.",
        });
        // Optimistically update document in list without refreshing entire page
        setItems((prev) =>
          prev.map((item) => {
            const docs = item.documents?.map((d) =>
              d.id === documentId ? { ...d, verification_status: "verified" } : d
            );
            return { ...item, documents: docs };
          })
        );
        setLightboxDocument((prev) =>
          prev && prev.id === documentId ? { ...prev, verification_status: "verified" } : prev
        );
        fetch("/api/approvals/counts")
          .then(async (res) => (res.ok ? ((await res.json()) as ApprovalCounts) : null))
          .then((countData: ApprovalCounts | null) => {
            if (countData) setCounts(countData);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    } finally {
      setIsModalSubmitting(false);
    }
  };

  // Action: Prompt Reject Single Document
  const handleRejectPromptDocument = (doc: AttachedDocumentSummary, userId?: string) => {
    setRejectTarget({
      kind: "document",
      docId: doc.id,
      userId: userId || "",
      summary: `${doc.label} rejection`,
    });
    setRejectModalOpen(true);
  };

  // Action: Confirm Rejection with Reason
  const handleConfirmRejection = async (reason: string) => {
    if (!rejectTarget) return;
    setIsModalSubmitting(true);
    setToastMessage(null);

    const target = rejectTarget;

    try {
      if (target.kind === "request") {
        const requestId = target.requestId;
        setProcessingRequestIds((prev) => ({ ...prev, [requestId]: "rejecting" }));
        const targetItem = items.find((i) => i.id === requestId);

        const result = await decideApprovalAction({
          request_id: requestId,
          decision: "reject",
          note: reason,
          expected_version: target.version,
          bound_request_ids: targetItem?.bound_request_ids,
        });

        setIsModalSubmitting(false);
        setRejectTarget(null);
        setRejectModalOpen(false);

        if (!result.success) {
          setProcessingRequestIds((prev) => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });
          setToastMessage({
            type: "error",
            text: result.error || "Failed to reject request.",
          });
          if (result.isVersionConflict) {
            fetchList(status, typeFilter);
          }
        } else {
          setToastMessage({ type: "success", text: "Request rejected." });

          // Update counts optimistically
          if (targetItem) {
            setCounts((prev) => {
              const newByType = { ...prev.by_type };
              if (newByType[targetItem.type_key]) {
                newByType[targetItem.type_key] = Math.max(0, newByType[targetItem.type_key] - 1);
              }
              return {
                total: Math.max(0, prev.total - 1),
                by_type: newByType,
              };
            });
          }

          // Silently revalidate counts
          fetch("/api/approvals/counts")
            .then(async (res) => (res.ok ? ((await res.json()) as ApprovalCounts) : null))
            .then((countData: ApprovalCounts | null) => {
              if (countData) setCounts(countData);
            })
            .catch(() => {});

          if (status === "pending") {
            setExitStates((prev) => ({ ...prev, [requestId]: "rejected" }));
            setProcessingRequestIds((prev) => {
              const next = { ...prev };
              delete next[requestId];
              return next;
            });

            setTimeout(() => {
              setItems((prev) => prev.filter((i) => i.id !== requestId));
              setExitStates((prev) => {
                const next = { ...prev };
                delete next[requestId];
                return next;
              });
            }, 350);
          } else {
            setItems((prev) =>
              prev.map((i) => (i.id === requestId ? { ...i, status: "rejected" } : i))
            );
            setProcessingRequestIds((prev) => {
              const next = { ...prev };
              delete next[requestId];
              return next;
            });
          }
        }
      } else if (target.kind === "document") {
        const result = await rejectUserDocumentAction({
          documentId: target.docId,
          userId: target.userId,
          rejectionReason: reason,
        });

        setIsModalSubmitting(false);
        setRejectTarget(null);
        setRejectModalOpen(false);

        if (!result.success) {
          setToastMessage({
            type: "error",
            text: result.error || "Failed to reject document.",
          });
        } else {
          setToastMessage({ type: "success", text: "Document rejected." });
          // Optimistically update document in list without refreshing entire page
          setItems((prev) =>
            prev.map((item) => {
              const docs = item.documents?.map((d) =>
                d.id === target.docId
                  ? { ...d, verification_status: "rejected" }
                  : d
              );
              return { ...item, documents: docs };
            })
          );
          setLightboxDocument((prev) =>
            prev && prev.id === target.docId ? { ...prev, verification_status: "rejected" } : prev
          );
          fetch("/api/approvals/counts")
            .then(async (res) => (res.ok ? ((await res.json()) as ApprovalCounts) : null))
            .then((countData: ApprovalCounts | null) => {
              if (countData) setCounts(countData);
            })
            .catch(() => {});
        }
      }
    } catch (err: unknown) {
      setIsModalSubmitting(false);
      setRejectTarget(null);
      setRejectModalOpen(false);
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    }
  };

  const canDecide = canDecideApproval(
    { id: currentUser.id, role: currentUser.role },
    {},
    "registration"
  );

  // Pending approvals count for Approve All button badge
  const pendingApprovalsCount = useMemo(() => {
    if (typeFilter !== "all") {
      const typeCount = counts.by_type[typeFilter];
      if (typeCount !== undefined && typeCount > 0) return typeCount;
      return items.filter((i) => i.status === "pending" && i.type_key === typeFilter).length;
    }
    const regCount = counts.by_type["registration"];
    if (regCount !== undefined && regCount > 0) return regCount;
    return counts.total || items.filter((i) => i.status === "pending").length;
  }, [counts, items, typeFilter]);

  const canApproveAll =
    canDecide &&
    (pendingApprovalsCount > 0 || items.some((i) => i.status === "pending"));

  // Action: Approve All Pending Requests
  const handleApproveAll = async () => {
    if (isApprovingAll) return;
    setIsApprovingAll(true);
    setToastMessage(null);

    const targetTypeKey = typeFilter !== "all" ? typeFilter : undefined;
    const pendingItemsToApprove = items.filter(
      (i) => i.status === "pending" && (!targetTypeKey || i.type_key === targetTypeKey)
    );
    const countToApprove = pendingApprovalsCount || pendingItemsToApprove.length;

    // Fast responsive optimistic exit state
    if (status === "pending") {
      const exitMap: Record<string, "approved"> = {};
      for (const item of pendingItemsToApprove) {
        exitMap[item.id] = "approved";
      }
      setExitStates((prev) => ({ ...prev, ...exitMap }));
    }

    try {
      const result = await approveAllAction({
        type_key: targetTypeKey,
      });

      if (!result.success) {
        setExitStates({});
        setToastMessage({
          type: "error",
          text: result.error || "Failed to approve all requests.",
        });
      } else {
        const approvedCount = result.data?.approved_count ?? countToApprove;
        setToastMessage({
          type: "success",
          text: `Successfully approved ${approvedCount} request${
            approvedCount === 1 ? "" : "s"
          }. User accounts activated with documents pending verification.`,
        });

        // Smoothly remove approved items from items state
        if (status === "pending") {
          setTimeout(() => {
            setItems((prev) =>
              prev.filter((i) => !pendingItemsToApprove.some((p) => p.id === i.id))
            );
            setExitStates({});
          }, 350);
        } else {
          setItems((prev) =>
            prev.map((i) =>
              pendingItemsToApprove.some((p) => p.id === i.id)
                ? { ...i, status: "approved" }
                : i
            )
          );
          setExitStates({});
        }

        // Optimistically clear pending counts for approved types
        setCounts((prev) => {
          const newByType = { ...prev.by_type };
          if (targetTypeKey) {
            newByType[targetTypeKey] = 0;
          } else {
            newByType["registration"] = 0;
          }
          const newTotal = Object.values(newByType).reduce((acc, v) => acc + (v || 0), 0);
          return {
            total: Math.max(0, newTotal),
            by_type: newByType,
          };
        });

        // Silently revalidate counts from server
        fetch("/api/approvals/counts")
          .then(async (res) => (res.ok ? ((await res.json()) as ApprovalCounts) : null))
          .then((countData: ApprovalCounts | null) => {
            if (countData) setCounts(countData);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      setExitStates({});
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    } finally {
      setIsApprovingAll(false);
      setApproveAllModalOpen(false);
    }
  };


  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-7xl mx-auto p-3 sm:p-6 space-y-4">
      {/* Toast Feedback with 5s auto-dismiss and smooth exit animation (Feedback 3) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-4 right-4 z-50 p-3.5 rounded-xl border text-xs font-semibold shadow-xl flex items-center gap-2.5 backdrop-blur-md ${
              toastMessage.type === "success"
                ? "bg-emerald-50/95 text-emerald-900 border-emerald-300 dark:bg-emerald-950/95 dark:text-emerald-100 dark:border-emerald-700"
                : "bg-red-50/95 text-red-900 border-red-300 dark:bg-red-950/95 dark:text-red-100 dark:border-red-700"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
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

      {/* ── Clean Header with Action Bar ── */}
      <div className="pb-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Approvals &amp; Verifications
        </h1>

        {canDecide && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              disabled={!canApproveAll || isApprovingAll}
              onClick={() => setApproveAllModalOpen(true)}
              className="h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              title={canApproveAll ? "Approve all pending user registrations" : "No pending requests to approve"}
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
            </button>
          </div>
        )}
      </div>

      {/* ── Standard Search & Filter Toolbar (Feedback 1) ── */}
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
          {/* Dropdown selectors for Status and Type (Feedback 4 & 5: Custom Dropdowns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {/* 1. Status Filter Dropdown (Custom color-coded dropdown - Feedback 5) */}
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

                {/* Animated Floating Popover Listbox */}
                <AnimatePresence>
                  {statusDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
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

            {/* 2. Type Filter Dropdown (Custom dropdown selection - Feedback 4) */}
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

                      {/* Animated Floating Popover Listbox */}
                      <AnimatePresence>
                        {typeDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
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

      {/* ── Single Section Main Layout (Feedback 6, 7: Only ONE section, no second split panel) ── */}
      <div className="w-full">
        {/* Results Count Banner */}
        <div className="flex items-center justify-between pb-2 text-xs font-medium text-[var(--color-ink-muted)]">
          <span>
            Showing <strong className="text-[var(--color-ink)]">{filteredItems.length}</strong>{" "}
            approval requests
          </span>
        </div>

        {/* Loading State: only if initial items is empty and transition pending */}
        {isPendingTransition && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-xs text-[var(--color-ink-muted)]">
            <Loader2 size={24} className="animate-spin mb-2 text-sky-600" />
            <span>Loading approval requests...</span>
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
          /* Responsive Redesigned Cards Grid with Independent Smooth Exit & Layout Animations (Feedback 1 & 2) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.92,
                    y: -8,
                    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  }}
                  transition={{
                    layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                    duration: 0.25,
                  }}
                  className="w-full flex"
                >
                  <ApprovalRow
                    item={item}
                    onApprove={handleApproveRequest}
                    onRejectPrompt={handleRejectPromptRequest}
                    onOpenDocumentLightbox={handleOpenDocumentLightbox}
                    onVerifyDocument={(docId) =>
                      handleVerifyDocument(docId, item.payload?.user_id || item.requested_by)
                    }
                    onRejectDocumentPrompt={(doc) =>
                      handleRejectPromptDocument(doc, item.payload?.user_id || item.requested_by)
                    }
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
      </div>

      {/* ── Document Full View Lightbox Modal (Opens when any document thumbnail is clicked) ── */}
      <DocumentLightboxModal
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

      {/* ── Rejection Reason Modal (Mandatory reason capture) ── */}
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
        typeLabel={typeFilter !== "all" ? TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter)?.label : undefined}
        isSubmitting={isApprovingAll}
      />
    </div>
  );
}
