"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { 
  LeadStatus, 
  OpportunityStage, 
  QuotationStatus, 
  SalesOrderStatus, 
  SalesOrderApprovalStatus, 
  SalesDeliveryStatus 
} from "@/lib/types/database";

// ----------------------------------------------------
// 1. LEADS MANAGEMENT
// ----------------------------------------------------
export async function createSalesLeadAction(payload: {
  leadName: string;
  companyName: string;
  contactPerson: string;
  contactMobile?: string;
  phone?: string;
  contactEmail?: string;
  email?: string;
  city: string;
  state: string;
  equipmentRequired?: string;
  requirement?: string;
  machineModel?: string;
  estimatedBudget?: number;
  expectedQuantity?: number;
  expectedPurchaseDate?: string;
  leadSource?: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const leadNumber = `LD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const mobile = payload.contactMobile || payload.phone || "";
  const email = payload.contactEmail || payload.email || null;
  const equip = payload.equipmentRequired || payload.requirement || payload.machineModel || null;

  const { data, error } = await supabase
    .from("sales_leads")
    .insert({
      lead_number: leadNumber,
      lead_name: payload.leadName,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      contact_mobile: mobile,
      contact_email: email,
      city: payload.city,
      state: payload.state,
      equipment_required: equip,
      estimated_budget: payload.estimatedBudget || null,
      expected_purchase_date: payload.expectedPurchaseDate || null,
      lead_source: payload.leadSource || "Direct Inquiry",
      status: "New",
      assigned_to: currentUser.id,
      branch_id: currentUser.branch_id,
      created_by: currentUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales lead:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_lead.create",
    entity_type: "sales_lead",
    entity_id: data.id,
    metadata: { lead_number: leadNumber, company_name: payload.companyName },
  });

  revalidateTag("sales-leads", "max");
  return { success: true, data };
}

export async function updateSalesLeadAction(leadId: string, payload: Partial<{
  leadName: string;
  companyName: string;
  contactPerson: string;
  contactMobile: string;
  phone: string;
  contactEmail: string;
  email: string;
  city: string;
  state: string;
  equipmentRequired: string;
  estimatedBudget: number;
  expectedPurchaseDate: string;
  leadSource: string;
  status: LeadStatus;
}>) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

  if (payload.leadName !== undefined) updateData.lead_name = payload.leadName;
  if (payload.companyName !== undefined) updateData.company_name = payload.companyName;
  if (payload.contactPerson !== undefined) updateData.contact_person = payload.contactPerson;
  if (payload.contactMobile !== undefined || payload.phone !== undefined) updateData.contact_mobile = payload.contactMobile || payload.phone;
  if (payload.contactEmail !== undefined || payload.email !== undefined) updateData.contact_email = payload.contactEmail || payload.email;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.state !== undefined) updateData.state = payload.state;
  if (payload.equipmentRequired !== undefined) updateData.equipment_required = payload.equipmentRequired;
  if (payload.estimatedBudget !== undefined) updateData.estimated_budget = payload.estimatedBudget;
  if (payload.expectedPurchaseDate !== undefined) updateData.expected_purchase_date = payload.expectedPurchaseDate;
  if (payload.leadSource !== undefined) updateData.lead_source = payload.leadSource;
  if (payload.status !== undefined) updateData.status = payload.status;

  const { data, error } = await supabase
    .from("sales_leads")
    .update(updateData)
    .eq("id", leadId)
    .select()
    .single();

  if (error) {
    console.error("Error updating sales lead:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_lead.update",
    entity_type: "sales_lead",
    entity_id: leadId,
    metadata: updateData,
  });

  revalidateTag("sales-leads", "max");
  return { success: true, data };
}

export async function convertLeadAction(leadId: string) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const { data: lead, error: fetchErr } = await supabase
    .from("sales_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchErr || !lead) return { success: false, error: "Lead not found" };

  // Create Customer from Lead
  const customerCode = `CUST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: customer, error: custErr } = await supabase
    .from("sales_customers")
    .insert({
      customer_code: customerCode,
      company_name: lead.company_name,
      contact_person: lead.contact_person,
      contact_mobile: lead.contact_mobile,
      contact_email: lead.contact_email,
      city: lead.city,
      state: lead.state,
      status: "active",
      account_owner: currentUser.id,
      branch_id: lead.branch_id || currentUser.branch_id,
      created_by: currentUser.id,
    })
    .select()
    .single();

  if (custErr) return { success: false, error: custErr.message };

  // Create Opportunity from Lead
  const oppNumber = `OPP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: opp, error: oppErr } = await supabase
    .from("sales_opportunities")
    .insert({
      opportunity_number: oppNumber,
      title: `${lead.company_name} - ${lead.equipment_required || "Machine Purchase"}`,
      customer_id: customer.id,
      stage: "Qualification",
      estimated_value: lead.estimated_budget || 0,
      expected_close_date: lead.expected_purchase_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      salesperson_id: currentUser.id,
      branch_id: lead.branch_id || currentUser.branch_id,
    })
    .select()
    .single();

  if (oppErr) return { success: false, error: oppErr.message };

  // Update Lead Status to Qualified
  await supabase
    .from("sales_leads")
    .update({ status: "Qualified", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  await logAudit({
    user_id: currentUser.id,
    action: "sales_lead.convert",
    entity_type: "sales_lead",
    entity_id: leadId,
    metadata: { customer_id: customer.id, opportunity_id: opp.id },
  });

  revalidateTag("sales-leads", "max");
  revalidateTag("sales-customers", "max");
  revalidateTag("sales-opportunities", "max");
  return { success: true, customer, opportunity: opp };
}

// ----------------------------------------------------
// 2. CUSTOMER MANAGEMENT
// ----------------------------------------------------
export async function createSalesCustomerAction(payload: {
  companyName: string;
  contactPerson: string;
  contactMobile?: string;
  phone?: string;
  contactEmail?: string;
  email?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city: string;
  state: string;
  gstin?: string;
  creditLimit?: number;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const customerCode = `CUST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const mobile = payload.contactMobile || payload.phone || "";
  const email = payload.contactEmail || payload.email || null;

  const { data, error } = await supabase
    .from("sales_customers")
    .insert({
      customer_code: customerCode,
      company_name: payload.companyName,
      contact_person: payload.contactPerson,
      contact_mobile: mobile,
      contact_email: email,
      billing_address: payload.billingAddress || null,
      city: payload.city,
      state: payload.state,
      gstin: payload.gstin || null,
      credit_limit: payload.creditLimit || 0,
      status: "active",
      account_owner: currentUser.id,
      branch_id: currentUser.branch_id,
      created_by: currentUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales customer:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_customer.create",
    entity_type: "sales_customer",
    entity_id: data.id,
    metadata: { customer_code: customerCode, company_name: payload.companyName },
  });

  revalidateTag("sales-customers", "max");
  return { success: true, data };
}

