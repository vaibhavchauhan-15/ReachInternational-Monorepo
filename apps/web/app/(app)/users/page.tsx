import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getUserList,
  getUserListAggregatesCached,
  getSupervisorUserListAggregatesCached,
  USERS_PAGE_SIZE,
} from "@/lib/data/users";
import { getApprovalCountsDAL } from "@/lib/dal/approvals";
import { canViewUsers, canCreateUser } from "@reachinternational/permissions";
import { UsersPageClient } from "./UsersClient";
import { UsersSkeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersPageContent({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const isSupervisor = currentUser.role === "supervisor";
  const isAuthorized =
    currentUser.role === "admin" ||
    currentUser.role === "super_admin" ||
    currentUser.role === "manager" ||
    currentUser.role === "hr" ||
    isSupervisor ||
    canViewUsers(currentUser.role);
  const isSuperAdmin = currentUser.role === "super_admin";
  const readOnly = isSupervisor || !canCreateUser(currentUser.role);

  if (!isAuthorized) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = typeof params?.page === "string" ? parseInt(params.page, 10) : 1;
  const search = typeof params?.search === "string" ? params.search : undefined;
  const role = typeof params?.role === "string" ? params.role : "all";
  const status = typeof params?.status === "string" ? params.status : "all";
  const kyc = typeof params?.kyc === "string" ? params.kyc : "all";
  const state = typeof params?.state === "string" ? params.state : "all";
  const dateRange = typeof params?.dateRange === "string" ? params.dateRange : "all";
  const sort = typeof params?.sort === "string" ? params.sort : "newest";

  const [{ users, totalPages, total }, aggregates, approvalCountsResult] = await Promise.all([
    getUserList({ search, role, status, kyc, state, dateRange, sort, page, pageSize: USERS_PAGE_SIZE }),
    isSupervisor ? getSupervisorUserListAggregatesCached(currentUser.id) : getUserListAggregatesCached(),
    readOnly ? Promise.resolve({ data: { total: 0, by_type: {} }, error: null }) : getApprovalCountsDAL(),
  ]);

  const approvalCounts = approvalCountsResult?.data || { total: 0, by_type: {} };

  return (
    <UsersPageClient
      users={users}
      currentUser={currentUser}
      isSuperAdmin={isSuperAdmin}
      totalPages={totalPages}
      totalCount={total}
      currentPage={page}
      aggregates={aggregates}
      readOnly={readOnly}
      pendingApprovalCounts={approvalCounts}
    />
  );
}
