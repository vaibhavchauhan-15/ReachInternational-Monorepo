"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";
import { formatMachineDatabaseError } from "@/lib/utils/machine-errors";

export interface MachineFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const machineIdRegex = /^RI-MC-\d{4,}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

function parseUuidArray(formData: FormData, fieldName: string, fallbackField?: string): string[] {
  const raw = (formData.get(fieldName) as string)?.trim();
  let ids: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ids = parsed.map((item) => String(item).trim()).filter(isValidUuid);
      } else if (isValidUuid(raw)) {
        ids = [raw];
      }
    } catch {
      if (isValidUuid(raw)) {
        ids = [raw];
      }
    }
  }
  if (ids.length === 0) {
    const all = formData.getAll(fieldName).map((item) => String(item).trim()).filter(isValidUuid);
    if (all.length > 0) ids = all;
  }
  if (ids.length === 0 && fallbackField) {
    const fallbackVal = (formData.get(fallbackField) as string)?.trim();
    if (fallbackVal && isValidUuid(fallbackVal)) {
      ids = [fallbackVal];
    }
  }
  return Array.from(new Set(ids));
}

export async function createMachine(state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  try {
    await requireRole("admin", "super_admin", "manager", "service_manager");

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required. Please log in to register a machine." };
    }

    let machine_id = (formData.get("machine_id") as string)?.trim()?.toUpperCase();
    const model = (formData.get("model") as string)?.trim() || null;
    const serial_number = (formData.get("serial_number") as string)?.trim() || null;
    const year_of_mfg = (formData.get("year_of_mfg") as string)?.trim() || null;
    const manufacturer = (formData.get("manufacturer") as string)?.trim() || null;
    const supervisor_ids = parseUuidArray(formData, "supervisor_ids", "current_supervisor_id");
    const operator_ids = parseUuidArray(formData, "operator_ids", "current_operator_id");
    const current_supervisor_id = supervisor_ids[0] || null;
    const current_operator_id = operator_ids[0] || null;
    const client_id = (formData.get("client_id") as string)?.trim() || null;
    const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
    const health_status = (formData.get("health_status") as string) || "active";
    const status = (formData.get("status") as string) || "available";

    const errors: Record<string, string> = {};

    if (!model) errors.model = "Model is required.";
    if (!serial_number) errors.serial_number = "Serial number is required.";
    if (!year_of_mfg) errors.year_of_mfg = "Year of manufacture is required.";
    if (!manufacturer) errors.manufacturer = "Manufacturer is required.";

    if (machine_id && !machineIdRegex.test(machine_id) && !/^[A-Z0-9\-]{3,20}$/.test(machine_id)) {
      errors.machine_id = "Machine ID format should be RI-MC-0001 or valid alphanumeric string.";
    }

    if (!["active", "under_maintenance", "breakdown"].includes(health_status)) {
      errors.health_status = "Invalid health status option selected.";
    }
    if (!["available", "rented"].includes(status)) {
      errors.status = "Invalid status option selected.";
    }

    if (Object.keys(errors).length > 0 || !serial_number) {
      return { error: "Please complete all mandatory machine specification fields.", fieldErrors: errors };
    }

    // Pre-validate uniqueness of Serial Number (case-insensitive)
    const normalizedSerial = serial_number.trim();
    const { data: existingSerialMachine } = await supabase
      .from("machines")
      .select("id, machine_id, serial_number")
      .ilike("serial_number", normalizedSerial)
      .limit(1);

    if (existingSerialMachine && existingSerialMachine.length > 0) {
      const matchId = existingSerialMachine[0].machine_id || "existing machine";
      return {
        error: `A machine with Serial Number "${normalizedSerial}" already exists in the inventory (${matchId}).`,
        fieldErrors: {
          serial_number: `Serial Number already registered to machine ${matchId}.`,
        },
      };
    }

    // Auto-generate next available unique Machine ID if omitted
    if (!machine_id) {
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
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
        }
      }
      machine_id = `RI-MC-${String(maxNum + 1).padStart(4, "0")}`;
    }

    const insertPayload: Record<string, any> = {
      machine_id,
      model,
      serial_number,
      year_of_mfg,
      manufacturer,
      supervisor_ids,
      current_supervisor_id,
      operator_ids,
      current_operator_id,
      client_id: status === "rented" && isValidUuid(client_id) ? client_id : null,
      hour_meter,
      health_status,
      status,
      created_by: user.id,
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

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machinesMeta, "max");
    revalidateTag(TAGS.dashboardKpis, "max");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : "Failed to register machine";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to add new machines."
        : rawMsg,
    };
  }
}