export async function archiveSalesCustomerAction(customerId: string) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();

  // Check if customer has historical transactions
  const { data: orders } = await supabase.from("sales_orders").select("id").eq("customer_id", customerId);
  const { data: quotes } = await supabase.from("sales_quotations").select("id").eq("customer_id", customerId);

  if ((orders && orders.length > 0) || (quotes && quotes.length > 0)) {
    // Soft delete to 'archived' per RBAC rules! Hard delete is strictly prohibited.
    const { error } = await supabase
      .from("sales_customers")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", customerId);

    if (error) return { success: false, error: error.message };

    await logAudit({
      user_id: currentUser.id,
      action: "sales_customer.archive",
      entity_type: "sales_customer",
      entity_id: customerId,
      metadata: { reason: "Soft-archived due to existing historical transactions" },
    });

    revalidateTag("sales-customers", "max");
    return { success: true, message: "Customer soft-archived successfully. Hard deletion prevented due to historical transactions." };
  }

  const { error: updateErr } = await supabase
    .from("sales_customers")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (updateErr) return { success: false, error: updateErr.message };

  revalidateTag("sales-customers", "max");
  return { success: true, message: "Customer set to inactive." };
}

// ----------------------------------------------------
// 3. INTERACTIONS LOGGING
// ----------------------------------------------------
export async function logSalesInteractionAction(payload: {
  customerId?: string;
  leadId?: string;
  interactionType: "Call" | "Meeting" | "Site Visit" | "Email" | "Demo" | "Phone Call";
  summary: string;
  notes?: string;
  followUpDate?: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const interactionNum = `ACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const type = payload.interactionType === "Phone Call" ? "Call" : payload.interactionType;

  const { data, error } = await supabase
    .from("sales_customer_interactions")
    .insert({
      interaction_number: interactionNum,
      customer_id: payload.customerId || null,
      lead_id: payload.leadId || null,
      interaction_type: type,
      summary: payload.summary,
      notes: payload.notes || null,
      follow_up_date: payload.followUpDate || null,
      salesperson_id: currentUser.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging sales interaction:", error);
    return { success: false, error: error.message };
  }

  revalidateTag("sales-interactions", "max");
  return { success: true, data };
}

// ----------------------------------------------------
// 4. OPPORTUNITIES MANAGEMENT
// ----------------------------------------------------
export async function createSalesOpportunityAction(payload: {
  title: string;
  customerId: string;
  stage: OpportunityStage;
  estimatedValue?: number;
  expectedValue?: number;
  expectedCloseDate?: string;
  expectedClosingDate?: string;
  probability?: number;
  competitor?: string;
  requirementNotes?: string;
  machineModel?: string;
  quantity?: number;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const oppNumber = `OPP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const val = payload.estimatedValue || payload.expectedValue || 0;
  const date = payload.expectedCloseDate || payload.expectedClosingDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("sales_opportunities")
    .insert({
      opportunity_number: oppNumber,
      title: payload.title,
      customer_id: payload.customerId,
      stage: payload.stage,
      estimated_value: val,
      expected_close_date: date,
      probability: payload.probability || 50,
      competitor: payload.competitor || null,
      requirement_notes: payload.requirementNotes || null,
      salesperson_id: currentUser.id,
      branch_id: currentUser.branch_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales opportunity:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_opportunity.create",
    entity_type: "sales_opportunity",
    entity_id: data.id,
    metadata: { opp_number: oppNumber, title: payload.title },
  });

  revalidateTag("sales-opportunities", "max");
  return { success: true, data };
}

// ----------------------------------------------------
// 5. QUOTATIONS MANAGEMENT
// ----------------------------------------------------
export async function createSalesQuotationAction(payload: {
  opportunityId?: string;
  customerId: string;
  customerName?: string;
  machineId?: string;
  equipmentDescription?: string;
  machineModel?: string;
  quantity?: number;
  unitPrice: number;
  discountPercentage?: number;
  discountPercent?: number;
  deliveryCharges?: number;
  transportCharges?: number;
  warrantyTerms?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityPeriod?: string;
  remarks?: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const quotationNumber = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qty = payload.quantity || 1;
  const unitPrice = payload.unitPrice;
  const discPct = payload.discountPercentage || payload.discountPercent || 0;
  const subtotal = qty * unitPrice;
  const discAmt = (subtotal * discPct) / 100;
  const taxAmt = (subtotal - discAmt) * 0.18;
  const grandTotal = (subtotal - discAmt) + taxAmt + (payload.deliveryCharges || 0) + (payload.transportCharges || 0);

  const approvalStatus = discPct > 5 ? "pending_approval" : "auto_approved";
  const equip = payload.equipmentDescription || payload.machineModel || "Industrial Machinery";

  const { data, error } = await supabase
    .from("sales_quotations")
    .insert({
      quotation_number: quotationNumber,
      revision_number: 1,
      opportunity_id: payload.opportunityId || null,
      customer_id: payload.customerId,
      machine_id: payload.machineId || null,
      equipment_description: equip,
      quantity: qty,
      unit_price: unitPrice,
      subtotal_amount: subtotal,
      discount_percentage: discPct,
      discount_amount: discAmt,
      tax_amount: taxAmt,
      grand_total: grandTotal,
      payment_terms: payload.paymentTerms || "100% Advance prior to dispatch",
      delivery_terms: payload.deliveryTerms || "Ex-Works Warehouse",
      validity_period: payload.validityPeriod || "30 Days from date of quotation",
      discount_approval_status: approvalStatus,
      status: "draft",
      remarks: payload.remarks || null,
      created_by: currentUser.id,
      branch_id: currentUser.branch_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales quotation:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_quotation.create",
    entity_type: "sales_quotation",
    entity_id: data.id,
    metadata: { quotation_number: quotationNumber, discount_percent: discPct, discount_approval_status: approvalStatus },
  });

  revalidateTag("sales-quotations", "max");
  return { success: true, data };
}

export async function reviseSalesQuotationAction(parentQuotationId: string, payload: {
  unitPrice: number;
  discountPercentage?: number;
  quantity?: number;
  equipmentDescription?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityPeriod?: string;
  remarks?: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const { data: parent, error: fetchErr } = await supabase
    .from("sales_quotations")
    .select("*")
    .eq("id", parentQuotationId)
    .single();

  if (fetchErr || !parent) return { success: false, error: "Parent quotation not found" };

  await supabase
    .from("sales_quotations")
    .update({ status: "revised", updated_at: new Date().toISOString() })
    .eq("id", parentQuotationId);

  const nextRev = (parent.revision_number || 1) + 1;
  const revQuotationNumber = `${parent.quotation_number.split("-V")[0]}-V${nextRev}`;

  const qty = payload.quantity || parent.quantity || 1;
  const unitPrice = payload.unitPrice;
  const discPct = payload.discountPercentage || 0;
  const subtotal = qty * unitPrice;
  const discAmt = (subtotal * discPct) / 100;
  const taxAmt = (subtotal - discAmt) * 0.18;
  const grandTotal = (subtotal - discAmt) + taxAmt + (parent.delivery_charges || 0) + (parent.transport_charges || 0);

  const { data, error } = await supabase
    .from("sales_quotations")
    .insert({
      quotation_number: revQuotationNumber,
      revision_number: nextRev,
      parent_quotation_id: parentQuotationId,
      opportunity_id: parent.opportunity_id,
      customer_id: parent.customer_id,
      machine_id: parent.machine_id,
      equipment_description: payload.equipmentDescription || parent.equipment_description,
      quantity: qty,
      unit_price: unitPrice,
      subtotal_amount: subtotal,
      discount_percentage: discPct,
      discount_amount: discAmt,
      tax_amount: taxAmt,
      grand_total: grandTotal,
      payment_terms: payload.paymentTerms || parent.payment_terms,
      delivery_terms: payload.deliveryTerms || parent.delivery_terms,
      validity_period: payload.validityPeriod || parent.validity_period,
      discount_approval_status: discPct > 5 ? "pending_approval" : "auto_approved",
      status: "draft",
      remarks: payload.remarks || `Revision ${nextRev} of ${parent.quotation_number}`,
      created_by: currentUser.id,
      branch_id: currentUser.branch_id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    user_id: currentUser.id,
    action: "sales_quotation.revise",
    entity_type: "sales_quotation",
    entity_id: data.id,
    metadata: { revision_number: nextRev, parent_id: parentQuotationId },
  });

  revalidateTag("sales-quotations", "max");
  return { success: true, data };
}

// ----------------------------------------------------
// 6. SALES ORDERS & MACHINE RESERVATION
// ----------------------------------------------------
export async function createSalesOrderAction(payload: {
  quotationId?: string;
  customerId: string;
  customerName?: string;
  machineId?: string;
  equipmentDescription?: string;
  quantity?: number;
  unitPrice: number;
  totalAmount: number;
  paymentStatus?: string;
  warrantyTerms?: string;
  deliveryInstruction?: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const orderNumber = `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qty = payload.quantity || 1;
  const unitPrice = payload.unitPrice;
  const totalAmount = payload.totalAmount;
  const equip = payload.equipmentDescription || "Industrial Machine";

  const { data, error } = await supabase
    .from("sales_orders")
    .insert({
      order_number: orderNumber,
      quotation_id: payload.quotationId || null,
      customer_id: payload.customerId,
      machine_id: payload.machineId || null,
      equipment_description: equip,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      order_date: new Date().toISOString().split("T")[0],
      payment_status: payload.paymentStatus || "pending_advance",
      approval_status: "approved",
      status: "order_confirmed",
      warranty_terms: payload.warrantyTerms || "12 Months / 2000 Hours Standard Manufacturer Warranty",
      delivery_instruction: payload.deliveryInstruction || null,
      salesperson_id: currentUser.id,
      created_by: currentUser.id,
      branch_id: currentUser.branch_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sales order:", error);
    return { success: false, error: error.message };
  }

  await logAudit({
    user_id: currentUser.id,
    action: "sales_order.create",
    entity_type: "sales_order",
    entity_id: data.id,
    metadata: { order_number: orderNumber, total_amount: totalAmount },
  });

  revalidateTag("sales-orders", "max");
  return { success: true, data };
}

export async function reserveMachineForSalesAction(orderId: string, machineId: string) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const resNumber = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: res, error: resErr } = await supabase
    .from("sales_machine_reservations")
    .insert({
      reservation_number: resNumber,
      sales_order_id: orderId,
      machine_id: machineId,
      reservation_date: new Date().toISOString().split("T")[0],
      status: "active",
      reserved_by: currentUser.id,
      branch_id: currentUser.branch_id,
    })
    .select()
    .single();

  if (resErr) return { success: false, error: resErr.message };

  await supabase
    .from("sales_orders")
    .update({ 
      machine_id: machineId, 
      status: "machine_reserved",
      updated_at: new Date().toISOString() 
    })
    .eq("id", orderId);

  await logAudit({
    user_id: currentUser.id,
    action: "sales_machine.reserve",
    entity_type: "sales_machine_reservation",
    entity_id: res.id,
    metadata: { order_id: orderId, machine_id: machineId, reservation_number: resNumber },
  });

  revalidateTag("sales-orders", "max");
  revalidateTag("sales-reservations", "max");
  return { success: true, data: res };
}

export async function requestSalesDeliveryAction(orderId: string, payload: {
  deliveryAddress?: string;
  deliveryLocation?: string;
  contactPersonAtSite?: string;
  contactMobileAtSite?: string;
  specialInstructions?: string;
  requestedDeliveryDate: string;
}) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const coordNum = `SDC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: order } = await supabase.from("sales_orders").select("*").eq("id", orderId).single();
  if (!order) return { success: false, error: "Sales order not found" };

  const addr = payload.deliveryAddress || payload.deliveryLocation || "Customer Site";

  const { data, error } = await supabase
    .from("sales_delivery_coordinations")
    .insert({
      coordination_number: coordNum,
      sales_order_id: orderId,
      machine_id: order.machine_id,
      delivery_address: addr,
      contact_person_at_site: payload.contactPersonAtSite || "Site Manager",
      contact_mobile_at_site: payload.contactMobileAtSite || "9876543210",
      special_instructions: payload.specialInstructions || null,
      requested_delivery_date: payload.requestedDeliveryDate,
      status: "requested",
      created_by: currentUser.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await supabase
    .from("sales_orders")
    .update({ status: "delivery_requested", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  await logAudit({
    user_id: currentUser.id,
    action: "sales_delivery.request",
    entity_type: "sales_delivery_coordination",
    entity_id: data.id,
    metadata: { coordination_number: coordNum, order_id: orderId },
  });

  revalidateTag("sales-orders", "max");
  revalidateTag("sales-deliveries", "max");
  return { success: true, data };
}

export async function completeSalesHandoverAction(coordinationId: string, signedDocUrl: string) {
  await requirePermission("sales.view");
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "Unauthorized" };

  const supabase = createSupabaseAdminClient();
  const { data: coord, error: fetchErr } = await supabase
    .from("sales_delivery_coordinations")
    .select("*")
    .eq("id", coordinationId)
    .single();

  if (fetchErr || !coord) return { success: false, error: "Delivery coordination not found" };

  const { data, error } = await supabase
    .from("sales_delivery_coordinations")
    .update({
      signed_handover_doc_url: signedDocUrl,
      status: "delivered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", coordinationId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await supabase
    .from("sales_orders")
    .update({ status: "handover_completed", updated_at: new Date().toISOString() })
    .eq("id", coord.sales_order_id);

  await logAudit({
    user_id: currentUser.id,
    action: "sales_handover.complete",
    entity_type: "sales_delivery_coordination",
    entity_id: coordinationId,
    metadata: { signed_doc_url: signedDocUrl },
  });

  revalidateTag("sales-orders", "max");
  revalidateTag("sales-deliveries", "max");
  return { success: true, data };
}
