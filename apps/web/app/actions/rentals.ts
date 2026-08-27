"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import { requireRole } from "@/lib/dal";

export interface RentalActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

// ----------------------------------------------------
// 1. CUSTOMER MANAGEMENT
// ----------------------------------------------------
export async function createRentalCustomerAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const company_name = (formData.get("company_name") as string)?.trim();
  const contact_person = (formData.get("contact_person") as string)?.trim();
  const contact_mobile = (formData.get("contact_mobile") as string)?.trim();
  const contact_email = (formData.get("contact_email") as string)?.trim() || null;
  const billing_address = (formData.get("billing_address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const gstin = (formData.get("gstin") as string)?.trim() || null;

  if (!company_name || !contact_person || !contact_mobile || !city || !state) {
    return { success: false, error: "Company name, contact person, mobile, city, and state are required." };
  }

  const customer_code = `RC-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("rental_customers")
    .insert({
      customer_code,
      company_name,
      contact_person,
      contact_mobile,
      contact_email,
      billing_address,
      city,
      state,
      gstin,
      status: "active",
      branch_id: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await logAudit({
    action: "rental_customer.created",
    entity_type: "rental_customer",
    entity_id: data.id,
    metadata: { company_name, customer_code },
  });

  revalidateTag(TAGS.machines, "max");
  return { success: true, id: data.id };
}

export async function updateRentalCustomerAction(id: string, formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const company_name = (formData.get("company_name") as string)?.trim();
  const contact_person = (formData.get("contact_person") as string)?.trim();
  const contact_mobile = (formData.get("contact_mobile") as string)?.trim();
  const contact_email = (formData.get("contact_email") as string)?.trim() || null;
  const billing_address = (formData.get("billing_address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const gstin = (formData.get("gstin") as string)?.trim() || null;

  const { error } = await supabase
    .from("rental_customers")
    .update({
      company_name,
      contact_person,
      contact_mobile,
      contact_email,
      billing_address,
      city,
      state,
      gstin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "rental_customer.updated",
    entity_type: "rental_customer",
    entity_id: id,
  });

  return { success: true };
}

export async function deactivateRentalCustomerAction(id: string): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  // Check if historical rentals exist
  const { data: existingAgreements } = await supabase
    .from("rental_agreements")
    .select("id")
    .eq("customer_id", id);

  if (existingAgreements && existingAgreements.length > 0) {
    // Soft archive instead of delete
    const { error } = await supabase
      .from("rental_customers")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "rental_customer.archived",
      entity_type: "rental_customer",
      entity_id: id,
      metadata: { reason: "Customer has historical rentals. Soft archived." },
    });

    return { success: true };
  }

  // Deactivate
  const { error } = await supabase
    .from("rental_customers")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ----------------------------------------------------
// 2. RENTAL REQUESTS
// ----------------------------------------------------
export async function createRentalRequestAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "sales_executive", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const customer_id = (formData.get("customer_id") as string) || null;
  const customer_name = (formData.get("customer_name") as string)?.trim();
  const contact_mobile = (formData.get("contact_mobile") as string)?.trim();
  const category_name = (formData.get("category_name") as string) || "Forklift";
  const machine_id = (formData.get("machine_id") as string) || null;
  const required_quantity = parseInt((formData.get("required_quantity") as string) || "1") || 1;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const site_location = (formData.get("site_location") as string)?.trim();
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const operator_required = formData.get("operator_required") === "true";
  const delivery_required = formData.get("delivery_required") !== "false";
  const remarks = (formData.get("remarks") as string)?.trim() || null;

  if (!customer_name || !contact_mobile || !start_date || !end_date || !site_location || !city || !state) {
    return { success: false, error: "Please fill in all required request fields." };
  }

  const request_number = `RR-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("rental_requests")
    .insert({
      request_number,
      customer_id,
      customer_name,
      contact_mobile,
      category_name,
      machine_id,
      required_quantity,
      start_date,
      end_date,
      site_location,
      city,
      state,
      operator_required,
      delivery_required,
      remarks,
      status: "pending",
      branch_id: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "rental_request.created",
    entity_type: "rental_request",
    entity_id: data.id,
    metadata: { request_number, customer_name },
  });

  return { success: true, id: data.id };
}

export async function approveRentalRequestAction(requestId: string): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("rental_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "rental_request.approved",
    entity_type: "rental_request",
    entity_id: requestId,
  });

  return { success: true };
}

