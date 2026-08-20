/**
 * ServiceCentric Mobile — Field Part Requisition Modal (Phase 19)
 * Allows field technicians to request spare parts directly from store inventory.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Package, AlertCircle } from 'lucide-react-native';

export interface PartRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (request: {
    machineCode: string;
    partName: string;
    partNumber: string;
    quantity: number;
    urgency: string;
    reason: string;
  }) => void;
}

export const PartRequestModal: React.FC<PartRequestModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [machineCode, setMachineCode] = useState('MCH-004');
  const [partName, setPartName] = useState('Hydraulic Seal Kit');
  const [partNumber, setPartNumber] = useState('HSK-8812');
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState('high');
  const [reason, setReason] = useState('Required urgently for breakdown complaint CMP-008 hydraulic leak repair.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!partName.trim()) {
      setError('Please specify the part name required.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        machineCode,
        partName,
        partNumber,
        quantity: parseInt(quantity, 10) || 1,
        urgency,
        reason,
      });
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>Field Part Requisition</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll}>
            <Input
              label="Target Machine Code"
              value={machineCode}
              onChangeText={setMachineCode}
            />

            <Input
              label="Part Description / Name"
              placeholder="e.g. Hydraulic Seal Kit"
              value={partName}
              onChangeText={setPartName}
            />

            <View style={styles.row}>
              <Input
                label="Part Number (P/N)"
                value={partNumber}
                onChangeText={setPartNumber}
                containerStyle={{ flex: 2, marginRight: 6 }}
              />
              <Input
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            <Text style={[styles.label, { color: theme.colors.body }]}>Requisition Urgency Level</Text>
            <View style={styles.urgencyRow}>
              {[
                { key: 'normal', label: 'Normal' },
                { key: 'high', label: 'High Priority' },
                { key: 'emergency', label: 'Emergency Breakdown' },
              ].map((u) => {
                const isSelected = urgency === u.key;
                return (
                  <TouchableOpacity
                    key={u.key}
                    onPress={() => setUrgency(u.key)}
                    style={[
                      styles.urgencyBtn,
                      {
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.hairlineSoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? theme.colors.link : theme.colors.mute, fontSize: 12, fontWeight: '600' }}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Requisition Reason / Complaint #"
              placeholder="Detail why part is needed..."
              value={reason}
              onChangeText={setReason}
              multiline
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Part Request" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    padding: spacingNumeric.xs,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs,
  },
  formScroll: {
    marginBottom: spacingNumeric.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacingNumeric.xxs,
    marginTop: spacingNumeric.xs,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
  },
  urgencyBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
