import React, { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { showToast } from '../ui';
import { haptics } from '../../lib/haptics';
import { Trash2 } from '../ui/icon';
import { supabase } from '../../lib/supabase';
import { notifyMachineDeleted } from '../../lib/notifications';

export interface DeleteMachineDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
  onDeleted?: () => void;
  machine?: any;
  machineId?: string;
  model?: string;
  isLoading?: boolean;
}

export const DeleteMachineDialog: React.FC<DeleteMachineDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  onDeleted,
  machine,
  machineId,
  model,
  isLoading = false,
}) => {
  const [deleting, setDeleting] = useState(false);

  const displayId = machine?.machine_id || machineId || 'Machine';
  const displayModel = machine?.model || model || '';
  const isBusy = isLoading || deleting;

  const handleDelete = async () => {
    haptics.warning();
    if (onConfirm) {
      await onConfirm();
      return;
    }

    const targetId = machine?.id;
    if (!targetId) {
      onClose();
      return;
    }

    try {
      setDeleting(true);
      const { error } = await supabase.from('machines').delete().eq('id', targetId);
      if (error) {
        haptics.error();
        showToast('error', 'Error', error.message || 'Failed to delete machine');
      } else {
        haptics.success();
        notifyMachineDeleted(displayId);
        showToast('success', 'Machine Deleted', `Machine ${displayId} has been deleted.`);
        onDeleted?.();
        onClose();
      }
    } catch (err: any) {
      haptics.error();
      showToast('error', 'Error', err?.message || 'Failed to delete machine');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      visible={visible}
      onClose={onClose}
      onConfirm={handleDelete}
      title={`Delete Machine ${displayId}?`}
      message={`Are you sure you want to permanently delete machine ${displayId}${
        displayModel ? ` (${displayModel})` : ''
      }? This action cannot be undone and will permanently remove associated shift personnel records.`}
      confirmText="Delete Machine"
      cancelText="Cancel"
      variant="danger"
      isLoading={isBusy}
      icon={<Trash2 size={24} color="#ef4444" />}
    />
  );
};
