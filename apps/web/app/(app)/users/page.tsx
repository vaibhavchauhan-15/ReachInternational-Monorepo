import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import {
  getUserList,
  getPendingUsersCached,
  getPendingProfileChangeRequests,
  getUserListAggregatesCached,
  getSupervisorUserListAggregatesCached,
  USERS_PAGE_SIZE,
} from "@/lib/queries/users";
import { canViewUsers, canCreateUser } from "@reachinternational/permissions";
import { UsersPageClient } from "./users-client";
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
    currentUser.role === "service_manager" ||
    currentUser.role === "hr_manager" ||
    currentUser.role === "manager" ||
    isSupervisor ||
    canViewUsers(currentUser.role);
  const isSuperAdmin = currentUser.role === "super_admin";
  const readOnly = isSupervisor || !canCreateUser(currentUser.role);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-[var(--color-error)] text-lg font-medium">Access Denied</div>
        <p className="text-[var(--color-mute)]">You don&rsquo;t have permission to view user management.</p>
      </div>
    );
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

  const [{ users, totalPages, total }, pendingUsers, profileChangeRequests, aggregates] = await Promise.all([
    getUserList({ search, role, status, kyc, state, dateRange, sort, page, pageSize: USERS_PAGE_SIZE }),
    isSupervisor ? Promise.resolve([]) : getPendingUsersCached(),
    isSupervisor ? Promise.resolve([]) : getPendingProfileChangeRequests(currentUser.role),
    isSupervisor ? getSupervisorUserListAggregatesCached(currentUser.id) : getUserListAggregatesCached(),
  ]);

  return (
    <UsersPageClient
      users={users}
      pendingUsers={pendingUsers}
      profileChangeRequests={profileChangeRequests}
      currentUser={currentUser}
      isSuperAdmin={isSuperAdmin}
      totalPages={totalPages}
      totalCount={total}
      currentPage={page}
      aggregates={aggregates}
      readOnly={readOnly}
    />
  );
}
