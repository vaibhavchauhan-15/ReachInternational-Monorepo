import { Suspense } from "react";
import { getCurrentUser, protectOperatorRoute } from "@/lib/dal";
import { getMachines, getActiveSupervisors, getActiveOperators } from "@/lib/queries/machines";
import { getMachineComplaints } from "@/lib/queries/complaints";
import { getEngineerServicesData } from "@/lib/queries/services";
import { MachineListClient } from "@/components/machines/MachineListClient";
import { MachinesSkeleton } from "@/components/ui";

interface MachinesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    city?: string;
    engineer_id?: string;
    bucket?: string;
    page?: string;
    tab?: string;
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
  const city = resolvedParams.city || "all";
  const engineer_id = resolvedParams.engineer_id || "all";
  const bucket = resolvedParams.bucket || "all";
  const initialTab = resolvedParams.tab || "inventory";

  const [machineData, supervisors, operators, complaintData, serviceData] = await Promise.all([
    getMachines({
      search,
      status,
      page,
      pageSize: 25,
    }),
    getActiveSupervisors(),
    getActiveOperators(),
    getMachineComplaints(),
    getEngineerServicesData(),
  ]);

  return (
    <MachineListClient
      machines={machineData.machines}
      total={machineData.total}
      page={machineData.page}
      pageSize={machineData.pageSize}
      totalPages={machineData.totalPages}
      engineers={[]}
      supervisors={supervisors}
      operators={operators}
      cities={[]}
      complaints={complaintData.complaints}
      serviceData={serviceData}
      userRole={user.role}
      currentSearch={search}
      currentStatus={status}
      currentEngineerId={engineer_id}
      currentBucket={bucket}
      initialTab={initialTab}
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
