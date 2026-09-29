import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/dal";
import {
  resolveUserId,
  getUserById,
  getUserSummaryKPIs,
  getUserAssignedMachines,
  getUserRunningLogs,
  getUserAssignments,
  getUserAuditLogs,
} from "@/lib/data/users";
import { getUserDocumentsAction, getDocumentTypesAction } from "@/app/actions/documents";
import { getSupervisorsAction } from "@/app/actions/auth";
import { EmptyState } from "@/components/ui";
import { UserDetailClient } from "./UserDetailClient";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await props.params;
  const userId = await resolveUserId(decodeURIComponent(rawId));
  if (!userId) {
    return {
      title: "Employee Not Found | ReachInternational Directory",
    };
  }

  const user = await getUserById(userId);
  if (!user) {
    return {
      title: "Employee Not Found | ReachInternational Directory",
    };
  }

  const empCode = user.employee_id || user.id.slice(0, 8);
  return {
    title: `${user.full_name} (${empCode}) | Employee Profile | ReachInternational Directory`,
    description: `Operational profile details, shift assignments, and telemetry running logs for ${user.full_name}.`,
  };
}

export default async function UserDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const { id: rawId } = await props.params;
  const userId = await resolveUserId(decodeURIComponent(rawId));

  if (!userId) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Employee Account Not Found"
          description="The requested employee identifier doesn't exist, has been removed, or you don't have permission to view it."
          action={
            <Link
              href="/users"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to User Directory
            </Link>
          }
        />
      </div>
    );
  }

  // Authorization: Management roles (admin, super_admin, manager, hr, supervisor) or user viewing self
  const isAuthorizedStaff = ["super_admin", "admin", "manager", "hr", "supervisor"].includes(currentUser.role);
  const isSelf = currentUser.id === userId;

  if (!isAuthorizedStaff && !isSelf) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Access Restricted"
          description="You do not have permission to inspect this employee profile."
          action={
            <Link
              href="/users"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to User Directory
            </Link>
          }
        />
      </div>
    );
  }

  // High-performance concurrent queries: load all detail sections in parallel
  const [
    user,
    kpis,
    machines,
    runningLogs,
    assignments,
    auditLogs,
    documents,
    docTypes,
    supervisors,
  ] = await Promise.all([
    getUserById(userId),
    getUserSummaryKPIs(userId),
    getUserAssignedMachines(userId),
    getUserRunningLogs(userId, 50),
    getUserAssignments(userId),
    getUserAuditLogs(userId, 50),
    getUserDocumentsAction(userId).catch(() => []),
    getDocumentTypesAction().catch(() => []),
    getSupervisorsAction().catch(() => []),
  ]);

  if (!user) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Employee Account Not Found"
          description="The requested employee profile could not be loaded or has been archived."
          action={
            <Link
              href="/users"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to User Directory
            </Link>
          }
        />
      </div>
    );
  }

  const isSuperAdmin = currentUser.role === "super_admin";
  const canManage = isSuperAdmin || (currentUser.role === "admin" && user.role !== "super_admin");

  return (
    <UserDetailClient
      user={user}
      currentUser={currentUser}
      isSuperAdmin={isSuperAdmin}
      canManage={canManage}
      kpis={kpis}
      machines={machines}
      runningLogs={runningLogs}
      assignments={assignments}
      auditLogs={auditLogs}
      documents={documents}
      documentTypes={docTypes}
      supervisors={Array.isArray(supervisors) ? supervisors : []}
    />
  );
}
