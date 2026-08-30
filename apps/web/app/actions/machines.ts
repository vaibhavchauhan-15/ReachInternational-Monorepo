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

export async function createMachine(state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  try {
    await requireRole("admin", "super_admin", "manager", "service_manager", "store_manager");

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
    const current_supervisor_id = (formData.get("current_supervisor_id") as string)?.trim() || null;
    const current_operator_id = (formData.get("current_operator_id") as string)?.trim() || null;
    const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
    const service_count = parseInt((formData.get("service_count") as string) || "0", 10) || 0;
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

    if (Object.keys(errors).length > 0) {
      return { error: "Please complete all mandatory machine specification fields.", fieldErrors: errors };
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
      current_supervisor_id: current_supervisor_id || null,
      current_operator_id: current_operator_id || null,
      hour_meter,
      service_count,
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
    await requireRole("admin", "super_admin", "manager", "service_manager", "store_manager", "supervisor");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Authentication required. Please log in to update machine details." };

    const machine_id = (formData.get("machine_id") as string)?.trim()?.toUpperCase();
    const model = (formData.get("model") as string)?.trim() || null;
    const serial_number = (formData.get("serial_number") as string)?.trim() || null;
    const year_of_mfg = (formData.get("year_of_mfg") as string)?.trim() || null;
    const manufacturer = (formData.get("manufacturer") as string)?.trim() || null;
    const current_supervisor_id = (formData.get("current_supervisor_id") as string)?.trim() || null;
    const current_operator_id = (formData.get("current_operator_id") as string)?.trim() || null;
    const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
    const service_count = parseInt((formData.get("service_count") as string) || "0", 10) || 0;
    const health_status = (formData.get("health_status") as string) || "active";
    const status = (formData.get("status") as string) || "available";

    const updateErrors: Record<string, string> = {};

    if (!model) updateErrors.model = "Model is required.";
    if (!serial_number) updateErrors.serial_number = "Serial number is required.";
    if (!year_of_mfg) updateErrors.year_of_mfg = "Year of manufacture is required.";
    if (!manufacturer) updateErrors.manufacturer = "Manufacturer is required.";

    if (Object.keys(updateErrors).length > 0) {
      return { error: "Please complete all mandatory machine specification fields.", fieldErrors: updateErrors };
    }

    const updateData: Record<string, any> = {
      model,
      serial_number,
      year_of_mfg,
      manufacturer,
      current_supervisor_id: current_supervisor_id || null,
      current_operator_id: current_operator_id || null,
      hour_meter,
      service_count,
      health_status,
      status,
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

export async function deleteMachine(id: string): Promise<{ success?: boolean; error?: string }> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }
  try {
    await requireRole("admin", "super_admin");
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
    await requireRole("admin", "super_admin", "service_manager");
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
