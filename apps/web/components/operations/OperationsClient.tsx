"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import type { Machine, User, CRMClient } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { OperationsHeader } from "./OperationsHeader";
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

const TodayShiftMonitorTab = dynamic(
  () =>
    import("./TodayShiftMonitorTab").then(
      (mod) => mod.TodayShiftMonitorTab
    ),
  { ssr: false }
);

export interface OperationsClientProps {
  userRole?: string;
  user: User;
  machines?: Machine[];
  dbClients?: CRMClient[];
  operators?: User[];
  initialTodayRows?: any[];
  assignedMachine?: Machine | null;
  recentLogs?: OperatorHourLog[];
  allMachines?: any[];
}

export function OperationsClient({
  userRole,
  user,
  machines = [],
  dbClients = [],
  operators = [],
  initialTodayRows,
  assignedMachine,
  recentLogs = [],
  allMachines = [],
}: OperationsClientProps) {
  const handleOpenPrintModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:export-print"));
  }, []);

  const handleAssignOperator = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:quick-assign"));
  }, []);

  const canAssign = userRole !== "operator" && userRole !== "client";

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

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      <OperationsHeader
        title="Today's Shift Logs"
        onAssignOperator={canAssign ? handleAssignOperator : undefined}
        onOpenPrintModal={handleOpenPrintModal}
      />

      <TodayShiftMonitorTab
        user={user}
        userRole={userRole}
        machines={machines}
        dbClients={dbClients}
        operators={operators}
        initialRows={initialTodayRows}
      />
    </div>
  );
}

