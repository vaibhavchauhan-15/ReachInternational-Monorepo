import "server-only";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { formatMachineDatabaseError } from "@/lib/utils/machine-errors";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MACHINE_ID_REGEX = /^RI-MC-\d{4,}$/i;

export interface CreateMachineInput {
  machine_id?: string | null;
  model: string;
  serial_number: string;
  year_of_mfg: string;
  manufacturer: string;
  supervisor_ids?: string[];
  operator_ids?: string[];
  current_supervisor_id?: string | null;
  current_operator_id?: string | null;
  client_id?: string | null;
  hour_meter?: number;
  health_status?: "active" | "under_maintenance" | "breakdown" | "spare";
  status?: "available" | "rented";
}

export interface UpdateMachineInput {
  machine_id?: string;
  model?: string;
  serial_number?: string;
  year_of_mfg?: string;
  manufacturer?: string;
  supervisor_ids?: string[];
  operator_ids?: string[];
  current_supervisor_id?: string | null;
  current_operator_id?: string | null;
  client_id?: string | null;
  hour_meter?: number;
  health_status?: "active" | "under_maintenance" | "breakdown" | "spare";
  status?: "available" | "rented";
}

export interface UpdateMachineOperationalInput {
  hour_meter?: number;
  health_status?: "active" | "under_maintenance" | "breakdown" | "spare";
  status?: "available" | "rented";
  operator_ids?: string[];
  current_operator_id?: string | null;
  supervisor_ids?: string[];
  current_supervisor_id?: string | null;
  client_id?: string | null;
}

export interface MutationResult {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: any;
}

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Check if a serial number is available for registration/update.
 */
export async function checkMachineSerialNumberAvailable(
  serialNumber: string,
  excludeMachineId?: string
): Promise<{ available: boolean; conflictMachineId?: string; existingMachineId?: string }> {
  const trimmed = (serialNumber || "").trim();
  if (!trimmed) return { available: true };

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("machines")
    .select("id, machine_id, serial_number")
    .ilike("serial_number", trimmed)
    .limit(1);

  if (excludeMachineId && isValidUuid(excludeMachineId)) {
    query = query.neq("id", excludeMachineId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return { available: true };
  }

  const match = data[0].machine_id || "existing machine";
  return {
    available: false,
    conflictMachineId: match,
    existingMachineId: match,
  };
}

/**
 * Create a new machine record with validation, ID generation, and audit logging.
 */
export async function createMachine(input: CreateMachineInput): Promise<MutationResult> {
  try {
    const caller = await requireRole("admin", "super_admin", "manager");
    const supabase = await createSupabaseServerClient();

    const errors: Record<string, string> = {};
    if (!input.model?.trim()) errors.model = "Model is required.";
    if (!input.serial_number?.trim()) errors.serial_number = "Serial number is required.";
    if (!input.year_of_mfg?.trim()) errors.year_of_mfg = "Year of manufacture is required.";
    if (!input.manufacturer?.trim()) errors.manufacturer = "Manufacturer is required.";

    let machineId = input.machine_id?.trim()?.toUpperCase() || null;
    if (machineId && !MACHINE_ID_REGEX.test(machineId) && !/^[A-Z0-9\-]{3,20}$/.test(machineId)) {
      errors.machine_id = "Machine ID format should be RI-MC-0001 or valid alphanumeric string.";
    }

    const healthStatus = input.health_status || "active";
    if (!["active", "under_maintenance", "breakdown", "spare"].includes(healthStatus)) {
      errors.health_status = "Invalid health status option selected.";
    }

    const status = input.status || "available";
    if (!["available", "rented"].includes(status)) {
      errors.status = "Invalid status option selected.";
    }

    if (Object.keys(errors).length > 0) {
      return { error: "Please complete all mandatory machine specification fields.", fieldErrors: errors };
    }

    // Verify Serial Number uniqueness
    const serialCheck = await checkMachineSerialNumberAvailable(input.serial_number);
    if (!serialCheck.available) {
      return {
        error: `A machine with Serial Number "${input.serial_number.trim()}" already exists in the inventory (${serialCheck.conflictMachineId}).`,
        fieldErrors: {
          serial_number: `Serial Number already registered to machine ${serialCheck.conflictMachineId}.`,
        },
      };
    }

    // Auto-generate next RI-MC-XXXX if not provided
    if (!machineId) {
      const { data: existingMachines } = await supabase
        .from("machines")
        .select("machine_id")
        .like("machine_id", "RI-MC-%")
        .order("created_at", { ascending: false })
        .limit(100);

      let maxNum = 0;
      if (existingMachines && existingMachines.length > 0) {
        for (const m of existingMachines) {
          if (m.machine_id) {
            const match = m.machine_id.match(/^RI-MC-(\d+)$/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxNum) maxNum = num;
            }
          }
        }
      }
      machineId = `RI-MC-${String(maxNum + 1).padStart(4, "0")}`;
    }

    const supervisor_ids = (input.supervisor_ids || []).filter(isValidUuid);
    const operator_ids = (input.operator_ids || []).filter(isValidUuid);
    const current_supervisor_id = input.current_supervisor_id || supervisor_ids[0] || null;
    const current_operator_id = input.current_operator_id || operator_ids[0] || null;
    const client_id = status === "rented" && isValidUuid(input.client_id) ? input.client_id : null;
    const hour_meter = Number(input.hour_meter ?? 0) >= 0 ? Number(input.hour_meter ?? 0) : 0;

    const insertPayload = {
      machine_id: machineId,
      model: input.model.trim(),
      serial_number: input.serial_number.trim(),
      year_of_mfg: input.year_of_mfg.trim(),
      manufacturer: input.manufacturer.trim(),
      supervisor_ids,
      current_supervisor_id,
      operator_ids,
      current_operator_id,
      client_id,
      hour_meter,
      health_status: healthStatus,
      status,
      created_by: caller.id,
    };

    const { data, error } = await supabase
      .from("machines")
      .insert(insertPayload)
      .select("id, machine_id")
      .single();

    if (error) {
      return formatMachineDatabaseError(error);
    }

    await logAudit({
      action: "machine.created",
      entity_type: "machine",
      entity_id: data?.id,
      metadata: {
        supervisor_ids,
        operator_ids,
      },
    });

    // Targeted cache invalidation: new machine affects list, KPIs, and selection options
    revalidateTag(TAGS.machinesList, "max");
    revalidateTag(TAGS.machinesKpis, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machinesMeta, "max");

    return { success: true, data };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Failed to register machine";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to add new machines."
        : rawMsg,
    };
  }
}

