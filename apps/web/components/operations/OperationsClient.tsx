"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { User, Machine } from "@/lib/types/database";
import { MACHINE_CAPABILITIES, hasMachineCapability } from "@reachinternational/permissions";
import { OperationsHeader } from "./OperationsHeader";
import { TodayShiftMonitorTab } from "./TodayShiftMonitorTab";

const LogsheetImportModal = dynamic(
  () => import("./import/LogsheetImportModal").then((m) => m.LogsheetImportModal),
  { ssr: false }
);

/**
 * Supervisors, managers, HR and admins land here. Operators are rendered by
 * `OperatorEntryClient` directly from the server page.
 *
 * `TodayShiftMonitorTab` used to be a `ssr: false` dynamic import, which threw away the
 * roster that the RSC page had already streamed (`initialRows`) and forced the whole
 * page body to wait for the client bundle before painting anything. It is now a static
 * import so the server-rendered roster is the first paint; the heavy modals inside the
 * tab stay code-split.
 */
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
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);

  const handleOpenPrintModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:export-print"));
  }, []);

  const handleAssignOperator = useCallback(() => {
    window.dispatchEvent(new CustomEvent("reach:quick-assign"));
  }, []);

  const handleImportLogsheet = useCallback(() => {
    setImportOpen(true);
  }, []);

  // Any header / menu can open the importer through the shared page event.
  useEffect(() => {
    const handler = () => setImportOpen(true);
    window.addEventListener("reach:import-logsheet", handler);
    return () => window.removeEventListener("reach:import-logsheet", handler);
  }, []);

  const canImport = hasMachineCapability(userRole, MACHINE_CAPABILITIES.LOGS_IMPORT);
  const canAssign = userRole !== "operator" && userRole !== "client";

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      <OperationsHeader
        title="Today's Shift Logs"
        onAssignOperator={canAssign ? handleAssignOperator : undefined}
        onOpenPrintModal={handleOpenPrintModal}
        onImportLogsheet={canImport ? handleImportLogsheet : undefined}
      />

      <TodayShiftMonitorTab
        user={user}
        userRole={userRole}
        machines={machines}
        operators={operators}
        initialRows={initialTodayRows}
        initialDate={initialDate}
      />

      {canImport && (
        <LogsheetImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  );
}