export async function updateMachine(id: string, state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }
  try {
    const caller = await requireRole("admin", "super_admin", "manager", "service_manager", "supervisor");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Authentication required. Please log in to update machine details." };

    const isSupervisor = caller.role === "supervisor";

    const operator_ids = parseUuidArray(formData, "operator_ids", "current_operator_id");
    const current_operator_id = operator_ids[0] || null;
    const client_id = (formData.get("client_id") as string)?.trim() || null;
    const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
    const health_status = (formData.get("health_status") as string) || "active";
    const status = (formData.get("status") as string) || "available";

    if (!["active", "under_maintenance", "breakdown"].includes(health_status)) {
      return { error: "Invalid health status option selected." };
    }
    if (!["available", "rented"].includes(status)) {
      return { error: "Invalid rental status option selected." };
    }
    if (hour_meter < 0 || isNaN(hour_meter)) {
      return { error: "Hour meter reading cannot be negative." };
    }

    // If supervisor is updating, strictly apply only operational updates (HMR, Health, Rental Status, Operators, Client)
    if (isSupervisor) {
      const updateData: Record<string, any> = {
        hour_meter,
        health_status,
        status,
        operator_ids,
        current_operator_id,
        client_id: status === "rented" && isValidUuid(client_id) ? client_id : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("machines")
        .update(updateData)
        .eq("id", id);

      if (error) {
        return formatMachineDatabaseError(error);
      }

      await logAudit({
        action: "machine.operational_updated",
        entity_type: "machine",
        entity_id: id,
        metadata: {
          hour_meter,
          health_status,
          status,
          operator_ids,
          current_operator_id: updateData.current_operator_id,
          client_id: updateData.client_id,
        },
      });

      revalidateTag(TAGS.machines, "max");
      revalidateTag(TAGS.machinesMeta, "max");
      revalidateTag(TAGS.dashboardKpis, "max");
      revalidateTag(TAGS.machineDetail(id), "max");

      return { success: true };
    }

    // Full Manager / Admin update pathway
    const machine_id = (formData.get("machine_id") as string)?.trim()?.toUpperCase();
    const model = (formData.get("model") as string)?.trim() || null;
    const serial_number = (formData.get("serial_number") as string)?.trim() || null;
    const year_of_mfg = (formData.get("year_of_mfg") as string)?.trim() || null;
    const manufacturer = (formData.get("manufacturer") as string)?.trim() || null;
    const supervisor_ids = parseUuidArray(formData, "supervisor_ids", "current_supervisor_id");
    const current_supervisor_id = supervisor_ids[0] || null;

    const updateErrors: Record<string, string> = {};

    if (!model) updateErrors.model = "Model is required.";
    if (!serial_number) updateErrors.serial_number = "Serial number is required.";
    if (!year_of_mfg) updateErrors.year_of_mfg = "Year of manufacture is required.";
    if (!manufacturer) updateErrors.manufacturer = "Manufacturer is required.";

    if (Object.keys(updateErrors).length > 0 || !serial_number) {
      return { error: "Please complete all mandatory machine specification fields.", fieldErrors: updateErrors };
    }

    // Pre-validate uniqueness of Serial Number (case-insensitive, excluding current machine)
    const normalizedSerial = serial_number.trim();
    const { data: existingSerialMachine } = await supabase
      .from("machines")
      .select("id, machine_id, serial_number")
      .ilike("serial_number", normalizedSerial)
      .neq("id", id)
      .limit(1);

    if (existingSerialMachine && existingSerialMachine.length > 0) {
      const matchId = existingSerialMachine[0].machine_id || "existing machine";
      return {
        error: `A machine with Serial Number "${normalizedSerial}" already exists in the inventory (${matchId}).`,
        fieldErrors: {
          serial_number: `Serial Number already registered to machine ${matchId}.`,
        },
      };
    }

    const updateData: Record<string, any> = {
      model,
      serial_number,
      year_of_mfg,
      manufacturer,
      supervisor_ids,
      current_supervisor_id,
      operator_ids,
      current_operator_id,
      client_id: status === "rented" && isValidUuid(client_id) ? client_id : null,
      hour_meter,
      health_status,
      status,
      updated_at: new Date().toISOString(),
    };

    if (machine_id) {
      updateData.machine_id = machine_id;
    }

    const { error } = await supabase
      .from("machines")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return formatMachineDatabaseError(error);
    }

    await logAudit({
      action: "machine.updated",
      entity_type: "machine",
      entity_id: id,
    });

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machinesMeta, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machineDetail(id), "max");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : "Failed to update machine details";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to update machine details."
        : rawMsg,
    };
  }
}

