import { Suspense } from "react";
import { getCurrentUser, protectOperatorRoute } from "@/lib/dal";
import { getMachines, getActiveSupervisors, getActiveOperators } from "@/lib/queries/machines";
import { getClientOptions } from "@/lib/queries/clients";
import { MachineListClient } from "@/components/machines/MachineListClient";
import { MachinesSkeleton } from "@/components/ui";

interface MachinesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
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

  const [machineData, supervisors, operators, clients] = await Promise.all([
    getMachines({
      search,
      status,
      page,
      pageSize: 25,
    }),
    getActiveSupervisors(),
    getActiveOperators(),
    getClientOptions(),
  ]);

  return (
    <MachineListClient
      machines={machineData.machines}
      total={machineData.total}
      page={machineData.page}
      pageSize={machineData.pageSize}
      totalPages={machineData.totalPages}
      supervisors={supervisors}
      operators={operators}
      clients={clients}
      userRole={user.role}
      currentSearch={search}
      currentStatus={status}
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
