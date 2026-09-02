import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { getAllUsersCached, getPendingProfileChangeRequests } from "@/lib/queries/users";
import { UsersPageClient } from "./users-client";
import { UsersSkeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersPageContent />
    </Suspense>
  );
}

async function UsersPageContent() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const isAuthorized =
    currentUser.role === "admin" ||
    currentUser.role === "super_admin" ||
    currentUser.role === "service_manager" ||
    currentUser.role === "hr_manager" ||
    currentUser.role === "manager";
  const isSuperAdmin = currentUser.role === "super_admin";

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-[var(--color-error)] text-lg font-medium">Access Denied</div>
        <p className="text-[var(--color-mute)]">You don&rsquo;t have permission to view user management.</p>
      </div>
    );
  }

  const [allUsers, profileChangeRequests] = await Promise.all([
    getAllUsersCached(),
    getPendingProfileChangeRequests(currentUser.role),
  ]);
  const pendingUsers = allUsers.filter((u) => u.status === "pending");

  return (
    <UsersPageClient
      users={allUsers}
      pendingUsers={pendingUsers}
      profileChangeRequests={profileChangeRequests}
      currentUser={currentUser}
      isSuperAdmin={isSuperAdmin}
    />
  );
}