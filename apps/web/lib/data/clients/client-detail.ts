import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { CLIENT_KEYS } from "@reachinternational/utils";
import type { CRMClient } from "@/lib/types/database";

// ─── Section Interfaces ──────────────────────────────────────────────────────

export interface ClientSummaryData {
  id: string;
  code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  gstin: string | null;
  pan_number: string | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  machine_count: number;
}

export interface ClientLocationData {
  id: string;
  street: string;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  site_address: string;
  is_billing_address_different: boolean;
  billing_address: string | null;
  billing_city: string | null;
  billing_district: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  formatted_billing_address: string;
}

export interface ClientMachineItem {
  id: string;
  machine_id: string;
  model: string;
  status: string;
  health_status: string;
  serial_number: string | null;
  manufacturer: string | null;
  year_of_mfg: string | null;
  hour_meter: number | null;
  updated_at: string;
}

export interface ClientRunningLogItem {
  id: string;
  machine_id: string;
  operator_id: string | null;
  log_date: string;
  start_meter: number | null;
  end_meter: number | null;
  running_hours: number;
  normal_working_hours: number | null;
  overtime_hours: number | null;
  shift: string | null;
  is_breakdown: boolean;
  remarks: string | null;
  location: string | null;
  created_at: string;
  machine_code?: string;
  machine_model?: string;
  operator_name?: string;
  operator_phone?: string;
}

export interface ClientAssignmentItem {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  is_active: boolean;
  assigned_at: string;
  machine_code: string;
  machine_model: string;
  operator_name: string;
  operator_phone: string | null;
}

export interface ClientHistoryItem {
  id: string;
  event_type: string;
  title: string;
  description: string;
  actor_name: string | null;
  timestamp: string;
  badge_color?: "sky" | "emerald" | "amber" | "purple" | "rose";
}

export interface ClientAuditItem {
  id: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  severity: "info" | "warning" | "critical";
  category: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

// Backward-compatible structures
export interface AssignedMachineSummary {
  id: string;
  machine_id: string;
  model: string;
  status: string;
  health_status: string;
}

export interface ClientDetailResponse {
  client: CRMClient | null;
  assignedMachines: AssignedMachineSummary[];
  totalMachines: number;
}

export const CLIENT_DETAIL_COLUMNS =
  "id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status, deleted_at, created_at, updated_at";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

// ─── 1. Client Summary (Immediate) ───────────────────────────────────────────

export function getCachedClientSummary(id: string) {
  return unstable_cache(
    async (): Promise<ClientSummaryData | null> => {
      if (!isValidUuid(id)) return null;

      const supabase = createSupabaseAdminClient();
      const [clientRes, countRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, code, company_name, contact_person, phone, gstin, pan_number, status, deleted_at, created_at, updated_at")
          .eq("id", id)
          .single(),
        supabase
          .from("machines")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id),
      ]);

      if (clientRes.error || !clientRes.data) {
        console.error("Error in getClientSummary:", clientRes.error?.message || clientRes.error);
        return null;
      }

      const raw = clientRes.data;
      return {
        id: raw.id,
        code: raw.code,
        company_name: raw.company_name,
        contact_person: raw.contact_person,
        phone: raw.phone,
        gstin: raw.gstin,
        pan_number: raw.pan_number,
        status: raw.status ?? "active",
        deleted_at: raw.deleted_at,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        machine_count: countRes.count ?? 0,
      };
    },
    [CLIENT_KEYS.detailSummary(id)],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id), TAGS.clients],
    }
  )();
}

export const getClientSummary = cache(async (id: string): Promise<ClientSummaryData | null> => {
  return getCachedClientSummary(id);
});

// ─── 2. Client Location (On Demand) ──────────────────────────────────────────

