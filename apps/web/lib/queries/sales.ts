import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { 
  SalesLead,
  SalesCustomer,
  SalesInteraction,
  SalesOpportunity,
  SalesQuotation,
  SalesOrder,
  SalesMachineReservation,
  SalesDeliveryCoordination,
  SalesSettings,
  SalesDashboardMetrics,
  Machine
} from "@/lib/types/database";

export const getSalesDashboardMetrics = cache(async (userBranchId?: string | null): Promise<SalesDashboardMetrics> => {
  const supabase = createSupabaseAdminClient();

  try {
    let leadsQuery = supabase.from("sales_leads").select("id, status, created_at", { count: "exact" });
    let oppsQuery = supabase.from("sales_opportunities").select("id, expected_value, stage", { count: "exact" });
    let quotesQuery = supabase.from("sales_quotations").select("id, status, grand_total", { count: "exact" });
    let ordersQuery = supabase.from("sales_orders").select("id, status, approval_status, total_amount, machine_reserved", { count: "exact" });
    let customersQuery = supabase.from("sales_customers").select("id", { count: "exact" }).eq("status", "active");

    if (userBranchId) {
      leadsQuery = leadsQuery.eq("branch_id", userBranchId);
      oppsQuery = oppsQuery.eq("branch_id", userBranchId);
      quotesQuery = quotesQuery.eq("branch_id", userBranchId);
      ordersQuery = ordersQuery.eq("branch_id", userBranchId);
      customersQuery = customersQuery.eq("branch_id", userBranchId);
    }

    const [
      { data: leadsData, count: totalLeadsCount },
      { data: oppsData },
      { data: quotesData },
      { data: ordersData },
      { count: customerCount }
    ] = await Promise.all([
      leadsQuery,
      oppsQuery,
      quotesQuery,
      ordersQuery,
      customersQuery
    ]);

    const leads = leadsData || [];
    const opps = oppsData || [];
    const quotes = quotesData || [];
    const orders = ordersData || [];

    const newLeads = leads.filter(l => l.status === "New").length;
    const activeOpps = opps.filter(o => o.stage !== "Order Won" && o.stage !== "Order Lost").length;
    const pipelineValue = opps.filter(o => o.stage !== "Order Won" && o.stage !== "Order Lost").reduce((acc, curr) => acc + (Number(curr.expected_value) || 0), 0);

    const quotationPending = quotes.filter(q => q.status === "pending_approval" || q.status === "draft").length;
    const quotationAccepted = quotes.filter(q => q.status === "accepted").length;
    const quotationRejected = quotes.filter(q => q.status === "rejected").length;

    const ordersWon = orders.filter(o => o.status === "approved" || o.status === "delivered" || o.status === "handover_completed").length;
    const ordersLost = quotes.filter(q => q.status === "rejected").length;
    const monthlySales = orders.filter(o => o.status !== "cancelled").reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

    const reservedMachinesCount = orders.filter(o => o.machine_reserved).length;
    const pendingDeliveryCount = orders.filter(o => o.status === "delivery_requested" || o.status === "machine_reserved").length;
    const pendingApprovalsCount = orders.filter(o => o.approval_status === "pending_approval").length + quotes.filter(q => q.status === "pending_approval").length;

    return {
      totalLeads: totalLeadsCount || leads.length || 0,
      newLeads,
      followUpsDue: 3,
      activeOpportunities: activeOpps,
      quotationPending,
      quotationAccepted,
      quotationRejected,
      ordersWon,
      ordersLost,
      pipelineValue,
      monthlySales,
      salesTarget: 5000000,
      customerCount: customerCount || 0,
      reservedMachinesCount,
      pendingDeliveryCount,
      pendingApprovalsCount,
    };
  } catch (error) {
    console.error("Error in getSalesDashboardMetrics:", error);
    return {
      totalLeads: 0,
      newLeads: 0,
      followUpsDue: 0,
      activeOpportunities: 0,
      quotationPending: 0,
      quotationAccepted: 0,
      quotationRejected: 0,
      ordersWon: 0,
      ordersLost: 0,
      pipelineValue: 0,
      monthlySales: 0,
      salesTarget: 5000000,
      customerCount: 0,
      reservedMachinesCount: 0,
      pendingDeliveryCount: 0,
      pendingApprovalsCount: 0,
    };
  }
});

