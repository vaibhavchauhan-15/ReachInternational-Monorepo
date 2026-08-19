"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedBellRing,
  AnimatedRefresh,
  AnimatedCheckCircle,
  AnimatedXCircle,
  AnimatedClock,
  AnimatedSearch,
  AnimatedEye,
  AnimatedSlidersHorizontal,
} from "@/components/ui/animated-icons";
import { Eye, RefreshCw, CheckCircle, BellRing, XCircle, Clock, SlidersHorizontal } from "lucide-react";

import {
  Button,
  Pagination,
  useToast,
  PageHeader,
  MetricCard,
  SearchableSelect,
  EnterpriseTable,
  CopyCell,
  Badge,
  EmptyState,
  RefreshButton,
  FilterToolbar,
} from "@/components/ui";
import dynamic from "next/dynamic";
import { resendNotification } from "@/app/actions/notifications";
import type { NotificationWithDetails, UserRole } from "@/lib/types/database";
import { NotificationMobileCard } from "./NotificationMobileCard";

const NotificationPreviewModal = dynamic(
  () => import("./NotificationPreviewModal").then((mod) => mod.NotificationPreviewModal),
  { ssr: false }
);

interface NotificationListClientProps {
  notifications: NotificationWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    sentToday: number;
    failedToday: number;
  };
  userRole: UserRole;
  currentStatus?: string;
  currentAlertType?: string;
  currentSearch?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