export function getCachedClientDetailLocation(id: string) {
  return unstable_cache(
    async (): Promise<ClientLocationData | null> => {
      if (!isValidUuid(id)) return null;

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode"
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Error in getClientDetailLocation:", error?.message || error);
        return null;
      }

      const street = (data.street || "").trim();
      const siteAddress = [street, data.city, data.district, data.state, data.pincode]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join(", ");

      const formattedBilling = data.is_billing_address_different
        ? [
            data.billing_address,
            data.billing_city,
            data.billing_district,
            data.billing_state,
            data.billing_pincode,
          ]
            .filter(Boolean)
            .map((s) => String(s).trim())
            .filter(Boolean)
            .join(", ")
        : siteAddress;

      return {
        id: data.id,
        street,
        city: data.city,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        site_address: siteAddress || "—",
        is_billing_address_different: !!data.is_billing_address_different,
        billing_address: data.billing_address,
        billing_city: data.billing_city,
        billing_district: data.billing_district,
        billing_state: data.billing_state,
        billing_pincode: data.billing_pincode,
        formatted_billing_address: formattedBilling || "Same as site location",
      };
    },
    [CLIENT_KEYS.detailLocation(id)],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id), TAGS.clients],
    }
  )();
}

export const getClientDetailLocation = cache(async (id: string): Promise<ClientLocationData | null> => {
  return getCachedClientDetailLocation(id);
});

// ─── 3. Client Machines (On Tab) ─────────────────────────────────────────────

export function getCachedClientMachines(id: string) {
  return unstable_cache(
    async (): Promise<ClientMachineItem[]> => {
      if (!isValidUuid(id)) return [];

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machines")
        .select("id, machine_id, model, status, health_status, serial_number, manufacturer, year_of_mfg, hour_meter, updated_at")
        .eq("client_id", id)
        .order("machine_id", { ascending: true });

      if (error) {
        console.error("Error in getClientMachines:", error.message);
        return [];
      }

      return (data || []).map((m) => ({
        id: m.id,
        machine_id: m.machine_id,
        model: m.model,
        status: m.status,
        health_status: m.health_status,
        serial_number: m.serial_number,
        manufacturer: m.manufacturer,
        year_of_mfg: m.year_of_mfg ? String(m.year_of_mfg) : null,
        hour_meter: m.hour_meter !== null ? Number(m.hour_meter) : null,
        updated_at: m.updated_at,
      }));
    },
    [CLIENT_KEYS.detailMachines(id)],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id), TAGS.machines],
    }
  )();
}

export const getClientMachines = cache(async (id: string): Promise<ClientMachineItem[]> => {
  return getCachedClientMachines(id);
});

// ─── 4. Client Running Logs (On Tab) ─────────────────────────────────────────

