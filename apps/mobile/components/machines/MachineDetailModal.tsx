import React from 'react';
import { Modal, View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ui';
import { MachineDetailView } from './MachineDetailView';

export interface MachineDetailModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  userRole?: string | null;
  onMachineUpdated?: () => void;
  machineData?: any;
}

/**
 * MachineDetailModal
 * Wraps MachineDetailView in a full-screen Modal presentation for modal-based invocation,
 * maintaining identical visual layout, tabs, hero banner, personnel and running hour logs.
 */
export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  visible,
  onClose,
  machineData,
  userRole,
  onMachineUpdated,
}) => {
  const { theme, isDark } = useTheme();

  if (!machineData) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.canvas }]}
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <MachineDetailView
          machine={machineData}
          onBack={onClose}
          onMachineUpdated={onMachineUpdated}
          onMachineDeleted={onClose}
          userRole={userRole}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
