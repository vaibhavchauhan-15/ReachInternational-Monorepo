"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import type {
  Machine,
  User,
  MachineAssignment,
  OperatorMachineAssignment,
  MachineHourLog,
  MachineWithEngineer,
  CRMClient,
} from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { OperationsHeader } from "./OperationsHeader";
import { OperationsLogsTab } from "./logs/OperationsLogsTab";
import { OperatorDashboardSkeleton } from "./skeletons/OperationsSkeletons";

const OperatorDashboard = dynamic(
  () =>
    import("@/components/dashboard/OperatorDashboard").then(
      (mod) => mod.OperatorDashboard
    ),
  {
    loading: () => <OperatorDashboardSkeleton />,
    ssr: false,
  }
);

export interface OperationsClientProps {
  machines: Machine[];
  dbClients?: CRMClient[];
  operators: User[];
  assignments: (OperatorMachineAssignment | MachineAssignment | any)[];
  hourLogs: MachineHourLog[];
  userRole?: string;
  user?: User;
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: MachineWithEngineer[];
  totalLogsCount?: number;
  currentPage?: number;
  logsPageSize?: number;
  logsSummary?: {
    totalRunHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    loggedDaysCount: number;
  };
  initialViewMode?: "machine" | "client" | "operator";
  initialMachineId?: string;
  initialClientId?: string;
  mostRecentClientId?: string;
  initialOperatorId?: string;
  initialMonth?: string;
  initialCustomStart?: string;
  initialCustomEnd?: string;
  initialSearch?: string;
  initialSite?: string;
  initialSort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  initialExpanded?: boolean;
}

export function OperationsClient({
  machines,
  dbClients = [],
  operators,
  assignments,
  hourLogs,
  userRole,
  user,
  assignedMachine,
  recentLogs = [],
  allMachines = [],
  totalLogsCount,
  currentPage = 1,
  logsPageSize = 10,
  logsSummary,
  initialViewMode,
  initialMachineId,
  initialClientId,
  mostRecentClientId,
  initialOperatorId,
  initialMonth,
  initialCustomStart,
  initialCustomEnd,
  initialSearch,
  initialSite,
  initialSort,
  initialExpanded = false,
}: OperationsClientProps) {
  const handleOpenPrintModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:export-print"));
  }, []);

  // If role is operator, render OperatorDashboard directly
  if (userRole === "operator" && user) {
    return (
      <OperatorDashboard
        user={user}
        assignedMachine={assignedMachine}
        recentLogs={recentLogs}
        allMachines={allMachines}
        dbClients={dbClients}
      />
    );
  }

  // Daily Running Hours is the whole page (tab strip removed)
  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      <OperationsHeader onOpenPrintModal={handleOpenPrintModal} />

      <OperationsLogsTab
        machines={machines}
        dbClients={dbClients}
        operators={operators}
        assignments={assignments}
        hourLogs={hourLogs}
        userRole={userRole}
        user={user}
        totalLogsCount={totalLogsCount}
        currentPage={currentPage}
        logsPageSize={logsPageSize}
        logsSummary={logsSummary}
        initialViewMode={initialViewMode}
        initialMachineId={initialMachineId}
        initialClientId={initialClientId}
        mostRecentClientId={mostRecentClientId}
        initialOperatorId={initialOperatorId}
        initialMonth={initialMonth}
        initialCustomStart={initialCustomStart}
        initialCustomEnd={initialCustomEnd}
        initialSearch={initialSearch}
        initialSite={initialSite}
        initialSort={initialSort}
        initialExpanded={initialExpanded}
      />
    </div>
  );
}
