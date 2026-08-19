import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { getAllUsers, getPendingUsers } from "@/app/actions/users";
import { getBranchesAction } from "@/app/actions/branches";
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

  const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin";
  const isSuperAdmin = currentUser.role === "super_admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-[var(--color-error)] text-lg font-medium">Access Denied</div>
        <p className="text-[var(--color-mute)]">You don&rsquo;t have permission to view this page.</p>
      </div>
    );
  }

  const [allUsers, pendingUsers, branchesRes] = await Promise.all([
    getAllUsers(),
    getPendingUsers(),
    getBranchesAction(),
  ]);

  const branches = branchesRes.data || [];

  return (
    <UsersPageClient
      users={allUsers}
      pendingUsers={pendingUsers}
      branches={branches}
      currentUser={currentUser}
      isSuperAdmin={isSuperAdmin}
    />
  );
}