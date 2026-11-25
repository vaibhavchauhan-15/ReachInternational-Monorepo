"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  AlertCircle,
  Clock,
  RefreshCw,
  MapPin,
  ArrowRight,
  Shield,
  Trash2,
  ArrowRightLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  User,
  Cpu,
  Calendar,
  Check,
  Copy,
} from "lucide-react";
import { AnimatedLoader } from "@/components/ui/animated-icons";
import { Card, Badge, Button, EmptyState, Modal } from "@/components/ui";
import { getMachineAuditAction } from "@/app/actions/machines";
import type { MachineWithEngineer } from "@/lib/types/database";

interface AuditTabProps {
  machineId: string;
  isAdmin: boolean;
  machine?: MachineWithEngineer | null;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  category: string | null;
  severity: "info" | "warning" | "critical" | null;
  actor_name: string | null;
  actor_role: string | null;
  metadata: Record<string, any> | null;
  details: Record<string, any> | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  created_at: string;
  user?: { id: string; full_name: string; role: string }[] | { id: string; full_name: string; role: string } | null;
}

export interface AuditDiffItem {
  field: string;
  label: string;
  previous: string;
  updated: string;
}

export interface AuditDeletionItem {
  field: string;
  label: string;
  deletedValue: string;
  reason?: string;
}

export interface EnrichedAuditLog extends AuditLog {
  diffs: AuditDiffItem[];
  deletions: AuditDeletionItem[];
  isDeletionEvent: boolean;
  isBreakdown: boolean;
}

// ─── Utility Helpers ───

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

function formatLogDateHeader(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Unknown Date";
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

function formatTimeWithSeconds(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatFullDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    const time = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return dateStr;
  }
}

function formatShiftTimingWithDate(meta: Record<string, any>): string {
  const startDate = meta.startDate || meta.logDate || meta.start_date || meta.log_date;
  const endDate = meta.endDate || meta.end_date || startDate;
  const startTime = meta.startTime || meta.start_time;
  const endTime = meta.endTime || meta.end_time;

  const formatDateShort = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = d.getDate();
      const month = MONTH_NAMES[d.getMonth()];
      return `${day} ${month}`;
    } catch {
      return dStr;
    }
  };

  if (startTime && endTime) {
    if (startDate && endDate && startDate !== endDate) {
      return `${formatDateShort(startDate)}, ${startTime} → ${formatDateShort(endDate)}, ${endTime}`;
    }
    if (startDate) {
      return `${formatDateShort(startDate)} • ${startTime} - ${endTime}`;
    }
    return `${startTime} - ${endTime}`;
  }

  if (startDate) {
    return `${formatDateShort(startDate)} • Shift Logged`;
  }

  return "Standard Shift";
}

function normalizeAuditUser(
  user: AuditLog["user"],
  fallbackName?: string | null,
  fallbackRole?: string | null
): { name: string; role: string } {
  let name = fallbackName || "";
  let role = fallbackRole || "";

  if (user) {
    const singleUser = Array.isArray(user) ? user[0] : user;
    if (singleUser?.full_name) name = singleUser.full_name;
    if (singleUser?.role) role = singleUser.role;
  }

  return {
    name: name || "System Operator",
    role: role || "Staff",
  };
}

type ActionCategory = "all" | "hour_logs" | "breakdowns" | "assignments" | "updates";

function isHmrAction(action: string): boolean {
  const act = action.toLowerCase();
  return act.includes("hour_logged") || act.includes("hmr") || act.includes("meter");
}

function isBreakdownActionOrMeta(log: AuditLog): boolean {
  const act = log.action.toLowerCase();
  if (act.includes("breakdown")) return true;
  if (log.metadata?.isBreakdown === true || log.metadata?.is_breakdown === true) return true;
  if (
    log.metadata?.breakdownDuration &&
    String(log.metadata.breakdownDuration) !== "0" &&
    String(log.metadata.breakdownDuration) !== "0h"
  ) {
    return true;
  }
  if (log.metadata?.breakdownHours && Number(log.metadata.breakdownHours) > 0) return true;
  if (log.metadata?.breakdownReason) return true;
  return false;
}

function isAssignAction(action: string): boolean {
  const act = action.toLowerCase();
  return act.includes("assign") || act.includes("operator") || act.includes("supervisor");
}

function isUpdateAction(action: string): boolean {
  return !isHmrAction(action) && !isAssignAction(action);
}

function getActionPresentation(action: string, isPureRemoval?: boolean, isBreakdown?: boolean) {
  if (isBreakdown) {
    return {
      title: "Breakdown Logged",
      badgeVariant: "overdue" as const,
      isBreakdown: true,
    };
  }

  const act = action.toLowerCase();
  if (act.includes("hour_logged")) {
    return {
      title: "Hour Meter Logged",
      badgeVariant: "success" as const,
      isBreakdown: false,
    };
  }
  if (act.includes("operator_assignment_ended") || act.includes("assignment_ended")) {
    return {
      title: "Operator Unassigned",
      badgeVariant: "overdue" as const,
      isBreakdown: false,
    };
  }
  if (act.includes("operator_assigned")) {
    return {
      title: isPureRemoval ? "Operator Removed" : "Operator Assigned",
      badgeVariant: isPureRemoval ? ("overdue" as const) : ("info" as const),
      isBreakdown: false,
    };
  }
  if (act.includes("operators_updated")) {
    return {
      title: isPureRemoval ? "Operators Removed" : "Operators Updated",
      badgeVariant: isPureRemoval ? ("overdue" as const) : ("info" as const),
      isBreakdown: false,
    };
  }
  if (act.includes("reassigned_supervisor") || act.includes("supervisors_updated")) {
    return {
      title: isPureRemoval ? "Supervisor Removed" : "Supervisor Assigned",
      badgeVariant: isPureRemoval ? ("overdue" as const) : ("info" as const),
      isBreakdown: false,
    };
  }
  if (act.includes("client_assignment_updated")) {
    return {
      title: isPureRemoval ? "Client Removed" : "Client Updated",
      badgeVariant: isPureRemoval ? ("overdue" as const) : ("info" as const),
      isBreakdown: false,
    };
  }
  if (act.includes("operational_status") || act.includes("status")) {
    return {
      title: "Status Updated",
      badgeVariant: "warning" as const,
      isBreakdown: false,
    };
  }
  if (act.includes("created")) {
    return {
      title: "Machine Created",
      badgeVariant: "success" as const,
      isBreakdown: false,
    };
  }
  if (act.includes("delete") || act.includes("deactivated")) {
    return {
      title: "Machine Deleted",
      badgeVariant: "overdue" as const,
      isBreakdown: false,
    };
  }
  if (act.includes("info_updated") || act.includes("updated")) {
    return {
      title: "Machine Updated",
      badgeVariant: "neutral" as const,
      isBreakdown: false,
    };
  }
  return {
    title: action.replace(/_/g, " ").replace(/\./g, " › ").replace(/\b\w/g, (l) => l.toUpperCase()),
    badgeVariant: "neutral" as const,
    isBreakdown: false,
  };
}