/**
 * Update an existing machine record with role-aware field restrictions.
 */
export async function updateMachine(id: string, input: UpdateMachineInput): Promise<MutationResult> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }

  try {
    const caller = await requireRole("admin", "super_admin", "manager", "supervisor");
    const supabase = await createSupabaseServerClient();
    const isSupervisor = caller.role === "supervisor";

    const hour_meter = input.hour_meter !== undefined ? Number(input.hour_meter) : undefined;
    if (hour_meter !== undefined && (isNaN(hour_meter) || hour_meter < 0)) {
      return { error: "Hour meter reading cannot be negative." };
    }

    const health_status = input.health_status;
    if (health_status && !["active", "under_maintenance", "breakdown", "spare"].includes(health_status)) {
      return { error: "Invalid health status option selected." };
    }

    const status = input.status;
    if (status && !["available", "rented"].includes(status)) {
      return { error: "Invalid rental status option selected." };
    }

    // Query current state before updating for tamper-evident audit diff tracking
    const { data: previousMachine } = await supabase
      .from("machines")
      .select("*, client:clients(id, company_name)")
      .eq("id", id)
      .maybeSingle();

    // Supervisor path: strictly operational fields
    if (isSupervisor) {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (hour_meter !== undefined) updateData.hour_meter = hour_meter;
      if (health_status) updateData.health_status = health_status;
      if (status) {
        updateData.status = status;
        updateData.client_id = status === "rented" && isValidUuid(input.client_id) ? input.client_id : null;
      }
      if (input.operator_ids !== undefined) {
        const validOps = input.operator_ids.filter(isValidUuid);
        if (validOps.length > 0) {
          const { data: operatorUsers } = await supabase
            .from("users")
            .select("id, role, status")
            .in("id", validOps);
          const invalidUsers = (operatorUsers || []).filter(
            (u) => u.role !== "operator" || u.status === "inactive"
          );
          if (invalidUsers.length > 0 || (operatorUsers?.length || 0) < validOps.length) {
            return {
              error: "Invalid assignment: Only active users with the 'operator' role can be assigned as machine operators.",
            };
          }
        }
        updateData.operator_ids = validOps;
        updateData.current_operator_id = validOps[0] || null;
      }

      const { error } = await supabase.from("machines").update(updateData).eq("id", id);
      if (error) return formatMachineDatabaseError(error);

      // Compute granular field diffs
      const changes: Record<string, { previous: any; updated: any; deleted?: boolean }> = {};
      for (const [key, val] of Object.entries(updateData)) {
        if (key === "updated_at") continue;
        const prevVal = previousMachine ? previousMachine[key] : undefined;
        if (JSON.stringify(prevVal) !== JSON.stringify(val)) {
          changes[key] = {
            previous: prevVal ?? null,
            updated: val ?? null,
            deleted: val === null || val === "" || (Array.isArray(val) && val.length === 0 && prevVal && prevVal.length > 0),
          };
        }
      }

      await logAudit({
        action: "machine.operational_updated",
        entity_type: "machine",
        entity_id: id,
        before_state: previousMachine || undefined,
        after_state: updateData,
        metadata: {
          ...updateData,
          changes,
        },
      });

      // Targeted invalidation: operational update affects machine detail, list queries, and KPIs
      revalidateTag(TAGS.machineDetail(id), "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.machinesKpis, "max");
      revalidateTag(TAGS.dashboardKpis, "max");

      return { success: true };
    }

    // Manager / Admin path: full update
    if (input.serial_number?.trim()) {
      const serialCheck = await checkMachineSerialNumberAvailable(input.serial_number, id);
      if (!serialCheck.available) {
        return {
          error: `A machine with Serial Number "${input.serial_number.trim()}" already exists in the inventory (${serialCheck.conflictMachineId}).`,
          fieldErrors: {
            serial_number: `Serial Number already registered to machine ${serialCheck.conflictMachineId}.`,
          },
        };
      }
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.machine_id?.trim()) updatePayload.machine_id = input.machine_id.trim().toUpperCase();
    if (input.model?.trim()) updatePayload.model = input.model.trim();
    if (input.serial_number?.trim()) updatePayload.serial_number = input.serial_number.trim();
    if (input.year_of_mfg?.trim()) updatePayload.year_of_mfg = input.year_of_mfg.trim();
    if (input.manufacturer?.trim()) updatePayload.manufacturer = input.manufacturer.trim();
    if (hour_meter !== undefined) updatePayload.hour_meter = hour_meter;
    if (health_status) updatePayload.health_status = health_status;
    if (status) {
      updatePayload.status = status;
      updatePayload.client_id = status === "rented" && isValidUuid(input.client_id) ? input.client_id : null;
    }

    if (input.supervisor_ids !== undefined) {
      const validSups = input.supervisor_ids.filter(isValidUuid);
      updatePayload.supervisor_ids = validSups;
      updatePayload.current_supervisor_id = validSups[0] || null;
    }
    if (input.operator_ids !== undefined) {
      const validOps = input.operator_ids.filter(isValidUuid);
      updatePayload.operator_ids = validOps;
      updatePayload.current_operator_id = validOps[0] || null;
    }

    const { error } = await supabase.from("machines").update(updatePayload).eq("id", id);
    if (error) return formatMachineDatabaseError(error);

    // Compute granular field diffs
    const changes: Record<string, { previous: any; updated: any; deleted?: boolean }> = {};
    for (const [key, val] of Object.entries(updatePayload)) {
      if (key === "updated_at") continue;
      const prevVal = previousMachine ? previousMachine[key] : undefined;
      if (JSON.stringify(prevVal) !== JSON.stringify(val)) {
        changes[key] = {
          previous: prevVal ?? null,
          updated: val ?? null,
          deleted: val === null || val === "" || (Array.isArray(val) && val.length === 0 && prevVal && prevVal.length > 0),
        };
      }
    }

    await logAudit({
      action: "machine.updated",
      entity_type: "machine",
      entity_id: id,
      before_state: previousMachine || undefined,
      after_state: updatePayload,
      metadata: {
        ...updatePayload,
        changes,
      },
    });

    // Targeted invalidation: update affects machine detail, list queries, and fleet KPIs
    revalidateTag(TAGS.machineDetail(id), "max");
    revalidateTag(TAGS.machinesList, "max");
    revalidateTag(TAGS.machinesKpis, "max");
    revalidateTag(TAGS.dashboardKpis, "max");

    return { success: true };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Failed to update machine";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to update machine details."
        : rawMsg,
    };
  }
}

