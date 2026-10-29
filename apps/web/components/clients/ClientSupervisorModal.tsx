"use client";

import React from "react";
import {
  AssignSupervisorToClientDialog,
} from "@/components/assignments/AssignSupervisorToClientDialog";
import type { ClientSupervisorItem } from "@/lib/data/clients";
import type { ClientSite } from "@/lib/data/clients/client-sites";

export interface ClientSupervisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientCode?: string;
  initialSites?: ClientSite[];
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
