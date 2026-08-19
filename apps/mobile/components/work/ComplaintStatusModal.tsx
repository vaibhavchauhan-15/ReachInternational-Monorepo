/**
 * ServiceCentric Mobile — Complaint Status Modal Component (Phase 14)
 * Allows technicians to quickly update complaint lifecycle status.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, Badge, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X } from 'lucide-react-native';

export interface ComplaintStatusModalProps {
  visible: boolean;
  onClose: () => void;
  complaintNo?: string;
  currentStatus?: string;
  onUpdateStatus: (newStatus: string) => void;
}

const STATUS_OPTIONS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

export const ComplaintStatusModal: React.FC<ComplaintStatusModalProps> = ({
  visible,
  onClose,
  complaintNo = 'CMP-008',
  currentStatus = 'open',
  onUpdateStatus,
}) => {
  const { theme } = useTheme();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const handleSave = () => {
    onUpdateStatus(selectedStatus);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>Update Status — {complaintNo}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>Select new lifecycle status for this breakdown complaint:</Text>

          <View style={styles.optionsList}>
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = selectedStatus === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSelectedStatus(opt.key)}
                  style={[
                    styles.optionItem,
                    {
                      borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                      backgroundColor: isSelected ? theme.colors.hairlineSoft : 'transparent',
                    },
                  ]}
                >
                  <Badge status={opt.key} customLabel={opt.label} />
                  {isSelected && <Text style={{ color: theme.colors.link, fontWeight: '700' }}>✓ Selected</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Save Status" onPress={handleSave} variant="primary" size="md" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: spacingNumeric.md,
  },
  closeBtn: {
    padding: 4,
  },
  optionsList: {
    marginBottom: spacingNumeric.lg,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacingNumeric.sm,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
