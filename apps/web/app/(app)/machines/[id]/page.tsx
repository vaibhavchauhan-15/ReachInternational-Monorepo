import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getMachineById,
  getMachineActiveRental,
  getActiveSupervisors,
  getActiveOperators,
} from "@/lib/data/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { getOperatorEntryContext } from "@/lib/queries/operator-entry";
import { EmptyState, MachineDetailSkeleton } from "@/components/ui";
import { MachineClientView } from "./machine-client-view";

async function MachineDetailContent({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isSupervisor = user.role === "supervisor";
  const canManage =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager";

  const canAssignOperator = canManage || isSupervisor;

  // Parallel fetch: all light queries in one Promise.all()
  const [machine, activeRental, supervisors, operators, clients] = await Promise.all([
    getMachineById(id),
    getMachineActiveRental(id),
    canManage ? getActiveSupervisors() : Promise.resolve([]),
    canAssignOperator ? getActiveOperators() : Promise.resolve([]),
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

  // Operators may only view basic info for their assigned machine
  if (user.role === "operator") {
    const operatorContext = await getOperatorEntryContext(user.id);
    const isAssigned =
      machine.id === operatorContext.machine?.id ||
      machine.current_operator_id === user.id ||
      machine.operator_ids?.includes(user.id);

    if (!isAssigned) {
      redirect("/machines");
    }
  }

  const canEdit = canManage;
  const canDelete = canManage;
  const isAssignedEngineer = false;

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
      canAssignOperator={canAssignOperator}
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