/**
 * Deactivate or delete a machine asset from inventory.
 */
export async function deactivateMachine(id: string): Promise<MutationResult> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }

  try {
    await requireRole("admin", "super_admin", "manager");
    const supabase = await createSupabaseServerClient();

    // Query full machine details before deletion to log exact deleted attributes
    const { data: previousMachine } = await supabase
      .from("machines")
      .select("*, client:clients(id, company_name)")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("machines").delete().eq("id", id);
    if (error) {
      return formatMachineDatabaseError(error);
    }

    await logAudit({
      action: "machine.deleted",
      entity_type: "machine",
      entity_id: id,
      before_state: previousMachine || undefined,
      after_state: undefined,
      metadata: {
        deleted_record: previousMachine || null,
        machine_id: previousMachine?.machine_id,
        model: previousMachine?.model,
        serial_number: previousMachine?.serial_number,
        hour_meter: previousMachine?.hour_meter,
        health_status: previousMachine?.health_status,
        status: previousMachine?.status,
        manufacturer: previousMachine?.manufacturer,
        client_name: previousMachine?.client?.company_name || null,
      },
    });

    // Targeted invalidation: deletion affects detail, list queries, KPIs, and machine selection options
    revalidateTag(TAGS.machineDetail(id), "max");
    revalidateTag(TAGS.machinesList, "max");
    revalidateTag(TAGS.machinesKpis, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machinesMeta, "max");

    return { success: true };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Failed to delete machine";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to delete machines."
        : rawMsg,
    };
  }
}
