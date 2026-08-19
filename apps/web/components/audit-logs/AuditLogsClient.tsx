"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AnimatedSearch,
  AnimatedCalendarClock,
  AnimatedRotateCw,
  AnimatedChevronLeft,
  AnimatedChevronRight,
  AnimatedScrollText,
  AnimatedShieldCheck,
  AnimatedClock,
  AnimatedSlidersHorizontal,
  AnimatedX,
} from "@/components/ui/animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import type { AuditLogWithUser } from "@/lib/types/database";
import { PageHeader, Badge, Button, Modal, FilterToolbar } from "@/components/ui";
import { formatAuditAction, getAuditActionStyle, getAuditLogDescription } from "@/lib/audit-helpers";

interface AuditLogsClientProps {
  initialLogs: AuditLogWithUser[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  initialParams: {
    search?: string;
    role?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  };
}

const roleBadgeVariant: Record<string, "default" | "success" | "warning" | "error"> = {
  super_admin: "error",
  admin: "warning",
  engineer: "success",
  system: "default",
};

export function AuditLogsClient({
  initialLogs,
  totalCount,
  currentPage,
  totalPages,
  initialParams,
}: AuditLogsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialParams.search || "");
  const [role, setRole] = useState(initialParams.role || "all");
  const [dateRange, setDateRange] = useState(initialParams.dateRange || "all");
  const [startDate, setStartDate] = useState(initialParams.startDate || "");
  const [endDate, setEndDate] = useState(initialParams.endDate || "");
  const [selectedActionCategory, setSelectedActionCategory] = useState("all");

  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, unknown> | null>(null);

