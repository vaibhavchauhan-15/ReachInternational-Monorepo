/**
 * ServiceCentric Mobile — Machine Return Inspection Modal (Phase 20)
 * Allows field supervisors to inspect returned rental machines:
 * Return hour meter, fuel level, damage report, damage photos, and return sign-off.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X, Camera, ShieldAlert } from 'lucide-react-native';

export interface RentalReturnModalProps {
  visible: boolean;
  onClose: () => void;
  contractNo?: string;
  machineCode?: string;
  onSubmit: (returnReport: {
    contractNo: string;
    machineCode: string;
    returnMeter: number;
    fuelLevel: string;
    hasDamage: boolean;
    damageDescription: string;
    photoCount: number;
  }) => void;
}

export const RentalReturnModal: React.FC<RentalReturnModalProps> = ({
  visible,
  onClose,
  contractNo = 'RNT-2026-081',
  machineCode = 'MCH-004',
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [returnMeter, setReturnMeter] = useState('1450');
  const [fuelLevel, setFuelLevel] = useState('75% Full');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [photoCount, setPhotoCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (hasDamage && !damageDescription.trim()) {
      setError('Please provide a description of the observed damage.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        contractNo,
        machineCode,
        returnMeter: parseFloat(returnMeter) || 0,
        fuelLevel,
        hasDamage,
        damageDescription,
        photoCount,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Rental Return Inspection</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.link }]}>
            Contract: {contractNo} • Machine: {machineCode}
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12 }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll}>
            <Input
              label="Return Hour Meter Reading (hrs)"
              value={returnMeter}
              onChangeText={setReturnMeter}
              keyboardType="numeric"
            />

            <Input
              label="Return Fuel Level / Percentage"
              value={fuelLevel}
              onChangeText={setFuelLevel}
            />

            {/* Damage Check Toggle */}
            <View style={[styles.toggleRow, { borderColor: theme.colors.hairline }]}>
              <Text style={[styles.toggleLabel, { color: theme.colors.ink }]}>Observed Machine Damage / Wear</Text>
              <Switch
                value={hasDamage}
                onValueChange={setHasDamage}
                trackColor={{ false: theme.colors.hairline, true: theme.colors.error }}
              />
            </View>

            {hasDamage && (
              <>
                <Input
                  label="Damage Inspection Description"
                  placeholder="Describe scratches, dented panels, broken lights, or hydraulic leaks..."
                  value={damageDescription}
                  onChangeText={setDamageDescription}
                  multiline
                />

                <TouchableOpacity
                  onPress={() => setPhotoCount((c) => c + 1)}
                  style={[styles.photoBox, { borderColor: theme.colors.error, backgroundColor: theme.colors.error + '11' }]}
                >
                  <Camera size={20} color={theme.colors.error} />
                  <Text style={[styles.photoText, { color: theme.colors.error }]}>
                    {photoCount > 0 ? `${photoCount} Damage Photos Attached` : 'Attach Damage Photos'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Complete Return" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacingNumeric.sm,
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.sm,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    marginVertical: spacingNumeric.xs,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
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
