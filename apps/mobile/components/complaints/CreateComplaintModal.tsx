/**
 * ServiceCentric Mobile — Create Breakdown Complaint Modal (Phase 16)
 * Multi-step mobile form workflow for logging breakdown complaints:
 * Machine Selection -> Complaint -> Hour Meter -> Location -> Parts -> Photos -> Submit.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Camera, Paperclip } from 'lucide-react-native';

export interface CreateComplaintModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (complaint: {
    machineId: string;
    machineCode: string;
    complaintText: string;
    hourMeter: number;
    city: string;
    stateName: string;
    location: string;
    requiredPart: string;
    partQuantity: number;
    imageCount: number;
  }) => void;
}

export const CreateComplaintModal: React.FC<CreateComplaintModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [machineCode, setMachineCode] = useState('MCH-004');
  const [complaintText, setComplaintText] = useState('');
  const [hourMeter, setHourMeter] = useState('1420');
  const [city, setCity] = useState('Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [location, setLocation] = useState('Delhi Logistics Hub, Gate 2');
  const [requiredPart, setRequiredPart] = useState('Hydraulic Seal Kit');
  const [partQuantity, setPartQuantity] = useState('1');
  const [imageCount, setImageCount] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!complaintText.trim()) {
      setError('Please provide a description of the breakdown complaint.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        machineId: 'mch-004',
        machineCode,
        complaintText,
        hourMeter: parseFloat(hourMeter) || 0,
        city,
        stateName,
        location,
        requiredPart,
        partQuantity: parseInt(partQuantity, 10) || 1,
        imageCount,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Report Breakdown Complaint</Text>
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
            {/* Step 1: Machine Selection */}
            <Input
              label="Machine Code / ID"
              placeholder="e.g. MCH-004"
              value={machineCode}
              onChangeText={setMachineCode}
            />

            {/* Step 2: Breakdown Complaint Description */}
            <Input
              label="Breakdown Issue Description"
              placeholder="Describe symptoms, noise, leaks, or electrical faults..."
              value={complaintText}
              onChangeText={setComplaintText}
              multiline
            />

            {/* Step 3: Current Hour Meter */}
            <Input
              label="Current Hour Meter Reading (hrs)"
              placeholder="1420"
              value={hourMeter}
              onChangeText={setHourMeter}
              keyboardType="numeric"
            />

            {/* Step 4: Location Details */}
            <View style={styles.row}>
              <Input
                label="City"
                value={city}
                onChangeText={setCity}
                containerStyle={{ flex: 1, marginRight: 6 }}
              />
              <Input
                label="State"
                value={stateName}
                onChangeText={setStateName}
                containerStyle={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            <Input
              label="Specific Site Location / Landmark"
              placeholder="e.g. Delhi Logistics Hub, Bay 4"
              value={location}
              onChangeText={setLocation}
            />

            {/* Step 5: Parts Required */}
            <View style={styles.row}>
              <Input
                label="Required Spare Part"
                placeholder="Part description or part #"
                value={requiredPart}
                onChangeText={setRequiredPart}
                containerStyle={{ flex: 2, marginRight: 6 }}
              />
              <Input
                label="Qty"
                value={partQuantity}
                onChangeText={setPartQuantity}
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            {/* Step 6: Photos Attachment */}
            <Text style={[styles.sectionLabel, { color: theme.colors.body }]}>Damage / Issue Photos</Text>
            <TouchableOpacity
              onPress={() => setImageCount((c) => c + 1)}
              style={[styles.photoBox, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.hairlineSoft }]}
            >
              <Camera size={20} color={theme.colors.link} />
              <Text style={[styles.photoText, { color: theme.colors.link }]}>
                {imageCount > 0 ? `${imageCount} Photo Attached (Tap to add more)` : 'Attach Photo of Breakdown'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Complaint" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacingNumeric.xxs,
    marginTop: spacingNumeric.xs,
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