  const applyFilters = (newParams: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(newParams).forEach(([key, val]) => {
      if (val === undefined || val === "" || val === "all") {
        current.delete(key);
      } else {
        current.set(key, String(val));
      }
    });

    startTransition(() => {
      router.push(`/audit-logs?${current.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search, page: 1 });
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    applyFilters({ role: newRole, page: 1 });
  };

  const handleDateRangeChange = (newRange: string) => {
    setDateRange(newRange);
    if (newRange !== "custom") {
      setStartDate("");
      setEndDate("");
      applyFilters({ dateRange: newRange, startDate: undefined, endDate: undefined, page: 1 });
    } else {
      applyFilters({ dateRange: "custom", page: 1 });
    }
  };

  const handleCustomDateSubmit = () => {
    applyFilters({ dateRange: "custom", startDate, endDate, page: 1 });
  };

  const handleResetFilters = () => {
    setSearch("");
    setRole("all");
    setDateRange("all");
    setStartDate("");
    setEndDate("");
    setSelectedActionCategory("all");
    startTransition(() => {
      router.push("/audit-logs");
    });
  };

  const handlePageChange = (newPage: number) => {
    applyFilters({ page: newPage });
  };

  const filteredLogs = useMemo(() => {
    if (selectedActionCategory === "all") return initialLogs;
    return initialLogs.filter((log) => {
      const act = log.action.toLowerCase();
      if (selectedActionCategory === "notification") {
        return act.startsWith("notification") || act.startsWith("manual") || act.startsWith("reminders");
      }
      return act.startsWith(selectedActionCategory);
    });
  }, [initialLogs, selectedActionCategory]);

  const hasActiveFilters = Boolean(
    search || (role && role !== "all") || (dateRange && dateRange !== "all") || selectedActionCategory !== "all"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="System Audit Logs"
        description="Comprehensive audit trail of security events, user activity, and machine modifications."
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border text-xs font-semibold text-foreground">
            <AnimatedScrollText size={14} className="text-sky-600 dark:text-sky-400" />
            {totalCount.toLocaleString()} Total Recorded Events
          </span>
        }
      />

      {/* Filter Toolbar Component */}
      <FilterToolbar
        searchQuery={search}
        onSearchChange={(val) => {
          setSearch(val);
          if (!val) applyFilters({ search: undefined, page: 1 });
        }}
        placeholder="Search action, entity ID, or details..."
        activeFilterCount={
          (role !== "all" ? 1 : 0) +
          (dateRange !== "all" ? 1 : 0) +
          (selectedActionCategory !== "all" ? 1 : 0)
        }
        onResetFilters={handleResetFilters}
        onSubmitSearch={handleSearchSubmit}
        defaultOpen={false}
      >
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Role Filter Select */}
            <div className="flex items-center gap-2">
              <AnimatedShieldCheck size={16} className="text-muted-foreground shrink-0 hidden sm:block" />
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="all">All User Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="engineer">Service Engineer</option>
                <option value="system">System (Automated)</option>
              </select>
            </div>

            {/* Date Filter Select */}
            <div className="flex items-center gap-2">
              <AnimatedCalendarClock size={16} className="text-muted-foreground shrink-0 hidden sm:block" />
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Pickers */}
          <AnimatePresence>
            {dateRange === "custom" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-3 items-end overflow-hidden"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-lg bg-background border border-border text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full py-1.5 px-3 rounded-lg bg-background border border-border text-xs text-foreground"
                  />
                </div>
                <div>
                  <Button variant="primary-sm" onClick={handleCustomDateSubmit} className="w-full text-xs">
                    Apply Date Range
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Category:
            </span>
            {[
              { id: "all", label: "All Events" },
              { id: "auth", label: "Auth" },
              { id: "machine", label: "Machines" },
              { id: "service", label: "Services" },
              { id: "user", label: "Users" },
              { id: "notification", label: "Notifications" },
              { id: "alert_run", label: "Cron Runs" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedActionCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedActionCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </FilterToolbar>

      {/* Audit Logs List Table */}
      <div className="card-base overflow-hidden border border-border shadow-xs bg-card">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <AnimatedScrollText size={40} className="text-muted-foreground mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-foreground">No audit logs found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              No matching activity records found for the selected search query and filter criteria.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs.map((log) => {
              const formattedAction = formatAuditAction(log.action);
              const actionStyle = getAuditActionStyle(log.action);
              const description = getAuditLogDescription(log);
              const dateObj = new Date(log.created_at);

              return (
                <div
                  key={log.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                >
                  {/* Left Column: User Avatar & Action Title + Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0 shadow-xs mt-0.5">
                      {log.user?.full_name?.charAt(0).toUpperCase() ?? "?"}
                    </div>

                    <div className="flex flex-col min-w-0 gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground tracking-tight">
                          {formattedAction}
                        </span>
                        <Badge variant={actionStyle.badgeVariant}>
                          {log.action.split(".")[0].toUpperCase()}
                        </Badge>
                      </div>

                      {description && (
                        <p className="text-xs font-medium text-foreground/90 leading-snug">
                          {description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span>
                          by <strong className="text-foreground font-semibold">{log.user?.full_name ?? "System (Automated)"}</strong>
                          {log.user?.email && (
                            <span className="ml-1 text-muted-foreground font-mono text-[11px]">
                              ({log.user.email})
                            </span>
                          )}
                        </span>
                        {log.user?.role && (
                          <Badge variant={roleBadgeVariant[log.user.role] ?? "default"}>
                            {log.user.role}
                          </Badge>
                        )}
                        {log.entity_type && (
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {log.entity_type}: {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "N/A"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Date & Metadata Drawer Action */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                    <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                      <AnimatedClock size={14} className="text-muted-foreground" />
                      {dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      {dateObj.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMetadata(log.metadata)}
                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-foreground transition-colors"
                      >
                        Payload
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between card-base p-4 border border-border bg-card shadow-xs">
          <div className="text-xs text-muted-foreground">
            Showing Page <strong className="text-foreground">{currentPage}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({totalCount.toLocaleString()} total entries)
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={currentPage <= 1 || isPending}
              onClick={() => handlePageChange(currentPage - 1)}
              className="text-xs flex items-center gap-1 px-3 py-1.5"
            >
              <AnimatedChevronLeft size={16} />
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => handlePageChange(currentPage + 1)}
              className="text-xs flex items-center gap-1 px-3 py-1.5"
            >
              Next
              <AnimatedChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Metadata JSON Modal */}
      {selectedMetadata && (
        <Modal
          open={Boolean(selectedMetadata)}
          onClose={() => setSelectedMetadata(null)}
          title="Event Metadata Payload"
        >
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Raw JSON metadata recorded during this audit event:
            </p>
            <pre className="p-4 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              {JSON.stringify(selectedMetadata, null, 2)}
            </pre>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedMetadata(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
