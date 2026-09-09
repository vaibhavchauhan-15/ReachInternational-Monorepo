"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AnimatedScrollText,
  AnimatedRotateCw,
  AnimatedEye,
  AnimatedUser,
  AnimatedWrench,
  AnimatedBuilding2,
  AnimatedUsers,
  AnimatedUserCheck,
  AnimatedShieldCheck,
  AnimatedActivity,
} from "@/components/ui/animated-icons";
import { AuditKpis } from "./AuditKpis";
import { AuditFilters } from "./AuditFilters";
import { AuditDetailDrawer } from "./AuditDetailDrawer";
import {
  formatAuditAction,
  getAuditActionStyle,
  getAuditSeverityStyle,
  getAuditCategoryStyle,
  getAuditLogDescription,
} from "@/lib/audit-helpers";
import type { AuditLogWithUser } from "@/lib/types/database";
import type { AuditTab, AuditTabCounts } from "@/lib/queries/audit-logs";

interface AuditClientProps {
  initialLogs: AuditLogWithUser[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  tabCounts: AuditTabCounts;
  activeTab: AuditTab;
  userRole?: string;
  initialParams: {
    tab?: string;
    search?: string;
    category?: string;
    severity?: string;
    role?: string;
    dateRange?: "all" | "today" | "7days" | "30days" | "custom";
    startDate?: string;
    endDate?: string;
  };
}

interface AuditTabDef {
  id: AuditTab;
  label: string;
  shortLabel?: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeColor: string;
}

const AUDIT_TABS: AuditTabDef[] = [
  {
    id: "machine",
    label: "Machines",
    description:
      "Tracks all machine equipment additions, specification edits, equipment deletions, status transitions, and hour meter (HMR) updates.",
    icon: AnimatedWrench,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    id: "assignments",
    label: "Operator & Supervisor Assignments",
    shortLabel: "Assignments",
    description:
      "Tracks which operator or supervisor was assigned to which machine, shift timings, assigner attribution (who assigned whom), and shift closures.",
    icon: AnimatedUsers,
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  {
    id: "rentals",
    label: "Machine Rental & Client Allocations",
    shortLabel: "Rentals & Clients",
    description:
      "Tracks equipment assigned to or removed from client sites, machine rental agreements, dispatches, returns, lease extensions, and client records.",
    icon: AnimatedBuilding2,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "employees",
    label: "Employees",
    description:
      "Tracks employee account creation, profile edits, admin approvals, rejections, role upgrades, account activations, and deletions.",
    icon: AnimatedUserCheck,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "auth",
    label: "Auth + Sign In / Out",
    shortLabel: "Auth Logs",
    description:
      "Tracks user sign-ins, sign-outs, failed login attempts, session expirations, and new user self-registrations.",
    icon: AnimatedShieldCheck,
    badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    id: "others",
    label: "Others",
    description:
      "Tracks daily running hour log operations, equipment breakdown complaints, system settings changes, security alerts, and cron job executions.",
    icon: AnimatedActivity,
    badgeColor: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  },
  {
    id: "all",
    label: "All Activity",
    description:
      "Complete chronological enterprise audit stream across all operational modules, security events, and database mutations.",
    icon: AnimatedScrollText,
    badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
];

export function AuditClient({
  initialLogs,
  totalCount,
  currentPage,
  totalPages,
  tabCounts,
  activeTab,
  userRole,
  initialParams,
}: AuditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Selected log for slide-over detail drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogWithUser | null>(null);

  // Sync URL query params with transitions
  const handleFilterChange = (updates: Record<string, string | number | undefined>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === "" || (key !== "tab" && val === "all")) {
        current.delete(key);
      } else {
        current.set(key, String(val));
      }
    });

    // Reset pagination when modifying filters, unless page was explicitly passed
    if (!("page" in updates)) {
      current.delete("page");
    }

    startTransition(() => {
      router.push(`/audit?${current.toString()}`);
    });
  };

  const handleTabChange = (newTab: AuditTab) => {
    handleFilterChange({ tab: newTab, category: undefined, page: 1 });
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handlePageChange = (newPage: number) => {
    handleFilterChange({ page: newPage });
  };

  const currentTabDef =
    AUDIT_TABS.find((t) => t.id === activeTab) || AUDIT_TABS[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header with Real-Time Refresh */}
      <PageHeader
        title="Audit Logs"
        description="Centralized audit trail of machine operations, assignments, employee mutations, sign-in events, and security access."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="gap-1.5 text-xs h-9"
          >
            <AnimatedRotateCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Refreshing..." : "Refresh"}</span>
          </Button>
        }
      />

