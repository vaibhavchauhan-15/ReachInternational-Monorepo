"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";

export async function completeService(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const user = await requireRole("engineer", "service_engineer", "service_manager", "branch_manager", "supervisor", "mechanic", "admin", "super_admin");
  const role = user.role;

  const machine_id = formData.get("machine_id") as string;
  const engineer_id = formData.get("engineer_id") as string;
  const supervisor_id = formData.get("supervisor_id") as string;
  const service_category = (formData.get("service_category") as string) || "Engine Service";
  const service_status = (formData.get("service_status") as string) || "completed";
  const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
  const location = formData.get("location") as string;
  const pdf_report_url = formData.get("pdf_report_url") as string;
  const notes = formData.get("notes") as string;
  const service_date_str = formData.get("service_date") as string;
  const completion_date_str = formData.get("service_completion_date") as string;
  const photo_urls_str = formData.get("photo_urls") as string;

  const service_date = service_date_str || new Date().toISOString().split("T")[0];
  const service_completion_date = completion_date_str || (service_status === "completed" ? service_date : null);
  const photo_urls = photo_urls_str ? photo_urls_str.split(",").filter(Boolean) : [];

  const { data: machine } = await supabase
    .from("machines")
    .select("service_interval_days, next_service_due_date, engineer_id, service_count, hour_meter")
    .eq("id", machine_id)
    .single();

  if (!machine) throw new Error("Machine not found");

  if (role === "engineer" && machine.engineer_id && machine.engineer_id !== user.id) {
    throw new Error("You are not assigned to this machine");
  }

  const oldDue = machine.next_service_due_date;
  const baseDate = oldDue && new Date(oldDue) > new Date(service_date) ? new Date(oldDue) : new Date(service_date);
  const nextDue = new Date(baseDate.getTime() + machine.service_interval_days * 86400000);
  const nextDueStr = nextDue.toISOString().split("T")[0];

  await supabase.from("service_records").insert({
    machine_id,
    engineer_id: engineer_id || (role === "engineer" ? user.id : machine.engineer_id),
    supervisor_id: supervisor_id || (role === "supervisor" ? user.id : null),
    service_date,
    service_category,
    service_status,
    service_due_date: oldDue || service_date,
    service_completion_date,
    hour_meter: hour_meter || machine.hour_meter || 0,
    location: location || null,
    pdf_report_url: pdf_report_url || null,
    notes: notes || null,
    photo_urls,
    next_service_due_date: nextDueStr,
  });

  const updatedServiceCount = (machine.service_count || 0) + 1;
  const newHourMeter = Math.max(hour_meter, machine.hour_meter || 0);

  await supabase
    .from("machines")
    .update({
      last_service_date: service_date,
      next_service_due_date: nextDueStr,
      engineer_id: engineer_id || machine.engineer_id,
      service_count: updatedServiceCount,
      hour_meter: newHourMeter,
    })
    .eq("id", machine_id);

  await logAudit({
    action: "service.completed",
    entity_type: "machine",
    entity_id: machine_id,
    metadata: { engineer_id: engineer_id || user.id, service_date, next_due: nextDueStr },
  });

  revalidatePath(`/machines/${machine_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/services");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.services, "max");
  revalidateTag(CACHE_TAGS.machineDetail(machine_id), "max");
  revalidateTag(CACHE_TAGS.machineServices(machine_id), "max");
}
