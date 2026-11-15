"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
  UserRole,
} from "@reachinternational/types";
import type { User } from "@/lib/types/database";
import { ApprovalRow } from "./components/ApprovalRow";
import { ApprovalDetailPanel } from "./components/ApprovalDetailPanel";
import { ApprovalRejectModal } from "./components/ApprovalRejectModal";
import { decideApprovalAction } from "@/app/actions/approvals";
import { canDecideApproval } from "@reachinternational/permissions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Loader2,
  Inbox,
  ShieldCheck,
} from "lucide-react";

export interface ApprovalsClientShellProps {
  currentUser: User;
  initialItems: ApprovalRequestListItem[];
  initialCounts: ApprovalCounts;
  initialStatus?: ApprovalStatus;
  initialType?: string;
  selectedRequestId?: string | null;
}

export function ApprovalsClientShell({
  currentUser,
  initialItems,
  initialCounts,
  initialStatus = "pending",
  initialType,
  selectedRequestId = null,
}: ApprovalsClientShellProps) {
  // Navigation / Filter State
  const [status, setStatus] = useState<ApprovalStatus>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(initialType);
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [items, setItems] = useState<ApprovalRequestListItem[]>(initialItems);
  const [counts, setCounts] = useState<ApprovalCounts>(initialCounts);
  const [selectedItem, setSelectedItem] = useState<ApprovalRequestListItem | null>(() => {
    if (selectedRequestId) {
      return initialItems.find((i) => i.id === selectedRequestId) || null;
    }
    return initialItems[0] || null;
  });

  const [selectedDetail, setSelectedDetail] = useState<ApprovalRequest | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [pendingRejectRequest, setPendingRejectRequest] = useState<ApprovalRequest | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mobile Drawer State
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Fetch detail whenever selectedItem changes
  useEffect(() => {
    if (!selectedItem) {
      setSelectedDetail(null);
      return;
    }

    let isMounted = true;
    setIsDetailLoading(true);

    fetch(`/api/approvals/${selectedItem.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setSelectedDetail(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedItem?.id]);

  // Refetch list when status or typeFilter changes
  const fetchList = useCallback(async (currentStatus: ApprovalStatus, currentType?: string) => {
    startTransition(async () => {
      const q = new URLSearchParams();
      q.set("status", currentStatus);
      if (currentType) q.set("type_key", currentType);
      q.set("limit", "25");

      try {
        const res = await fetch(`/api/approvals?${q.toString()}`);
        if (res.ok) {
          const data: ApprovalRequestListItem[] = await res.json();
          setItems(data);
          if (data.length > 0 && !selectedItem) {
            setSelectedItem(data[0]);
          }
        }
      } catch {
        // network error handled via offline banner
      }

      // Also refresh counts
      try {
        const countRes = await fetch("/api/approvals/counts");
        if (countRes.ok) {
          const countData = await countRes.json();
          setCounts(countData);
        }
      } catch {}
    });
  }, [selectedItem]);

  const handleStatusChange = (newStatus: ApprovalStatus) => {
    setStatus(newStatus);
    fetchList(newStatus, typeFilter);
  };

  const handleTypeChange = (newType?: string) => {
    const next = typeFilter === newType ? undefined : newType;
    setTypeFilter(next);
    fetchList(status, next);
  };

  // Filter items in memory by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) =>
        i.summary.toLowerCase().includes(q) ||
        (i.requester_name && i.requester_name.toLowerCase().includes(q)) ||
        (i.subject_label && i.subject_label.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Action: Approve
  const handleApprove = async (requestId: string) => {
    setIsSubmittingDecision(true);
    setToastMessage(null);

    // Optimistic UI: remove from pending list immediately
    const previousItems = [...items];
    const itemToApprove = items.find((i) => i.id === requestId);
    setItems((prev) => prev.filter((i) => i.id !== requestId));

    try {
      const result = await decideApprovalAction({
        request_id: requestId,
        decision: "approve",
        expected_version: selectedDetail?.version ?? itemToApprove?.version,
      });

      if (!result.success) {
        // Rollback on failure
        setItems(previousItems);
        setToastMessage({ type: "error", text: result.error || "Failed to approve request." });
      } else {
        setToastMessage({ type: "success", text: "Request approved successfully." });
        if (selectedItem?.id === requestId) {
          setIsMobileDetailOpen(false);
          const nextItem = items.find((i) => i.id !== requestId) || null;
          setSelectedItem(nextItem);
        }
        // Refresh counts in background
        fetchList(status, typeFilter);
      }
    } catch (err: unknown) {
      setItems(previousItems);
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Action: Reject Prompt
  const handleRejectPrompt = (req: ApprovalRequest) => {
    setPendingRejectRequest(req);
    setRejectModalOpen(true);
  };

  // Action: Confirm Rejection with Reason
  const handleConfirmReject = async (reason: string) => {
    if (!pendingRejectRequest) return;
    setIsSubmittingDecision(true);

    const requestId = pendingRejectRequest.id;
    const previousItems = [...items];
    setItems((prev) => prev.filter((i) => i.id !== requestId));

    try {
      const result = await decideApprovalAction({
        request_id: requestId,
        decision: "reject",
        note: reason,
        expected_version: pendingRejectRequest.version,
      });

      if (!result.success) {
        setItems(previousItems);
        setToastMessage({ type: "error", text: result.error || "Failed to reject request." });
      } else {
        setToastMessage({ type: "success", text: "Request rejected." });
        if (selectedItem?.id === requestId) {
          setIsMobileDetailOpen(false);
          const nextItem = items.find((i) => i.id !== requestId) || null;
          setSelectedItem(nextItem);
        }
        fetchList(status, typeFilter);
      }
    } catch (err: unknown) {
      setItems(previousItems);
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage({ type: "error", text: msg });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Keyboard shortcuts on Desktop: A = approve, R = reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || rejectModalOpen) return;

      if (e.key === "a" || e.key === "A") {
        if (selectedDetail && selectedDetail.status === "pending") {
          e.preventDefault();
          handleApprove(selectedDetail.id);
        }
      } else if (e.key === "r" || e.key === "R") {
        if (selectedDetail && selectedDetail.status === "pending") {
          e.preventDefault();
          handleRejectPrompt(selectedDetail);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDetail, rejectModalOpen]);

  const canDecide = canDecideApproval(
    { id: currentUser.id, role: currentUser.role },
    { id: selectedDetail?.subject_id },
    selectedDetail?.type_key || ""
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto p-3 sm:p-6 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-3.5 rounded-xl border text-xs font-medium shadow-lg animate-in slide-in-from-top flex items-center gap-2 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-200 dark:border-red-800"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-current opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
              Approvals & Verifications
            </h1>
            {counts.total > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                {counts.total} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
            Universal audit queue for onboarding, KYC documents, sensitive profile changes, and fleet shifts.
          </p>
        </div>

        {/* Global Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchList(status, typeFilter)}
          disabled={isPending}
          className="gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Filters Bar: Status Tabs + Type Chips + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[var(--color-border)] shrink-0">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-border)] shrink-0">
          <button
            onClick={() => handleStatusChange("pending")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === "pending"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <Clock size={13} />
            <span>Pending</span>
            {counts.total > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {counts.total}
              </span>
            )}
          </button>

          <button
            onClick={() => handleStatusChange("approved")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === "approved"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Approved</span>
          </button>

          <button
            onClick={() => handleStatusChange("rejected")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === "rejected"
                ? "bg-red-500/15 text-red-700 dark:text-red-300 font-semibold"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <XCircle size={13} />
            <span>Rejected</span>
          </button>
        </div>

        {/* Type Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => handleTypeChange(undefined)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
              !typeFilter
                ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400 font-semibold"
                : "border-[var(--color-border)] text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)]"
            }`}
          >
            All Types
          </button>
          {[
            { key: "document_verify", label: "Documents" },
            { key: "profile_change", label: "Profile" },
            { key: "registration", label: "Registrations" },
            { key: "document_replace", label: "Replacements" },
            { key: "account_deletion", label: "Deletions" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => handleTypeChange(t.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                typeFilter === t.key
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400 font-semibold"
                  : "border-[var(--color-border)] text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)]"
              }`}
            >
              {t.label}
              {counts.by_type[t.key] ? ` (${counts.by_type[t.key]})` : ""}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-ink-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, summary..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] placeholder-[var(--color-ink-muted)] focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Main 3-Tier Viewport Layout */}
      <div className="flex-1 flex overflow-hidden rounded-2xl border border-[var(--color-border)] mt-3 bg-[var(--color-canvas)]">
        {/* Left Column: Keyset List (Mobile: 100%, Tablet: 40%, Desktop: 380px fixed) */}
        <div className="w-full md:w-[40%] lg:w-[420px] flex flex-col shrink-0 border-r border-[var(--color-border)] bg-[var(--color-canvas)] overflow-hidden">
          <div className="p-3 text-xs font-medium text-[var(--color-ink-muted)] border-b border-[var(--color-border)] bg-[var(--color-canvas)]/50 flex justify-between items-center">
            <span>{filteredItems.length} items</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
              Keyboard: <kbd className="font-mono bg-[var(--color-canvas-elevated)] px-1 rounded border">A</kbd> approve, <kbd className="font-mono bg-[var(--color-canvas-elevated)] px-1 rounded border">R</kbd> reject
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isPending ? (
              <div className="flex items-center justify-center p-8 text-xs text-[var(--color-ink-muted)]">
                <Loader2 size={18} className="animate-spin mr-2" />
                Loading approvals...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--color-ink-muted)]">
                <Inbox size={32} className="opacity-30 mb-2" />
                <p className="text-xs font-medium">No approval requests found</p>
                <p className="text-[11px] mt-0.5">
                  {status === "pending" ? "You're all caught up!" : "No items matching filter."}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <ApprovalRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  onSelect={(sel) => {
                    setSelectedItem(sel);
                    setIsMobileDetailOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Master-Detail Panel (Hidden on Mobile, Visible on Tablet & Desktop) */}
        <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-[var(--color-canvas-elevated)]">
          <ApprovalDetailPanel
            request={selectedDetail}
            isLoading={isDetailLoading}
            onApprove={handleApprove}
            onRejectPrompt={handleRejectPrompt}
            isActionLoading={isSubmittingDecision}
            canDecide={canDecide}
          />
        </div>
      </div>

      {/* Mobile Full-Screen Detail Slide Drawer (≤640px) */}
      {isMobileDetailOpen && selectedDetail && (
        <div className="md:hidden fixed inset-0 z-50 bg-[var(--color-canvas-elevated)] flex flex-col animate-in slide-in-from-bottom duration-200">
          <ApprovalDetailPanel
            request={selectedDetail}
            isLoading={isDetailLoading}
            onApprove={handleApprove}
            onRejectPrompt={handleRejectPrompt}
            isActionLoading={isSubmittingDecision}
            onClose={() => setIsMobileDetailOpen(false)}
            canDecide={canDecide}
          />
        </div>
      )}

      {/* Reject Reason Confirmation Modal */}
      <ApprovalRejectModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setPendingRejectRequest(null);
        }}
        onConfirm={handleConfirmReject}
        requestSummary={pendingRejectRequest?.summary}
        isSubmitting={isSubmittingDecision}
      />
    </div>
  );
}