export const getSalesLeads = cache(async (branchId?: string | null): Promise<SalesLead[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_leads")
    .select(`
      *,
      assignee:users!assigned_to(id, full_name, email),
      branch:branches(id, code, name)
    `)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales leads:", error);
    return [];
  }
  return (data as unknown as SalesLead[]) || [];
});

export const getSalesCustomers = cache(async (branchId?: string | null): Promise<SalesCustomer[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_customers")
    .select(`
      *,
      branch:branches(id, code, name)
    `)
    .order("company_name", { ascending: true });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales customers:", error);
    return [];
  }
  return (data as unknown as SalesCustomer[]) || [];
});

export const getSalesInteractions = cache(async (customerId?: string | null, leadId?: string | null): Promise<SalesInteraction[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_customer_interactions")
    .select(`
      *,
      customer:sales_customers(id, company_name, contact_person),
      lead:sales_leads(id, lead_number, company_name),
      salesperson:users!salesperson_id(id, full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (customerId) query = query.eq("customer_id", customerId);
  if (leadId) query = query.eq("lead_id", leadId);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales interactions:", error);
    return [];
  }
  return (data as unknown as SalesInteraction[]) || [];
});

export const getSalesOpportunities = cache(async (branchId?: string | null): Promise<SalesOpportunity[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_opportunities")
    .select(`
      *,
      customer:sales_customers(id, company_name, contact_person, phone),
      salesperson:users!salesperson_id(id, full_name),
      branch:branches(id, code, name)
    `)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales opportunities:", error);
    return [];
  }
  return (data as unknown as SalesOpportunity[]) || [];
});

export const getSalesQuotations = cache(async (branchId?: string | null): Promise<SalesQuotation[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_quotations")
    .select(`
      *,
      customer:sales_customers(id, company_name, contact_person, phone, email),
      salesperson:users!salesperson_id(id, full_name),
      discount_approver:users!discount_approved_by(id, full_name)
    `)
    .order("quotation_number", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales quotations:", error);
    return [];
  }
  return (data as unknown as SalesQuotation[]) || [];
});

export const getSalesOrders = cache(async (branchId?: string | null): Promise<SalesOrder[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_orders")
    .select(`
      *,
      customer:sales_customers(id, company_name, contact_person, phone),
      quotation:sales_quotations(id, quotation_number),
      salesperson:users!salesperson_id(id, full_name),
      machine:machines(id, machine_code, machine_name, model)
    `)
    .order("order_number", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching sales orders:", error);
    return [];
  }
  return (data as unknown as SalesOrder[]) || [];
});

export const getAvailableMachinesForSale = cache(async (branchId?: string | null): Promise<Machine[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("machines")
    .select(`
      *,
      branch:branches(id, code, name, city)
    `)
    .in("status", ["active", "inactive"])
    .order("machine_name", { ascending: true });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching available machines for sale:", error);
    return [];
  }
  return (data as unknown as Machine[]) || [];
});

export const getSalesMachineReservations = cache(async (branchId?: string | null): Promise<SalesMachineReservation[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sales_machine_reservations")
    .select(`
      *,
      machine:machines(id, machine_code, machine_name, model, serial_number, city),
      sales_order:sales_orders(id, order_number, customer_name),
      reserver:users!reserved_by(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching machine reservations:", error);
    return [];
  }
  return (data as unknown as SalesMachineReservation[]) || [];
});

export const getSalesDeliveryCoordinations = cache(async (branchId?: string | null): Promise<SalesDeliveryCoordination[]> => {
  const supabase = createSupabaseAdminClient();
  const query = supabase
    .from("sales_delivery_coordinations")
    .select(`
      *,
      sales_order:sales_orders(id, order_number, customer_name, machine_model),
      machine:machines(id, machine_code, machine_name),
      creator:users!created_by(id, full_name)
    `)
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching delivery coordinations:", error);
    return [];
  }
  return (data as unknown as SalesDeliveryCoordination[]) || [];
});

export const getSalesSettings = cache(async (): Promise<SalesSettings | null> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sales_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching sales settings:", error);
    return {
      id: "default-sales-settings",
      discount_limit_sales: 5,
      discount_limit_manager: 10,
      discount_limit_admin: 15,
      sales_stages: ["New", "Contacted", "Qualified", "Requirement Identified", "Quotation", "Negotiation", "Won", "Lost"],
      lead_sources: ["Website", "Referral", "Exhibition", "Cold Call", "Social Media", "Direct Inquiry", "Partner"],
      document_templates: [],
      updated_at: new Date().toISOString(),
    };
  }

  return data as unknown as SalesSettings;
});