export async function updateMachineOperationalStatus(
  machineId: string,
  payload: {
    hour_meter?: number;
    current_operator_id?: string | null;
    operator_ids?: string[] | null;
    supervisor_ids?: string[] | null;
    client_id?: string | null;
    health_status?: "active" | "under_maintenance" | "breakdown";
    status?: "available" | "rented";
  }
): Promise<{ success?: boolean; error?: string }> {
  if (!isValidUuid(machineId)) {
    return { error: "Invalid machine ID format." };
  }
  try {
    await requireRole("admin", "super_admin", "manager", "service_manager", "supervisor");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.hour_meter !== undefined) {
      const hmr = Number(payload.hour_meter);
      if (isNaN(hmr) || hmr < 0) {
        return { error: "Hour meter reading cannot be negative." };
      }
      updateData.hour_meter = hmr;
    }

    if (payload.health_status !== undefined) {
      if (!["active", "under_maintenance", "breakdown"].includes(payload.health_status)) {
        return { error: "Invalid health status option." };
      }
      updateData.health_status = payload.health_status;
    }

    if (payload.status !== undefined) {
      if (!["available", "rented"].includes(payload.status)) {
        return { error: "Invalid rental status option." };
      }
      updateData.status = payload.status;
      if (payload.status === "available") {
        updateData.client_id = null;
      }
    }

    if (payload.operator_ids !== undefined) {
      const validOps = Array.isArray(payload.operator_ids)
        ? payload.operator_ids.filter(isValidUuid)
        : [];
      updateData.operator_ids = validOps;
      updateData.current_operator_id = validOps[0] || null;
    } else if (payload.current_operator_id !== undefined) {
      const opId =
        payload.current_operator_id && isValidUuid(payload.current_operator_id)
          ? payload.current_operator_id
          : null;
      updateData.current_operator_id = opId;
      updateData.operator_ids = opId ? [opId] : [];
    }

    if (payload.supervisor_ids !== undefined) {
      const validSups = Array.isArray(payload.supervisor_ids)
        ? payload.supervisor_ids.filter(isValidUuid)
        : [];
      updateData.supervisor_ids = validSups;
      updateData.current_supervisor_id = validSups[0] || null;
    }

    if (payload.client_id !== undefined && payload.status !== "available") {
      updateData.client_id =
        payload.client_id && isValidUuid(payload.client_id)
          ? payload.client_id
          : null;
    }

    const { error } = await supabase
      .from("machines")
      .update(updateData)
      .eq("id", machineId);

    if (error) {
      const formatted = formatMachineDatabaseError(error);
      return { error: formatted.error };
    }

    await logAudit({
      action: "machine.operational_status_updated",
      entity_type: "machine",
      entity_id: machineId,
      metadata: updateData,
    });

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machinesMeta, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machineDetail(machineId), "max");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : "Failed to update machine status";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to update machine status."
        : rawMsg,
    };
  }
}

