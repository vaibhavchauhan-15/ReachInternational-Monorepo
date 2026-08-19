/**
 * ServiceCentric Mobile — Meter Log Modal Component (Phase 14)
 * Allows operators and technicians to log daily machine hour meter readings directly from My Work.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X } from 'lucide-react-native';

export interface MeterLogModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  machineCode?: string;
  onSubmit: (log: { machineId: string; startMeter: number; endMeter: number; runningHours: number; remarks: string }) => void;
}

export const MeterLogModal: React.FC<MeterLogModalProps> = ({
  visible,
  onClose,
  machineId = '',
  machineCode = 'MCH-004',
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [startMeter, setStartMeter] = useState('1420');
  const [endMeter, setEndMeter] = useState('1428');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const startVal = parseFloat(startMeter) || 0;
  const endVal = parseFloat(endMeter) || 0;
  const runningHours = Math.max(0, endVal - startVal);

  const handleSubmit = () => {
    if (endVal < startVal) {
      setError('End meter reading cannot be less than start meter.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        machineId,
        startMeter: startVal,
        endMeter: endVal,
        runningHours,
        remarks,
      });
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>Log Hour Meter — {machineCode}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll}>
            <Input
              label="Start Meter Reading (hrs)"
              value={startMeter}
              onChangeText={setStartMeter}
              keyboardType="numeric"
            />

            <Input
              label="End Meter Reading (hrs)"
              value={endMeter}
              onChangeText={setEndMeter}
              keyboardType="numeric"
            />

            <View style={[styles.calcBox, { backgroundColor: theme.colors.hairlineSoft }]}>
              <Text style={[styles.calcLabel, { color: theme.colors.mute }]}>Calculated Running Hours:</Text>
              <Text style={[styles.calcValue, { color: theme.colors.link }]}>{runningHours.toFixed(1)} hrs</Text>
            </View>

            <Input
              label="Operational Remarks / Location"
              placeholder="e.g. Normal shift operation at Delhi Site"
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Meter Log" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    padding: spacingNumeric.xs,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  formScroll: {
    marginBottom: spacingNumeric.md,
  },
  calcBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.sm,
  },
  calcLabel: {
    fontSize: 13,
  },
  calcValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