      {/* KPI Activity Strip */}
      <AuditKpis
        logs={initialLogs}
        totalCount={totalCount}
        tabCounts={tabCounts}
        activeTab={activeTab}
        activeSeverity={initialParams.severity}
        onSelectTab={(tab) => handleTabChange(tab as AuditTab)}
        onFilterSeverity={(sev) =>
          handleFilterChange({ severity: sev === "all" ? undefined : sev })
        }
      />

      {/* ── TOP-LEVEL DOMAIN TABS (Per User Request) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-canvas-subtle)] border border-[var(--color-hairline)] rounded-2xl w-fit overflow-x-auto max-w-full scrollbar-none">
          {AUDIT_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const count = tabCounts ? tabCounts[tab.id] : undefined;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="inline md:hidden">{tab.shortLabel || tab.label}</span>
                {count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold border ${
                      isActive
                        ? "bg-white/20 text-white border-white/30"
                        : tab.badgeColor
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Context Well */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-canvas-subtle)]/70 border border-[var(--color-hairline)] rounded-[var(--radius-md)] text-xs text-[var(--color-subtle)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--color-ink)] uppercase tracking-wider text-[10px]">
              {currentTabDef.label}:
            </span>
            <span className="text-[var(--color-subtle)] line-clamp-1">
              {currentTabDef.description}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--color-mute)] shrink-0 ml-3">
            {totalCount.toLocaleString()} {totalCount === 1 ? "record" : "records"}
          </span>
        </div>
      </div>

      {/* Filter Toolbar for Active Tab */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-4 shadow-sm">
        <AuditFilters
          currentParams={{ ...initialParams, tab: activeTab }}
          onFilterChange={handleFilterChange}
          logs={initialLogs}
          userRole={userRole}
        />
      </div>

      {/* Main Content Area */}
      {initialLogs.length === 0 ? (
        <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-12 text-center">
          <EmptyState
            title={`No ${currentTabDef.label.toLowerCase()} found`}
            description={`No logs match your criteria in the ${currentTabDef.label} tab. Try adjusting your search query or date range filters.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleFilterChange({
                    search: undefined,
                    severity: undefined,
                    role: undefined,
                    dateRange: undefined,
                    startDate: undefined,
                    endDate: undefined,
                  })
                }
                className="text-xs"
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-hidden bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas-subtle)] text-[var(--color-subtle)] uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4 w-36">Time</th>

                    {/* Dynamic Headers based on Active Tab */}
                    {activeTab === "assignments" ? (
                      <>
                        <th className="py-3 px-4">Machine</th>
                        <th className="py-3 px-4">Assigned Person</th>
                        <th className="py-3 px-4">Assigned / Ended By</th>
                        <th className="py-3 px-4">Shift Details</th>
                        <th className="py-3 px-4">Event</th>
                      </>
                    ) : activeTab === "rentals" ? (
                      <>
                        <th className="py-3 px-4">Machine</th>
                        <th className="py-3 px-4">Client Site</th>
                        <th className="py-3 px-4">Rental Action</th>
                        <th className="py-3 px-4">Action By</th>
                        <th className="py-3 px-4 min-w-[180px]">Details</th>
                      </>
                    ) : activeTab === "employees" ? (
                      <>
                        <th className="py-3 px-4">Target Employee</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Action Taken</th>
                        <th className="py-3 px-4">Approved / Done By</th>
                        <th className="py-3 px-4 min-w-[180px]">Details</th>
                      </>
                    ) : activeTab === "machine" ? (
                      <>
                        <th className="py-3 px-4">Machine Code / ID</th>
                        <th className="py-3 px-4">Action Taken</th>
                        <th className="py-3 px-4">Changed By</th>
                        <th className="py-3 px-4 min-w-[200px]">Modification Details</th>
                      </>
                    ) : activeTab === "auth" ? (
                      <>
                        <th className="py-3 px-4">User Account</th>
                        <th className="py-3 px-4">Auth Activity</th>
                        <th className="py-3 px-4">User Role</th>
                        <th className="py-3 px-4">IP Origin</th>
                        <th className="py-3 px-4 min-w-[180px]">Status / Details</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3 px-4">Activity</th>
                        <th className="py-3 px-4">Target Entity</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4 min-w-[200px]">Details</th>
                      </>
                    )}

                    <th className="py-3 px-3 text-center w-24">Severity</th>
                    <th className="py-3 px-3 text-right w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {initialLogs.map((log) => {
                    const actionStyle = getAuditActionStyle(log.action);
                    const severityStyle = getAuditSeverityStyle(log.severity || "info");
                    const categoryStyle = getAuditCategoryStyle(log.category || "system");
                    const description = getAuditLogDescription(log);
                    const meta = (log.metadata || {}) as Record<string, any>;
                    const details = (log.details || {}) as Record<string, any>;

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-[var(--color-canvas-subtle)] cursor-pointer transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono text-xs text-[var(--color-ink)] font-medium">
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                          <div className="text-[11px] text-[var(--color-mute)]">
                            {new Date(log.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </td>

                        {/* ── TAB-CUSTOMIZED DATA CELLS ── */}
                        {activeTab === "assignments" ? (
                          <>
                            {/* Machine */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[var(--color-ink)]">
                              {log.entity_name || log.entity_id || meta.machine_code || "Machine"}
                            </td>
                            {/* Assigned Operator/Supervisor */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-[var(--color-ink)]">
                                {meta.operator_name || meta.supervisor_name || meta.user_name || details.operator_name || log.entity_name || "N/A"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {meta.supervisor_name ? "Supervisor" : "Operator"}
                              </div>
                            </td>
                            {/* Assigned By */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || meta.assigned_by_name || "Supervisor"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {log.actor_role || log.user?.role || "supervisor"}
                              </div>
                            </td>
                            {/* Shift Details */}
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-[var(--color-subtle)]">
                              {meta.shift_start_time && meta.shift_end_time ? (
                                <span className="font-mono font-semibold text-[var(--color-ink)]">
                                  {meta.shift_start_time} – {meta.shift_end_time}
                                </span>
                              ) : meta.end_reason ? (
                                <span className="text-amber-600 capitalize">
                                  Ended: {meta.end_reason.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <span className="text-[var(--color-mute)] italic">—</span>
                              )}
                            </td>
                            {/* Event Type Badge */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionStyle.bgClass} ${actionStyle.textClass}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                          </>
                        ) : activeTab === "rentals" ? (
                          <>
                            {/* Machine */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[var(--color-ink)]">
                              {log.entity_name || meta.machine_code || meta.machine_id || "Machine"}
                            </td>
                            {/* Client Site */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-[var(--color-ink)]">
                                {meta.client_name || meta.company_name || (log.entity_type === "client" ? log.entity_name : "Client Site")}
                              </div>
                              {meta.location && (
                                <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[140px]">
                                  {meta.location}
                                </div>
                              )}
                            </td>
                            {/* Rental Action */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionStyle.bgClass} ${actionStyle.textClass}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            {/* Action By */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || "Staff"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {log.actor_role || log.user?.role || "admin"}
                              </div>
                            </td>
                            {/* Details */}
                            <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                              {description || JSON.stringify(details || meta)}
                            </td>
                          </>
                        ) : activeTab === "employees" ? (
                          <>
                            {/* Target Employee */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-bold text-[var(--color-ink)]">
                                {log.entity_name || meta.full_name || meta.user_name || meta.email || "Employee"}
                              </div>
                              {meta.email && (
                                <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[160px]">
                                  {meta.email}
                                </div>
                              )}
                            </td>
                            {/* Role */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono text-xs capitalize text-[var(--color-subtle)]">
                                {meta.role || meta.new_role || "Staff"}
                              </span>
                            </td>
                            {/* Action Taken */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionStyle.bgClass} ${actionStyle.textClass}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            {/* Approved / Done By */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || "Admin"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {log.actor_role || log.user?.role || "super_admin"}
                              </div>
                            </td>
                            {/* Details */}
                            <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                              {description || JSON.stringify(details || meta)}
                            </td>
                          </>
                        ) : activeTab === "machine" ? (
                          <>
                            {/* Machine Code */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono font-bold text-[var(--color-ink)] text-sm">
                                {log.entity_name || log.entity_id || meta.machine_code || "Machine"}
                              </div>
                              {meta.model && (
                                <div className="text-[10px] text-[var(--color-mute)]">
                                  Model: {meta.model}
                                </div>
                              )}
                            </td>
                            {/* Action Taken */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionStyle.bgClass} ${actionStyle.textClass}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            {/* Changed By */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || "Staff"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {log.actor_role || log.user?.role || "admin"}
                              </div>
                            </td>
                            {/* Modification Details */}
                            <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                              {description || JSON.stringify(details || meta)}
                            </td>
                          </>
                        ) : activeTab === "auth" ? (
                          <>
                            {/* User Account */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-bold text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || log.user?.email || "User"}
                              </div>
                              {log.user?.email && (
                                <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[160px]">
                                  {log.user.email}
                                </div>
                              )}
                            </td>
                            {/* Auth Activity */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionStyle.bgClass} ${actionStyle.textClass}`}>
                                {formatAuditAction(log.action)}
                              </span>
                            </td>
                            {/* User Role */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono text-xs capitalize text-[var(--color-subtle)]">
                                {log.actor_role || log.user?.role || "user"}
                              </span>
                            </td>
                            {/* IP Origin */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--color-mute)]">
                              {log.ip_address || "Internal / System"}
                            </td>
                            {/* Details */}
                            <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                              {description || JSON.stringify(details || meta)}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* General Activity */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[var(--color-ink)]">
                                {formatAuditAction(log.action)}
                              </div>
                              <div className="mt-0.5">
                                <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${categoryStyle.bgClass} ${categoryStyle.textClass}`}>
                                  {categoryStyle.label}
                                </span>
                              </div>
                            </td>
                            {/* Target Entity */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono font-semibold text-[var(--color-ink)]">
                                {log.entity_name || log.entity_id || "N/A"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider">
                                {log.entity_type || "Entity"}
                              </div>
                            </td>
                            {/* Actor */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-medium text-[var(--color-ink)]">
                                {log.actor_name || log.user?.full_name || "System"}
                              </div>
                              <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                                {log.actor_role || log.user?.role || "system"}
                              </div>
                            </td>
                            {/* Details */}
                            <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                              {description || JSON.stringify(details || meta)}
                            </td>
                          </>
                        )}

                        {/* Severity */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${severityStyle.bgClass} ${severityStyle.textClass}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1 ${severityStyle.dotClass}`}
                            />
                            {severityStyle.label}
                          </span>
                        </td>

                        {/* Action View */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1.5 text-[var(--color-mute)] hover:text-[var(--color-primary)] hover:bg-[var(--color-canvas)] rounded-md transition-colors"
                            aria-label="View log details"
                          >
                            <AnimatedEye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List (block sm:hidden) */}
          <div className="block sm:hidden space-y-2.5">
            {initialLogs.map((log) => {
              const actionStyle = getAuditActionStyle(log.action);
              const severityStyle = getAuditSeverityStyle(log.severity || "info");
              const description = getAuditLogDescription(log);
              const meta = (log.metadata || {}) as Record<string, any>;

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 shadow-sm active:bg-[var(--color-canvas-subtle)] transition-colors min-h-[44px]"
                >
                  {/* Top Bar: Action & Severity */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-xs text-[var(--color-ink)] leading-snug">
                      {formatAuditAction(log.action)}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${severityStyle.bgClass} ${severityStyle.textClass}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1 ${severityStyle.dotClass}`}
                      />
                      {severityStyle.label}
                    </span>
                  </div>

                  {/* Domain-specific highlights on mobile */}
                  {activeTab === "assignments" && (meta.operator_name || meta.supervisor_name) && (
                    <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">
                      Assigned: {meta.operator_name || meta.supervisor_name}
                    </div>
                  )}

                  {activeTab === "rentals" && (meta.client_name || meta.company_name) && (
                    <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">
                      Client: {meta.client_name || meta.company_name}
                    </div>
                  )}

                  {/* Description / Summary */}
                  {description && (
                    <p className="text-xs text-[var(--color-subtle)] line-clamp-2 mb-2">
                      {description}
                    </p>
                  )}

                  {/* Meta Strip */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-2 border-t border-[var(--color-hairline)]">
                    <div className="flex items-center gap-1 font-mono">
                      <span>By: {log.actor_name || log.user?.full_name || "System"}</span>
                      {log.entity_name && (
                        <span>• <span className="text-[var(--color-ink)]">{log.entity_name}</span></span>
                      )}
                    </div>
                    <div className="font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="pt-2">
              <Pagination
                page={currentPage}
                pageSize={25}
                total={totalCount}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Detail Slide-Over Drawer */}
      <AuditDetailDrawer
        log={selectedLog}
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
