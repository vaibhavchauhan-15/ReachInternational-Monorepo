import React from 'react';
import { MobileAssignPersonnelModal } from '../operations/MobileAssignPersonnelModal';
import type { UserRecord } from './UserDetailModal';

export interface AssignMachineModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  userRole?: string;
  onSuccess: (updatedAssignments?: any) => void;
}

/**
 * AssignMachineModal — Focused assignment modal for users roster.
 * Replaces legacy checkbox drawer with canonical MobileAssignPersonnelModal.
 * Supports Supervisor, Machine, and Shift dropdowns with client/site configuration,
 * overnight shift intervals, multi-machine disjoint overlap validation, and atomic concurrency locks.
 */
export const AssignMachineModal: React.FC<AssignMachineModalProps> = ({
  visible,
  onClose,
  user,
  userRole,
  onSuccess,
}) => {
  if (!visible) return null;

  return (
    <MobileAssignPersonnelModal
      visible={visible}
      onClose={onClose}
      targetUser={user}
      initialOperatorId={user?.role === 'operator' ? user?.id : undefined}
      initialSupervisorId={user?.role === 'supervisor' || user?.role === 'manager' ? user?.id : undefined}
      userRole={userRole}
      onSuccess={onSuccess}
    />
  );
};
