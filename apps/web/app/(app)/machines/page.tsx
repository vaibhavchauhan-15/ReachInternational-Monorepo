import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { getMachines, getActiveEngineers, getActiveSupervisors, getMachineCities } from "@/lib/queries/machines";
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

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const search = resolvedParams.search || "";
  const status = resolvedParams.status || "all";
  const city = resolvedParams.city || "all";
  const engineer_id = resolvedParams.engineer_id || "all";
  const bucket = resolvedParams.bucket || "all";
  const initialTab = resolvedParams.tab || "inventory";

  const [machineData, engineers, supervisors, cities, complaintData, serviceData] = await Promise.all([
    getMachines({
      search,
      status,
      city,
      engineer_id,
      bucket,
      page,
      pageSize: 25,
    }),
    getActiveEngineers(),
    getActiveSupervisors(),
    getMachineCities(),
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
      engineers={engineers}
      supervisors={supervisors}
      cities={cities}
      complaints={complaintData.complaints}
      serviceData={serviceData}
      userRole={user.role}
      currentSearch={search}
      currentStatus={status}
      currentCity={city}
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
