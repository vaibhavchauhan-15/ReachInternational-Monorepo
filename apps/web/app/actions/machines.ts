"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";

export interface MachineFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const machineIdRegex = /^RI-MC-\d{4,}$/i;

export async function createMachine(state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  await requireRole("admin", "super_admin", "branch_manager", "service_manager");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized." };
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

  if (machine_id && !machineIdRegex.test(machine_id) && !/^[A-Z0-9\-]{3,20}$/.test(machine_id)) {
    errors.machine_id = "Machine ID format should be RI-MC-0001 or valid alphanumeric string.";
  }

  if (!["active", "under_maintenance", "breakdown"].includes(health_status)) {
    errors.health_status = "Invalid health status.";
  }
  if (!["available", "rented"].includes(status)) {
    errors.status = "Invalid status.";
  }

  if (Object.keys(errors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors: errors };
  }

  const insertPayload: Record<string, any> = {
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

  if (machine_id) {
    insertPayload.machine_id = machine_id;
  }

  const { data, error } = await supabase
    .from("machines")
    .insert(insertPayload)
    .select("id, machine_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A machine with this Machine ID already exists.", fieldErrors: { machine_id: "ID already taken." } };
    }
    return { error: error.message };
  }

  await logAudit({
    action: "machine.created",
    entity_type: "machine",
    entity_id: data?.id,
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.machinesMeta, "max");
  revalidateTag(TAGS.dashboardKpis, "max");

  redirect("/machines");
}

export async function updateMachine(id: string, state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  await requireRole("admin", "super_admin", "branch_manager", "service_manager", "rental_manager", "supervisor");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized." };

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

  if (error) return { error: error.message };

  await logAudit({
    action: "machine.updated",
    entity_type: "machine",
    entity_id: id,
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.machinesMeta, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.machineDetail(id), "max");

  redirect(`/machines/${id}`);
}

export async function deleteMachine(id: string): Promise<void> {
  await requireRole("super_admin");
  const supabase = await createSupabaseServerClient();
  await supabase.from("machines").delete().eq("id", id);
  await logAudit({ action: "machine.deleted", entity_type: "machine", entity_id: id });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.machinesMeta, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.machineDetail(id), "max");

  redirect("/machines");
}

export async function reassignMachineSupervisor(machineId: string, supervisorId: string): Promise<void> {
  await requireRole("admin", "super_admin", "branch_manager", "service_manager");
  const supabase = await createSupabaseServerClient();
  await supabase.from("machines").update({ current_supervisor_id: supervisorId }).eq("id", machineId);
  await logAudit({
    action: "machine.reassigned_supervisor",
    entity_type: "machine",
    entity_id: machineId,
    metadata: { current_supervisor_id: supervisorId },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.machineDetail(machineId), "max");
}
