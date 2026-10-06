import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { haptics } from '../../lib/interaction/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Trash2 } from 'lucide-react-native';
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
  const { theme } = useTheme();
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
        Alert.alert('Error', error.message || 'Failed to delete machine');
      } else {
        haptics.success();
        notifyMachineDeleted(displayId);
        onDeleted?.();
        onClose();
      }
    } catch (err: any) {
      haptics.error();
      Alert.alert('Error', err?.message || 'Failed to delete machine');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="center"
      persistent={isBusy}
      testID="delete-machine-dialog"
    >
      <View
        style={[
          styles.dialog,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.error + '18' }]}>
          <Trash2 size={24} color={theme.colors.error} />
        </View>

        <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>
          Delete Machine {displayId}?
        </Text>

        <Text variant="caption" style={[styles.description, { color: theme.colors.mute }]}>
          Are you sure you want to permanently delete machine{' '}
          <Text variant="caption" style={{ color: theme.colors.ink }}>
            {displayId}
          </Text>
          {displayModel ? ` (${displayModel})` : ''}? This action cannot be undone and will permanently remove associated shift personnel records.
        </Text>

        <View style={styles.buttonRow}>
          <Touchable
            preset="button"
            onPress={onClose}
            disabled={isBusy}
            style={[
              styles.cancelBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="label" style={[styles.cancelBtnText, { color: theme.colors.ink }]}>
              Cancel
            </Text>
          </Touchable>

          <Touchable
            preset="button"
            onPress={handleDelete}
            disabled={isBusy}
            style={[
              styles.deleteBtn,
              { backgroundColor: theme.colors.error },
            ]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text variant="label" style={styles.deleteBtnText}>Delete Machine</Text>
            )}
          </Touchable>
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacingNumeric.xs,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacingNumeric.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelBtnText: {},
  deleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteBtnText: {
    color: '#ffffff',
  },
});
