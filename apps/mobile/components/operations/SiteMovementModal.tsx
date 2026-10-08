/**
 * ServiceCentric Mobile — Site Movement & Machine Relocation Modal (Phase 18)
 * Allows field supervisors to log machine loading, transport, site relocation, and unloading.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Button, Input, useTheme, Text } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Truck, MapPin } from '../ui/icon';

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

  const handleSubmit = async () => {
    if (!fromLocation || !toLocation) {
      haptics.reject();
      setError('Please provide origin and destination site locations.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await Promise.resolve(onSubmit({
        machineCode,
        fromLocation,
        toLocation,
        transporterName,
        driverPhone,
        notes,
      }));
      haptics.confirm();
      onClose();
    } catch (err: any) {
      haptics.reject();
      setError(err?.message || 'Failed to submit site movement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom">
      <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>Machine Relocation & Site Movement</Text>
            <Pressable variant="iconButton" haptic="select" hitSlopToMin48={true} onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '22', borderColor: theme.colors.error }]}>
              <Text variant="caption" style={{ color: theme.colors.error }}>{error}</Text>
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
    </AppModal>
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
  title: {},
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
