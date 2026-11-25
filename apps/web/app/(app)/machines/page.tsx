import { Suspense } from "react";
import {
  getMachineList,
  getMachineKPIs,
  getOperatorAssignedMachine,
} from "@/lib/data/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { MachineListClient } from "@/components/machines/MachineListClient";
import { MachinesSkeleton } from "@/components/ui";
import {
  MACHINE_CAPABILITIES,
  requireMachinesPageAccess,
} from "@/lib/machines/authorization";
import { isOperatorMachineView } from "@reachinternational/permissions";

interface MachinesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    health_status?: string;
    supervisor?: string;
    client_id?: string;
    sort?: string;
    city?: string;
    page?: string;
  }>;
}

const EMPTY_KPIS = {
  total: 0,
  available: 0,
  rented: 0,
  breakdown: 0,
  maintenance: 0,
  spare: 0,
  active: 0,
};

async function MachinesContent({ searchParams }: MachinesPageProps) {
  // Route guard: unauthenticated -> /login, HR/sales/marketing -> role home.
  const { user, auth } = await requireMachinesPageAccess();

  // Operator: dedicated assigned-machine view. Never runs fleet list / KPI / client queries.
  if (isOperatorMachineView(user.role)) {
    const assignedMachine = await getOperatorAssignedMachine(user.id);
    const machines = assignedMachine ? [assignedMachine] : [];
    return (
      <MachineListClient
        machines={machines}
        total={machines.length}
        page={1}
        pageSize={25}
        totalPages={1}
        clients={[]}
        userRole={user.role}
        capabilities={auth.capabilities}
        currentSearch=""
        currentStatus="all"
        currentHealthStatus="all"
        currentSupervisor="all"
        currentClientId="all"
        currentSort="machine_id_asc"
        initialKpis={EMPTY_KPIS}
      />
    );
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const search = resolvedParams.search || "";
  const status = resolvedParams.status || "all";
  const health_status = resolvedParams.health_status || "all";
  // Supervisors are hard-scoped to themselves; only manager tier may pick another supervisor.
  const supervisor =
    auth.scope === "supervised"
      ? user.id
      : resolvedParams.supervisor || "all";
  const client_id = resolvedParams.client_id || "all";
  const sort = resolvedParams.sort || "machine_id_asc";

  let sortField = "machine_id";
  let sortOrder: "asc" | "desc" = "asc";
  if (sort === "machine_id_desc") {
    sortField = "machine_id";
    sortOrder = "desc";
  } else if (sort === "model_asc") {
    sortField = "model";
    sortOrder = "asc";
  } else if (sort === "newest_yum") {
    sortField = "year_of_mfg";
    sortOrder = "desc";
  } else if (sort === "oldest_yum") {
    sortField = "year_of_mfg";
    sortOrder = "asc";
  } else if (sort === "highest_hmr") {
    sortField = "hour_meter";
    sortOrder = "desc";
  } else if (sort === "lowest_hmr") {
    sortField = "hour_meter";
    sortOrder = "asc";
  }

  const canFilterBySupervisor = auth.can(MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR);

  // Parallel fetch: directory slice, fleet KPIs, and client options.
  const [machineData, kpis, clientOptions] = await Promise.all([
    getMachineList({
      search,
      status,
      health_status,
      current_supervisor_id: supervisor,
      client_id,
      page,
      pageSize: 25,
      sortField,
      sortOrder,
    }),
    getMachineKPIs({
      supervisorId: supervisor !== "all" ? supervisor : undefined,
      clientId: client_id !== "all" ? client_id : undefined,
    }),
    auth.can(MACHINE_CAPABILITIES.ASSIGN_CLIENT) ? getClientOptions() : Promise.resolve([]),
  ]);

  return (
    <MachineListClient
      machines={machineData.machines}
      total={machineData.total}
      page={machineData.page}
      pageSize={machineData.pageSize}
      totalPages={machineData.totalPages}
      clients={clientOptions}
      userRole={user.role}
      capabilities={auth.capabilities}
      canFilterBySupervisor={canFilterBySupervisor}
      currentSearch={search}
      currentStatus={status}
      currentHealthStatus={health_status}
      currentSupervisor={supervisor}
      currentClientId={client_id}
      currentSort={sort}
      initialKpis={kpis}
    />
  );
}

export default function MachinesPage({ searchParams }: MachinesPageProps) {
  return (
    <Suspense fallback={<MachinesSkeleton />}>
      <MachinesContent searchParams={searchParams} />
    </Suspense>
  );
}
