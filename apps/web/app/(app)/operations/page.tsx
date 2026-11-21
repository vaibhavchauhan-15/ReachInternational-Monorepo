import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getOperatorEntryContext } from "@/lib/queries/operator-entry";
import { getTodayShiftLogMonitor } from "@/lib/data/operations/today-shift-monitor";
import { getActiveOperatorsForUser } from "@/lib/data/machines/machine-filters";
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
  date?: string;
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

  const rawDate = searchParams?.date;
  const parsedDate = typeof rawDate === "string" ? rawDate : Array.isArray(rawDate) ? rawDate[0] : undefined;
  const currentDate = parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate) ? parsedDate : undefined;

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

  // Dedicated Shift Logs view for supervisors, managers, admins, and HR.
  // The client filter options and counts are derived from the roster rows themselves,
  // so the previous `getClients()` call (a full CRM client payload on every visit) is gone.
  const [initialTodayRows, activeOperators] = await Promise.all([
    getTodayShiftLogMonitor(user.id, currentDate),
    getActiveOperatorsForUser(user.id, user.role),
  ]);

  return (
    <OperationsClient
      userRole={user?.role}
      user={user!}
      machines={[]}
      operators={activeOperators}
      initialTodayRows={initialTodayRows}
      initialDate={currentDate}
    />
  );
}
