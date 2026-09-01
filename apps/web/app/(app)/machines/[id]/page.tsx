import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import {
  getMachineById,
  getMachineActiveRental,
} from "@/lib/queries/machines";
import { EmptyState, MachineDetailSkeleton } from "@/components/ui";
import { MachineClientView } from "./machine-client-view";

async function MachineDetailContent({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  // On initial page load, only fetch machine and active rental metadata.
  // Machine hour meter running logs are lazy-loaded on demand when the tab is selected.
  const [machine, activeRental] = await Promise.all([
    getMachineById(id),
    getMachineActiveRental(id),
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

  const canManage =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager" ||
    user.role === "service_manager";
  const canEdit = canManage || user.role === "supervisor";
  const canDelete = canManage;
  const isAssignedEngineer = user.role === "engineer" && machine.engineer_id === user.id;

  return (
    <MachineClientView
      machine={machine}
      activeRental={activeRental}
      isAdmin={canManage}
      canEdit={canEdit}
      canDelete={canDelete}
      isAssignedEngineer={isAssignedEngineer}
      currentUserId={user.id}
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