// Format technical field names to readable human labels
function formatFieldLabel(key: string): string {
  switch (key) {
    case "hour_meter":
      return "Hour Meter Reading";
    case "health_status":
      return "Health Status";
    case "status":
      return "Rental Fleet Status";
    case "client_id":
      return "Client Assignment";
    case "model":
      return "Machine Model";
    case "serial_number":
      return "Serial Number";
    case "year_of_mfg":
      return "Year of Mfg";
    case "manufacturer":
      return "Manufacturer";
    case "machine_id":
      return "Machine Code";
    case "operator_ids":
    case "current_operator_id":
      return "Assigned Operators";
    case "supervisor_ids":
    case "current_supervisor_id":
      return "Assigned Supervisors";
    default:
      return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// Format values for human-readable audit diffs
function formatDiffValue(val: any): string {
  if (val === null || val === undefined || val === "") return "None";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") {
    if (val === "active") return "Active";
    if (val === "under_maintenance") return "Under Maintenance";
    if (val === "breakdown") return "Breakdown";
    if (val === "spare") return "Spare";
    if (val === "available") return "Available";
    if (val === "rented") return "On Rent";
    return val;
  }
  if (Array.isArray(val)) {
    return val.length === 0 ? "None" : val.join(", ");
  }
  return JSON.stringify(val);
}

// ─── Filter Out Raw Technical Redundancies ───
const NOISY_SYSTEM_KEYS = new Set([
  "idempotencyKey",
  "idempotency_key",
  "logId",
  "log_id",
  "clientId",
  "client_id",
  "machineId",
  "machine_id",
  "operatorId",
  "operator_id",
  "supervisorId",
  "supervisor_id",
  "startDatetime",
  "endDatetime",
  "created_at",
  "updated_at",
  "changes",
  "previous_operator_ids",
  "previous_supervisor_ids",
  "previous_client_id",
  "previous_client_name",
  "removed_operator_ids",
  "added_operator_ids",
  "removed_supervisor_ids",
  "added_supervisor_ids",
  "deleted_record",
]);

function sanitizeMetadata(rawMeta: Record<string, any> | null): Record<string, any> {
  if (!rawMeta || typeof rawMeta !== "object") return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawMeta)) {
    if (!NOISY_SYSTEM_KEYS.has(key) && value !== null && value !== undefined && value !== "") {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ─── Skeleton Loader ───
function AuditTabSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 p-3 sm:p-4 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
        <AnimatedLoader isSpinning size={16} className="text-sky-500" />
        <span className="text-xs font-semibold text-[var(--color-ink)]">
          Loading audit trail history...
        </span>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] animate-pulse flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-[var(--color-hairline)] rounded-md" />
              <div className="h-4 w-28 bg-[var(--color-hairline)] rounded" />
              <div className="h-4 w-16 bg-[var(--color-hairline)] rounded" />
            </div>
            <div className="h-4 w-20 bg-[var(--color-hairline)] rounded" />
          </div>
          <div className="h-6 bg-[var(--color-hairline)]/60 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN AUDIT TAB COMPONENT
// ═══════════════════════════════════════════════════════
export default function AuditTab({ machineId, machine }: AuditTabProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // Category filter state (including Breakdowns)
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>("all");

  // Selected Log for Complete Details Drawer
  const [activeAuditLog, setActiveAuditLog] = useState<EnrichedAuditLog | null>(null);
  const [isRawJsonExpanded, setIsRawJsonExpanded] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState(false);

  // Machine specs fallback
  const machineModel = machine?.model || "50B-9";
  const machineSerial = machine?.serial_number || "";
  const machineCode = machine?.machine_id || "";

  // On-demand fetch with state cache
  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getMachineAuditAction(machineId);
      if (res.unauthorized) {
        setUnauthorized(true);
        setAuditLogs([]);
        setHasLoaded(true);
      } else if (res.success) {
        setAuditLogs(res.auditLogs || []);
        setHasLoaded(true);
      } else {
        setError(res.error || "Failed to load audit logs.");
        setAuditLogs([]);
        setHasLoaded(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setAuditLogs([]);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [machineId]);

  // Auto-load on mount
  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Fast entity name resolver map (User IDs & Client IDs -> display names)
  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; role?: string }>();

    // Seed from machine props
    if (machine?.operators) {
      machine.operators.forEach((op: any) => {
        if (op?.id) map.set(op.id, { name: op.full_name || "Operator", role: op.role });
      });
    }
    if (machine?.supervisors) {
      machine.supervisors.forEach((sup: any) => {
        if (sup?.id) map.set(sup.id, { name: sup.full_name || "Supervisor", role: sup.role });
      });
    }
    if (machine?.current_operator?.id) {
      map.set(machine.current_operator.id, {
        name: machine.current_operator.full_name || "Current Operator",
        role: "operator",
      });
    }
    if (machine?.current_supervisor?.id) {
      map.set(machine.current_supervisor.id, {
        name: machine.current_supervisor.full_name || "Current Supervisor",
        role: "supervisor",
      });
    }

    // Seed from logs
    if (auditLogs) {
      auditLogs.forEach((l) => {
        if (l.user) {
          const u = Array.isArray(l.user) ? l.user[0] : l.user;
          if (u?.id && u?.full_name) {
            map.set(u.id, { name: u.full_name, role: u.role });
          }
        }
        if (l.metadata?.operatorId && l.metadata?.operatorName) {
          map.set(l.metadata.operatorId, { name: l.metadata.operatorName, role: "operator" });
        }
      });
    }

    return map;
  }, [machine, auditLogs]);

  const resolveUserName = useCallback(
    (userId?: string | null): string => {
      if (!userId) return "None";
      const found = userMap.get(userId);
      if (found?.name) return found.name;
      return `User (${userId.slice(0, 8)})`;
    },
    [userMap]
  );

  const resolveClientName = useCallback(
    (clientId?: string | null): string => {
      if (!clientId) return "None (Available)";
      if (machine?.client_id === clientId && machine.client?.company_name) {
        return machine.client.company_name;
      }
      return `Client (${clientId.slice(0, 8)})`;
    },
    [machine]
  );

  // ─── Enriched Audit Logs with Previous vs Updated Details and Deletions ───
  const enrichedLogs = useMemo<EnrichedAuditLog[]>(() => {
    if (!auditLogs || auditLogs.length === 0) return [];

    // Sort chronologically (oldest to newest) to maintain a running snapshot
    const chron = [...auditLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const runningSnapshot: Record<string, any> = {
      model: machine?.model,
      serial_number: machine?.serial_number,
      machine_id: machine?.machine_id,
      year_of_mfg: machine?.year_of_mfg,
      manufacturer: machine?.manufacturer,
      hour_meter: machine?.hour_meter,
      health_status: machine?.health_status,
      status: machine?.status,
      client_id: machine?.client_id,
      operator_ids: machine?.operator_ids || [],
      supervisor_ids: machine?.supervisor_ids || [],
    };

    const enrichedList: EnrichedAuditLog[] = [];

    for (const log of chron) {
      const act = log.action.toLowerCase();
      const isHourLog = isHmrAction(log.action);
      const isBreakdown = isBreakdownActionOrMeta(log);
      const isOpEnded = act.includes("operator_assignment_ended") || act.includes("assignment_ended");
      const isDeleteEvent = act.includes("delete") || act.includes("deactivated");
      const isOpUpdate = act.includes("operators_updated") || act.includes("operator_assigned");
      const isSupUpdate = act.includes("supervisors_updated") || act.includes("reassigned_supervisor");
      const isClientUpdate = act.includes("client_assignment_updated");
      const isStatusUpdate = act.includes("operational_status") || act.includes("status");
      const isInfoUpdate = act.includes("info_updated") || act.includes("updated");

      const diffs: AuditDiffItem[] = [];
      const deletions: AuditDeletionItem[] = [];

      // CASE A: Explicit changes object already recorded in metadata or before_state/after_state
      if (log.metadata?.changes && typeof log.metadata.changes === "object") {
        for (const [key, change] of Object.entries(log.metadata.changes as Record<string, any>)) {
          if (!change) continue;
          if (isHourLog && (key === "hour_meter" || key === "hourMeter")) continue; // Handled in log details

          if (change.deleted) {
            deletions.push({
              field: key,
              label: formatFieldLabel(key),
              deletedValue: formatDiffValue(change.previous),
              reason: "Removed / cleared during update",
            });
          } else if (JSON.stringify(change.previous) !== JSON.stringify(change.updated)) {
            let prevStr = formatDiffValue(change.previous);
            let updatedStr = formatDiffValue(change.updated);

            if (key === "operator_ids") {
              const prevList = Array.isArray(change.previous)
                ? change.previous.map(resolveUserName).join(", ")
                : resolveUserName(change.previous);
              const nextList = Array.isArray(change.updated)
                ? change.updated.map(resolveUserName).join(", ")
                : resolveUserName(change.updated);
              prevStr = prevList || "None";
              updatedStr = nextList || "None";
            } else if (key === "supervisor_ids" || key === "current_supervisor_id") {
              const prevList = Array.isArray(change.previous)
                ? change.previous.map(resolveUserName).join(", ")
                : resolveUserName(change.previous);
              const nextList = Array.isArray(change.updated)
                ? change.updated.map(resolveUserName).join(", ")
                : resolveUserName(change.updated);
              prevStr = prevList || "None";
              updatedStr = nextList || "None";
            } else if (key === "client_id") {
              prevStr = resolveClientName(change.previous);
              updatedStr = resolveClientName(change.updated);
            }

            if (updatedStr !== "None") {
              diffs.push({
                field: key,
                label: formatFieldLabel(key),
                previous: prevStr,
                updated: updatedStr,
              });
            } else {
              deletions.push({
                field: key,
                label: formatFieldLabel(key),
                deletedValue: prevStr,
                reason: "Unassigned from machine",
              });
            }
          }
        }
      }

      // CASE B: Hour Meter Log snapshot update
      if (isHourLog && log.metadata) {
        const end = log.metadata.endMeter ?? log.metadata.end_meter;
        if (end !== undefined) {
          runningSnapshot.hour_meter = end;
        }
      }

      // CASE C: Operator Assignment Ended / Removed
      if (isOpEnded && log.metadata) {
        const opName = log.metadata.operatorName || resolveUserName(log.metadata.operatorId);
        deletions.push({
          field: "operator",
          label: "Removed Operator Assignment",
          deletedValue: opName,
          reason: log.metadata.endReason
            ? `Assignment terminated: ${log.metadata.endReason}`
            : "Operator unassigned from machine roster",
        });
      }

      // CASE D: Machine Record Deletion / Deactivation
      if (isDeleteEvent) {
        const delMeta = log.metadata?.deleted_record || log.metadata || runningSnapshot;
        deletions.push({
          field: "machine",
          label: "Deleted Machine Asset Record",
          deletedValue: `${delMeta.model || machineModel} • Serial: ${delMeta.serial_number || machineSerial || "—"} (${delMeta.machine_id || machineCode || machineId})`,
          reason: "Machine asset permanently deleted from active inventory",
        });
      }

      // CASE E: Historical Sequential Diff fallback
      if (diffs.length === 0 && deletions.length === 0) {
        if (isOpUpdate && log.metadata) {
          const rawOps =
            log.metadata.operator_ids ||
            (log.metadata.current_operator_id ? [log.metadata.current_operator_id] : []);
          const prevOps: string[] = runningSnapshot.operator_ids || [];

          const removed = prevOps.filter((id) => !rawOps.includes(id));
          removed.forEach((id) => {
            deletions.push({
              field: "operator",
              label: "Removed Operator",
              deletedValue: resolveUserName(id),
              reason: "Unassigned from machine roster",
            });
          });

          const prevStr = prevOps.map(resolveUserName).join(", ") || "None";
          const nextStr = rawOps.map(resolveUserName).join(", ") || "None";
          if (nextStr !== "None" && prevStr !== nextStr) {
            diffs.push({
              field: "operator_ids",
              label: "Assigned Operators",
              previous: prevStr,
              updated: nextStr,
            });
          }
          runningSnapshot.operator_ids = rawOps;
        } else if (isSupUpdate && log.metadata) {
          const rawSups =
            log.metadata.supervisor_ids ||
            (log.metadata.current_supervisor_id ? [log.metadata.current_supervisor_id] : []);
          const prevSups: string[] = runningSnapshot.supervisor_ids || [];

          const removed = prevSups.filter((id) => !rawSups.includes(id));
          removed.forEach((id) => {
            deletions.push({
              field: "supervisor",
              label: "Removed Supervisor",
              deletedValue: resolveUserName(id),
              reason: "Unassigned from machine roster",
            });
          });

          const prevStr = prevSups.map(resolveUserName).join(", ") || "None";
          const nextStr = rawSups.map(resolveUserName).join(", ") || "None";
          if (nextStr !== "None" && prevStr !== nextStr) {
            diffs.push({
              field: "supervisor_ids",
              label: "Assigned Supervisors",
              previous: prevStr,
              updated: nextStr,
            });
          }
          runningSnapshot.supervisor_ids = rawSups;
        } else if (isClientUpdate && log.metadata) {
          const newClient = log.metadata.client_id;
          const prevClient = runningSnapshot.client_id;

          if (prevClient && !newClient) {
            deletions.push({
              field: "client_id",
              label: "De-allocated Client",
              deletedValue: resolveClientName(prevClient),
              reason: "Machine lease ended; returned to available fleet",
            });
          } else if (newClient && newClient !== prevClient) {
            diffs.push({
              field: "client_id",
              label: "Client Assignment",
              previous: resolveClientName(prevClient),
              updated: resolveClientName(newClient),
            });
          }
          runningSnapshot.client_id = newClient;
        } else if (isStatusUpdate && log.metadata) {
          if (log.metadata.health_status && log.metadata.health_status !== runningSnapshot.health_status) {
            diffs.push({
              field: "health_status",
              label: "Health Status",
              previous: formatDiffValue(runningSnapshot.health_status || "active"),
              updated: formatDiffValue(log.metadata.health_status),
            });
            runningSnapshot.health_status = log.metadata.health_status;
          }
          if (log.metadata.status && log.metadata.status !== runningSnapshot.status) {
            diffs.push({
              field: "status",
              label: "Rental Fleet Status",
              previous: formatDiffValue(runningSnapshot.status || "available"),
              updated: formatDiffValue(log.metadata.status),
            });
            runningSnapshot.status = log.metadata.status;
          }
        } else if (isInfoUpdate && log.metadata) {
          for (const key of [
            "model",
            "serial_number",
            "year_of_mfg",
            "manufacturer",
            "machine_id",
            "hour_meter",
            "health_status",
          ]) {
            if (log.metadata[key] !== undefined) {
              const oldVal = runningSnapshot[key];
              const newVal = log.metadata[key];
              if (oldVal !== undefined && String(oldVal) !== String(newVal)) {
                diffs.push({
                  field: key,
                  label: formatFieldLabel(key),
                  previous: formatDiffValue(oldVal),
                  updated: formatDiffValue(newVal),
                });
              }
              runningSnapshot[key] = newVal;
            }
          }
        }
      }

      // Deduplicate: If an entity was removed and already captured in deletions, exclude duplicate diff
      const cleanDiffs = diffs.filter((d) => {
        if (d.updated === "None" && deletions.length > 0) {
          const isCovered = deletions.some(
            (del) =>
              (d.field.includes("operator") && del.field.includes("operator")) ||
              (d.field.includes("supervisor") && del.field.includes("supervisor")) ||
              (d.field.includes("client") && del.field.includes("client"))
          );
          if (isCovered) return false;
        }
        return true;
      });

      enrichedList.push({
        ...log,
        diffs: cleanDiffs,
        deletions,
        isDeletionEvent: isDeleteEvent || isOpEnded || deletions.length > 0,
        isBreakdown,
      });
    }

    // Return in reverse chronological order (newest first for UI timeline)
    return enrichedList.reverse();
  }, [
    auditLogs,
    machine,
    machineModel,
    machineSerial,
    machineCode,
    machineId,
    resolveUserName,
    resolveClientName,
  ]);

  // Category counts (including Breakdowns)
  const counts = useMemo(() => {
    if (!enrichedLogs) return { all: 0, hour_logs: 0, breakdowns: 0, assignments: 0, updates: 0 };
    return {
      all: enrichedLogs.length,
      hour_logs: enrichedLogs.filter((l) => isHmrAction(l.action)).length,
      breakdowns: enrichedLogs.filter((l) => l.isBreakdown).length,
      assignments: enrichedLogs.filter((l) => isAssignAction(l.action)).length,
      updates: enrichedLogs.filter((l) => isUpdateAction(l.action)).length,
    };
  }, [enrichedLogs]);

  // Filtered logs strictly by Category
  const filteredLogs = useMemo(() => {
    if (!enrichedLogs) return [];
    if (selectedCategory === "all") return enrichedLogs;
    if (selectedCategory === "breakdowns") return enrichedLogs.filter((l) => l.isBreakdown);
    if (selectedCategory === "hour_logs") return enrichedLogs.filter((l) => isHmrAction(l.action));
    if (selectedCategory === "assignments") return enrichedLogs.filter((l) => isAssignAction(l.action));
    if (selectedCategory === "updates") return enrichedLogs.filter((l) => isUpdateAction(l.action));
    return enrichedLogs;
  }, [enrichedLogs, selectedCategory]);

  // Group logs by Date Header
  const groupedLogs = useMemo(() => {
    if (!filteredLogs.length) return [];
    const groups: { dateKey: string; dateLabel: string; logs: EnrichedAuditLog[] }[] = [];
    const map = new Map<string, EnrichedAuditLog[]>();

    for (const log of filteredLogs) {
      const label = formatLogDateHeader(log.created_at);
      if (!map.has(label)) {
        map.set(label, []);
        groups.push({ dateKey: label, dateLabel: label, logs: map.get(label)! });
      }
      map.get(label)!.push(log);
    }

    return groups;
  }, [filteredLogs]);

  // Helper to find operator name from machine rosters
  const resolveOperatorName = (meta: Record<string, any> | null) => {
    if (!meta) return "Field Operator";
    if (meta.operatorName) return meta.operatorName;
    if (meta.current_operator_id && machine?.operators && machine.operators.length > 0) {
      const match = machine.operators.find((op) => op.id === meta.current_operator_id);
      if (match?.full_name) return match.full_name;
    }
    if (
      Array.isArray(meta.operator_ids) &&
      meta.operator_ids[0] &&
      machine?.operators &&
      machine.operators.length > 0
    ) {
      const match = machine.operators.find((op) => op.id === meta.operator_ids[0]);
      if (match?.full_name) return match.full_name;
    }
    if (machine?.current_operator?.full_name) {
      return machine.current_operator.full_name;
    }
    return "Field Operator";
  };

  const handleCopyLogId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedLogId(true);
    setTimeout(() => setCopiedLogId(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header Controls & 5 Clean Action Category Filter Chips ── */}
      <Card padding="md" className="sm:p-5">
        <div className="flex flex-row items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-[var(--color-hairline)]">
          {/* Header Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
              Machine Logs & Audit Trail
            </h3>
            {hasLoaded && auditLogs && (
              <Badge variant="neutral" className="font-mono text-xs">
                {auditLogs.length} total
              </Badge>
            )}
          </div>

          {/* Action button: Show ONLY refresh icon */}
          <div className="flex items-center shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={13} className={isLoading ? "animate-spin text-sky-500" : ""} />}
              onClick={loadAuditLogs}
              disabled={isLoading}
              title="Refresh Audit Logs"
              aria-label="Refresh Audit Logs"
              className="w-8 h-8 p-0 flex items-center justify-center rounded-lg min-h-[36px] min-w-[36px]"
            />
          </div>
        </div>

        {/* ── 5 Category Filter Chips: All Logs | HMR Logs | Breakdowns | Assignments | Machine Updates ── */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0">
          {/* All Logs */}
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              selectedCategory === "all"
                ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-2xs"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span>All Logs</span>
            <span className="text-[10px] font-mono opacity-80">({counts.all})</span>
          </button>

          {/* HMR Logs */}
          <button
            type="button"
            onClick={() => setSelectedCategory("hour_logs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              selectedCategory === "hour_logs"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span>HMR Logs</span>
            <span className="text-[10px] font-mono opacity-80">({counts.hour_logs})</span>
          </button>

          {/* Breakdowns (Dedicated Operational Priority Tab) */}
          <button
            type="button"
            onClick={() => setSelectedCategory("breakdowns")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              selectedCategory === "breakdowns"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-rose-600 dark:hover:text-rose-400"
            }`}
          >
            <span>Breakdowns</span>
            <span className="text-[10px] font-mono opacity-80">({counts.breakdowns})</span>
          </button>

          {/* Assignments */}
          <button
            type="button"
            onClick={() => setSelectedCategory("assignments")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              selectedCategory === "assignments"
                ? "bg-sky-600 text-white shadow-2xs"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span>Assignments</span>
            <span className="text-[10px] font-mono opacity-80">({counts.assignments})</span>
          </button>

          {/* Machine Updates */}
          <button
            type="button"
            onClick={() => setSelectedCategory("updates")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              selectedCategory === "updates"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span>Machine Updates</span>
            <span className="text-[10px] font-mono opacity-80">({counts.updates})</span>
          </button>
        </div>
      </Card>

      {/* ── Loading State ── */}
      {isLoading && <AuditTabSkeleton />}

      {/* ── Unauthorized Access State ── */}
      {!isLoading && unauthorized && (
        <Card padding="md" className="py-12 text-center">
          <Shield className="h-10 w-10 text-[var(--color-mute)] mx-auto mb-3 opacity-50" />
          <h4 className="font-bold text-[var(--color-ink)] text-sm sm:text-base">
            Access Restricted
          </h4>
          <p className="text-xs text-[var(--color-mute)] mt-1 max-w-md mx-auto">
            Viewing system audit logs for fleet machines requires Service Manager or Administrator privileges.
          </p>
        </Card>
      )}

      {/* ── Error State ── */}
      {!isLoading && error && !unauthorized && (
        <Card padding="md" className="border-rose-500/30 bg-rose-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={loadAuditLogs}>
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* ── Empty State ── */}
      {!isLoading && !error && !unauthorized && hasLoaded && filteredLogs.length === 0 && (
        <Card padding="md" className="py-12 text-center">
          <EmptyState
            title={selectedCategory !== "all" ? "No Matching Records" : "No Audit History Found"}
            description={
              selectedCategory !== "all"
                ? "No audit records match your selected category filter. Try viewing all logs."
                : "No operational or configuration audit records have been logged for this machine yet."
            }
            action={
              selectedCategory !== "all" ? (
                <Button variant="secondary" size="sm" onClick={() => setSelectedCategory("all")}>
                  View All Logs
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {/* ── Structured Hybrid Responsive Timeline & Compact Rows ── */}
      {!isLoading && !error && !unauthorized && groupedLogs.length > 0 && (
        <div className="flex flex-col gap-5">
          {groupedLogs.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2">
              {/* Date Separator Header */}
              <div className="relative py-1.5 flex items-center gap-2.5">
                <div className="h-px bg-[var(--color-hairline)] flex-1" />
                <span className="text-xs font-bold font-mono text-[var(--color-ink)] px-3 py-0.5 rounded-full bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] shadow-2xs shrink-0">
                  {group.dateLabel}
                </span>
                <div className="h-px bg-[var(--color-hairline)] flex-1" />
              </div>

              {/* Log stream for this date group */}
              <div className="flex flex-col gap-2">
                {group.logs.map((log) => {
                  const userMeta = normalizeAuditUser(log.user, log.actor_name, log.actor_role);
                  const isHourLog = isHmrAction(log.action);
                  const isBreakdown = log.isBreakdown;
                  const isAssignLog = isAssignAction(log.action);
                  const hasDeletions = log.deletions && log.deletions.length > 0;
                  const hasDiffs = log.diffs && log.diffs.length > 0;
                  const isPureRemoval = hasDeletions && (!hasDiffs || log.diffs.every((d) => d.updated === "None"));
                  const presentation = getActionPresentation(log.action, isPureRemoval, isBreakdown);

                  return (
                    <div
                      key={log.id}
                      className={`group relative rounded-xl border transition-all ${
                        isBreakdown
                          ? "border-rose-500/40 bg-rose-500/[0.03] dark:bg-rose-500/[0.06] hover:border-rose-500/60"
                          : log.isDeletionEvent
                          ? "border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/40"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-[var(--color-hairline-soft-surface)]"
                      } p-3 sm:p-3.5 shadow-2xs`}
                    >
                      {/* ─────────────────────────────────────────────────────────────
                          DESKTOP & TABLET VIEW: Compact Horizontal Log Row (hidden sm:flex)
                          ───────────────────────────────────────────────────────────── */}
                      <div className="hidden sm:flex sm:flex-col gap-2">
                        {/* 1. Common Top Header Row: [LOG TYPE] Actor Name [ROLE] ... TIME */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Log Type Status Badge */}
                            <Badge
                              variant={presentation.badgeVariant}
                              className={`text-[11px] font-semibold shrink-0 ${
                                isBreakdown ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" : ""
                              }`}
                            >
                              {presentation.title}
                            </Badge>

                            {/* Actor Name */}
                            <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                              {userMeta.name}
                            </span>

                            {/* Actor Role Badge */}
                            <span className="text-[10px] font-semibold text-[var(--color-mute)] capitalize px-1.5 py-0.2 rounded bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] shrink-0">
                              {userMeta.role.replace(/_/g, " ")}
                            </span>

                            {/* Target Machine ID */}
                            <span className="text-[11px] text-[var(--color-mute)] shrink-0">
                              Machine:{" "}
                              <span className="font-semibold text-[var(--color-ink)]">
                                {log.metadata?.model || machineModel}
                              </span>
                              {(log.metadata?.machineCode || machineCode) && (
                                <span className="font-mono text-[10px] ml-1 px-1 py-0.2 rounded bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-[var(--color-ink)] font-bold">
                                  {log.metadata?.machineCode || machineCode}
                                </span>
                              )}
                              {(log.metadata?.serial_number || machineSerial) && (
                                <span className="font-mono text-[10px] text-[var(--color-mute)] hidden lg:inline ml-1">
                                  • {log.metadata?.serial_number || machineSerial}
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Time with Seconds Precision */}
                          <div className="flex items-center gap-1 text-[11px] text-[var(--color-mute)] font-mono shrink-0">
                            <Clock size={11} className="shrink-0" />
                            <span>{formatTimeWithSeconds(log.created_at)}</span>
                          </div>
                        </div>

                        {/* 2. Type-Specific Operational Information Strip + [View Details] Action */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--color-hairline)]/60 text-xs">
                          {/* Type Specific Body Content */}
                          <div className="flex items-center gap-3 sm:gap-4 flex-wrap min-w-0 flex-1">
                            {/* CASE A: Breakdown Event (Visually Prioritized) */}
                            {isBreakdown && (
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                                  <AlertTriangle size={12} className="shrink-0 text-rose-600" />
                                  <span>
                                    Duration:{" "}
                                    {log.metadata?.breakdownDuration ||
                                      (log.metadata?.breakdownHours ? `${log.metadata.breakdownHours}h` : "Breakdown")}
                                  </span>
                                </div>
                                {log.metadata?.breakdownReason && (
                                  <div className="flex items-center gap-1 text-[var(--color-ink)]">
                                    <span className="text-[var(--color-mute)] font-medium">Reason:</span>
                                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                                      {log.metadata.breakdownReason}
                                    </span>
                                  </div>
                                )}
                                {log.metadata && (
                                  <div className="flex items-center gap-1 text-[var(--color-mute)]">
                                    <span>Shift:</span>
                                    <span className="font-semibold text-[var(--color-ink)]">
                                      {formatShiftTimingWithDate(log.metadata)}
                                    </span>
                                  </div>
                                )}
                                {log.metadata?.location && (
                                  <div className="hidden lg:flex items-center gap-1 text-[var(--color-mute)] truncate max-w-xs">
                                    <MapPin size={11} className="shrink-0 text-rose-500" />
                                    <span className="truncate">{log.metadata.location}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* CASE B: Hour Meter Logged (Normal Operation) */}
                            {!isBreakdown && isHourLog && log.metadata && (
                              <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
                                {/* Meter Range */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[var(--color-mute)] font-medium">Meter:</span>
                                  <span className="font-mono font-bold text-[var(--color-ink)]">
                                    {log.metadata.startMeter ?? log.metadata.start_meter ?? "—"}
                                  </span>
                                  <ArrowRight size={10} className="text-[var(--color-mute)]" />
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {log.metadata.endMeter ?? log.metadata.end_meter ?? "—"}
                                  </span>
                                </div>

                                <span className="text-[var(--color-hairline)]">•</span>

                                {/* Worked Hours */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[var(--color-mute)] font-medium">Worked:</span>
                                  <span className="font-mono font-bold text-[var(--color-ink)]">
                                    {Number(log.metadata.runningHours || log.metadata.running_hours || 0)
                                      .toFixed(1)
                                      .replace(/\.0$/, "")}
                                    h
                                  </span>
                                </div>

                                <span className="text-[var(--color-hairline)]">•</span>

                                {/* Shift Timing */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[var(--color-mute)] font-medium">Shift:</span>
                                  <span className="font-semibold text-[var(--color-ink)]">
                                    {formatShiftTimingWithDate(log.metadata)}
                                  </span>
                                </div>

                                <span className="text-[var(--color-hairline)]">•</span>

                                {/* Breakdown condition: 0 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[var(--color-mute)] font-medium">Breakdown:</span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0</span>
                                </div>

                                {/* Location (Desktop only, collapsed on tablet) */}
                                {log.metadata.location && (
                                  <div className="hidden lg:flex items-center gap-1 text-[11px] text-[var(--color-mute)] truncate max-w-xs">
                                    <MapPin size={11} className="shrink-0 text-sky-500" />
                                    <span className="truncate">{log.metadata.location}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* CASE C: Assignment Updates */}
                            {isAssignLog && (
                              <div className="flex items-center gap-2.5 flex-wrap">
                                {hasDiffs ? (
                                  log.diffs.map((diff, dIdx) => (
                                    <div key={dIdx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-[var(--color-ink)]">{diff.label}:</span>
                                      <span className="line-through text-[var(--color-mute)] font-mono text-[11px]">
                                        {diff.previous}
                                      </span>
                                      <ArrowRight size={10} className="text-emerald-500 shrink-0" />
                                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                                        {diff.updated}
                                      </span>
                                    </div>
                                  ))
                                ) : hasDeletions ? (
                                  log.deletions.map((del, delIdx) => (
                                    <div key={delIdx} className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                      <span className="font-semibold">{del.label}:</span>
                                      <span className="line-through">{del.deletedValue}</span>
                                      <Badge variant="overdue" className="text-[9px] py-0 px-1">
                                        Removed
                                      </Badge>
                                    </div>
                                  ))
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[var(--color-mute)]">Assigned:</span>
                                    <span className="font-semibold text-[var(--color-ink)]">
                                      {resolveOperatorName(log.metadata)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* CASE D: Machine Record Updates / Configuration Changes */}
                            {!isHourLog && !isAssignLog && !isBreakdown && (
                              <div className="flex items-center gap-3 flex-wrap">
                                {hasDiffs ? (
                                  log.diffs.slice(0, 2).map((diff, dIdx) => (
                                    <div key={dIdx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-[var(--color-ink)]">{diff.label}:</span>
                                      <span className="line-through text-[var(--color-mute)] font-mono text-[11px]">
                                        {diff.previous}
                                      </span>
                                      <ArrowRight size={10} className="text-emerald-500 shrink-0" />
                                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                                        {diff.updated}
                                      </span>
                                    </div>
                                  ))
                                ) : hasDeletions ? (
                                  log.deletions.slice(0, 1).map((del, delIdx) => (
                                    <div key={delIdx} className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                      <span className="font-semibold">{del.label}:</span>
                                      <span className="line-through">{del.deletedValue}</span>
                                      <Badge variant="overdue" className="text-[9px] py-0 px-1">
                                        Removed
                                      </Badge>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[var(--color-mute)] italic">
                                    {log.action.replace(/_/g, " ")} configuration updated
                                  </span>
                                )}
                                {hasDiffs && log.diffs.length > 2 && (
                                  <span className="text-[11px] text-[var(--color-mute)] font-medium">
                                    +{log.diffs.length - 2} more changes
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* [View Details] Action Button on right */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveAuditLog(log)}
                            className="text-xs h-7 px-2.5 rounded-md font-semibold shrink-0 cursor-pointer bg-[var(--color-link)] hover:bg-[var(--color-link-deep)] text-white border-transparent transition-all flex items-center"
                          >
                            <span>View Details</span>
                          </Button>
                        </div>
                      </div>

                      {/* ─────────────────────────────────────────────────────────────
                          MOBILE VIEW: Stacked Compact Cards (block sm:hidden)
                          ───────────────────────────────────────────────────────────── */}
                      <div className="flex flex-col gap-2 sm:hidden">
                        {/* Mobile Header: [LOG TYPE] on left, TIME on right */}
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge
                            variant={presentation.badgeVariant}
                            className={`text-[10px] font-semibold ${
                              isBreakdown ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" : ""
                            }`}
                          >
                            {presentation.title}
                          </Badge>
                          <span className="text-[10px] font-mono text-[var(--color-mute)]">
                            {formatTimeWithSeconds(log.created_at)}
                          </span>
                        </div>

                        {/* Mobile Actor + Role */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                            {userMeta.name}
                          </span>
                          <span className="text-[9px] font-semibold text-[var(--color-mute)] capitalize px-1 py-0.2 rounded bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]">
                            {userMeta.role.replace(/_/g, " ")}
                          </span>
                        </div>

                        {/* Mobile Target Machine Line */}
                        <div className="text-[11px] text-[var(--color-mute)]">
                          <span>{log.metadata?.model || machineModel}</span>
                          {(log.metadata?.machineCode || machineCode) && (
                            <span className="font-mono text-[10px] ml-1 font-bold text-[var(--color-ink)]">
                              · {log.metadata?.machineCode || machineCode}
                            </span>
                          )}
                        </div>

                        {/* Mobile Type-Specific Metrics */}
                        {isBreakdown ? (
                          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold">
                              <span>Breakdown Duration:</span>
                              <span className="font-mono">
                                {log.metadata?.breakdownDuration ||
                                  (log.metadata?.breakdownHours ? `${log.metadata.breakdownHours}h` : "Breakdown")}
                              </span>
                            </div>
                            {log.metadata?.breakdownReason && (
                              <div className="text-[11px] text-rose-800 dark:text-rose-300">
                                Reason: {log.metadata.breakdownReason}
                              </div>
                            )}
                          </div>
                        ) : isHourLog && log.metadata ? (
                          <div className="p-2 rounded-lg bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--color-mute)]">Meter:</span>
                              <span className="font-mono font-bold text-[var(--color-ink)]">
                                {log.metadata.startMeter ?? log.metadata.start_meter ?? "—"} →{" "}
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {log.metadata.endMeter ?? log.metadata.end_meter ?? "—"}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--color-mute)]">Worked:</span>
                              <span className="font-mono font-bold text-[var(--color-ink)]">
                                {Number(log.metadata.runningHours || log.metadata.running_hours || 0)
                                  .toFixed(1)
                                  .replace(/\.0$/, "")}{" "}
                                hrs
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--color-mute)]">Breakdown:</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] pt-0.5 border-t border-[var(--color-hairline)]/50">
                              <span>Shift:</span>
                              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[180px]">
                                {formatShiftTimingWithDate(log.metadata)}
                              </span>
                            </div>
                          </div>
                        ) : isAssignLog ? (
                          <div className="p-2 rounded-lg bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs">
                            {hasDiffs && log.diffs[0] ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-[var(--color-mute)]">
                                  {log.diffs[0].label}:
                                </span>
                                <div className="flex items-center gap-1 text-[11px] font-mono">
                                  <span className="line-through text-[var(--color-mute)]">{log.diffs[0].previous}</span>
                                  <ArrowRight size={10} className="text-emerald-500" />
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {log.diffs[0].updated}
                                  </span>
                                </div>
                              </div>
                            ) : hasDeletions && log.deletions[0] ? (
                              <div className="text-rose-600 dark:text-rose-400 text-[11px]">
                                Removed: <span className="line-through">{log.deletions[0].deletedValue}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[var(--color-ink)]">
                                Assigned: {resolveOperatorName(log.metadata)}
                              </div>
                            )}
                          </div>
                        ) : (
                          hasDiffs && log.diffs[0] && (
                            <div className="p-2 rounded-lg bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs">
                              <div className="text-[10px] text-[var(--color-mute)] font-semibold">
                                {log.diffs[0].label}:
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-mono">
                                <span className="line-through text-[var(--color-mute)]">{log.diffs[0].previous}</span>
                                <ArrowRight size={10} className="text-emerald-500" />
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {log.diffs[0].updated}
                                </span>
                              </div>
                            </div>
                          )
                        )}

                        {/* Mobile View Details Trigger Button */}
                        <button
                          type="button"
                          onClick={() => setActiveAuditLog(log)}
                          className="w-full flex items-center justify-center py-2 px-2.5 rounded-lg bg-[var(--color-link)] hover:bg-[var(--color-link-deep)] active:bg-[var(--color-link-deep)] text-white text-xs font-semibold transition-colors min-h-[44px] cursor-pointer mt-0.5"
                        >
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          COMPLETE AUDIT DETAILS DIALOG (Desktop, Tablet, Mobile)
          ───────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(activeAuditLog)}
        onClose={() => {
          setActiveAuditLog(null);
          setIsRawJsonExpanded(false);
        }}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                activeAuditLog
                  ? getActionPresentation(
                      activeAuditLog.action,
                      activeAuditLog.deletions?.length > 0 &&
                        (!activeAuditLog.diffs?.length || activeAuditLog.diffs.every((d) => d.updated === "None")),
                      activeAuditLog.isBreakdown
                    ).badgeVariant
                  : "neutral"
              }
              className="text-xs font-semibold"
            >
              {activeAuditLog
                ? getActionPresentation(
                    activeAuditLog.action,
                    activeAuditLog.deletions?.length > 0 &&
                      (!activeAuditLog.diffs?.length || activeAuditLog.diffs.every((d) => d.updated === "None")),
                    activeAuditLog.isBreakdown
                  ).title
                : "Audit Details"}
            </Badge>
            <span className="text-sm font-bold text-[var(--color-ink)]">Audit Event Details</span>
          </div>
        }
        description={
          activeAuditLog ? (
            <span className="text-xs text-[var(--color-mute)]">
              Logged on {formatFullDateTime(activeAuditLog.created_at)}
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            {activeAuditLog && (
              <button
                type="button"
                onClick={() => handleCopyLogId(activeAuditLog.id)}
                className="text-[11px] font-mono text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer"
                title="Copy Audit Log ID"
              >
                {copiedLogId ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">ID Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>ID: {activeAuditLog.id.slice(0, 10)}...</span>
                  </>
                )}
              </button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveAuditLog(null);
                setIsRawJsonExpanded(false);
              }}
            >
              Close Details
            </Button>
          </div>
        }
      >
        {activeAuditLog && (
          <div className="flex flex-col gap-4 py-2">
            {/* 1. Actor & Authorization Card */}
            <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                <User size={12} className="text-sky-500" />
                <span>Actor & Authorization</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                    Full Name
                  </span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">
                    {normalizeAuditUser(activeAuditLog.user, activeAuditLog.actor_name, activeAuditLog.actor_role).name}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                    System Role
                  </span>
                  <span className="font-semibold text-[var(--color-ink)] capitalize">
                    {normalizeAuditUser(
                      activeAuditLog.user,
                      activeAuditLog.actor_name,
                      activeAuditLog.actor_role
                    ).role.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Target Machine Specifications */}
            <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                <Cpu size={12} className="text-emerald-500" />
                <span>Target Machine Context</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                    Machine Model
                  </span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {activeAuditLog.metadata?.model || machineModel}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                    Machine Code / ID
                  </span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {activeAuditLog.metadata?.machineCode || machineCode || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                    Serial Number
                  </span>
                  <span className="font-mono font-semibold text-[var(--color-ink)]">
                    {activeAuditLog.metadata?.serial_number || machineSerial || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Operational Details (Type-Specific) */}
            {activeAuditLog.isBreakdown && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  <AlertTriangle size={13} className="text-rose-600" />
                  <span>Breakdown Information</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-rose-600 dark:text-rose-400 block text-[10px] uppercase font-semibold">
                      Duration
                    </span>
                    <span className="font-mono font-bold text-rose-950 dark:text-rose-200 text-sm">
                      {activeAuditLog.metadata?.breakdownDuration ||
                        (activeAuditLog.metadata?.breakdownHours
                          ? `${activeAuditLog.metadata.breakdownHours}h`
                          : "Breakdown")}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-600 dark:text-rose-400 block text-[10px] uppercase font-semibold">
                      Reason
                    </span>
                    <span className="font-bold text-rose-900 dark:text-rose-200">
                      {activeAuditLog.metadata?.breakdownReason || "Unspecified"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isHmrAction(activeAuditLog.action) && activeAuditLog.metadata && (
              <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  <Calendar size={12} className="text-amber-500" />
                  <span>Operational Shift & Meter Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                      Worked Hours
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--color-ink)]">
                      {Number(
                        activeAuditLog.metadata.runningHours || activeAuditLog.metadata.running_hours || 0
                      ).toFixed(1)}{" "}
                      hrs
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                      Meter Range
                    </span>
                    <div className="flex items-center gap-1 font-mono font-bold text-[var(--color-ink)]">
                      <span>{activeAuditLog.metadata.startMeter ?? activeAuditLog.metadata.start_meter ?? "—"}</span>
                      <ArrowRight size={10} className="text-[var(--color-mute)]" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {activeAuditLog.metadata.endMeter ?? activeAuditLog.metadata.end_meter ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                      Breakdown Time
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        activeAuditLog.isBreakdown
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {activeAuditLog.isBreakdown
                        ? activeAuditLog.metadata.breakdownDuration || "Active"
                        : "0 (Normal)"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                      Shift Window
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      {formatShiftTimingWithDate(activeAuditLog.metadata)}
                    </span>
                  </div>
                  {activeAuditLog.metadata.location && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-[var(--color-mute)] block text-[10px] uppercase font-semibold">
                        Location
                      </span>
                      <div className="flex items-center gap-1 text-[var(--color-ink)] font-medium">
                        <MapPin size={11} className="text-sky-500 shrink-0" />
                        <span>{activeAuditLog.metadata.location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Previous vs Updated Diffs in Detail */}
            {activeAuditLog.diffs && activeAuditLog.diffs.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  <ArrowRightLeft size={12} className="text-sky-500" />
                  <span>Changed Fields Comparison</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {activeAuditLog.diffs.map((diff, dfIdx) => (
                    <div
                      key={dfIdx}
                      className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] flex flex-col gap-1 text-xs"
                    >
                      <span className="font-bold text-[var(--color-ink)]">{diff.label}</span>
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1 text-[var(--color-mute)]">
                          <span className="text-[10px] uppercase font-semibold">Prev:</span>
                          <span className="line-through font-mono text-[11px]">{diff.previous}</span>
                        </div>
                        <ArrowRight size={11} className="text-emerald-500" />
                        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <span className="text-[10px] uppercase font-semibold">New:</span>
                          <span className="font-bold font-mono text-[11px]">{diff.updated}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Deletions & Removals Details */}
            {activeAuditLog.deletions && activeAuditLog.deletions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  <Trash2 size={12} className="text-rose-600" />
                  <span>Deleted / Unassigned Records</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {activeAuditLog.deletions.map((del, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-2 rounded-lg bg-[var(--color-canvas-elevated)] border border-rose-500/20 flex flex-col gap-0.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-700 dark:text-rose-400">{del.label}</span>
                        <Badge variant="overdue" className="text-[9px] py-0 px-1">
                          Removed
                        </Badge>
                      </div>
                      <span className="line-through text-rose-950 dark:text-rose-200 font-semibold text-[11px]">
                        {del.deletedValue}
                      </span>
                      {del.reason && (
                        <span className="text-[10px] text-[var(--color-mute)] italic mt-0.5">{del.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Technical Audit Metadata & Raw JSON Toggle */}
            <div className="pt-2 border-t border-[var(--color-hairline)] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsRawJsonExpanded(!isRawJsonExpanded)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <FileText size={12} />
                  <span>Technical Audit Payload (Raw JSON)</span>
                </div>
                <ChevronRight size={13} className={`transition-transform ${isRawJsonExpanded ? "rotate-90" : ""}`} />
              </button>

              {isRawJsonExpanded && (
                <pre className="p-3 rounded-xl bg-neutral-950 text-neutral-200 text-[10px] font-mono overflow-x-auto max-h-60 border border-neutral-800">
                  {JSON.stringify(
                    {
                      id: activeAuditLog.id,
                      action: activeAuditLog.action,
                      entity_type: activeAuditLog.entity_type,
                      entity_id: activeAuditLog.entity_id,
                      actor_name: activeAuditLog.actor_name,
                      actor_role: activeAuditLog.actor_role,
                      created_at: activeAuditLog.created_at,
                      metadata: activeAuditLog.metadata,
                      before_state: activeAuditLog.before_state,
                      after_state: activeAuditLog.after_state,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
