"use client";

import React from "react";
import type { User, Machine, MachineHourLog } from "@/lib/types/database";
import type { OperatorHourLog } from "./OperatorDashboard";
import { PrintableSupervisorLogsModal } from "@/components/operations/PrintableSupervisorLogsModal";

export interface PrintableOperatorLogsModalProps {
  open: boolean;
  onClose: () => void;
  logs: OperatorHourLog[] | any[];
  user: User;
  assignedMachine?: Machine | null;
}

/**
 * Delegate wrapper to the unified PrintableSupervisorLogsModal from running logs.
 * Ensures consistent centered columns, no overlapping text, unified A4 pagination,
 * and high-performance Excel/PDF exports across the entire application.
 */
export function PrintableOperatorLogsModal({
  open,
  onClose,
  logs,
  user,
  assignedMachine,
}: PrintableOperatorLogsModalProps) {
  return (
    <PrintableSupervisorLogsModal
      open={open}
      onClose={onClose}
      user={user}
      logs={logs as unknown as MachineHourLog[]}
      viewMode="operator"
      selectedEntityId={user.id}
      selectedEntityName={user.full_name || "Operator"}
      selectedOperatorId={user.id}
      selectedMonthValue="all"
      machines={assignedMachine ? [assignedMachine] : []}
    />
  );
}
