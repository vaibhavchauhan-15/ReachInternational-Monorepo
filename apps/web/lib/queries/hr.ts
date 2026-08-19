import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { 
  Employee, 
  Department, 
  Designation, 
  EmployeeSalaryHistory, 
  EmployeeDocument, 
  UserAccountRequest 
} from "@/lib/types/database";

export interface HRDashboardMetrics {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  pending_onboarding: number;
  notice_period: number;
  new_employees: number;
  by_branch: Array<{ branch_id: string; branch_name: string; count: number }>;
  by_department: Array<{ department: string; count: number }>;
  by_designation: Array<{ designation: string; count: number }>;
  recent_onboardings: Employee[];
  records_requiring_update: Employee[];
}

const getCachedEmployeeDirectory = unstable_cache(
  async (branchId?: string): Promise<Employee[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("employees")
      .select(`
        id, employee_code, full_name, phone, email, designation, department, branch_id, user_id, 
        joining_date, employment_type, reporting_manager_id, salary, bank_name, account_number, 
        ifsc_code, status, created_at, updated_at, 
        branch:branches(id, code, name, city), 
        user:users(id, email, role),
        reporting_manager:employees!reporting_manager_id(id, full_name, employee_code)
      `)
      .order("full_name", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching employee directory:", error);
      return [];
    }

    return (data as unknown as Employee[]) ?? [];
  },
  ["employee-directory-list-v2"],
  {
    revalidate: CACHE_TIERS.CLASS_B_DIRECTORY,
    tags: [TAGS.employees],
  }
);

export const getEmployeeDirectory = cache(async (branchId?: string): Promise<Employee[]> => {
  return getCachedEmployeeDirectory(branchId);
});

export const getEmployeeById = cache(async (id: string): Promise<Employee | null> => {
  const employees = await getEmployeeDirectory();
  return employees.find((e) => e.id === id) ?? null;
});

export const getHRDashboardData = cache(async (branchId?: string): Promise<HRDashboardMetrics> => {
  const employees = await getEmployeeDirectory(branchId);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const total_employees = employees.filter((e) => e.status !== "archived").length;
  const active_employees = employees.filter((e) => e.status === "active").length;
  const inactive_employees = employees.filter((e) => e.status === "inactive" || e.status === "resigned" || e.status === "terminated").length;
  const pending_onboarding = employees.filter((e) => e.status === "pending_onboarding").length;
  const notice_period = employees.filter((e) => e.status === "notice_period").length;
  const new_employees = employees.filter((e) => new Date(e.joining_date) >= thirtyDaysAgo).length;

  // Group by branch
  const branchMap: Record<string, { name: string; count: number }> = {};
  // Group by department
  const deptMap: Record<string, number> = {};
  // Group by designation
  const desigMap: Record<string, number> = {};

  employees.forEach((emp) => {
    if (emp.status === "archived") return;

    // Branch
    const bName = emp.branch?.name || "Unassigned Branch";
    const bId = emp.branch_id || "unassigned";
    if (!branchMap[bId]) {
      branchMap[bId] = { name: bName, count: 0 };
    }
    branchMap[bId].count += 1;

    // Department
    const dept = emp.department || "General Operations";
    deptMap[dept] = (deptMap[dept] || 0) + 1;

    // Designation
    const desig = emp.designation || "Staff";
    desigMap[desig] = (desigMap[desig] || 0) + 1;
  });

  const by_branch = Object.entries(branchMap).map(([bId, val]) => ({
    branch_id: bId,
    branch_name: val.name,
    count: val.count,
  }));

  const by_department = Object.entries(deptMap).map(([dept, count]) => ({
    department: dept,
    count,
  }));

  const by_designation = Object.entries(desigMap).map(([desig, count]) => ({
    designation: desig,
    count,
  }));

  const recent_onboardings = [...employees]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const records_requiring_update = employees.filter(
    (e) => e.status === "active" && (!e.email || !e.phone || !e.bank_name || !e.account_number)
  );

  return {
    total_employees,
    active_employees,
    inactive_employees,
    pending_onboarding,
    notice_period,
    new_employees,
    by_branch,
    by_department,
    by_designation,
    recent_onboardings,
    records_requiring_update,
  };
});

