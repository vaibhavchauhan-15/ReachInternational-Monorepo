import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AssignmentAuditRecord {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_start_time: string;
  shift_end_time: string;
  crosses_midnight: boolean;
  is_active: boolean;
  assigned_by: string;
  assigned_at: string;
  ended_at: string | null;
  ended_by: string | null;
  end_reason: string | null;
  created_at: string;
  updated_at: string;
  machine: {
    id: string;
    machine_id: string;
    machine_code: string;
    machine_name?: string;
    model?: string | null;
    serial_number?: string | null;
    status?: string | null;
    hour_meter?: number | null;
    client?: {
      id: string;
      code?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
  operator: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
  assigner: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
  ender: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
}

export interface AssignmentAuditLogsResult {
  records: AssignmentAuditRecord[];
  metrics: {
    total: number;
    active: number;
    ended: number;
    overnight: number;
    uniqueMachines: number;
  };
}

/**
 * Format raw PostgREST / Supabase errors into human-readable strings.
 * Prevents empty `{}` serialization across the Next.js server-client IPC dev boundary.
 */
function formatPostgrestError(error: unknown): string {
  if (!error) return "Unknown database error";
  if (typeof error === "string") return error;
  const e = error as Record<string, unknown>;
  const parts: string[] = [];
  if (e.message) parts.push(String(e.message));
  if (e.code) parts.push(`[Code: ${e.code}]`);
  if (e.details) parts.push(`Details: ${e.details}`);
  if (e.hint) parts.push(`Hint: ${e.hint}`);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(e);
}

/**
 * Safe scalar projection for operator_machine_assignments.
 * Omits ambiguous multi-foreign-key joins to public.users and public.machines
 * to prevent PostgREST PGRST200 schema cache relationship resolution failures.
 */
const ASSIGNMENT_SCALAR_PROJECTION = `
  id,
  machine_id,
  operator_id,
  shift_start_time,
  shift_end_time,
  crosses_midnight,
  is_active,
  assigned_by,
  assigned_at,
  ended_at,
  ended_by,
  end_reason,
  created_at,
  updated_at
`;

/**
 * Derives assignment audit records from machines table state.
 * Acts as resilient fallback if operator_machine_assignments is empty or unmigrated.
 */
function deriveAssignmentsFromMachines(
  machines: any[],
  clientsMap: Map<string, any>,
  usersMap: Map<string, any>
): AssignmentAuditRecord[] {
  const records: AssignmentAuditRecord[] = [];

  for (const m of machines) {
    const operatorIds: string[] = [];
    if (Array.isArray(m.operator_ids) && m.operator_ids.length > 0) {
      m.operator_ids.forEach((id: string) => id && operatorIds.push(id));
    } else if (m.current_operator_id) {
      operatorIds.push(m.current_operator_id);
    }

    const client = m.client_id ? clientsMap.get(m.client_id) : null;
    const code = m.machine_id || m.machine_code || m.id || "Machine";
    const model = m.model ? ` (${m.model})` : "";
    const assignerUser = m.current_supervisor_id ? usersMap.get(m.current_supervisor_id) : null;

    const machineObj = {
      id: m.id,
      machine_id: code,
      machine_code: code,
      machine_name: `${code}${model}`,
      model: m.model || null,
      serial_number: m.serial_number || null,
      status: m.status || null,
      hour_meter: m.hour_meter ?? null,
      client: client
        ? {
            id: client.id,
            code: client.code || null,
            company_name: client.company_name || null,
          }
        : null,
    };

    if (operatorIds.length > 0) {
      operatorIds.forEach((opId, idx) => {
        const opUser = usersMap.get(opId);
        records.push({
          id: `derived-${m.id}-${opId}-${idx}`,
          machine_id: m.id,
          operator_id: opId,
          shift_start_time: "08:00:00",
          shift_end_time: "17:00:00",
          crosses_midnight: false,
          is_active: true,
          assigned_by: m.current_supervisor_id || "",
          assigned_at: m.updated_at || m.created_at || new Date().toISOString(),
          ended_at: null,
          ended_by: null,
          end_reason: null,
          created_at: m.created_at || new Date().toISOString(),
          updated_at: m.updated_at || new Date().toISOString(),
          machine: machineObj,
          operator: opUser
            ? {
                id: opUser.id,
                full_name: opUser.full_name,
                email: opUser.email || null,
                phone: opUser.phone || null,
                role: opUser.role || "operator",
              }
            : null,
          assigner: assignerUser
            ? {
                id: assignerUser.id,
                full_name: assignerUser.full_name,
                email: assignerUser.email || null,
                phone: assignerUser.phone || null,
                role: assignerUser.role || "supervisor",
              }
            : null,
          ender: null,
        });
      });
    } else if (m.current_supervisor_id) {
      records.push({
        id: `derived-sup-${m.id}`,
        machine_id: m.id,
        operator_id: "",
        shift_start_time: "08:00:00",
        shift_end_time: "17:00:00",
        crosses_midnight: false,
        is_active: true,
        assigned_by: m.current_supervisor_id,
        assigned_at: m.updated_at || m.created_at || new Date().toISOString(),
        ended_at: null,
        ended_by: null,
        end_reason: null,
        created_at: m.created_at || new Date().toISOString(),
        updated_at: m.updated_at || new Date().toISOString(),
        machine: machineObj,
        operator: null,
        assigner: assignerUser
          ? {
              id: assignerUser.id,
              full_name: assignerUser.full_name,
              email: assignerUser.email || null,
              phone: assignerUser.phone || null,
              role: assignerUser.role || "supervisor",
            }
          : null,
        ender: null,
      });
    }
  }

  return records;
}

export const getAssignmentAuditLogs = cache(
  async (): Promise<AssignmentAuditLogsResult> => {
    const supabase = createSupabaseAdminClient();

    try {
      // 1. Fetch machines, clients, users, and assignment records in parallel
      const [machinesRes, clientsRes, usersRes, assignmentsRes] = await Promise.all([
        supabase
          .from("machines")
          .select("id, machine_id, model, serial_number, status, hour_meter, client_id, current_operator_id, operator_ids, current_supervisor_id, created_at, updated_at"),
        supabase
          .from("clients")
          .select("id, code, company_name"),
        supabase
          .from("users")
          .select("id, full_name, email, phone, role, shift_time"),
        supabase
          .from("operator_machine_assignments")
          .select(ASSIGNMENT_SCALAR_PROJECTION)
          .order("assigned_at", { ascending: false }),
      ]);

      const machinesList = machinesRes.data || [];
      const clientsMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
      const usersMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
      const machinesMap = new Map(
        machinesList.map((m: any) => [
          m.id,
          {
            ...m,
            client: m.client_id ? clientsMap.get(m.client_id) : null,
          },
        ])
      );

      if (assignmentsRes.error) {
        console.warn(
          "[DAL] Notice: Error fetching operator_machine_assignments, falling back to machine relations:",
          formatPostgrestError(assignmentsRes.error)
        );
      }

      let formattedRecords: AssignmentAuditRecord[] = [];
      const rawRecords = assignmentsRes.data;

      if (rawRecords && rawRecords.length > 0) {
        formattedRecords = rawRecords.map((row: any) => {
          const m = machinesMap.get(row.machine_id);
          const op = usersMap.get(row.operator_id);
          const assigner = row.assigned_by ? usersMap.get(row.assigned_by) : null;
          const ender = row.ended_by ? usersMap.get(row.ended_by) : null;

          const code = m?.machine_id || m?.machine_code || row.machine_id || "Machine";
          const model = m?.model ? ` (${m.model})` : "";

          const isOvernight =
            row.crosses_midnight ??
            (row.shift_start_time && row.shift_end_time
              ? row.shift_end_time < row.shift_start_time
              : false);

          return {
            id: row.id,
            machine_id: row.machine_id,
            operator_id: row.operator_id,
            shift_start_time: row.shift_start_time,
            shift_end_time: row.shift_end_time,
            crosses_midnight: isOvernight,
            is_active: Boolean(row.is_active),
            assigned_by: row.assigned_by,
            assigned_at: row.assigned_at,
            ended_at: row.ended_at || null,
            ended_by: row.ended_by || null,
            end_reason: row.end_reason || null,
            created_at: row.created_at || row.assigned_at,
            updated_at: row.updated_at || row.assigned_at,
            machine: m
              ? {
                  id: m.id,
                  machine_id: code,
                  machine_code: code,
                  machine_name: `${code}${model}`,
                  model: m.model || null,
                  serial_number: m.serial_number || null,
                  status: m.status || null,
                  hour_meter: m.hour_meter ?? null,
                  client: m.client
                    ? {
                        id: m.client.id,
                        code: m.client.code || null,
                        company_name: m.client.company_name || null,
                      }
                    : null,
                }
              : {
                  id: row.machine_id,
                  machine_id: code,
                  machine_code: code,
                  machine_name: code,
                  model: null,
                  serial_number: null,
                  status: null,
                  hour_meter: null,
                  client: null,
                },
            operator: op
              ? {
                  id: op.id,
                  full_name: op.full_name,
                  email: op.email || null,
                  phone: op.phone || null,
                  role: op.role || null,
                }
              : null,
            assigner: assigner
              ? {
                  id: assigner.id,
                  full_name: assigner.full_name,
                  email: assigner.email || null,
                  phone: assigner.phone || null,
                  role: assigner.role || null,
                }
              : null,
            ender: ender
              ? {
                  id: ender.id,
                  full_name: ender.full_name,
                  email: ender.email || null,
                  phone: ender.phone || null,
                  role: ender.role || null,
                }
              : null,
          };
        });
      } else {
        // Authoritative table empty or unavailable -> derive from current machine state
        formattedRecords = deriveAssignmentsFromMachines(machinesList, clientsMap, usersMap);
      }

      const activeCount = formattedRecords.filter((r) => r.is_active).length;
      const endedCount = formattedRecords.filter((r) => !r.is_active).length;
      const overnightCount = formattedRecords.filter((r) => r.crosses_midnight).length;
      const uniqueMachinesSet = new Set(
        formattedRecords.map((r) => r.machine_id).filter(Boolean)
      );

      return {
        records: formattedRecords,
        metrics: {
          total: formattedRecords.length,
          active: activeCount,
          ended: endedCount,
          overnight: overnightCount,
          uniqueMachines: uniqueMachinesSet.size,
        },
      };
    } catch (unexpectedError) {
      console.error(
        "[DAL] Unexpected error in getAssignmentAuditLogs:",
        formatPostgrestError(unexpectedError)
      );
      return {
        records: [],
        metrics: { total: 0, active: 0, ended: 0, overnight: 0, uniqueMachines: 0 },
      };
    }
  }
);
