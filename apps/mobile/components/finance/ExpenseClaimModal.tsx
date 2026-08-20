/**
 * ServiceCentric Mobile — Log Field Expense Claim Modal (Phase 22)
 * Allows field technicians to log operational expenses (fuel, toll, spare parts, travel).
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Camera, DollarSign } from 'lucide-react-native';

export interface ExpenseClaimModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expense: {
    category: string;
    amount: number;
    machineCode: string;
    description: string;
    receiptPhotoCount: number;
  }) => void;
}

export const ExpenseClaimModal: React.FC<ExpenseClaimModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [category, setCategory] = useState('Fuel & Transit');
  const [amount, setAmount] = useState('2450');
  const [machineCode, setMachineCode] = useState('MCH-004');
  const [description, setDescription] = useState('Emergency diesel refilling at site & highway toll taxes.');
  const [receiptPhotoCount, setReceiptPhotoCount] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please provide a valid claim amount.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        category,
        amount: parseFloat(amount) || 0,
        machineCode,
        description,
        receiptPhotoCount,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Field Expense Claim</Text>
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
            <Text style={[styles.label, { color: theme.colors.body }]}>Expense Category</Text>
            <View style={styles.catRow}>
              {['Fuel & Transit', 'Spare Parts', 'Travel', 'Lodging'].map((c) => {
                const isSelected = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.catBtn,
                      {
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.hairlineSoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? theme.colors.link : theme.colors.mute, fontSize: 11, fontWeight: '600' }}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Claim Amount (INR)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Input
              label="Associated Machine Code"
              value={machineCode}
              onChangeText={setMachineCode}
            />

            <Input
              label="Expense Description & Reason"
              placeholder="Describe purpose of expense..."
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity
              onPress={() => setReceiptPhotoCount((c) => c + 1)}
              style={[styles.photoBox, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.hairlineSoft }]}
            >
              <Camera size={20} color={theme.colors.link} />
              <Text style={[styles.photoText, { color: theme.colors.link }]}>
                {receiptPhotoCount > 0 ? `${receiptPhotoCount} Bill Receipt Attached` : 'Attach Receipt Photo'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Claim" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacingNumeric.xxs,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
  },
  catBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.xs,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
