"use client";

import { useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AnimatedCheck,
  AnimatedCopy,
  AnimatedClock,
  AnimatedUser,
  AnimatedShield,
} from "@/components/ui/animated-icons";
import { ExternalLink, Layers, Globe } from "lucide-react";
import {
  formatAuditAction,
  getAuditActionStyle,
  getAuditSeverityStyle,
  getAuditCategoryStyle,
  getAuditLogDescription,
} from "@/lib/audit-helpers";
import type { AuditLogWithUser } from "@/lib/types/database";

interface AuditDetailDrawerProps {
  log: AuditLogWithUser | null;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ log, open, onClose }: AuditDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const severityStyle = getAuditSeverityStyle(log.severity || "info");
  const categoryStyle = getAuditCategoryStyle(log.category || "system");
  const description = getAuditLogDescription(log);

  const handleCopyJson = () => {
    const payload = {
      id: log.id,
      action: log.action,
      category: log.category,
      severity: log.severity,
      created_at: log.created_at,
      actor: {
        id: log.user_id,
        name: log.actor_name || log.user?.full_name || "System",
        role: log.actor_role || log.user?.role || "system",
        email: log.user?.email || null,
        ip_address: log.ip_address || null,
      },
      entity: {
        type: log.entity_type,
        id: log.entity_id,
        name: log.entity_name,
      },
      metadata: log.metadata,
      details: log.details,
      before_state: log.before_state,
      after_state: log.after_state,
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compute State Diff keys
  const beforeKeys = Object.keys(log.before_state || {});
  const afterKeys = Object.keys(log.after_state || {});
  const allDiffKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex flex-col gap-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-[var(--color-ink)]">
              {formatAuditAction(log.action)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${severityStyle.bgClass} ${severityStyle.textClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${severityStyle.dotClass}`} />
              {severityStyle.label}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryStyle.bgClass} ${categoryStyle.textClass}`}
            >
              {categoryStyle.label}
            </span>
          </div>
          <span className="text-xs text-[var(--color-mute)] font-mono">
            ID: {log.id}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="text-xs gap-1.5"
          >
            {copied ? (
              <>
                <AnimatedCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied JSON</span>
              </>
            ) : (
              <>
                <AnimatedCopy className="w-3.5 h-3.5" />
                <span>Copy Raw JSON</span>
              </>
            )}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Description Banner */}
        {description && (
          <div className="p-3 bg-[var(--color-canvas-subtle)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] block mb-1">
              Event Narrative
            </span>
            <p className="text-sm font-medium text-[var(--color-ink)] leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Core Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Actor Info */}
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
            <div className="flex items-center gap-1.5 text-[var(--color-mute)] font-semibold text-[11px] uppercase tracking-wider">
              <AnimatedUser className="w-3.5 h-3.5" />
              <span>Actor Information</span>
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--color-ink)]">
                {log.actor_name || log.user?.full_name || "System"}
              </div>
              <div className="text-[11px] text-[var(--color-subtle)] mt-0.5">
                Role: <span className="font-mono capitalize">{log.actor_role || log.user?.role || "system"}</span>
              </div>
              {log.user?.email && (
                <div className="text-[11px] text-[var(--color-mute)] truncate mt-0.5">
                  {log.user.email}
                </div>
              )}
            </div>
          </div>

          {/* Timestamp & IP */}
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
            <div className="flex items-center gap-1.5 text-[var(--color-mute)] font-semibold text-[11px] uppercase tracking-wider">
              <AnimatedClock className="w-3.5 h-3.5" />
              <span>Timestamp & Origin</span>
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-[var(--color-ink)]">
                {new Date(log.created_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </div>
              <div className="text-[11px] text-[var(--color-subtle)] mt-0.5 font-mono">
                ISO: {log.created_at}
              </div>
              <div className="text-[11px] text-[var(--color-mute)] mt-0.5 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>IP: {log.ip_address || "Internal / System"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Target Entity Information */}
        {(log.entity_type || log.entity_name || log.entity_id) && (
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[var(--color-mute)] font-semibold text-[11px] uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Target Entity</span>
              </div>
              {log.entity_type === "machine" && log.entity_id && (
                <Link
                  href={`/machines?search=${encodeURIComponent(log.entity_name || log.entity_id)}`}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                >
                  <span>View Machine</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
              {log.entity_type === "user" && log.entity_id && (
                <Link
                  href="/users"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                >
                  <span>View Users</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider block">
                  Entity Type
                </span>
                <span className="font-semibold text-xs text-[var(--color-ink)] capitalize">
                  {log.entity_type || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider block">
                  Entity Name / Code
                </span>
                <span className="font-semibold text-xs text-[var(--color-ink)] font-mono">
                  {log.entity_name || "N/A"}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-[var(--color-mute)] uppercase tracking-wider block">
                  Entity ID
                </span>
                <span className="font-mono text-[11px] text-[var(--color-subtle)] truncate block">
                  {log.entity_id || "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State Mutation / Before-After Comparison */}
        {allDiffKeys.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                State Mutation Diff (Before vs After)
              </span>
            </div>
            <div className="border border-[var(--color-hairline)] rounded-[var(--radius-sm)] overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[var(--color-canvas-subtle)] border-b border-[var(--color-hairline)]">
                    <th className="py-2 px-3 font-semibold text-[var(--color-subtle)] w-1/3">Field</th>
                    <th className="py-2 px-3 font-semibold text-rose-600 dark:text-rose-400 w-1/3">Previous (Before)</th>
                    <th className="py-2 px-3 font-semibold text-emerald-600 dark:text-emerald-400 w-1/3">New (After)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)] font-mono">
                  {allDiffKeys.map((key) => {
                    const beforeVal = (log.before_state as Record<string, unknown> | null)?.[key];
                    const afterVal = (log.after_state as Record<string, unknown> | null)?.[key];
                    const isChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

                    return (
                      <tr
                        key={key}
                        className={isChanged ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-[var(--color-canvas-subtle)]"}
                      >
                        <td className="py-2 px-3 font-medium text-[var(--color-ink)] font-sans">
                          {key}
                        </td>
                        <td className="py-2 px-3 text-rose-600 dark:text-rose-400 break-all">
                          {beforeVal !== undefined ? JSON.stringify(beforeVal) : <span className="text-[var(--color-mute)] italic">—</span>}
                        </td>
                        <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 break-all font-semibold">
                          {afterVal !== undefined ? JSON.stringify(afterVal) : <span className="text-[var(--color-mute)] italic">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Event Metadata & Additional Details */}
        {(log.metadata || log.details) && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] block">
              Event Details & Payload
            </span>
            <div className="bg-[var(--color-canvas-subtle)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)] p-3 font-mono text-[11px] overflow-x-auto max-h-56">
              <pre className="text-[var(--color-ink)] whitespace-pre-wrap break-words">
                {JSON.stringify(log.details || log.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
