"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import type {
  Machine,
  User,
  MachineAssignment,
  OperatorMachineAssignment,
  MachineHourLog,
  CRMClient,
} from "@/lib/types/database";
import { OperationsHeader } from "./OperationsHeader";
import { OperationsLogsTabSkeleton } from "./skeletons/OperationsSkeletons";

const OperationsLogsTab = dynamic(
  () =>
    import("./logs/OperationsLogsTab").then(
      (mod) => mod.OperationsLogsTab
    ),
  {
    loading: () => <OperationsLogsTabSkeleton />,
    ssr: true,
  }
);

export interface RunningLogsClientProps {
  machines: Machine[];
  dbClients?: CRMClient[];
  operators: User[];
  assignments: (OperatorMachineAssignment | MachineAssignment | any)[];
  hourLogs: MachineHourLog[];
  userRole?: string;
  user: User;
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
  initialSort?: string;
  initialExpanded?: boolean;
}

export function RunningLogsClient(props: RunningLogsClientProps) {
  const handleOpenPrintModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:export-print"));
  }, []);

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      <OperationsHeader title="Daily Running Logs" onOpenPrintModal={handleOpenPrintModal} />
      <OperationsLogsTab {...props} />
    </div>
  );
}
