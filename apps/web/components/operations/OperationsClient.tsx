"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import type { User, Machine } from "@/lib/types/database";
import { OperationsHeader } from "./OperationsHeader";

/**
 * Supervisors, managers, HR and admins land here. Operators are rendered by
 * `OperatorEntryClient` directly from the server page, so the previous
 * `ssr: false` dynamic import of `OperatorDashboard` (dead branch) has been removed —
 * it pulled an unused code-split bundle into this route.
 */
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
  operators?: User[];
  initialTodayRows?: any[];
  initialDate?: string;
}

export function OperationsClient({
  userRole,
  user,
  machines = [],
  operators = [],
  initialTodayRows,
  initialDate,
}: OperationsClientProps) {
  const handleOpenPrintModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:export-print"));
  }, []);

  const handleAssignOperator = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:quick-assign"));
  }, []);

  const canAssign = userRole !== "operator" && userRole !== "client";

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
        operators={operators}
        initialRows={initialTodayRows}
        initialDate={initialDate}
      />
    </div>
  );
}