export async function rejectRentalRequestAction(requestId: string, reason: string): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("rental_requests")
    .update({ status: "rejected", remarks: `Rejected: ${reason}`, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "rental_request.rejected",
    entity_type: "rental_request",
    entity_id: requestId,
    metadata: { reason },
  });

  return { success: true };
}

// ----------------------------------------------------
// 3. RENTAL AGREEMENTS / CONTRACTS & PRICING
// ----------------------------------------------------
export async function createRentalAgreementAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const customer_id = formData.get("customer_id") as string;
  const machine_id = formData.get("machine_id") as string;
  const rental_request_id = (formData.get("rental_request_id") as string) || null;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const rental_rate = parseFloat((formData.get("rental_rate") as string) || "0") || 0;
  const rate_unit = (formData.get("rate_unit") as string) || "monthly";
  const allowed_hours_per_day = parseFloat((formData.get("allowed_hours_per_day") as string) || "8") || 8;
  const extra_hour_rate = parseFloat((formData.get("extra_hour_rate") as string) || "0") || 0;
  const security_deposit = parseFloat((formData.get("security_deposit") as string) || "0") || 0;
  const delivery_charges = parseFloat((formData.get("delivery_charges") as string) || "0") || 0;
  const operator_provided = formData.get("operator_provided") === "true";
  const discount_percentage = parseFloat((formData.get("discount_percentage") as string) || "0") || 0;
  const terms_conditions = (formData.get("terms_conditions") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!customer_id || !machine_id || !start_date || !end_date || rental_rate <= 0) {
    return { success: false, error: "Customer, machine, dates, and valid rental rate are required." };
  }

  // Check Machine Unbookable Status
  const { data: machine } = await supabase
    .from("machines")
    .select("id, status, notes")
    .eq("id", machine_id)
    .single();

  if (!machine) {
    return { success: false, error: "Selected machine not found." };
  }

  if (machine.status === "on_rent") {
    return { success: false, error: "Machine is currently rented out to another client." };
  }
  if (machine.status === "reserved") {
    return { success: false, error: "Machine is already reserved for an active booking." };
  }
  if (machine.status === "under_maintenance" || machine.status === "service_due") {
    return { success: false, error: "Machine is currently under maintenance / service hold." };
  }
  if (machine.status === "safety_hold" || machine.status === "inactive") {
    return { success: false, error: "Machine has a safety or compliance hold." };
  }

  // Pricing Rule: Discount > 15% requires approval
  const requires_discount_approval = discount_percentage > 15;
  const initialStatus = requires_discount_approval ? "pending_approval" : "approved";

  const contract_number = `RA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("rental_agreements")
    .insert({
      contract_number,
      rental_request_id,
      customer_id,
      machine_id,
      branch_id: null,
      start_date,
      end_date,
      rental_rate,
      rate_unit,
      allowed_hours_per_day,
      extra_hour_rate,
      security_deposit,
      delivery_charges,
      operator_provided,
      discount_percentage,
      requires_discount_approval,
      status: initialStatus,
      terms_conditions,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Reserve machine if contract approved
  if (initialStatus === "approved") {
    await supabase.from("machines").update({ status: "reserved" }).eq("id", machine_id);
  }

  // If request ID exists, mark converted
  if (rental_request_id) {
    await supabase.from("rental_requests").update({ status: "converted_to_contract" }).eq("id", rental_request_id);
  }

  await logAudit({
    action: "rental_agreement.created",
    entity_type: "rental_agreement",
    entity_id: data.id,
    metadata: { contract_number, discount_percentage, requires_discount_approval, status: initialStatus },
  });

  revalidateTag(TAGS.machines, "max");
  return { success: true, id: data.id };
}

export async function approveRentalAgreementAction(agreementId: string): Promise<RentalActionResult> {
  const user = await requireRole("admin", "super_admin", "sales_executive");
  const supabase = await createSupabaseServerClient();

  const { data: agreement } = await supabase
    .from("rental_agreements")
    .select("id, machine_id")
    .eq("id", agreementId)
    .single();

  if (!agreement) return { success: false, error: "Agreement not found." };

  const { error } = await supabase
    .from("rental_agreements")
    .update({
      status: "approved",
      discount_approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agreementId);

  if (error) return { success: false, error: error.message };

  // Reserve machine
  await supabase.from("machines").update({ status: "reserved" }).eq("id", agreement.machine_id);

  await logAudit({
    action: "rental_agreement.approved",
    entity_type: "rental_agreement",
    entity_id: agreementId,
    metadata: { approved_by: user.id },
  });

  revalidateTag(TAGS.machines, "max");
  return { success: true };
}

// ----------------------------------------------------
// 4. DISPATCH & DELIVERY CHALLANS
// ----------------------------------------------------
export async function dispatchRentalMachineAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const rental_agreement_id = formData.get("rental_agreement_id") as string;
  const site_location = (formData.get("site_location") as string)?.trim();
  const transport_details = (formData.get("transport_details") as string)?.trim() || null;
  const driver_name = (formData.get("driver_name") as string)?.trim() || null;
  const driver_contact = (formData.get("driver_contact") as string)?.trim() || null;
  const operator_id = (formData.get("operator_id") as string) || null;
  const start_hour_meter = parseFloat((formData.get("start_hour_meter") as string) || "0") || 0;
  const start_fuel_level = parseFloat((formData.get("start_fuel_level") as string) || "100") || 100;
  const machine_condition = (formData.get("machine_condition") as string) || "Excellent";
  const remarks = (formData.get("remarks") as string) || null;

  if (!rental_agreement_id || !site_location) {
    return { success: false, error: "Rental agreement and dispatch site location are required." };
  }

  const { data: agreement } = await supabase
    .from("rental_agreements")
    .select("*, machines(id, machine_code), rental_customers(id, company_name)")
    .eq("id", rental_agreement_id)
    .single();

  if (!agreement) return { success: false, error: "Rental contract not found." };

  const challan_number = `RDC-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: challan, error } = await supabase
    .from("rental_delivery_challans")
    .insert({
      challan_number,
      rental_agreement_id,
      customer_id: agreement.customer_id,
      machine_id: agreement.machine_id,
      branch_id: agreement.branch_id || null,
      dispatch_date: new Date().toISOString(),
      site_location,
      transport_details,
      driver_name,
      driver_contact,
      operator_id,
      start_hour_meter,
      start_fuel_level,
      machine_condition,
      remarks,
      status: "finalized",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Update contract status to active & dispatch date
  await supabase
    .from("rental_agreements")
    .update({
      status: "active",
      dispatch_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rental_agreement_id);

  // Update machine status to on_rent & customer info & meter
  await supabase
    .from("machines")
    .update({
      status: "on_rent",
      customer_name: agreement.rental_customers?.company_name || "Rental Client",
      hour_meter: start_hour_meter,
    })
    .eq("id", agreement.machine_id);

  await logAudit({
    action: "rental_machine.dispatched",
    entity_type: "rental_delivery_challan",
    entity_id: challan.id,
    metadata: { challan_number, agreement_id: rental_agreement_id, machine_id: agreement.machine_id },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  return { success: true, id: challan.id };
}

// ----------------------------------------------------
// 5. RETURNS & INSPECTIONS & DAMAGE REPORTS
// ----------------------------------------------------
export async function recordMachineReturnAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const rental_agreement_id = formData.get("rental_agreement_id") as string;
  const end_hour_meter = parseFloat((formData.get("end_hour_meter") as string) || "0") || 0;
  const end_fuel_level = parseFloat((formData.get("end_fuel_level") as string) || "100") || 100;
  const exterior_condition = (formData.get("exterior_condition") as string) || "Good";
  const tyres_condition = (formData.get("tyres_condition") as string) || "Good";
  const engine_condition = (formData.get("engine_condition") as string) || "Good";
  const hydraulics_condition = (formData.get("hydraulics_condition") as string) || "Good";
  const attachments_condition = (formData.get("attachments_condition") as string) || "Good";
  const safety_equipment_condition = (formData.get("safety_equipment_condition") as string) || "Good";
  const has_damage = formData.get("has_damage") === "true";
  const damage_description = (formData.get("damage_description") as string)?.trim() || null;
  const estimated_repair_cost = parseFloat((formData.get("estimated_repair_cost") as string) || "0") || 0;

  if (!rental_agreement_id) {
    return { success: false, error: "Rental agreement ID is required." };
  }

  const { data: agreement } = await supabase
    .from("rental_agreements")
    .select("*, machines(id)")
    .eq("id", rental_agreement_id)
    .single();

  if (!agreement) return { success: false, error: "Agreement not found." };

  const inspection_number = `RI-${Math.floor(1000 + Math.random() * 9000)}`;

  const inspectionStatus = has_damage ? "failed_damaged" : "passed";

  const { data: inspection, error } = await supabase
    .from("rental_return_inspections")
    .insert({
      inspection_number,
      rental_agreement_id,
      machine_id: agreement.machine_id,
      customer_id: agreement.customer_id,
      branch_id: agreement.branch_id || null,
      return_date: new Date().toISOString(),
      end_hour_meter,
      end_fuel_level,
      exterior_condition,
      tyres_condition,
      engine_condition,
      hydraulics_condition,
      attachments_condition,
      safety_equipment_condition,
      has_damage,
      damage_description,
      estimated_repair_cost,
      status: inspectionStatus,
      inspected_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // If damage exists -> Auto-create Damage Report & Notify Service / Finance
  if (has_damage) {
    const report_number = `DR-${Math.floor(1000 + Math.random() * 9000)}`;
    await supabase.from("rental_damage_reports").insert({
      report_number,
      inspection_id: inspection.id,
      rental_agreement_id,
      machine_id: agreement.machine_id,
      customer_id: agreement.customer_id,
      branch_id: agreement.branch_id || null,
      damage_details: damage_description || "Machine returned with damages during return inspection.",
      severity: estimated_repair_cost > 50000 ? "severe" : estimated_repair_cost > 10000 ? "moderate" : "minor",
      service_manager_notified: true,
      finance_notified: true,
      damage_charge_amount: estimated_repair_cost,
      customer_notified: true,
      status: "reported",
      created_by: user.id,
    });

    // Update machine status to service_due / under_maintenance
    await supabase
      .from("machines")
      .update({ status: "service_due", hour_meter: end_hour_meter, notes: `Returned damaged: ${damage_description}` })
      .eq("id", agreement.machine_id);
  } else {
    // OK Return -> Mark Machine Available & Contract Returned
    await supabase
      .from("machines")
      .update({ status: "available", hour_meter: end_hour_meter })
      .eq("id", agreement.machine_id);
  }

  // Update Contract Status
  await supabase
    .from("rental_agreements")
    .update({
      status: "returned",
      return_date: new Date().toISOString(),
      actual_return_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", rental_agreement_id);

  await logAudit({
    action: "rental_machine.returned",
    entity_type: "rental_return_inspection",
    entity_id: inspection.id,
    metadata: { inspection_number, has_damage, agreement_id: rental_agreement_id },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
  return { success: true, id: inspection.id };
}

// ----------------------------------------------------
// 6. RENTAL EXTENSIONS
// ----------------------------------------------------
export async function extendRentalContractAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const rental_agreement_id = formData.get("rental_agreement_id") as string;
  const proposed_end_date = formData.get("proposed_end_date") as string;
  const additional_amount = parseFloat((formData.get("additional_amount") as string) || "0") || 0;

  if (!rental_agreement_id || !proposed_end_date) {
    return { success: false, error: "Contract ID and proposed end date are required." };
  }

  const { data: agreement } = await supabase
    .from("rental_agreements")
    .select("*, machines(id)")
    .eq("id", rental_agreement_id)
    .single();

  if (!agreement) return { success: false, error: "Agreement not found." };

  // Availability Check: Look for future reservations for same machine
  const { data: conflictingReservations } = await supabase
    .from("rental_agreements")
    .select("id, contract_number")
    .eq("machine_id", agreement.machine_id)
    .neq("id", rental_agreement_id)
    .in("status", ["approved", "reserved"])
    .gte("start_date", agreement.end_date);

  const request_number = `RE-${Math.floor(1000 + Math.random() * 9000)}`;
  const currentEnd = new Date(agreement.end_date);
  const proposedEnd = new Date(proposed_end_date);
  const extension_days = Math.max(1, Math.ceil((proposedEnd.getTime() - currentEnd.getTime()) / 86400000));

  if (conflictingReservations && conflictingReservations.length > 0) {
    // Conflict -> Log rejected request
    await supabase.from("rental_extension_requests").insert({
      request_number,
      rental_agreement_id,
      current_end_date: agreement.end_date,
      proposed_end_date,
      extension_days,
      additional_amount,
      availability_status: "conflict_reserved",
      status: "rejected",
      rejection_reason: "Machine is reserved by another customer for upcoming dates.",
      requested_by: user.id,
    });

    return {
      success: false,
      error: "Extension rejected: Machine is already reserved by another client. Please offer an alternative machine.",
    };
  }

  // Extend contract
  await supabase
    .from("rental_agreements")
    .update({
      end_date: proposed_end_date,
      rental_rate: Number(agreement.rental_rate) + additional_amount,
      status: "extended",
      updated_at: new Date().toISOString(),
    })
    .eq("id", rental_agreement_id);

  await supabase.from("rental_extension_requests").insert({
    request_number,
    rental_agreement_id,
    current_end_date: agreement.end_date,
    proposed_end_date,
    extension_days,
    additional_amount,
    availability_status: "available",
    status: "approved",
    requested_by: user.id,
    approved_by: user.id,
  });

  await logAudit({
    action: "rental_agreement.extended",
    entity_type: "rental_agreement",
    entity_id: rental_agreement_id,
    metadata: { proposed_end_date, extension_days, additional_amount },
  });

  revalidateTag(TAGS.machines, "max");
  return { success: true };
}

// ----------------------------------------------------
// 7. OPERATIONAL BILLING REQUEST TO FINANCE
// ----------------------------------------------------
export async function createRentalBillingRequestAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const rental_agreement_id = formData.get("rental_agreement_id") as string;
  const billing_period_start = formData.get("billing_period_start") as string;
  const billing_period_end = formData.get("billing_period_end") as string;
  const base_rental_amount = parseFloat((formData.get("base_rental_amount") as string) || "0") || 0;
  const additional_hours_amount = parseFloat((formData.get("additional_hours_amount") as string) || "0") || 0;
  const transport_charges = parseFloat((formData.get("transport_charges") as string) || "0") || 0;
  const damage_charges = parseFloat((formData.get("damage_charges") as string) || "0") || 0;
  const security_deposit_adjusted = parseFloat((formData.get("security_deposit_adjusted") as string) || "0") || 0;

  if (!rental_agreement_id || !billing_period_start || !billing_period_end) {
    return { success: false, error: "Contract ID and billing dates are required." };
  }

  const { data: agreement } = await supabase
    .from("rental_agreements")
    .select("*, rental_customers(id)")
    .eq("id", rental_agreement_id)
    .single();

  if (!agreement) return { success: false, error: "Agreement not found." };

  const total_billable_amount = base_rental_amount + additional_hours_amount + transport_charges + damage_charges - security_deposit_adjusted;
  const request_number = `RBR-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("rental_billing_requests")
    .insert({
      request_number,
      rental_agreement_id,
      customer_id: agreement.customer_id,
      branch_id: agreement.branch_id || null,
      billing_period_start,
      billing_period_end,
      base_rental_amount,
      additional_hours_amount,
      transport_charges,
      damage_charges,
      security_deposit_adjusted,
      total_billable_amount,
      status: "submitted_to_finance",
      notes: formData.get("notes") as string || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    action: "rental_billing_request.created",
    entity_type: "rental_billing_request",
    entity_id: data.id,
    metadata: { request_number, total_billable_amount },
  });

  return { success: true, id: data.id };
}

// ----------------------------------------------------
// 8. SERVICE BREAKDOWN COORDINATION
// ----------------------------------------------------
export async function requestRentalServiceAction(formData: FormData): Promise<RentalActionResult> {
  const user = await requireRole("rental_manager", "admin", "super_admin");
  const supabase = await createSupabaseServerClient();

  const machine_id = formData.get("machine_id") as string;
  const issue_title = (formData.get("issue_title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = (formData.get("priority") as string) || "high";

  if (!machine_id || !issue_title || !description) {
    return { success: false, error: "Machine, issue title, and description are required." };
  }

  const { data: machine } = await supabase
    .from("machines")
    .select("*, branches(id)")
    .eq("id", machine_id)
    .single();

  if (!machine) return { success: false, error: "Machine not found." };

  const complaint_number = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("breakdown_complaints")
    .insert({
      complaint_number,
      machine_id,
      machine_code: machine.machine_code,
      client_name: machine.customer_name || "Rental Client",
      client_contact: machine.customer_mobile || "",
      issue_type: issue_title,
      description: `[Rental Manager Request]: ${description}`,
      priority,
      status: "pending",
      branch_id: machine.branch_id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Update machine status to service_due
  await supabase.from("machines").update({ status: "service_due" }).eq("id", machine_id);

  await logAudit({
    action: "rental_service_request.created",
    entity_type: "breakdown_complaint",
    entity_id: data.id,
    metadata: { complaint_number, machine_id },
  });

  revalidateTag(TAGS.machines, "max");
  revalidateTag(TAGS.complaints, "max");
  return { success: true, id: data.id };
}
