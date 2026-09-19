import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getOperationsHubData } from "@/lib/queries/operators";
import { getOperatorEntryContext } from "@/lib/queries/operator-entry";
import { OperationsClient } from "@/components/operations/OperationsClient";
import { OperatorEntryClient } from "@/components/operations/entry/OperatorEntryClient";
import { getOperationsCurrentMonth } from "@reachinternational/utils";

export interface OperationsPageSearchParams {
  tab?: string;
  page?: string;
  pageSize?: string;
  view?: "machine" | "client" | "operator";
  machine?: string;
  client?: string;
  site?: string;
  operator?: string;
  month?: string;
  start?: string;
  end?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  expanded?: string;
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
  const tab = searchParams?.tab;

  if (user?.role === "operator" && tab !== "entry" && tab !== "history") {
    redirect("/operations?tab=entry");
  }

  if (
    user?.role !== "operator" &&
    (!tab || !["logs", "site-movement", "operators"].includes(tab))
  ) {
    redirect("/operations?tab=logs");
  }

  const effectiveTab = user?.role === "operator" ? (tab || "entry") : (tab || "logs");

  // Fast Path: Operator Entry/History landing loads ONLY the tiny entry context
  if (user?.role === "operator") {
    const entryContext = await getOperatorEntryContext(user.id);
    return (
      <OperatorEntryClient
        initialContext={entryContext}
        user={user}
        initialTab={effectiveTab === "history" ? "history" : "entry"}
      />
    );
  }

  const page = searchParams?.page ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  const rawView = searchParams?.view;
  const machineId = searchParams?.machine;
  const clientId = searchParams?.client;
  const site = searchParams?.site;
  const operatorId = searchParams?.operator;
  const rawMonth = searchParams?.month;
  const currentMonthNumber = getOperationsCurrentMonth();
  // Default to current month unless explicitly provided (e.g. 'all', specific month '01'-'12', or 'custom')
  const month = rawMonth && rawMonth.trim() !== "" ? rawMonth : currentMonthNumber;
  const customStart = searchParams?.start;
  const customEnd = searchParams?.end;
  const search = searchParams?.search;
  const sort = searchParams?.sort;

  const viewMode: "machine" | "client" | "operator" =
    rawView === "client" || rawView === "operator" || rawView === "machine"
      ? rawView
      : clientId
      ? "client"
      : operatorId
      ? "operator"
      : machineId
      ? "machine"
      : "machine";

  const rawPageSize = searchParams?.pageSize ? parseInt(searchParams.pageSize, 10) : undefined;
  const effectivePageSize =
    rawPageSize && !isNaN(rawPageSize) && rawPageSize > 0
      ? rawPageSize
      : 20;

  const expanded = searchParams?.expanded;

  const data = await getOperationsHubData(user!, effectiveTab, {
    page,
    pageSize: effectivePageSize,
    viewMode,
    machineId,
    clientId,
    site,
    operatorId,
    month,
    customStart,
    customEnd,
    search,
    sort,
    expanded: expanded === "true",
  });

  const dataMap = data as unknown as Record<string, string | undefined>;
  const effectiveInitialClientId =
    clientId || dataMap.activeClientId || dataMap.effectiveClientId || dataMap.mostRecentClientId;
  const effectiveInitialMachineId = machineId || dataMap.activeMachineId;
  const effectiveInitialOperatorId = operatorId || dataMap.activeOperatorId;

  return (
    <OperationsClient
      machines={data.machines}
      dbClients={data.dbClients}
      operators={data.operators}
      assignments={data.assignments}
      hourLogs={data.hourLogs}
      userRole={user?.role}
      user={user!}
      assignedMachine={data.assignedMachine}
      recentLogs={data.recentLogs}
      allMachines={data.allMachines}
      totalLogsCount={data.totalLogsCount}
      currentPage={data.currentPage}
      logsPageSize={data.logsPageSize}
      logsSummary={data.logsSummary}
      initialViewMode={viewMode}
      initialMachineId={effectiveInitialMachineId}
      initialClientId={effectiveInitialClientId}
      mostRecentClientId={dataMap.mostRecentClientId}
      initialSite={site}
      initialOperatorId={effectiveInitialOperatorId}
      initialMonth={month}
      initialCustomStart={customStart}
      initialCustomEnd={customEnd}
      initialSearch={search}
      initialSort={sort}
      initialExpanded={expanded === "true"}
    />
  );
}



