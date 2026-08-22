import { getCurrentUser, requirePermission, protectDisabledRoute } from "@/lib/dal";
import { currentUserHasPermission } from "@/lib/auth/server-rbac";
import { getBranchesWithMetrics } from "@/lib/queries/branches";
import { BranchesClient } from "@/components/branches/BranchesClient";

export default async function BranchesPage() {
  const user = await requirePermission("branch.view");
  protectDisabledRoute(user.role);
  const canCreateBranch = user?.role === "super_admin";
  const canEditBranch = await currentUserHasPermission("branch.edit");
  const branchesWithMetrics = await getBranchesWithMetrics();

  return (
    <div className="p-4 sm:p-6">
      <BranchesClient 
        branches={branchesWithMetrics} 
        canCreateBranch={canCreateBranch} 
        canEditBranch={canEditBranch} 
      />
    </div>
  );
}
