import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TIERS } from "@/lib/cache";
import { OPERATIONS_KEYS, OPERATIONS_CACHE_TAGS, OPERATIONS_CACHE_TTLS } from "./keys";


// ─── UUID Validation Helper ──────────────────────────────────────────────────

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// ─── Section Data Interfaces ─────────────────────────────────────────────────

export interface LogSummaryData {
  id: string;
  machine_id: string;
  operator_id: string | null;
  client_id: string | null;
  log_date: string;
  shift: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  overtime_hours: number | null;
  normal_working_hours: number | null;
  is_breakdown: boolean;
  conflict_flag: boolean;
  conflict_reason: string | null;
  conflict_status: string | null;
  conflict_resolved_by: string | null;
  conflict_resolved_at: string | null;
  conflict_resolution_notes: string | null;
  created_at: string;
  machine?: {
    id: string;
    machine_id: string;
    model: string;
  } | null;
  operator?: {
    id: string;
    full_name: string;
    phone: string | null;
  } | null;
  client?: {
    id: string;
    company_name: string;
  } | null;
}

export interface LogDetailsData {
  id: string;
  machine_id: string;
  operator_id: string | null;
  client_id: string | null;
  log_date: string;
  start_time: string | null;
  end_time: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  normal_working_hours: number | null;
  breakdown_start_time: string | null;
  breakdown_end_time: string | null;
  breakdown_duration: string | null;
  breakdown_hours: number;
  machine_condition: string | null;
  location: string | null;
  remarks: string | null;
  idempotency_key: string | null;
  machine?: {
    id: string;
    machine_id: string;
    model: string;
    serial_number: string | null;
    hour_meter: number | null;
    status: string;
    health_status: string;
    manufacturer: string | null;
    year_of_mfg: string | null;
  } | null;
  client?: {
    id: string;
    code: string;
    company_name: string;
    contact_person: string | null;
    phone: string | null;
    street: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
    full_address?: string;
  } | null;
  operator?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    shift_time: string | null;
    role: string;
  } | null;
}

export interface LogHistoryItem {
  id: string;
  machine_id: string;
  log_date: string;
  shift: string | null;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  overtime_hours: number | null;
  is_breakdown: boolean;
  conflict_flag: boolean;
  created_at: string;
  operator_name: string;
  meter_delta: number;
  is_current: boolean;
}

export interface LogAssignmentItem {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  crosses_midnight: boolean;
  is_active: boolean;
  assigned_at: string;
  ended_at: string | null;
  ended_by: string | null;
  end_reason: string | null;
  operator_name: string;
  operator_phone: string | null;
  operator_email: string | null;
  operator_role: string | null;
  assigned_by_name: string | null;
}

