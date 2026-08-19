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

const machineCodeRegex = /^[A-Z0-9\-]{3,20}$/;

function normalizeIndianPhone(input: string): { phone: string; isValid: boolean } {
  if (!input) return { phone: "", isValid: false };
  const cleaned = input.trim().replace(/\s+/g, "");
  // If 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { phone: `+91${cleaned}`, isValid: true };
  }
  // If already starts with +91 and 10 digits follow
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { phone: cleaned, isValid: true };
  }
  // Fallback for general valid phone numbers (10-15 digits with optional +)
  if (/^\+?[0-9]{10,15}$/.test(cleaned)) {
    return { phone: cleaned, isValid: true };
  }
  return { phone: cleaned, isValid: false };
}

export async function createMachine(state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  await requireRole("admin", "super_admin", "branch_manager");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized." };
  }

  let machine_code = (formData.get("machine_code") as string)?.trim()?.toUpperCase();
  if (!machine_code) {
    machine_code = `S${Math.floor(100 + Math.random() * 900)}`;
  }

  const machine_name = formData.get("machine_name") as string;
  const model = formData.get("model") as string;
  const serial_number = formData.get("serial_number") as string;
  const manufacturer = formData.get("manufacturer") as string;
  const year_of_mfg = formData.get("year_of_mfg") as string;
  const category_id = (formData.get("category_id") as string) || null;
  const category_name = (formData.get("category_name") as string) || "Forklift";
  const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
  const engine_serial_no = formData.get("engine_serial_no") as string;
  const engine_mot_no = formData.get("engine_mot_no") as string;
  const insurance_policy_no = formData.get("insurance_policy_no") as string;
  const insurance_expiry_date = (formData.get("insurance_expiry_date") as string) || null;
  const third_party_certificate = formData.get("third_party_certificate") as string;
  const third_party_expiry_date = (formData.get("third_party_expiry_date") as string) || null;
  const rto_tax = formData.get("rto_tax") as string;
  const rto_tax_expiry_date = (formData.get("rto_tax_expiry_date") as string) || null;
  const customer_name = formData.get("customer_name") as string;
  const raw_customer_mobile = formData.get("customer_mobile") as string;
  const customer_email = formData.get("customer_email") as string;
  const customer_address = formData.get("customer_address") as string;
  const city = formData.get("city") as string;
  const state_name = formData.get("state") as string;
  const engineer_id = formData.get("engineer_id") as string;
  const service_interval_days = parseInt(formData.get("service_interval_days") as string) || 90;
  const notes = formData.get("notes") as string;
  const status = (formData.get("status") as string) || "on_rent";

  const errors: Record<string, string> = {};

  if (!machine_code || !machineCodeRegex.test(machine_code)) {
    errors.machine_code = "Machine code must be 3-20 uppercase alphanumeric/dash characters.";
  }
  if (!machine_name) errors.machine_name = "Machine name is required.";
  if (!customer_name) errors.customer_name = "Customer name is required.";

  const phoneRes = normalizeIndianPhone(raw_customer_mobile);
  if (!phoneRes.isValid) {
    errors.customer_mobile = "Valid 10-digit Indian mobile number is required.";
  }
  const customer_mobile = phoneRes.phone;

  if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    errors.customer_email = "Valid email address is required.";
  }
  if (!city) errors.city = "City is required.";
  if (!state_name) errors.state = "State is required.";

  if (Object.keys(errors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors: errors };
  }

  // Generate next_service_due_date (today + interval)
  const now = new Date();
  const nextDue = new Date(now.getTime() + service_interval_days * 86400000);
  const nextDueStr = nextDue.toISOString().split("T")[0];

  const { data: userProfile } = await supabase
    .from("users")
    .select("branch_id, role")
    .eq("id", user.id)
    .single();

  const assignedBranchId = userProfile?.role === "branch_manager" ? userProfile.branch_id : (formData.get("branch_id") as string) || userProfile?.branch_id || null;

  const { data, error } = await supabase
    .from("machines")
    .insert({
      machine_code,
      machine_name,
      model: model || null,
      serial_number: serial_number || null,
      manufacturer: manufacturer || null,
      year_of_mfg: year_of_mfg || null,
      category_id: category_id || null,
      category_name: category_name || "Forklift",
      hour_meter,
      engine_serial_no: engine_serial_no || null,
      engine_mot_no: engine_mot_no || null,
      insurance_policy_no: insurance_policy_no || null,
      insurance_expiry_date: insurance_expiry_date || null,
      third_party_certificate: third_party_certificate || null,
      third_party_expiry_date: third_party_expiry_date || null,
      rto_tax: rto_tax || null,
      rto_tax_expiry_date: rto_tax_expiry_date || null,
      customer_name,
      customer_mobile,
      customer_email: customer_email || null,
      customer_address: customer_address || null,
      city,
      state: state_name,
      engineer_id: engineer_id || null,
      branch_id: assignedBranchId,
      last_service_date: null,
      next_service_due_date: nextDueStr,
      service_interval_days,
      status,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A machine with this code already exists.", fieldErrors: { machine_code: "Code already taken." } };
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

  // Log In-App Notification for New Machine
  await supabase.from("notifications").insert({
    machine_id: data.id,
    alert_type: "new_machine",
    alert_date: now.toISOString().split("T")[0],
    channel: "in_app",
    status: "sent",
    sent_at: now.toISOString(),
  });

  redirect("/machines");
}

export async function updateMachine(id: string, state: MachineFormState, formData: FormData): Promise<MachineFormState> {
  await requireRole("admin", "super_admin", "branch_manager", "service_manager", "rental_manager", "supervisor");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized." };

  const machine_code = (formData.get("machine_code") as string)?.trim()?.toUpperCase();
  const machine_name = formData.get("machine_name") as string;
  const model = formData.get("model") as string;
  const serial_number = formData.get("serial_number") as string;
  const manufacturer = formData.get("manufacturer") as string;
  const year_of_mfg = formData.get("year_of_mfg") as string;
  const category_id = (formData.get("category_id") as string) || null;
  const category_name = (formData.get("category_name") as string) || "Forklift";
  const hour_meter = parseFloat((formData.get("hour_meter") as string) || "0") || 0;
  const engine_serial_no = formData.get("engine_serial_no") as string;
  const engine_mot_no = formData.get("engine_mot_no") as string;
  const insurance_policy_no = formData.get("insurance_policy_no") as string;
  const insurance_expiry_date = (formData.get("insurance_expiry_date") as string) || null;
  const third_party_certificate = formData.get("third_party_certificate") as string;
  const third_party_expiry_date = (formData.get("third_party_expiry_date") as string) || null;
  const rto_tax = formData.get("rto_tax") as string;
  const rto_tax_expiry_date = (formData.get("rto_tax_expiry_date") as string) || null;
  const customer_name = formData.get("customer_name") as string;
  const raw_customer_mobile = formData.get("customer_mobile") as string;
  const customer_email = formData.get("customer_email") as string;
  const customer_address = formData.get("customer_address") as string;
  const city = formData.get("city") as string;
  const state_name = formData.get("state") as string;
  const engineer_id = formData.get("engineer_id") as string;
  const service_interval_days = parseInt(formData.get("service_interval_days") as string) || 90;
  const notes = formData.get("notes") as string;
  const status = formData.get("status") as string;

  const errors: Record<string, string> = {};
  if (!machine_code || !machineCodeRegex.test(machine_code)) errors.machine_code = "Machine code must be 3-20 uppercase alphanumeric/dash characters.";
  if (!machine_name) errors.machine_name = "Machine name is required.";
  if (!customer_name) errors.customer_name = "Customer name is required.";

  const phoneRes = normalizeIndianPhone(raw_customer_mobile);
  if (!phoneRes.isValid) errors.customer_mobile = "Valid 10-digit Indian mobile number is required.";
  const customer_mobile = phoneRes.phone;

  if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) errors.customer_email = "Valid email address is required.";
  if (!city) errors.city = "City is required.";
  if (!state_name) errors.state = "State is required.";

  if (Object.keys(errors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors: errors };
  }

  const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single();

  const updateData = userProfile?.role === "rental_manager"
    ? {
        status,
        notes: notes || null,
        customer_name,
        customer_mobile,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        city,
        state: state_name,
      }
    : {
        machine_code,
        machine_name,
        model: model || null,
        serial_number: serial_number || null,
        manufacturer: manufacturer || null,
        year_of_mfg: year_of_mfg || null,
        category_id: category_id || null,
        category_name: category_name || "Forklift",
        hour_meter,
        engine_serial_no: engine_serial_no || null,
        engine_mot_no: engine_mot_no || null,
        insurance_policy_no: insurance_policy_no || null,
        insurance_expiry_date: insurance_expiry_date || null,
        third_party_certificate: third_party_certificate || null,
        third_party_expiry_date: third_party_expiry_date || null,
        rto_tax: rto_tax || null,
        rto_tax_expiry_date: rto_tax_expiry_date || null,
        customer_name,
        customer_mobile,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        city,
        state: state_name,
        engineer_id: engineer_id || null,
        service_interval_days,
        status,
        notes: notes || null,
      };

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

  // Log In-App Notification for Machine Update
  await supabase.from("notifications").insert({
    machine_id: id,
    alert_type: "machine_updated",
    alert_date: new Date().toISOString().split("T")[0],
    channel: "in_app",
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  redirect(`/machines/${id}`);
}

export async function deleteMachine(id: string): Promise<void> {
  await requireRole("super_admin");
  const supabase = await createSupabaseServerClient();
  await supabase.from("machines").update({ status: "inactive" }).eq("id", id);
  await logAudit({ action: "machine.deleted", entity_type: "machine", entity_id: id });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.machinesMeta, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.machineDetail(id), "max");

  // Log In-App Notification for Machine Deletion
  await supabase.from("notifications").insert({
    machine_id: id,
    alert_type: "machine_deleted",
    alert_date: new Date().toISOString().split("T")[0],
    channel: "in_app",
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  redirect("/machines");
}

export async function reassignMachine(machineId: string, engineerId: string): Promise<void> {
  await requireRole("admin", "super_admin", "branch_manager", "service_manager", "rental_manager");
  const supabase = await createSupabaseServerClient();
  await supabase.from("machines").update({ engineer_id: engineerId }).eq("id", machineId);
  await logAudit({
    action: "machine.reassigned",
    entity_type: "machine",
    entity_id: machineId,
    metadata: { engineer_id: engineerId },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.services, "max");
  revalidateTag(TAGS.machineDetail(machineId), "max");
}

export async function requestMachineDeactivation(machineId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole("branch_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("machines")
    .update({ status: "inactive", notes: `Deactivation requested by ${user.full_name || user.email}: ${reason}` })
    .eq("id", machineId);

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "machine.deactivation_requested",
    entity_type: "machine",
    entity_id: machineId,
    metadata: { reason, requested_by: user.id },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  revalidateTag(TAGS.machineDetail(machineId), "max");
  return { success: true };
}
