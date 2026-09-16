import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import {
  getMachineById,
  getMachineActiveRental,
  getActiveSupervisors,
  getActiveOperators,
} from "@/lib/data/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { EmptyState, MachineDetailSkeleton } from "@/components/ui";
import { MachineClientView } from "./machine-client-view";

async function MachineDetailContent({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const canManage =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager" ||
    user.role === "service_manager";

  // Parallel fetch: all light queries in one Promise.all()
  const [machine, activeRental, supervisors, operators, clients] = await Promise.all([
    getMachineById(id),
    getMachineActiveRental(id),
    canManage ? getActiveSupervisors() : Promise.resolve([]),
    canManage ? getActiveOperators() : Promise.resolve([]),
    canManage ? getClientOptions() : Promise.resolve([]),
  ]);

  if (!machine) {
    return (
      <div className="py-12 max-w-xl mx-auto">
        <EmptyState
          title="Machine not found"
          description="The machine you're looking for doesn't exist, has been archived, or you don't have permission to view it."
        />
      </div>
    );
  }

  const canEdit = canManage;
  const canDelete = canManage;
  const isAssignedEngineer = user.role === "engineer" && machine.engineer_id === user.id;

  return (
    <MachineClientView
      machine={machine}
      activeRental={activeRental}
      supervisors={supervisors}
      operators={operators}
      clients={clients}
      isAdmin={canManage}
      canEdit={canEdit}
      canDelete={canDelete}
      isAssignedEngineer={isAssignedEngineer}
      currentUserId={user.id}
      userRole={user.role}
    />
  );
}

async function MachineDetailWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MachineDetailContent id={id} />;
}

export default function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<MachineDetailSkeleton />}>
      <MachineDetailWrapper params={params} />
    </Suspense>
  );
}