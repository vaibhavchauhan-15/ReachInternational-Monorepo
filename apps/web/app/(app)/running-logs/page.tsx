import { requireRole } from "@/lib/dal";
import { AUTHORIZED_RUNNING_LOG_ROLES } from "@reachinternational/permissions";
import { getOperationsHubData } from "@/lib/queries/operators";
import { RunningLogsClient } from "@/components/operations/RunningLogsClient";
import { getOperationsCurrentMonth } from "@reachinternational/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Running Logs | Reach International",
  description: "Machine running hours summary, client operational logs, and daily shift records",
  robots: { index: false, follow: false },
};

export interface RunningLogsPageSearchParams {
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

export default async function RunningLogsPage(props: {
  searchParams?: Promise<RunningLogsPageSearchParams>;
}) {
  const user = await requireRole(...AUTHORIZED_RUNNING_LOG_ROLES);

  const searchParams = await props.searchParams;
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
      : 500;

  const expanded = searchParams?.expanded;

  const data = await getOperationsHubData(user!, "logs", {
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
    <RunningLogsClient
      machines={data.machines}
      dbClients={data.dbClients}
      operators={data.operators}
      assignments={data.assignments}
      hourLogs={data.hourLogs}
      userRole={user?.role}
      user={user!}
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
