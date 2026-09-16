import { requirePermission, getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getOperationsHubData } from "@/lib/queries/operators";
import { OperationsClient } from "@/components/operations/OperationsClient";
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
      tab === "assignments" ||
      !tab ||
      !["logs", "site-movement", "operators"].includes(tab))
  ) {
    redirect("/operations?tab=logs");
  }

  const effectiveTab = tab || (user?.role === "operator" ? "entry" : "logs");

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

  const effectiveInitialClientId =
    clientId || (data as any).activeClientId || (data as any).effectiveClientId || (data as any).mostRecentClientId;
  const effectiveInitialMachineId = machineId || (data as any).activeMachineId;
  const effectiveInitialOperatorId = operatorId || (data as any).activeOperatorId;

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
      mostRecentClientId={(data as any).mostRecentClientId}
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