export function NotificationListClient({
  notifications,
  total,
  page,
  pageSize,
  totalPages,
  stats,
  userRole,
  currentStatus = "all",
  currentAlertType = "all",
  currentSearch = "",
  currentDateFrom = "",
  currentDateTo = "",
}: NotificationListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [previewNotification, setPreviewNotification] =
    useState<NotificationWithDetails | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const isAdmin = userRole === "super_admin" || userRole === "admin";

  const updateFilters = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === "" || val === "all" || (key === "page" && val === 1)) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const handleResend = useCallback(
    (id: string) => {
      setResendingId(id);
      startTransition(async () => {
        try {
          await resendNotification(id);
          toast("success", "Notification queued for resend");
          router.refresh();
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "An error occurred";
          toast("error", "Failed to resend notification", errorMsg);
        } finally {
          setResendingId(null);
        }
      });
    },
    [router, toast]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Statuses" },
      { value: "sent", label: "Sent" },
      { value: "failed", label: "Failed" },
      { value: "pending", label: "Pending" },
    ],
    []
  );

  const alertTypeOptions = useMemo(
    () => [
      { value: "all", label: "All Alert Types" },
      { value: "today", label: "Due Today" },
      { value: "tomorrow", label: "Due Tomorrow" },
      { value: "overdue", label: "Overdue" },
      { value: "daily_summary", label: "Daily Summary" },
      { value: "engineer_summary", label: "Engineer Summary" },
      { value: "new_machine", label: "New Machine" },
      { value: "system_error", label: "System Error" },
    ],
    []
  );

  const filterPills = useMemo(
    () => [
      { id: "all", label: "All", count: stats.total },
      { id: "sent", label: "Sent", count: stats.sent },
      { id: "failed", label: "Failed", count: stats.failed },
      { id: "pending", label: "Pending", count: stats.pending },
    ],
    [stats]
  );

  const tableColumns = useMemo(
    () => [
      {
        id: "created_at",
        header: "Timestamp",
        accessorKey: "created_at" as const,
        sortable: true,
        cell: (n: NotificationWithDetails) => (
          <span className="text-xs font-mono text-[var(--color-ink)] font-medium">
            {new Date(n.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        id: "recipient",
        header: "Recipient & Channel",
        cell: (n: NotificationWithDetails) => (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[var(--color-ink)]">
              {n.recipient?.full_name || n.machine?.customer_name || "System Recipient"}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
              <span className="uppercase font-mono font-bold text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
                {n.channel || "Email"}
              </span>
              <CopyCell value={n.recipient?.email || n.recipient?.phone || n.machine?.customer_mobile || ""} />
            </div>
          </div>
        ),
      },
      {
        id: "machine",
        header: "Associated Machine",
        cell: (n: NotificationWithDetails) => (
          <div className="flex flex-col">
            <span className="text-xs font-mono font-medium text-[var(--color-ink)]">
              {n.machine?.machine_code || "System"}
            </span>
            <span className="text-[11px] text-[var(--color-mute)] truncate">
              {n.machine?.machine_name || ""}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (n: NotificationWithDetails) => {
          if (n.status === "sent")
            return (
              <Badge variant="success" dot>
                Sent
              </Badge>
            );
          if (n.status === "failed")
            return (
              <Badge variant="error" dot>
                Failed
              </Badge>
            );
          return (
            <Badge variant="warning" dot>
              Pending
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: (n: NotificationWithDetails) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost-sm"
              onClick={() => setPreviewNotification(n)}
              title="Preview email/SMS payload"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && n.status === "failed" && (
              <Button
                variant="ghost-sm"
                onClick={() => handleResend(n.id)}
                loading={resendingId === n.id}
                title="Resend notification"
                className="text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, handleResend, resendingId]
  );

  return (
    <div className="flex flex-col gap-5 pb-16 sm:pb-6">
      {/* Page Header with Action Refresh */}
      <PageHeader
        title="Notification Center"
        description="Monitor automated SendGrid email and Twilio SMS dispatch logs, failure retries, and delivery statuses."
        breadcrumbs={[{ label: "Notifications" }]}
        actions={<RefreshButton path="/notifications" tag="notifications" label="Sync Logs" />}
      />

      {/* Mobile-First Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Total Sent" value={stats.sent} icon={CheckCircle} variant="success" />
        <MetricCard
          label="Sent Today"
          value={stats.sentToday}
          icon={BellRing}
          variant="success"
          trend={{ value: "Live dispatch", isUp: true }}
        />
        <MetricCard
          label="Failed Today"
          value={stats.failedToday}
          icon={XCircle}
          variant={stats.failedToday > 0 ? "error" : "default"}
        />
        <MetricCard label="Pending" value={stats.pending} icon={Clock} variant="warning" />
      </div>

      {/* Touch-Friendly Horizontal Filter Pills (Mobile & Desktop) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0 max-w-full overflow-x-auto">
          {filterPills.map((pill) => {
            const isActive = currentStatus === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => updateFilters({ status: pill.id, page: 1 })}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "text-[var(--color-ink)] shadow-xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-lg shadow-xs border border-[var(--color-hairline)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{pill.label}</span>
                <span
                  className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive
                      ? "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]"
                      : "bg-black/5 dark:bg-white/10 text-[var(--color-mute)]"
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile Search/Filter Expand Toggle Button */}
        <div className="flex items-center gap-2 sm:hidden shrink-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showMobileSearch || currentSearch || currentAlertType !== "all"
                ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Filter Toolbar Component */}
      <FilterToolbar
        searchQuery={currentSearch}
        onSearchChange={(val) => updateFilters({ search: val, page: 1 })}
        placeholder="Search recipient, customer, or machine code..."
        activeFilterCount={
          (currentStatus !== "all" ? 1 : 0) +
          (currentAlertType !== "all" ? 1 : 0) +
          (currentDateFrom ? 1 : 0) +
          (currentDateTo ? 1 : 0)
        }
        onResetFilters={() =>
          updateFilters({
            search: "",
            status: "all",
            alert_type: "all",
            date_from: "",
            date_to: "",
            page: 1,
          })
        }
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SearchableSelect
            options={statusOptions}
            value={currentStatus}
            onChange={(val) => updateFilters({ status: val, page: 1 })}
            placeholder="Filter Status"
          />

          <SearchableSelect
            options={alertTypeOptions}
            value={currentAlertType}
            onChange={(val) => updateFilters({ alert_type: val, page: 1 })}
            placeholder="Filter Alert Type"
          />

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={currentDateFrom}
              onChange={(e) => updateFilters({ date_from: e.target.value, page: 1 })}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
              title="From date"
            />
            <span className="text-[var(--color-mute)] text-xs">→</span>
            <input
              type="date"
              value={currentDateTo}
              onChange={(e) => updateFilters({ date_to: e.target.value, page: 1 })}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink)]"
              title="To date"
            />
          </div>
        </div>
      </FilterToolbar>

      {/* Desktop View: Enterprise Data Table */}
      <div className="hidden sm:block">
        <EnterpriseTable
          columns={tableColumns}
          data={notifications}
          loading={isPending}
          emptyMessage="No notifications found"
          emptyDescription="No notification dispatch records match your criteria."
          onRowClick={(row) => setPreviewNotification(row)}
        />
      </div>

      {/* Mobile Touch View: Responsive Animated Card List */}
      <div className="block sm:hidden space-y-3">
        {isPending ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-[var(--color-hairline-soft-surface)] animate-pulse border border-[var(--color-hairline)]"
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 bg-[var(--color-canvas-elevated)] rounded-xl border border-[var(--color-hairline)]">
            <EmptyState
              title="No notifications found"
              description="No notification dispatch records match your criteria."
            />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n) => (
              <NotificationMobileCard
                key={n.id}
                notification={n}
                isAdmin={isAdmin}
                resendingId={resendingId}
                onPreview={setPreviewNotification}
                onResend={handleResend}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-2 pt-2">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => updateFilters({ page: p })}
          />
        </div>
      )}

      {/* Notification Preview Modal */}
      {previewNotification && (
        <NotificationPreviewModal
          open={!!previewNotification}
          onClose={() => setPreviewNotification(null)}
          notification={previewNotification}
        />
      )}
    </div>
  );
}
