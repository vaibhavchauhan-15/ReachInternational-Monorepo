"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { roleHasPermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";

function generateComplaintCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${num}`;
}

export async function createComplaint(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; complaintId?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!roleHasPermission(user.role, "complaint.create")) {
    return { error: "You do not have permission to raise machine complaints." };
  }

  const machine_id = formData.get("machine_id")?.toString();
  const complaint_date = formData.get("complaint_date")?.toString() || new Date().toISOString().split("T")[0];
  const state_name = formData.get("state_name")?.toString() || "";
  const city = formData.get("city")?.toString() || "";
  const location = formData.get("location")?.toString() || `${city}, ${state_name}`.trim();
  const engineer_id = formData.get("engineer_id")?.toString() || null;
  const hour_meter = parseFloat(formData.get("hour_meter")?.toString() || "0") || 0;
  const required_part = formData.get("required_part")?.toString() || null;
  const part_quantity = parseInt(formData.get("part_quantity")?.toString() || "1", 10) || 1;
  const complaint = formData.get("complaint")?.toString()?.trim();
  const work_done = formData.get("work_done")?.toString() || null;
  const pending_work = formData.get("pending_work")?.toString() || null;
  const status = formData.get("status")?.toString() || "open";

  if (!machine_id) {
    return { error: "Please select a machine." };
  }
  if (!complaint) {
    return { error: "Complaint description is required." };
  }

  const supabase = createSupabaseAdminClient();
  const complaint_no = generateComplaintCode();

  const { data, error } = await supabase
    .from("machine_complaints")
    .insert({
      complaint_no,
      machine_id,
      supervisor_id: user.id,
      engineer_id: engineer_id || null,
      complaint_date,
      location,
      state_name,
      city,
      hour_meter,
      required_part,
      part_quantity,
      complaint,
      work_done,
      pending_work,
      status,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating complaint:", error);
    return { error: error.message };
  }

  // Update machine status to under_maintenance if complaint is active
  if (status === "open" || status === "in_progress" || status === "pending_parts") {
    await supabase.from("machines").update({ status: "under_maintenance" }).eq("id", machine_id);
  }

  await logAudit({
    action: "complaint.created",
    entity_type: "machine_complaint",
    entity_id: data.id,
    metadata: { complaint_no, machine_id },
  });

  revalidateTag(CACHE_TAGS.complaints, "max");
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return { success: true, complaintId: data.id };
}

export async function updateComplaint(
  id: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const engineer_id = formData.get("engineer_id")?.toString() || null;
  const hour_meter = parseFloat(formData.get("hour_meter")?.toString() || "0") || 0;
  const required_part = formData.get("required_part")?.toString() || null;
  const part_quantity = parseInt(formData.get("part_quantity")?.toString() || "1", 10) || 1;
  const work_done = formData.get("work_done")?.toString() || null;
  const pending_work = formData.get("pending_work")?.toString() || null;
  const end_date = formData.get("end_date")?.toString() || null;
  const status = formData.get("status")?.toString() || "open";

  const supabase = createSupabaseAdminClient();

  const updatePayload: Record<string, unknown> = {
    engineer_id: engineer_id || null,
    hour_meter,
    required_part,
    part_quantity,
    work_done,
    pending_work,
    status,
    updated_at: new Date().toISOString(),
  };

  if (end_date) {
    updatePayload.end_date = end_date;
  } else if (status === "closed" || status === "resolved") {
    updatePayload.end_date = new Date().toISOString().split("T")[0];
  }

  const { error } = await supabase
    .from("machine_complaints")
    .update(updatePayload)
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit({
    action: "complaint.updated",
    entity_type: "machine_complaint",
    entity_id: id,
    metadata: { status },
  });

  revalidateTag(CACHE_TAGS.complaints, "max");
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return { success: true };
}

export async function closeComplaintWithFSR(
  id: string,
  payload: {
    work_done: string;
    pdf_report_url?: string;
    checklist_data?: Record<string, unknown>;
    hour_meter?: number;
  }
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  if (user.role === "supervisor" || user.role === "operator") {
    return { error: "Operators and Supervisors do not have resolution authority to close complaints with FSR." };
  }

  const supabase = createSupabaseAdminClient();
  const endDateStr = new Date().toISOString().split("T")[0];

  // Get machine ID from complaint
  const { data: complaintData } = await supabase
    .from("machine_complaints")
    .select("machine_id, hour_meter")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("machine_complaints")
    .update({
      work_done: payload.work_done,
      pdf_report_url: payload.pdf_report_url || null,
      checklist_data: payload.checklist_data || null,
      status: "closed",
      end_date: endDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // If hour meter was updated, update machine's hour meter too
  if (complaintData?.machine_id) {
    const newHourMeter = payload.hour_meter || complaintData.hour_meter || 0;
    await supabase
      .from("machines")
      .update({
        status: "active",
        hour_meter: newHourMeter,
      })
      .eq("id", complaintData.machine_id);
  }

  await logAudit({
    action: "complaint.closed_fsr",
    entity_type: "machine_complaint",
    entity_id: id,
  });

  revalidateTag(CACHE_TAGS.complaints, "max");
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return { success: true };
}

export async function updateComplaintStatusAction(
  id: string,
  payload: {
    status: "open" | "in_progress" | "pending_parts" | "resolved" | "closed";
    workDone?: string;
    pendingWork?: string;
    requiredPart?: string;
    partQuantity?: number;
  }
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  if ((payload.status === "closed" || payload.status === "resolved") && (user.role === "mechanic" || user.role === "operator")) {
    return { error: "Operators and Mechanics can log machine notes, but final complaint closure requires Service Manager approval." };
  }

  const supabase = createSupabaseAdminClient();
  const updatePayload: Record<string, unknown> = {
    status: payload.status,
    work_done: payload.workDone || null,
    pending_work: payload.pendingWork || null,
    required_part: payload.requiredPart || null,
    part_quantity: payload.partQuantity || 1,
    updated_at: new Date().toISOString(),
  };

  if (payload.status === "closed" || payload.status === "resolved") {
    updatePayload.end_date = new Date().toISOString().split("T")[0];
  }

  const { error } = await supabase
    .from("machine_complaints")
    .update(updatePayload)
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit({
    action: "complaint.status_updated",
    entity_type: "machine_complaint",
    entity_id: id,
    metadata: { status: payload.status },
  });

  revalidateTag(CACHE_TAGS.complaints, "max");
  revalidateTag(CACHE_TAGS.machines, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");

  return { success: true };
}
