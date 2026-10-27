"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User, UserRole, ClientShiftCode } from "@reachinternational/types";
import {
  AssignOperatorToMachineDialog,
  type AssignOperatorToMachineDialogProps,
} from "@/components/assignments/AssignOperatorToMachineDialog";
import {
  AssignMachineToOperatorDialog,
  type AssignMachineToOperatorDialogProps,
} from "@/components/assignments/AssignMachineToOperatorDialog";
import { getAssignableMachinesAction } from "@/app/actions/assignments";

export interface OperatorAssignmentItem {
  operatorId: string;
  operatorName: string;
  phone?: string | null;
  email?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
}

export interface MachineAssignmentItem {
  machineId: string;
  machineCode: string;
  machineName?: string;
  model?: string;
  serialNumber?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  shiftCode: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  notes?: string | null;
  clientShifts?: ClientShiftCode[];
}

export interface AssignPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If machine is target:
  machine?: MachineWithEngineer | any | null;
  machineId?: string;
  // If operator is target:
  operator?: User | null;
  operatorId?: string;
  // Lists for dropdown / selection:
  supervisors?: any[];
  operators?: any[];
  machines?: any[];
  initialMachineId?: string;
  initialOperatorId?: string;
  userRole?: UserRole | string;
  onSuccess?: (result?: any) => void;
  onMachineUpdated?: (updated: Partial<MachineWithEngineer>) => void;
}

/**
 * Standardized AssignPersonnelModal — Composes AssignOperatorToMachineDialog and AssignMachineToOperatorDialog.
 * Maintains 100% backward compatibility for all existing callers while providing modern Geist design tokens,
 * debounced search, responsive ergonomics, and reliable optimistic rollback.
 */
export function AssignPersonnelModal({
  isOpen,
  onClose,
  machine: propMachine,
  machineId: propMachineId,
  operator: propOperator,
  operatorId: propOperatorId,
  supervisors = [],
  operators = [],
  machines = [],
  initialMachineId,
  initialOperatorId,
  userRole = "admin",
  onSuccess,
  onMachineUpdated,
}: AssignPersonnelModalProps) {
  // Determine target context
  const hasFixedOperator = Boolean(propOperator || propOperatorId || initialOperatorId);
  const hasFixedMachine = Boolean(propMachine || propMachineId || initialMachineId);

  // Lazy machine resolution if only machine ID was supplied
  const [resolvedMachine, setResolvedMachine] = useState<any>(propMachine || null);
  const targetMachineId = propMachine?.id || propMachineId || initialMachineId;

  useEffect(() => {
    if (propMachine) {
      setResolvedMachine(propMachine);
      return;
    }

    if (!isOpen || !targetMachineId) return;

    // Check if machine is in passed machines array
    const found = machines.find((m) => m.id === targetMachineId);
    if (found) {
      setResolvedMachine(found);
      return;
    }

    // Otherwise fetch assignable machines to find it
    let active = true;
    getAssignableMachinesAction().then((res) => {
      if (!active) return;
      if (res.success && res.machines) {
        const m = res.machines.find((item: any) => item.id === targetMachineId);
        if (m) setResolvedMachine(m);
        else {
          // Fallback minimal object
          setResolvedMachine({ id: targetMachineId, machine_id: "Equipment", model: "Asset" });
        }
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, targetMachineId, propMachine, machines]);

  // Lazy operator resolution if only operator ID was supplied
  const resolvedOperator = useMemo(() => {
    if (propOperator) return propOperator;
    const opId = propOperatorId || initialOperatorId;
    if (!opId) return null;
    const found = operators.find((u) => u.id === opId);
    if (found) return found;
    return { id: opId, full_name: "Operator", role: "operator" } as User;
  }, [propOperator, propOperatorId, initialOperatorId, operators]);

  if (!isOpen) return null;

  // CASE 1: Operator is the target entity (User detail view)
  if (hasFixedOperator && !hasFixedMachine) {
    return (
      <AssignMachineToOperatorDialog
        isOpen={isOpen}
        onClose={onClose}
        operator={resolvedOperator}
        userRole={typeof userRole === "string" ? userRole : undefined}
        onSuccess={onSuccess}
      />
    );
  }

  // CASE 2: Machine personnel assignment (Machine detail view, Fleet list, Operations)
  return (
    <AssignOperatorToMachineDialog
      isOpen={isOpen}
      onClose={onClose}
      machine={resolvedMachine}
      machines={machines}
      initialMachineId={targetMachineId}
      supervisors={supervisors}
      operators={operators}
      userRole={userRole}
      onSuccess={onSuccess}
      onMachineUpdated={onMachineUpdated}
    />
  );
}
