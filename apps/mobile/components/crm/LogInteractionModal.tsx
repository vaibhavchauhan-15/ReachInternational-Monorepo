/**
 * ServiceCentric Mobile — Log Customer Interaction Modal (Phase 21)
 * Allows sales reps to record customer call logs, site visits, and follow-ups.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X, PhoneCall, MapPin, MessageSquare } from 'lucide-react-native';

export interface LogInteractionModalProps {
  visible: boolean;
  onClose: () => void;
  customerName?: string;
  onSubmit: (interaction: {
    interactionType: string;
    notes: string;
    nextFollowUpDate: string;
  }) => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({
  visible,
  onClose,
  customerName = 'Delhi Logistics Pvt Ltd',
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [interactionType, setInteractionType] = useState('site_visit');
  const [notes, setNotes] = useState('Visited Delhi Hub site. Met VP Operations regarding expansion of forklift fleet by 2 units in Q4.');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('2026-08-25');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit({
        interactionType,
        notes,
        nextFollowUpDate,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>Log Customer Activity</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.colors.link }]}>Target: {customerName}</Text>

          <ScrollView style={styles.formScroll}>
            <Text style={[styles.label, { color: theme.colors.body }]}>Activity Type</Text>
            <View style={styles.typeRow}>
              {[
                { key: 'phone_call', label: 'Phone Call' },
                { key: 'site_visit', label: 'Site Visit' },
                { key: 'email', label: 'Email Note' },
              ].map((t) => {
                const isSelected = interactionType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setInteractionType(t.key)}
                    style={[
                      styles.typeBtn,
                      {
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.hairlineSoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? theme.colors.link : theme.colors.mute, fontSize: 12, fontWeight: '600' }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Meeting / Activity Notes"
              placeholder="Record summary of discussion, customer demands, or feedback..."
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Input
              label="Next Follow-Up Date (YYYY-MM-DD)"
              value={nextFollowUpDate}
              onChangeText={setNextFollowUpDate}
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Save Log" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
  formScroll: {
    marginBottom: spacingNumeric.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacingNumeric.xxs,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
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
