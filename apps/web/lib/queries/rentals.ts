import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, getUserBranchIds } from "@/lib/dal";

export interface RentalDashboardKpis {
  availableMachines: number;
  reservedMachines: number;
  onRentMachines: number;
  dueForReturn: number;
  overdueReturns: number;
  underInspection: number;
  underMaintenance: number;
  readyToRent: number;
  activeContracts: number;
  pendingRequests: number;
  totalRevenue: number;
  utilizationRate: number;
}

export async function getRentalDashboardKpis(branchId?: string | null): Promise<RentalDashboardKpis> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  const userBranchIds = await getUserBranchIds();

  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  // Fetch machines count by status
  let machineQuery = supabase.from("machines").select("id, status, notes");
  if (targetBranch) {
    machineQuery = machineQuery.eq("branch_id", targetBranch);
  }
  const { data: machines } = await machineQuery;

  const totalMachines = machines?.length || 0;
  const availableMachines = machines?.filter((m) => m.status === "available").length || 0;
  const reservedMachines = machines?.filter((m) => m.status === "reserved").length || 0;
  const onRentMachines = machines?.filter((m) => m.status === "on_rent").length || 0;
  const underMaintenance = machines?.filter((m) => m.status === "under_maintenance" || m.status === "service_due").length || 0;
  const readyToRent = availableMachines;

  // Fetch rental contracts
  let contractQuery = supabase.from("rental_agreements").select("*");
  if (targetBranch) {
    contractQuery = contractQuery.eq("branch_id", targetBranch);
  }
  const { data: contracts } = await contractQuery;

  const activeContracts = contracts?.filter((c) => c.status === "active" || c.status === "extended").length || 0;

  // Calculate returns and overdues
  const todayStr = new Date().toISOString().split("T")[0];
  let dueForReturn = 0;
  let overdueReturns = 0;
  let totalRevenue = 0;

  if (contracts) {
    for (const c of contracts) {
      if (c.status === "active" || c.status === "extended") {
        totalRevenue += Number(c.rental_rate) || 0;
        if (c.end_date === todayStr) {
          dueForReturn++;
        } else if (c.end_date < todayStr) {
          overdueReturns++;
        }
      }
    }
  }

  // Pending requests
  let requestQuery = supabase.from("rental_requests").select("id").eq("status", "pending");
  if (targetBranch) {
    requestQuery = requestQuery.eq("branch_id", targetBranch);
  }
  const { data: reqs } = await requestQuery;
  const pendingRequests = reqs?.length || 0;

  // Inspections
  let inspQuery = supabase.from("rental_return_inspections").select("id").eq("status", "under_inspection");
  if (targetBranch) {
    inspQuery = inspQuery.eq("branch_id", targetBranch);
  }
  const { data: insps } = await inspQuery;
  const underInspection = insps?.length || 0;

  const utilizationRate = totalMachines > 0 ? Math.round((onRentMachines / totalMachines) * 100) : 0;

  return {
    availableMachines,
    reservedMachines,
    onRentMachines,
    dueForReturn,
    overdueReturns,
    underInspection,
    underMaintenance,
    readyToRent,
    activeContracts,
    pendingRequests,
    totalRevenue,
    utilizationRate,
  };
}

export async function getRentalCustomers(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase.from("rental_customers").select("*").order("company_name", { ascending: true });
  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental customers:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalRequests(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase.from("rental_requests").select("*").order("created_at", { ascending: false });
  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental requests:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalAgreements(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase
    .from("rental_agreements")
    .select(`
      *,
      machines (machine_code, machine_name, serial_number, hour_meter, status),
      rental_customers (company_name, contact_person, contact_mobile, city)
    `)
    .order("created_at", { ascending: false });

  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental agreements:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalAgreementById(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: agreement, error } = await supabase
    .from("rental_agreements")
    .select(`
      *,
      machines (*),
      rental_customers (*)
    `)
    .eq("id", id)
    .single();

  if (error || !agreement) return null;

  // Fetch related challans, inspections, damage reports, billing requests
  const { data: challans } = await supabase
    .from("rental_delivery_challans")
    .select("*")
    .eq("rental_agreement_id", id)
    .order("created_at", { ascending: false });

  const { data: inspections } = await supabase
    .from("rental_return_inspections")
    .select("*")
    .eq("rental_agreement_id", id)
    .order("created_at", { ascending: false });

  const { data: damageReports } = await supabase
    .from("rental_damage_reports")
    .select("*")
    .eq("rental_agreement_id", id)
    .order("created_at", { ascending: false });

  const { data: billingRequests } = await supabase
    .from("rental_billing_requests")
    .select("*")
    .eq("rental_agreement_id", id)
    .order("created_at", { ascending: false });

  const { data: accessories } = await supabase
    .from("rental_accessories_log")
    .select("*")
    .eq("rental_agreement_id", id);

  return {
    ...agreement,
    challans: challans || [],
    inspections: inspections || [],
    damageReports: damageReports || [],
    billingRequests: billingRequests || [],
    accessories: accessories || [],
  };
}

export async function getRentalChallans(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase
    .from("rental_delivery_challans")
    .select(`
      *,
      machines (machine_code, machine_name, serial_number),
      rental_customers (company_name, contact_person)
    `)
    .order("created_at", { ascending: false });

  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental delivery challans:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalReturnInspections(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase
    .from("rental_return_inspections")
    .select(`
      *,
      machines (machine_code, machine_name, serial_number),
      rental_customers (company_name)
    `)
    .order("created_at", { ascending: false });

  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental return inspections:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalDamageReports(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase
    .from("rental_damage_reports")
    .select(`
      *,
      machines (machine_code, machine_name),
      rental_customers (company_name)
    `)
    .order("created_at", { ascending: false });

  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental damage reports:", error.message);
    return [];
  }
  return data || [];
}

export async function getRentalBillingRequests(branchId?: string | null) {
  const supabase = await createSupabaseServerClient();
  const userBranchIds = await getUserBranchIds();
  const targetBranch = branchId !== undefined ? branchId : (userBranchIds && userBranchIds.length > 0 ? userBranchIds[0] : null);

  let query = supabase
    .from("rental_billing_requests")
    .select(`
      *,
      rental_customers (company_name, contact_person)
    `)
    .order("created_at", { ascending: false });

  if (targetBranch) {
    query = query.eq("branch_id", targetBranch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching rental billing requests:", error.message);
    return [];
  }
  return data || [];
}
