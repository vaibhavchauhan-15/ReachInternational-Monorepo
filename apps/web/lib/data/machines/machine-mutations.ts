import "server-only";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MACHINE_CAPABILITIES,
  requireMachineCapability,
} from "@/lib/machines/authorization";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { formatMachineDatabaseError } from "@/lib/utils/machine-errors";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Deactivate or delete a machine asset from inventory.
 */
export async function deactivateMachine(id: string): Promise<MutationResult> {
  if (!isValidUuid(id)) {
    return { error: "Invalid machine ID format." };
  }

  try {
    await requireMachineCapability(MACHINE_CAPABILITIES.DELETE);
    const supabase = await createSupabaseServerClient();

    // Query full machine details before deletion to log exact deleted attributes
    const { data: previousMachine } = await supabase
      .from("machines")
      .select("id, machine_id, model, serial_number, year_of_mfg, manufacturer, hour_meter, health_status, status, client_id, client:clients(id, company_name)")
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
        client_name: (previousMachine as any)?.client?.company_name || null,
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
