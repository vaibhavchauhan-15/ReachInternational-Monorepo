import { requirePermission, protectDisabledRoute } from "@/lib/dal";
import { currentUserHasPermission } from "@/lib/auth/server-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { 
  getEmployeeDirectory, 
  getHRDashboardData, 
  getDepartments, 
  getDesignations, 
  getEmployeeSalaryHistory, 
  getEmployeeDocuments, 
  getUserAccountRequests 
} from "@/lib/queries/hr";
import { getBranches } from "@/lib/queries/branches";
import { HRClient } from "@/components/hr/HRClient";
import type { User } from "@/lib/types/database";

export default async function HRPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requirePermission("employee.view");
  protectDisabledRoute(user.role);
  const canViewSalary = await currentUserHasPermission("employee.salary.view");
  const canCreateEmployee = await currentUserHasPermission("employee.create");
  const { tab } = await searchParams;
  const supabase = createSupabaseAdminClient();

  const branchIdFilter = (user.role === "branch_manager" || user.role === "service_manager" || user.role === "supervisor") && user.branch_id ? user.branch_id : undefined;

  const [
    employees, 
    branches, 
    { data: users },
    departments,
    designations,
    salaryHistory,
    documents,
    userRequests,
    metrics
  ] = await Promise.all([
    getEmployeeDirectory(branchIdFilter),
    getBranches(),
    supabase.from("users").select("*").eq("status", "active"),
    getDepartments(),
    getDesignations(),
    canViewSalary ? getEmployeeSalaryHistory() : Promise.resolve([]),
    getEmployeeDocuments(),
    getUserAccountRequests(),
    getHRDashboardData(branchIdFilter),
  ]);

  return (
    <div className="p-4 sm:p-6">
      <HRClient
        employees={employees}
        branches={branches}
        users={(users as User[]) || []}
        departments={departments}
        designations={designations}
        salaryHistory={salaryHistory}
        documents={documents}
        userRequests={userRequests}
        metrics={metrics}
        canViewSalary={canViewSalary}
        canCreateEmployee={canCreateEmployee}
        initialTab={tab || "dashboard"}
      />
    </div>
  );
}
