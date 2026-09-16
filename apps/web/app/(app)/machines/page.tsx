import { Suspense } from "react";
import { getCurrentUser, protectOperatorRoute } from "@/lib/dal";
import {
  getMachineList,
  getMachineKPIs,
} from "@/lib/data/machines";
import { MachineListClient } from "@/components/machines/MachineListClient";
import { MachinesSkeleton } from "@/components/ui";

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

async function MachinesContent({ searchParams }: MachinesPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  protectOperatorRoute(user.role);

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const search = resolvedParams.search || "";
  const status = resolvedParams.status || "all";
  const health_status = resolvedParams.health_status || "all";
  const supervisor = resolvedParams.supervisor || "all";
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

  // Fast initial page load: only load active machine slice and fleet KPI summary.
  // Personnel rosters and client directories are lazily loaded on demand by modals and filters.
  const [machineData, kpis] = await Promise.all([
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
  ]);

  return (
    <MachineListClient
      machines={machineData.machines}
      total={machineData.total}
      page={machineData.page}
      pageSize={machineData.pageSize}
      totalPages={machineData.totalPages}
      userRole={user.role}
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
