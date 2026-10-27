"use client";

import React from "react";
import {
  AssignSupervisorToClientDialog,
  type AssignSupervisorToClientDialogProps,
} from "@/components/assignments/AssignSupervisorToClientDialog";
import type { ClientSupervisorItem } from "@/lib/data/clients";

export interface ClientSupervisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientCode?: string;
  onSuccess: (newAssignment: ClientSupervisorItem) => void;
  onError?: (errorMessage: string) => void;
}

/**
 * Standardized ClientSupervisorModal — assigns eligible supervisors to client scope.
 * Delegates to the unified AssignSupervisorToClientDialog component.
 */
export function ClientSupervisorModal(props: ClientSupervisorModalProps) {
  return <AssignSupervisorToClientDialog {...props} />;
}
