import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getOperationsHubData } from "@/lib/queries/operators";
import { OperationsClient } from "@/components/operations/OperationsClient";

export default async function OperationsPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  await requirePermission("machine.view");
  const user = await getCurrentUser();
  const searchParams = await props.searchParams;
  const tab = searchParams?.tab;

  if (user?.role === "operator" && tab !== "entry" && tab !== "history") {
    redirect("/operations?tab=entry");
  }

  if (
    user?.role !== "operator" &&
    (tab === "entry" ||
      tab === "history" ||
      tab === "machines" ||
      !tab ||
      !["logs", "assignments", "site-movement", "operators"].includes(tab))
  ) {
    redirect("/operations?tab=logs");
  }

  const effectiveTab = tab || (user?.role === "operator" ? "entry" : "logs");
  const data = await getOperationsHubData(user!, effectiveTab);

  return (
    <OperationsClient
      machines={data.machines}
      dbClients={data.dbClients}
      operators={data.operators}
      assignments={data.assignments}
      hourLogs={data.hourLogs}
      siteMovements={data.siteMovements}
      operatorPayouts={data.operatorPayouts}
      userRole={user?.role}
      user={user!}
      assignedMachine={data.assignedMachine}
      recentLogs={data.recentLogs}
      allMachines={data.allMachines}
      initialTab={tab}
    />
  );
}



