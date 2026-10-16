"use client";

import React from "react";
import { Highlight } from "@/components/ui/Highlight";
import { AnimatedEye } from "@/components/ui/animated-icons";
import {
  formatAuditAction,
  getAuditActionStyle,
  getAuditSeverityStyle,
  getAuditCategoryStyle,
  getAuditLogDescription,
} from "@/lib/audit-helpers";
import type { AuditLogWithUser } from "@/lib/types/database";
import type { AuditTab } from "@/lib/queries/audit-logs";
import { formatAuditTime, formatAuditDate } from "./AuditLogMobileCard";

export interface AuditLogTableProps {
  logs: AuditLogWithUser[];
  activeTab: AuditTab;
  currentSearch?: string;
  onSelect: (log: AuditLogWithUser) => void;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  activeTab,
  currentSearch = "",
  onSelect,
}) => {
  return (
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
            {logs.map((log) => {
              const actionStyle = getAuditActionStyle(log.action);
              const severityStyle = getAuditSeverityStyle(log.severity || "info");
              const categoryStyle = getAuditCategoryStyle(log.category || "system");
              const description = getAuditLogDescription(log);
              const meta = (log.metadata || {}) as Record<string, any>;
              const details = (log.details || {}) as Record<string, any>;

              return (
                <tr
                  key={log.id}
                  onClick={() => onSelect(log)}
                  className="hover:bg-[var(--color-canvas-subtle)] cursor-pointer transition-colors group"
                >
                  {/* Timestamp */}
                  <td suppressHydrationWarning className="py-3 px-4 whitespace-nowrap">
                    <div suppressHydrationWarning className="font-mono text-xs text-[var(--color-ink)] font-medium">
                      {formatAuditTime(log.created_at, true)}
                    </div>
                    <div suppressHydrationWarning className="text-[11px] text-[var(--color-mute)]">
                      {formatAuditDate(log.created_at)}
                    </div>
                  </td>

                  {/* ── TAB-CUSTOMIZED DATA CELLS ── */}
                  {activeTab === "assignments" ? (
                    <>
                      {/* Machine */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[var(--color-ink)]">
                        <Highlight text={log.entity_name || log.entity_id || meta.machine_code || "Machine"} query={currentSearch} />
                      </td>
                      {/* Assigned Operator/Supervisor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[var(--color-ink)]">
                          <Highlight text={meta.operator_name || meta.supervisor_name || meta.user_name || details.operator_name || log.entity_name || "N/A"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                          {meta.supervisor_name ? "Supervisor" : "Operator"}
                        </div>
                      </td>
                      {/* Assigned By */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-[var(--color-ink)]">
                          <Highlight text={log.actor_name || log.user?.full_name || meta.assigned_by_name || "Supervisor"} query={currentSearch} />
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
                        <Highlight text={log.entity_name || meta.machine_code || meta.machine_id || "Machine"} query={currentSearch} />
                      </td>
                      {/* Client Site */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[var(--color-ink)]">
                          <Highlight text={meta.client_name || meta.company_name || (log.entity_type === "client" ? log.entity_name : "Client Site")} query={currentSearch} />
                        </div>
                        {meta.location && (
                          <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[140px]">
                            <Highlight text={meta.location} query={currentSearch} />
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
                          <Highlight text={log.actor_name || log.user?.full_name || "Staff"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                          {log.actor_role || log.user?.role || "admin"}
                        </div>
                      </td>
                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                        <Highlight text={description || JSON.stringify(details || meta)} query={currentSearch} />
                      </td>
                    </>
                  ) : activeTab === "employees" ? (
                    <>
                      {/* Target Employee */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[var(--color-ink)]">
                          <Highlight text={log.entity_name || meta.full_name || meta.user_name || meta.email || "Employee"} query={currentSearch} />
                        </div>
                        {meta.email && (
                          <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[160px]">
                            <Highlight text={meta.email} query={currentSearch} />
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
                          <Highlight text={log.actor_name || log.user?.full_name || "Admin"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                          {log.actor_role || log.user?.role || "super_admin"}
                        </div>
                      </td>
                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                        <Highlight text={description || JSON.stringify(details || meta)} query={currentSearch} />
                      </td>
                    </>
                  ) : activeTab === "machine" ? (
                    <>
                      {/* Machine Code */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-[var(--color-ink)] text-sm">
                          <Highlight text={log.entity_name || log.entity_id || meta.machine_code || "Machine"} query={currentSearch} />
                        </div>
                        {meta.model && (
                          <div className="text-[10px] text-[var(--color-mute)]">
                            Model: <Highlight text={meta.model} query={currentSearch} />
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
                          <Highlight text={log.actor_name || log.user?.full_name || "Staff"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                          {log.actor_role || log.user?.role || "admin"}
                        </div>
                      </td>
                      {/* Modification Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                        <Highlight text={description || JSON.stringify(details || meta)} query={currentSearch} />
                      </td>
                    </>
                  ) : activeTab === "auth" ? (
                    <>
                      {/* User Account */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[var(--color-ink)]">
                          <Highlight text={log.actor_name || log.user?.full_name || log.user?.email || "User"} query={currentSearch} />
                        </div>
                        {log.user?.email && (
                          <div className="text-[10px] text-[var(--color-mute)] truncate max-w-[160px]">
                            <Highlight text={log.user.email} query={currentSearch} />
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
                        <Highlight text={description || JSON.stringify(details || meta)} query={currentSearch} />
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
                          <Highlight text={log.entity_name || log.entity_id || "N/A"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider">
                          {log.entity_type || "Entity"}
                        </div>
                      </td>
                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-[var(--color-ink)]">
                          <Highlight text={log.actor_name || log.user?.full_name || "System"} query={currentSearch} />
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono capitalize">
                          {log.actor_role || log.user?.role || "system"}
                        </div>
                      </td>
                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-[var(--color-subtle)]">
                        <Highlight text={description || JSON.stringify(details || meta)} query={currentSearch} />
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
                        onSelect(log);
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
  );
};
