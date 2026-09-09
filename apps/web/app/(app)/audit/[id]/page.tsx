import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, requirePermission } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AnimatedChevronLeft,
  AnimatedClock,
  AnimatedUser,
} from "@/components/ui/animated-icons";
import { Globe, Layers, ExternalLink } from "lucide-react";
import {
  formatAuditAction,
  getAuditActionStyle,
  getAuditSeverityStyle,
  getAuditCategoryStyle,
  getAuditLogDescription,
} from "@/lib/audit-helpers";
import type { AuditLogWithUser } from "@/lib/types/database";

export const metadata = {
  title: "Audit Event Detail | ReachInternational",
  description: "Detailed immutable audit trail event record.",
};

interface AuditDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  await requirePermission("audit.view");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: rawLog, error } = await supabase
    .from("audit_logs")
    .select(
      `id, user_id, action, entity_type, entity_id,
       category, severity,
       metadata, details, before_state, after_state,
       actor_name, actor_role, entity_name,
       ip_address, created_at,
       user:users(id, full_name, email, role)`
    )
    .eq("id", id)
    .single();

  if (error || !rawLog) {
    notFound();
  }

  const log = rawLog as unknown as AuditLogWithUser;
  const severityStyle = getAuditSeverityStyle(log.severity || "info");
  const categoryStyle = getAuditCategoryStyle(log.category || "system");
  const description = getAuditLogDescription(log);

  // Compute Diff keys
  const beforeKeys = Object.keys(log.before_state || {});
  const afterKeys = Object.keys(log.after_state || {});
  const allDiffKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back to Audit Logs */}
      <div>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-subtle)] hover:text-[var(--color-ink)] transition-colors"
        >
          <AnimatedChevronLeft className="w-3.5 h-3.5" />
          <span>Back to Audit Logs</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline)]">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
              {formatAuditAction(log.action)}
            </h1>
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
          <span className="font-mono text-xs text-[var(--color-mute)]">
            Audit ID: {log.id}
          </span>
        </div>
      </div>

      {/* Description Banner */}
      {description && (
        <div className="p-4 bg-[var(--color-canvas-subtle)] border border-[var(--color-hairline)] rounded-[var(--radius-md)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] block mb-1">
            Event Description
          </span>
          <p className="text-base font-medium text-[var(--color-ink)] leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Core Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Actor Information */}
        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
          <div className="flex items-center gap-2 text-[var(--color-mute)] font-semibold text-xs uppercase tracking-wider">
            <AnimatedUser className="w-4 h-4" />
            <span>Actor Details</span>
          </div>
          <div>
            <div className="text-base font-bold text-[var(--color-ink)]">
              {log.actor_name || log.user?.full_name || "System"}
            </div>
            <div className="text-xs text-[var(--color-subtle)] mt-0.5">
              Role: <span className="font-mono capitalize">{log.actor_role || log.user?.role || "system"}</span>
            </div>
            {log.user?.email && (
              <div className="text-xs text-[var(--color-mute)] mt-0.5">
                {log.user.email}
              </div>
            )}
            {log.user_id && (
              <div className="text-[11px] font-mono text-[var(--color-mute)] mt-1">
                User ID: {log.user_id}
              </div>
            )}
          </div>
        </div>

        {/* Timestamp & Origin */}
        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
          <div className="flex items-center gap-2 text-[var(--color-mute)] font-semibold text-xs uppercase tracking-wider">
            <AnimatedClock className="w-4 h-4" />
            <span>Timestamp & Network Origin</span>
          </div>
          <div>
            <div className="text-sm font-mono font-bold text-[var(--color-ink)]">
              {new Date(log.created_at).toLocaleString("en-US", {
                dateStyle: "full",
                timeStyle: "long",
              })}
            </div>
            <div className="text-xs text-[var(--color-subtle)] mt-1 font-mono">
              ISO: {log.created_at}
            </div>
            <div className="text-xs text-[var(--color-mute)] mt-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>IP Address: {log.ip_address || "Internal System"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Entity Information */}
      {(log.entity_type || log.entity_name || log.entity_id) && (
        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--color-mute)] font-semibold text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Target Entity</span>
            </div>
            {log.entity_type === "machine" && log.entity_id && (
              <Link
                href={`/machines?search=${encodeURIComponent(log.entity_name || log.entity_id)}`}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <span>View Machine Details</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {log.entity_type === "user" && log.entity_id && (
              <Link
                href="/users"
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <span>View User Accounts</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-[var(--color-mute)] uppercase tracking-wider block">
                Entity Type
              </span>
              <span className="font-semibold text-sm text-[var(--color-ink)] capitalize">
                {log.entity_type || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--color-mute)] uppercase tracking-wider block">
                Entity Name / Code
              </span>
              <span className="font-semibold text-sm text-[var(--color-ink)] font-mono">
                {log.entity_name || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--color-mute)] uppercase tracking-wider block">
                Entity ID
              </span>
              <span className="font-mono text-xs text-[var(--color-subtle)] truncate block">
                {log.entity_id || "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* State Mutation Diff */}
      {allDiffKeys.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] block">
            State Mutation Diff (Before vs After)
          </span>
          <div className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-canvas-elevated)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-canvas-subtle)] border-b border-[var(--color-hairline)]">
                  <th className="py-2.5 px-4 font-semibold text-[var(--color-subtle)] w-1/3">Field</th>
                  <th className="py-2.5 px-4 font-semibold text-rose-600 dark:text-rose-400 w-1/3">Previous (Before)</th>
                  <th className="py-2.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400 w-1/3">New (After)</th>
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
                      <td className="py-2.5 px-4 font-medium text-[var(--color-ink)] font-sans">
                        {key}
                      </td>
                      <td className="py-2.5 px-4 text-rose-600 dark:text-rose-400 break-all">
                        {beforeVal !== undefined ? JSON.stringify(beforeVal) : <span className="text-[var(--color-mute)] italic">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-600 dark:text-emerald-400 break-all font-semibold">
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

      {/* Raw Event Details & Metadata */}
      {(log.details || log.metadata) && (
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] block">
            Raw Payload & Metadata
          </span>
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-4 font-mono text-xs overflow-x-auto">
            <pre className="text-[var(--color-ink)] whitespace-pre-wrap break-words">
              {JSON.stringify(log.details || log.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
