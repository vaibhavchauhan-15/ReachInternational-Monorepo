import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getOperatorEntryContext } from "@/lib/queries/operator-entry";
import { getTodayShiftLogMonitor } from "@/lib/data/operations/today-shift-monitor";
import { getMachines } from "@/lib/queries/machines";
import { getClients } from "@/lib/queries/clients";
import { getActiveOperators } from "@/lib/data/machines/machine-filters";
import { OperationsClient } from "@/components/operations/OperationsClient";
import { OperatorEntryClient } from "@/components/operations/entry/OperatorEntryClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today's Shift Logs | Reach International",
  description: "Real-time daily shift roster, operator submissions, and operational coverage monitor",
  robots: { index: false, follow: false },
};

export interface OperationsPageSearchParams {
  tab?: string;
}

export default async function OperationsPage(props: {
  searchParams?: Promise<OperationsPageSearchParams>;
}) {
  await requirePermission("machine.view");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const searchParams = await props.searchParams;
  const rawTab = searchParams?.tab;
  const currentTab = typeof rawTab === "string" ? rawTab : Array.isArray(rawTab) ? rawTab[0] : undefined;

  // Fast Path: Operator Entry/History landing loads ONLY the lightweight entry context
  if (user?.role === "operator") {
    const entryContext = await getOperatorEntryContext(user.id);
    return (
      <OperatorEntryClient
        initialContext={entryContext}
        user={user}
        initialTab={currentTab === "history" ? "history" : "entry"}
      />
    );
  }

  // Dedicated Today's Shift Logs view for supervisors, managers, admins, and HR
  const [initialTodayRows, machineRes, dbClients, activeOperators] = await Promise.all([
    getTodayShiftLogMonitor(user.id),
    getMachines({ pageSize: 100 }),
    getClients(),
    getActiveOperators(),
  ]);

  return (
    <OperationsClient
      userRole={user?.role}
      user={user!}
      machines={machineRes?.machines || []}
      dbClients={dbClients}
      operators={activeOperators}
      initialTodayRows={initialTodayRows}
    />
  );
}
