import React from 'react';
import { AssignMachineToOperatorModal } from '../assignments/AssignMachineToOperatorModal';
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
 * Delegates to the standardized AssignMachineToOperatorModal for operators
 * while maintaining canonical MobileAssignPersonnelModal fallback for backwards compatibility.
 */
export const AssignMachineModal: React.FC<AssignMachineModalProps> = ({
  visible,
  onClose,
  user,
  userRole,
  onSuccess,
}) => {
  if (!visible) return null;

  // Use dedicated operator machine assignment modal when targeting an operator
  if (user?.role === 'operator') {
    return (
      <AssignMachineToOperatorModal
        visible={visible}
        onClose={onClose}
        operator={user}
        onSuccess={onSuccess}
      />
    );
  }

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
