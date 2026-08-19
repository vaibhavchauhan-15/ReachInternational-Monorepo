/**
 * ServiceCentric Mobile — Create Field Service Report (FSR) Modal (Phase 17)
 * Multi-step mobile FSR workflow:
 * Machine -> Component Checklist ("Mark All Passed") -> Work Completed -> Work Pending -> Replacement Parts -> Photos -> Digital Signature -> Submit.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X, CheckCircle, Camera, Edit3 } from 'lucide-react-native';

export interface CreateFsrModalProps {
  visible: boolean;
  onClose: () => void;
  complaintId?: string;
  machineCode?: string;
  onSubmit: (fsr: {
    machineCode: string;
    checklist: Record<string, boolean>;
    workDone: string;
    pendingWork: string;
    replacementPart: string;
    partQuantity: number;
    customerSignatureName: string;
    isDraft: boolean;
  }) => void;
}

export const CreateFsrModal: React.FC<CreateFsrModalProps> = ({
  visible,
  onClose,
  complaintId,
  machineCode = 'MCH-004',
  onSubmit,
}) => {
  const { theme } = useTheme();

  // Component Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    engineCheck: true,
    hydraulicCheck: false,
    brakeCheck: true,
    electricalCheck: true,
    mastCheck: true,
  });

  const [workDone, setWorkDone] = useState('Replaced hydraulic cylinder seals and pressure tested system up to 200 bar.');
  const [pendingWork, setPendingWork] = useState('None. Machine tested and cleared for regular shift operation.');
  const [replacementPart, setReplacementPart] = useState('Hydraulic Seal Kit (P/N: HSK-8812)');
  const [partQuantity, setPartQuantity] = useState('1');
  const [customerSignatureName, setCustomerSignatureName] = useState('Vikram Singh (Site Supervisor)');
  const [imageCount, setImageCount] = useState(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMarkAllPassed = () => {
    setChecklist({
      engineCheck: true,
      hydraulicCheck: true,
      brakeCheck: true,
      electricalCheck: true,
      mastCheck: true,
    });
  };

  const handleSubmit = (isDraft: boolean) => {
    if (!isDraft && !workDone.trim()) {
      setError('Please fill in Work Completed details before submitting.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        machineCode,
        checklist,
        workDone,
        pendingWork,
        replacementPart,
        partQuantity: parseInt(partQuantity, 10) || 1,
        customerSignatureName,
        isDraft,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Field Service Report (FSR)</Text>
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
            <Text style={[styles.sectionTitle, { color: theme.colors.link }]}>Target Machine: {machineCode}</Text>

            {/* Step 1: Component Checklist */}
            <View style={styles.checklistHeader}>
              <Text style={[styles.stepTitle, { color: theme.colors.ink }]}>1. Component Inspection Checklist</Text>
              <TouchableOpacity onPress={handleMarkAllPassed} style={styles.markAllBtn}>
                <CheckCircle size={14} color={theme.colors.success} />
                <Text style={[styles.markAllText, { color: theme.colors.success }]}>Mark All Passed</Text>
              </TouchableOpacity>
            </View>

            {[
              { key: 'engineCheck', label: 'Engine / Transmission System' },
              { key: 'hydraulicCheck', label: 'Hydraulic Hoses & Cylinders' },
              { key: 'brakeCheck', label: 'Brake & Steering Mechanics' },
              { key: 'electricalCheck', label: 'Battery & Electrical Wiring' },
              { key: 'mastCheck', label: 'Mast, Chains & Carriage' },
            ].map((item) => (
              <View key={item.key} style={[styles.checkRow, { borderColor: theme.colors.hairline }]}>
                <Text style={[styles.checkLabel, { color: theme.colors.body }]}>{item.label}</Text>
                <Switch
                  value={checklist[item.key]}
                  onValueChange={() => toggleCheck(item.key)}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.success }}
                />
              </View>
            ))}

            {/* Step 2: Work Done & Pending */}
            <Text style={[styles.stepTitle, { color: theme.colors.ink, marginTop: spacingNumeric.md }]}>
              2. Work Completed Details
            </Text>
            <Input
              placeholder="Detail all repair procedures, adjustments, and oil top-ups performed..."
              value={workDone}
              onChangeText={setWorkDone}
              multiline
            />

            <Text style={[styles.stepTitle, { color: theme.colors.ink }]}>3. Pending Work / Recommendations</Text>
            <Input
              placeholder="Any pending tasks, parts awaiting delivery, or follow-up recommendations..."
              value={pendingWork}
              onChangeText={setPendingWork}
              multiline
            />

            {/* Step 3: Replacement Parts */}
            <Text style={[styles.stepTitle, { color: theme.colors.ink }]}>4. Replacement Parts Used</Text>
            <View style={styles.row}>
              <Input
                placeholder="Part description & P/N"
                value={replacementPart}
                onChangeText={setReplacementPart}
                containerStyle={{ flex: 2, marginRight: 6 }}
              />
              <Input
                placeholder="Qty"
                value={partQuantity}
                onChangeText={setPartQuantity}
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            {/* Step 4: Photos */}
            <Text style={[styles.stepTitle, { color: theme.colors.ink }]}>5. Inspection & Repair Photos</Text>
            <TouchableOpacity
              onPress={() => setImageCount((c) => c + 1)}
              style={[styles.photoBox, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.hairlineSoft }]}
            >
              <Camera size={20} color={theme.colors.link} />
              <Text style={[styles.photoText, { color: theme.colors.link }]}>
                {imageCount} Inspection Photos Attached (Tap to add)
              </Text>
            </TouchableOpacity>

            {/* Step 5: Customer Signature Confirmation */}
            <Text style={[styles.stepTitle, { color: theme.colors.ink }]}>6. Digital Customer Sign-Off</Text>
            <Input
              label="Customer Representative Name & Designation"
              value={customerSignatureName}
              onChangeText={setCustomerSignatureName}
            />
            <View style={[styles.sigBox, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.hairlineSoft }]}>
              <Edit3 size={18} color={theme.colors.mute} />
              <Text style={[styles.sigText, { color: theme.colors.mute }]}>
                Digital Signature Captured • Confirmed by {customerSignatureName}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button label="Save Draft" onPress={() => handleSubmit(true)} variant="outline" size="md" />
            <Button label="Submit FSR" onPress={() => handleSubmit(false)} isLoading={isSubmitting} variant="primary" size="md" />
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
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacingNumeric.xs,
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
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacingNumeric.xs,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.sm,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    marginVertical: 2,
  },
  checkLabel: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
  },
  photoBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
  },
  photoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sigBox: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.md,
  },
  sigText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
