import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getMachineById,
  getActiveSupervisors,
  getActiveOperators,
} from "@/lib/queries/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { MachineEditClient } from "./machine-edit-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Machine | Reach International",
  description: "Update machine specifications, readings, and personnel assignments",
};

function EditMachineSkeleton() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-5 px-3 sm:px-6 py-3 sm:py-6 pb-24 sm:pb-8 animate-pulse">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Skeleton className="h-4 w-36 sm:w-48 rounded" />
        <Skeleton className="h-8 w-8 sm:w-28 rounded-lg" />
      </div>
      <Skeleton className="h-20 sm:h-24 w-full rounded-2xl" />
      <Skeleton className="h-56 sm:h-64 w-full rounded-2xl" />
      <Skeleton className="h-56 sm:h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 sm:h-56 w-full rounded-2xl" />
      <Skeleton className="h-14 sm:h-16 w-full rounded-2xl" />
    </div>
  );
}

async function MachineEditContent({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const canEdit =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager" ||
    user.role === "service_manager";

  if (!canEdit) {
    redirect(`/machines/${id}`);
  }

  const canDelete =
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "manager" ||
    user.role === "service_manager";

  const [machine, supervisors, operators, clients] = await Promise.all([
    getMachineById(id),
    getActiveSupervisors(),
    getActiveOperators(),
    getClientOptions(),
  ]);

  if (!machine) {
    return (
      <div className="py-12 max-w-xl mx-auto px-4">
        <EmptyState
          title="Machine not found"
          description="The machine you are trying to edit does not exist, has been deleted, or you don't have authorization to view it."
          action={
            <Button variant="primary" href="/machines">
              Back to Machine Directory
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <MachineEditClient
      machine={machine}
      supervisors={supervisors}
      operators={operators}
      clients={clients}
      userRole={user.role}
      canDelete={canDelete}
    />
  );
}

async function MachineEditWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MachineEditContent id={id} />;
}

export default function MachineEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<EditMachineSkeleton />}>
      <MachineEditWrapper params={params} />
    </Suspense>
  );
}
