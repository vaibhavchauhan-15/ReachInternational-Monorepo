import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import type { User } from "@/lib/types/database";
import {
  getMachineById,
  getMachineActiveRental,
  getActiveSupervisorsOnly,
  getActiveOperators,
} from "@/lib/data/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { EmptyState, MachineDetailSkeleton } from "@/components/ui";
import { isOperatorMachineView } from "@reachinternational/permissions";
import {
  MACHINE_CAPABILITIES,
  canAccessMachineRecord,
  canAccessMachinesRoute,
  requireMachinesPageAccess,
} from "@/lib/machines/authorization";
import { MachineClientView } from "./MachineClientView";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(id?: string | null): boolean {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

interface MachineDetailPageProps {
  params: Promise<{ id: string | string[] }>;
}

export async function generateMetadata({ params }: MachineDetailPageProps): Promise<Metadata> {
  // Do not leak machine details in the document title to roles without access.
  const user = await getCurrentUser();
  if (!user || !canAccessMachinesRoute(user.role)) {
    return { title: "Machines" };
  }
  const resolvedParams = await params;
  const segments = Array.isArray(resolvedParams.id) ? resolvedParams.id : [resolvedParams.id];
  const rawId = segments.join("/");
  const decodedId = decodeURIComponent(rawId);
  try {
    const machine = await getMachineById(decodedId);
    if (!machine) {
      return { title: "Machine Not Found" };
    }
    if (!(await canAccessMachineRecord(user, machine.id))) {
      return { title: "Machines" };
    }
    return {
      title: `${machine.machine_id || "Machine"} — ${machine.model || "Equipment Details"}`,
    };
  } catch {
    return { title: "Machine Details" };
  }
}

async function MachineDetailContent({ id, user }: { id: string; user: User }) {
  const { auth } = await requireMachinesPageAccess();
  const isOperatorView = isOperatorMachineView(user.role);

  // Role-based column projection: operators never receive GSTIN/PAN/billing fields.
  const machine = await getMachineById(id, {
    includeClientCompliance: !isOperatorView,
  });

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

  // Record-level scope: operator must be actively assigned, supervisor must supervise
  // this machine (client allocation or direct). Manager tier passes without a query.
  const inScope = await canAccessMachineRecord(user, machine.id);
  if (!inScope) {
    redirect("/machines");
  }

  const canViewRates = auth.can(MACHINE_CAPABILITIES.RENTAL_RATES_VIEW);
  const canAssignOperator = auth.can(MACHINE_CAPABILITIES.ASSIGN_OPERATOR);
  const canAssignSupervisor = auth.can(MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR);
  const canAssignClient = auth.can(MACHINE_CAPABILITIES.ASSIGN_CLIENT);
  const canEdit = auth.can(MACHINE_CAPABILITIES.EDIT_SPECS);
  const canDelete = auth.can(MACHINE_CAPABILITIES.DELETE);

  // Parallel fetch. Operators never fetch rental/client/personnel option data.
  const [activeRental, supervisors, operators, clients] = await Promise.all([
    isOperatorView
      ? Promise.resolve(null)
      : getMachineActiveRental(machine.id, { includeRate: canViewRates }),
    canAssignSupervisor ? getActiveSupervisorsOnly() : Promise.resolve([]),
    canAssignOperator ? getActiveOperators() : Promise.resolve([]),
    canAssignClient || canEdit ? getClientOptions() : Promise.resolve([]),
  ]);

  return (
    <MachineClientView
      machine={machine}
      activeRental={activeRental}
      supervisors={supervisors}
      operators={operators}
      clients={clients}
      capabilities={auth.capabilities}
      canEdit={canEdit}
      canDelete={canDelete}
      canAssignOperator={canAssignOperator}
      isAssignedEngineer={false}
      currentUserId={user.id}
      userRole={user.role}
    />
  );
}

export default async function MachineDetailPage({ params }: MachineDetailPageProps) {
  // Route guard: HR/sales/marketing are redirected to their home route.
  const { user } = await requireMachinesPageAccess();

  const resolvedParams = await params;
  const segments = Array.isArray(resolvedParams.id)
    ? resolvedParams.id
    : [resolvedParams.id];
  const lastSegment = segments[segments.length - 1];

  let rawId = segments.join("/");
  if (lastSegment === "edit" && segments.length > 1) {
    rawId = segments.slice(0, -1).join("/");
  }
  const decodedId = decodeURIComponent(rawId);

  // If accessed by UUID, automatically redirect to human-readable machine_id (e.g. /machines/M/C-0001)
  if (isValidUuid(decodedId)) {
    const machine = await getMachineById(decodedId);
    if (machine?.machine_id) {
      redirect(`/machines/${machine.machine_id}`);
    }
  }

  return (
    <Suspense fallback={<MachineDetailSkeleton />}>
      <MachineDetailContent id={decodedId} user={user} />
    </Suspense>
  );
}
