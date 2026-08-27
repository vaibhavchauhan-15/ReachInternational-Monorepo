/**
 * ServiceCentric Mobile — Create Lead & Opportunity Modal (Phase 21)
 * Allows sales reps to log new sales leads and rental deal opportunities from mobile.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, UserPlus, DollarSign } from 'lucide-react-native';

export interface CreateLeadModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (lead: {
    companyName: string;
    contactName: string;
    phone: string;
    email: string;
    city: string;
    estimatedValue: number;
    machineRequirement: string;
    stage: string;
  }) => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('180000');
  const [machineRequirement, setMachineRequirement] = useState('3.0T Forklift (2 Units, 6 Months Rental)');
  const [stage, setStage] = useState('qualified');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!companyName.trim() || !contactName.trim()) {
      setError('Please provide company name and contact person.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onSubmit({
        companyName,
        contactName,
        phone,
        email,
        city,
        estimatedValue: parseFloat(estimatedValue) || 0,
        machineRequirement,
        stage,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>New Lead & Opportunity</Text>
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
              label="Company Name"
              placeholder="e.g. Reliance Retail Logistics"
              value={companyName}
              onChangeText={setCompanyName}
            />

            <Input
              label="Contact Person Name"
              placeholder="e.g. Rajesh Mehta"
              value={contactName}
              onChangeText={setContactName}
            />

            <View style={styles.row}>
              <Input
                label="Mobile Phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                containerStyle={{ flex: 1, marginRight: 6 }}
              />
              <Input
                label="City / Location"
                placeholder="e.g. Pune"
                value={city}
                onChangeText={setCity}
                containerStyle={{ flex: 1, marginLeft: 6 }}
              />
            </View>

            <Input
              label="Machine Requirement Details"
              placeholder="e.g. 3.0T Forklift (2 Units, 6 Months Rental)"
              value={machineRequirement}
              onChangeText={setMachineRequirement}
            />

            <Input
              label="Estimated Deal Value (INR)"
              value={estimatedValue}
              onChangeText={setEstimatedValue}
              keyboardType="numeric"
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Save Lead" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.xs,
  },
});
