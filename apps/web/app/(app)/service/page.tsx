import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getMachines, getActiveEngineers, getActiveSupervisors } from "@/lib/queries/machines";
import { getMachineComplaints } from "@/lib/queries/complaints";
import { getEngineerServicesData } from "@/lib/queries/services";
import { ServiceHubClient } from "@/components/service/ServiceHubClient";

export default async function ServicePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [complaintData, machineData, engineers, supervisors, serviceData] = await Promise.all([
    getMachineComplaints(),
    getMachines(),
    getActiveEngineers(),
    getActiveSupervisors(),
    getEngineerServicesData(),
  ]);

  return (
    <ServiceHubClient
      user={user}
      complaints={complaintData.complaints}
      totalComplaints={complaintData.total}
      machines={machineData.machines}
      engineers={engineers}
      supervisors={supervisors}
      serviceData={serviceData}
    />
  );
}