export interface LogAuditItem {
  id: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  severity: "info" | "warning" | "critical";
  category: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ─── Projections ─────────────────────────────────────────────────────────────

const LOG_SUMMARY_PROJECTION = `
  id,
  machine_id,
  operator_id,
  client_id,
  log_date,
  shift,
  start_meter,
  end_meter,
  running_hours,
  overtime_hours,
  normal_working_hours,
  is_breakdown,
  conflict_flag,
  conflict_reason,
  conflict_status,
  conflict_resolved_by,
  conflict_resolved_at,
  conflict_resolution_notes,
  created_at,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone),
  client:clients!machine_hour_logs_client_id_fkey(id, company_name)
`;

const LOG_DETAILS_PROJECTION = `
  id,
  machine_id,
  operator_id,
  client_id,
  log_date,
  start_time,
  end_time,
  start_datetime,
  end_datetime,
  normal_working_hours,
  breakdown_start_time,
  breakdown_end_time,
  breakdown_duration,
  breakdown_hours,
  machine_condition,
  location,
  remarks,
  idempotency_key,
  machine:machines!machine_hour_logs_machine_id_fkey(id, machine_id, model, serial_number, hour_meter, status, health_status, manufacturer, year_of_mfg),
  client:clients!machine_hour_logs_client_id_fkey(id, code, company_name, contact_person, phone, street, city, district, state, pincode),
  operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email, shift_time, role)
`;

// ─── 1. Log Summary (Immediate / Core Identity) ──────────────────────────────

export function getCachedLogSummary(logId: string) {
  return unstable_cache(
    async (): Promise<LogSummaryData | null> => {
      if (!isValidUuid(logId)) return null;

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machine_hour_logs")
        .select(LOG_SUMMARY_PROJECTION)
        .eq("id", logId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("Error in getLogSummary:", error.message);
        return null;
      }

      return data as unknown as LogSummaryData;
    },
    [OPERATIONS_KEYS.details.logSummary(logId)],
    {
      revalidate: OPERATIONS_CACHE_TTLS.logDetails,
      tags: [OPERATIONS_CACHE_TAGS.logSummary(logId), OPERATIONS_CACHE_TAGS.logDetail(logId)],
    }
  )();
}

export const getLogSummary = cache(async (logId: string): Promise<LogSummaryData | null> => {
  return getCachedLogSummary(logId);
});

// ─── 2. Log Details (On Tab 'Details') ────────────────────────────────────────

export function getCachedLogDetails(logId: string) {
  return unstable_cache(
    async (): Promise<LogDetailsData | null> => {
      if (!isValidUuid(logId)) return null;

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machine_hour_logs")
        .select(LOG_DETAILS_PROJECTION)
        .eq("id", logId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("Error in getLogDetails:", error.message);
        return null;
      }

      const raw = data as any;
      const c = raw.client;
      let fullAddress: string | undefined = undefined;
      if (c) {
        const parts = [c.street, c.city, c.district, c.state, c.pincode].filter(Boolean);
        fullAddress = parts.join(", ") || undefined;
      }

      return {
        ...raw,
        client: c ? { ...c, full_address: fullAddress } : null,
      } as LogDetailsData;
    },
    [OPERATIONS_KEYS.details.logDetails(logId)],
    {
      revalidate: OPERATIONS_CACHE_TTLS.logDetails,
      tags: [OPERATIONS_CACHE_TAGS.logDetails(logId), OPERATIONS_CACHE_TAGS.logDetail(logId)],
    }
  )();
}

export const getLogDetails = cache(async (logId: string): Promise<LogDetailsData | null> => {
  return getCachedLogDetails(logId);
});

// ─── 3. Log History (On Tab 'History') ────────────────────────────────────────

export function getCachedLogHistory(logId: string, limit = 10) {
  return unstable_cache(
    async (): Promise<LogHistoryItem[]> => {
      if (!isValidUuid(logId)) return [];

      const supabase = createSupabaseAdminClient();

      // Step 1: Query target log's machine_id
      const { data: targetLog, error: targetError } = await supabase
        .from("machine_hour_logs")
        .select("id, machine_id, log_date")
        .eq("id", logId)
        .maybeSingle();

      if (targetError || !targetLog?.machine_id) {
        if (targetError) console.error("Error in getLogHistory target lookup:", targetError.message);
        return [];
      }

      // Step 2: Fetch sequence of running logs on same machine
      const { data: logs, error: logsError } = await supabase
        .from("machine_hour_logs")
        .select(`
          id,
          machine_id,
          log_date,
          shift,
          start_meter,
          end_meter,
          running_hours,
          overtime_hours,
          is_breakdown,
          conflict_flag,
          created_at,
          operator:users!machine_hour_logs_operator_id_fkey(id, full_name)
        `)
        .eq("machine_id", targetLog.machine_id)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (logsError) {
        console.error("Error in getLogHistory logs query:", logsError.message);
        return [];
      }

      return (logs || []).map((l: any) => {
        const start = l.start_meter ?? 0;
        const end = l.end_meter ?? start;
        const delta = Math.max(0, Math.round((end - start) * 10) / 10);

        return {
          id: l.id,
          machine_id: l.machine_id,
          log_date: l.log_date,
          shift: l.shift,
          start_meter: l.start_meter,
          end_meter: l.end_meter,
          running_hours: l.running_hours ?? delta,
          overtime_hours: l.overtime_hours ?? 0,
          is_breakdown: Boolean(l.is_breakdown),
          conflict_flag: Boolean(l.conflict_flag),
          created_at: l.created_at,
          operator_name: l.operator?.full_name || "Unassigned",
          meter_delta: delta,
          is_current: l.id === logId,
        };
      });
    },
    [OPERATIONS_KEYS.details.logHistory(logId), `limit:${limit}`],
    {
      revalidate: OPERATIONS_CACHE_TTLS.logHistory,
      tags: [OPERATIONS_CACHE_TAGS.logHistory(logId), OPERATIONS_CACHE_TAGS.logDetail(logId)],
    }
  )();
}

export const getLogHistory = cache(async (logId: string, limit = 10): Promise<LogHistoryItem[]> => {
  return getCachedLogHistory(logId, limit);
});

// ─── 4. Log Assignments (On Tab 'Assignments') ────────────────────────────────

export function getCachedLogAssignments(logId: string) {
  return unstable_cache(
    async (): Promise<LogAssignmentItem[]> => {
      if (!isValidUuid(logId)) return [];

      const supabase = createSupabaseAdminClient();

      // Step 1: Query target log's machine_id
      const { data: targetLog, error: targetError } = await supabase
        .from("machine_hour_logs")
        .select("id, machine_id")
        .eq("id", logId)
        .maybeSingle();

      if (targetError || !targetLog?.machine_id) {
        if (targetError) console.error("Error in getLogAssignments target lookup:", targetError.message);
        return [];
      }

      // Step 2: Query operator machine assignments for this equipment
      const { data: assignments, error: assignmentsError } = await supabase
        .from("operator_machine_assignments")
        .select(`
          id,
          machine_id,
          operator_id,
          shift_start_time,
          shift_end_time,
          crosses_midnight,
          is_active,
          assigned_at,
          ended_at,
          ended_by,
          end_reason,
          operator:users!operator_machine_assignments_operator_id_fkey(id, full_name, phone, email, shift_time, role),
          assigner:users!operator_machine_assignments_assigned_by_fkey(id, full_name)
        `)
        .eq("machine_id", targetLog.machine_id)
        .order("is_active", { ascending: false })
        .order("assigned_at", { ascending: false })
        .limit(10);

      if (assignmentsError) {
        console.error("Error in getLogAssignments query:", assignmentsError.message);
        return [];
      }

      return (assignments || []).map((a: any) => ({
        id: a.id,
        machine_id: a.machine_id,
        operator_id: a.operator_id,
        shift_start_time: a.shift_start_time,
        shift_end_time: a.shift_end_time,
        crosses_midnight: Boolean(a.crosses_midnight),
        is_active: Boolean(a.is_active),
        assigned_at: a.assigned_at,
        ended_at: a.ended_at,
        ended_by: a.ended_by,
        end_reason: a.end_reason,
        operator_name: a.operator?.full_name || "Unassigned",
        operator_phone: a.operator?.phone || null,
        operator_email: a.operator?.email || null,
        operator_role: a.operator?.role || null,
        assigned_by_name: a.assigner?.full_name || null,
      }));
    },
    [OPERATIONS_KEYS.details.logAssignments(logId)],
    {
      revalidate: OPERATIONS_CACHE_TTLS.logAssignments,
      tags: [OPERATIONS_CACHE_TAGS.logAssignments(logId), OPERATIONS_CACHE_TAGS.logDetail(logId)],
    }
  )();
}

export const getLogAssignments = cache(async (logId: string): Promise<LogAssignmentItem[]> => {
  return getCachedLogAssignments(logId);
});

// ─── 5. Log Audit (On Tab 'Audit') ───────────────────────────────────────────

export function getCachedLogAudit(logId: string, limit = 20) {
  return unstable_cache(
    async (): Promise<LogAuditItem[]> => {
      if (!isValidUuid(logId)) return [];

      const supabase = createSupabaseAdminClient();
      let { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_name, actor_role, severity, category, before_state, after_state, details, created_at")
        .eq("entity_id", logId)
        .order("created_at", { ascending: false })
        .limit(limit);

      // Graceful fallback for legacy audit records where entity_id was not populated
      if (!error && (!data || data.length === 0)) {
        const fallbackRes = await supabase
          .from("audit_logs")
          .select("id, action, actor_name, actor_role, severity, category, before_state, after_state, details, created_at")
          .or(`details->>log_id.eq.${logId},details->>logId.eq.${logId}`)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
        }
      }

      if (error) {
        console.error("Error in getLogAudit query:", error.message);
        return [];
      }

      return (data || []).map((a: any) => ({
        id: a.id,
        action: a.action,
        actor_name: a.actor_name,
        actor_role: a.actor_role,
        severity: (a.severity as "info" | "warning" | "critical") || "info",
        category: a.category,
        before_state: (a.before_state as Record<string, unknown>) || null,
        after_state: (a.after_state as Record<string, unknown>) || null,
        details: (a.details as Record<string, unknown>) || null,
        created_at: a.created_at,
      }));
    },
    [OPERATIONS_KEYS.details.logAudit(logId), `limit:${limit}`],
    {
      revalidate: OPERATIONS_CACHE_TTLS.logAudit,
      tags: [OPERATIONS_CACHE_TAGS.logAudit(logId), OPERATIONS_CACHE_TAGS.logDetail(logId)],
    }
  )();
}

export const getLogAudit = cache(async (logId: string, limit = 20): Promise<LogAuditItem[]> => {
  return getCachedLogAudit(logId, limit);
});