export async function deleteMachine(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }
  try {
    await requireRole("admin", "super_admin", "manager", "service_manager");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("machines").delete().eq("id", id);
    
    if (error) {
      const formatted = formatMachineDatabaseError(error);
      return { error: formatted.error };
    }

    await logAudit({ action: "machine.deleted", entity_type: "machine", entity_id: id });

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.machinesMeta, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machineDetail(id), "max");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : "Failed to delete machine";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to delete machines."
        : rawMsg,
    };
  }
}

export async function reassignMachineSupervisor(machineId: string, supervisorId: string): Promise<{ success?: boolean; error?: string }> {
  if (!isValidUuid(machineId)) {
    return { error: "Invalid machine ID format." };
  }
  if (supervisorId && !isValidUuid(supervisorId)) {
    return { error: "Invalid supervisor ID format." };
  }
  try {
    await requireRole("admin", "super_admin", "manager", "service_manager");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("machines").update({ current_supervisor_id: supervisorId || null }).eq("id", machineId);
    
    if (error) {
      const formatted = formatMachineDatabaseError(error);
      return { error: formatted.error };
    }

    await logAudit({
      action: "machine.reassigned_supervisor",
      entity_type: "machine",
      entity_id: machineId,
      metadata: { current_supervisor_id: supervisorId },
    });

    revalidateTag(TAGS.machines, "max");
    revalidateTag(TAGS.dashboardKpis, "max");
    revalidateTag(TAGS.machineDetail(machineId), "max");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : "Failed to reassign supervisor";
    return {
      error: rawMsg.includes("row-level security")
        ? "Permission denied: Your account role does not have authorization to reassign supervisors."
        : rawMsg,
    };
  }
}

export async function checkMachineSerialNumberAvailable(
  serialNumber: string,
  excludeMachineId?: string
): Promise<{ available: boolean; existingMachineId?: string }> {
  if (!serialNumber || !serialNumber.trim()) {
    return { available: true };
  }
  try {
    const cleanSerial = serialNumber.trim();
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("machines")
      .select("id, machine_id, serial_number")
      .ilike("serial_number", cleanSerial);

    if (excludeMachineId && isValidUuid(excludeMachineId)) {
      query = query.neq("id", excludeMachineId);
    }

    const { data, error } = await query.limit(1);
    if (error || !data || data.length === 0) {
      return { available: true };
    }

    return {
      available: false,
      existingMachineId: data[0].machine_id || "existing machine",
    };
  } catch {
    return { available: true };
  }
}

export async function getMachineHourLogsAction(machineId: string): Promise<{
  success: boolean;
  logs?: any[];
  error?: string;
}> {
  if (!isValidUuid(machineId)) {
    return { success: false, error: "Invalid machine ID format.", logs: [] };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Authentication required.", logs: [] };
    }

    const { data, error } = await supabase
      .from("machine_hour_logs")
      .select(`
        id,
        machine_id,
        operator_id,
        supervisor_id,
        client_id,
        log_date,
        start_meter,
        end_meter,
        running_hours,
        start_time,
        end_time,
        overtime_hours,
        normal_working_hours,
        is_breakdown,
        shift,
        machine_condition,
        location,
        remarks,
        idempotency_key,
        created_at,
        operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email),
        client:clients!machine_hour_logs_client_id_fkey(id, code, company_name)
      `)
      .eq("machine_id", machineId)
      .order("log_date", { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, error: error.message || "Failed to retrieve machine logs", logs: [] };
    }

    return { success: true, logs: data || [] };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Failed to load machine logs";
    return { success: false, error: rawMsg, logs: [] };
  }
}