export function getCachedClientRunningLogs(id: string, limit = 20) {
  return unstable_cache(
    async (): Promise<ClientRunningLogItem[]> => {
      if (!isValidUuid(id)) return [];

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("machine_hour_logs")
        .select(
          "id, machine_id, operator_id, log_date, start_meter, end_meter, running_hours, normal_working_hours, overtime_hours, shift, is_breakdown, remarks, location, created_at, machines!inner(id, machine_id, model), users!operator_id(id, full_name, phone)"
        )
        .eq("client_id", id)
        .order("log_date", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error in getClientRunningLogs:", error.message);
        return [];
      }

      return (data || []).map((log) => {
        const m = Array.isArray(log.machines) ? log.machines[0] : log.machines;
        const u = Array.isArray(log.users) ? log.users[0] : log.users;

        return {
          id: log.id,
          machine_id: log.machine_id,
          operator_id: log.operator_id,
          log_date: log.log_date,
          start_meter: log.start_meter !== null ? Number(log.start_meter) : null,
          end_meter: log.end_meter !== null ? Number(log.end_meter) : null,
          running_hours: Number(log.running_hours ?? 0),
          normal_working_hours: log.normal_working_hours !== null ? Number(log.normal_working_hours) : null,
          overtime_hours: log.overtime_hours !== null ? Number(log.overtime_hours) : null,
          shift: log.shift,
          is_breakdown: !!log.is_breakdown,
          remarks: log.remarks,
          location: log.location,
          created_at: log.created_at,
          machine_code: m?.machine_id || "—",
          machine_model: m?.model || "—",
          operator_name: u?.full_name || "Unassigned",
          operator_phone: u?.phone || null,
        };
      });
    },
    [CLIENT_KEYS.detailRunningLogs(id), `limit:${limit}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id)],
    }
  )();
}

export const getClientRunningLogs = cache(
  async (id: string, limit = 20): Promise<ClientRunningLogItem[]> => {
    return getCachedClientRunningLogs(id, limit);
  }
);

// ─── 5. Client Assignments (On Tab) ──────────────────────────────────────────

export function getCachedClientAssignments(id: string) {
  return unstable_cache(
    async (): Promise<ClientAssignmentItem[]> => {
      if (!isValidUuid(id)) return [];

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("operator_machine_assignments")
        .select(
          "id, machine_id, operator_id, shift_start_time, shift_end_time, is_active, assigned_at, machines!inner(id, machine_id, model, client_id), users!operator_id(id, full_name, phone)"
        )
        .eq("machines.client_id", id)
        .order("is_active", { ascending: false })
        .order("assigned_at", { ascending: false });

      if (error) {
        console.error("Error in getClientAssignments:", error.message);
        return [];
      }

      return (data || []).map((a) => {
        const m = Array.isArray(a.machines) ? a.machines[0] : a.machines;
        const u = Array.isArray(a.users) ? a.users[0] : a.users;

        return {
          id: a.id,
          machine_id: a.machine_id,
          operator_id: a.operator_id,
          shift_start_time: a.shift_start_time,
          shift_end_time: a.shift_end_time,
          is_active: !!a.is_active,
          assigned_at: a.assigned_at,
          machine_code: m?.machine_id || "—",
          machine_model: m?.model || "—",
          operator_name: u?.full_name || "Unassigned",
          operator_phone: u?.phone || null,
        };
      });
    },
    [CLIENT_KEYS.detailAssignments(id)],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id)],
    }
  )();
}

export const getClientAssignments = cache(async (id: string): Promise<ClientAssignmentItem[]> => {
  return getCachedClientAssignments(id);
});

// ─── 6. Client History (On Tab) ──────────────────────────────────────────────

export function getCachedClientHistory(id: string) {
  return unstable_cache(
    async (): Promise<ClientHistoryItem[]> => {
      if (!isValidUuid(id)) return [];

      const supabase = createSupabaseAdminClient();
      const [clientRes, machinesRes, auditRes] = await Promise.all([
        supabase.from("clients").select("created_at, updated_at, code, company_name, status").eq("id", id).single(),
        supabase.from("machines").select("id, machine_id, model, created_at, updated_at").eq("client_id", id),
        supabase
          .from("audit_logs")
          .select("id, action, actor_name, created_at, details")
          .or(`entity_id.eq.${id},details->>clientId.eq.${id}`)
          .order("created_at", { ascending: false })
          .limit(15),
      ]);

      const history: ClientHistoryItem[] = [];

      // Account Creation
      if (clientRes.data?.created_at) {
        history.push({
          id: `hist-create-${id}`,
          event_type: "account_created",
          title: "Account Registered",
          description: `Client profile created under code ${clientRes.data.code}. Initial status: ${clientRes.data.status?.toUpperCase() || "ACTIVE"}.`,
          actor_name: "System Registration",
          timestamp: clientRes.data.created_at,
          badge_color: "emerald",
        });
      }

      // Fleet Equipment Additions
      if (machinesRes.data && machinesRes.data.length > 0) {
        history.push({
          id: `hist-machines-${id}`,
          event_type: "fleet_deployed",
          title: "Fleet Equipment Deployed",
          description: `${machinesRes.data.length} industrial machine(s) deployed: ${machinesRes.data.map((m) => m.machine_id).slice(0, 4).join(", ")}${machinesRes.data.length > 4 ? ` and ${machinesRes.data.length - 4} more` : ""}.`,
          actor_name: "Operations Dispatch",
          timestamp: machinesRes.data[0].created_at || clientRes.data?.created_at || new Date().toISOString(),
          badge_color: "sky",
        });
      }

      // Audit Log Entries
      if (auditRes.data) {
        for (const a of auditRes.data) {
          history.push({
            id: `hist-audit-${a.id}`,
            event_type: "audit_event",
            title: a.action.replace(/_/g, " "),
            description: `Audit event recorded with actor ${a.actor_name || "System"}.`,
            actor_name: a.actor_name || "System",
            timestamp: a.created_at,
            badge_color: a.action.includes("DELETE") ? "rose" : a.action.includes("UPDATE") ? "amber" : "purple",
          });
        }
      }

      // Sort reverse chronological
      return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [CLIENT_KEYS.detailHistory(id)],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id)],
    }
  )();
}

export const getClientHistory = cache(async (id: string): Promise<ClientHistoryItem[]> => {
  return getCachedClientHistory(id);
});

// ─── 7. Client Audit Logs (On Tab) ───────────────────────────────────────────

export function getCachedClientAuditLogs(id: string, limit = 30) {
  return unstable_cache(
    async (): Promise<ClientAuditItem[]> => {
      if (!isValidUuid(id)) return [];

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_name, actor_role, severity, category, before_state, after_state, created_at")
        .or(`entity_id.eq.${id},details->>clientId.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error in getClientAuditLogs:", error.message);
        return [];
      }

      return (data || []).map((a) => ({
        id: a.id,
        action: a.action,
        actor_name: a.actor_name,
        actor_role: a.actor_role,
        severity: (a.severity as "info" | "warning" | "critical") || "info",
        category: a.category,
        before_state: (a.before_state as Record<string, unknown>) || null,
        after_state: (a.after_state as Record<string, unknown>) || null,
        created_at: a.created_at,
      }));
    },
    [CLIENT_KEYS.detailAudit(id), `limit:${limit}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id)],
    }
  )();
}

export const getClientAuditLogs = cache(
  async (id: string, limit = 30): Promise<ClientAuditItem[]> => {
    return getCachedClientAuditLogs(id, limit);
  }
);

// ─── Backward-Compatible Full Client Detail Fetcher ──────────────────────────

function getCachedClientDetailById(id: string, includeMachines: boolean = true) {
  return unstable_cache(
    async (): Promise<ClientDetailResponse> => {
      if (!isValidUuid(id)) {
        return { client: null, assignedMachines: [], totalMachines: 0 };
      }

      const supabase = createSupabaseAdminClient();

      const clientPromise = supabase
        .from("clients")
        .select(CLIENT_DETAIL_COLUMNS)
        .eq("id", id)
        .single();

      const machinesPromise = includeMachines
        ? supabase
            .from("machines")
            .select("id, machine_id, model, status, health_status")
            .eq("client_id", id)
        : Promise.resolve({ data: [] as AssignedMachineSummary[], error: null });

      const [clientRes, machinesRes] = await Promise.all([clientPromise, machinesPromise]);

      if (clientRes.error || !clientRes.data) {
        console.error("Error in getClientById:", clientRes.error?.message || clientRes.error);
        return { client: null, assignedMachines: [], totalMachines: 0 };
      }

      const raw = clientRes.data;
      const street = (raw.street || "").trim();
      const fullAddress = [street, raw.city, raw.district, raw.state, raw.pincode]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join(", ");

      const machines = machinesRes.data || [];

      const client: CRMClient = {
        ...raw,
        street,
        address: fullAddress,
        client_name: raw.company_name,
        machine_count: machines.length,
        open_complaints: 0,
        status: raw.status ?? "active",
      };

      return {
        client,
        assignedMachines: machines,
        totalMachines: machines.length,
      };
    },
    [CLIENT_KEYS.detail(id), includeMachines ? "machines:true" : "machines:false"],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(id), TAGS.clients],
    }
  )();
}

export const getClientById = cache(
  async (id: string, options?: { includeMachines?: boolean }): Promise<ClientDetailResponse> => {
    return getCachedClientDetailById(id, options?.includeMachines !== false);
  }
);

export const getClientDetail = getClientById;