export const getDepartments = cache(async (): Promise<Department[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    return [
      { id: "1", code: "DEP-SERVICE", name: "Service", description: "Service & Repairs", is_active: true, created_at: "", updated_at: "" },
      { id: "2", code: "DEP-STORE", name: "Store", description: "Inventory & Store", is_active: true, created_at: "", updated_at: "" },
      { id: "3", code: "DEP-SALES", name: "Sales", description: "Sales & CRM", is_active: true, created_at: "", updated_at: "" },
      { id: "4", code: "DEP-FINANCE", name: "Finance", description: "Finance & Accounts", is_active: true, created_at: "", updated_at: "" },
      { id: "5", code: "DEP-HR", name: "HR", description: "Human Resources", is_active: true, created_at: "", updated_at: "" },
      { id: "6", code: "DEP-OPS", name: "Operations", description: "Fleet Operations", is_active: true, created_at: "", updated_at: "" },
      { id: "7", code: "DEP-ADMIN", name: "Administration", description: "Administration", is_active: true, created_at: "", updated_at: "" },
      { id: "8", code: "DEP-RENTAL", name: "Rental", description: "Machine Rental", is_active: true, created_at: "", updated_at: "" },
    ];
  }

  return (data as Department[]) ?? [];
});

export const getDesignations = cache(async (): Promise<Designation[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("designations")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching designations:", error);
    return [
      { id: "1", code: "DES-SVC-ENG", title: "Service Engineer", department_code: "DEP-SERVICE", description: "Field Technician", is_active: true, created_at: "", updated_at: "" },
      { id: "2", code: "DES-MCH", title: "Mechanic", department_code: "DEP-SERVICE", description: "Equipment Mechanic", is_active: true, created_at: "", updated_at: "" },
      { id: "3", code: "DES-OPR", title: "Operator", department_code: "DEP-OPS", description: "Heavy Equipment Operator", is_active: true, created_at: "", updated_at: "" },
      { id: "4", code: "DES-SUP", title: "Supervisor", department_code: "DEP-OPS", description: "Site Supervisor", is_active: true, created_at: "", updated_at: "" },
      { id: "5", code: "DES-STR-MGR", title: "Store Manager", department_code: "DEP-STORE", description: "Store & Inventory Manager", is_active: true, created_at: "", updated_at: "" },
      { id: "6", code: "DES-BR-MGR", title: "Branch Manager", department_code: "DEP-ADMIN", description: "Branch Operational Manager", is_active: true, created_at: "", updated_at: "" },
      { id: "7", code: "DES-SLS-EXE", title: "Sales Executive", department_code: "DEP-SALES", description: "Sales Executive", is_active: true, created_at: "", updated_at: "" },
      { id: "8", code: "DES-FIN-MGR", title: "Finance Manager", department_code: "DEP-FINANCE", description: "Accounts Manager", is_active: true, created_at: "", updated_at: "" },
      { id: "9", code: "DES-HR-MGR", title: "HR Manager", department_code: "DEP-HR", description: "Human Resources Manager", is_active: true, created_at: "", updated_at: "" },
    ];
  }

  return (data as Designation[]) ?? [];
});

export const getEmployeeSalaryHistory = cache(async (employeeId?: string): Promise<EmployeeSalaryHistory[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("employee_salary_history")
    .select("*, creator:users!created_by(id, email, full_name)")
    .order("effective_date", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching salary history:", error);
    return [];
  }

  return (data as unknown as EmployeeSalaryHistory[]) ?? [];
});

export const getEmployeeDocuments = cache(async (employeeId?: string): Promise<EmployeeDocument[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("employee_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching employee documents:", error);
    return [];
  }

  return (data as EmployeeDocument[]) ?? [];
});

export const getUserAccountRequests = cache(async (): Promise<UserAccountRequest[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_account_requests")
    .select("*, employee:employees!employee_id(id, employee_code, full_name, email), requester:users!requested_by(id, full_name, email), branch:branches(id, code, name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user account requests:", error);
    return [];
  }

  return (data as unknown as UserAccountRequest[]) ?? [];
});
