/**
 * ServiceCentric Mobile — Site Movement & Machine Relocation Modal (Phase 18)
 * Allows field supervisors to log machine loading, transport, site relocation, and unloading.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X, Truck, MapPin } from 'lucide-react-native';

export interface SiteMovementModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (movement: {
    machineCode: string;
    fromLocation: string;
    toLocation: string;
    transporterName: string;
    driverPhone: string;
    notes: string;
  }) => void;
}

export const SiteMovementModal: React.FC<SiteMovementModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [machineCode, setMachineCode] = useState('MCH-004');
  const [fromLocation, setFromLocation] = useState('Delhi Logistics Hub, Site 1');
  const [toLocation, setToLocation] = useState('Gurgaon Warehouse Depot, Site 4');
  const [transporterName, setTransporterName] = useState('VRL Logistics Flatbed');
  const [driverPhone, setDriverPhone] = useState('+91 98100 11223');
  const [notes, setNotes] = useState('Relocating for 3-month rental deployment. Machine tied down & secured.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!fromLocation || !toLocation) {
      setError('Please provide origin and destination site locations.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        machineCode,
        fromLocation,
        toLocation,
        transporterName,
        driverPhone,
        notes,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Machine Relocation & Site Movement</Text>
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
              label="Origin Site Location (From)"
              placeholder="Origin site name or address"
              value={fromLocation}
              onChangeText={setFromLocation}
            />

            <Input
              label="Destination Site Location (To)"
              placeholder="Destination site name or address"
              value={toLocation}
              onChangeText={setToLocation}
            />

            <Input
              label="Transporter / Vehicle Detail"
              placeholder="e.g. VRL Logistics Flatbed Trailer"
              value={transporterName}
              onChangeText={setTransporterName}
            />

            <Input
              label="Driver Contact Mobile"
              placeholder="+91 98765 43210"
              value={driverPhone}
              onChangeText={setDriverPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Relocation & Dispatch Notes"
              placeholder="Loading instructions, tie-down checks, or special handling..."
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Relocation" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
