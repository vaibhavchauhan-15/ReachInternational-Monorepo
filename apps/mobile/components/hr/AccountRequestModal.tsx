/**
 * ServiceCentric Mobile — Account & HR Request Modal (Phase 23)
 * Allows staff to submit leave applications, uniform/PPE requests, or HR support tickets.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { X, HelpCircle } from 'lucide-react-native';

export interface AccountRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (request: {
    requestType: string;
    startDate?: string;
    endDate?: string;
    reason: string;
  }) => void;
}

export const AccountRequestModal: React.FC<AccountRequestModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [requestType, setRequestType] = useState('leave');
  const [startDate, setStartDate] = useState('2026-08-25');
  const [endDate, setEndDate] = useState('2026-08-27');
  const [reason, setReason] = useState('Casual leave application for personal work.');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit({
        requestType,
        startDate,
        endDate,
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
            <Text style={[styles.title, { color: theme.colors.ink }]}>HR Support / Leave Request</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            <Text style={[styles.label, { color: theme.colors.body }]}>Request Category</Text>
            <View style={styles.catRow}>
              {[
                { key: 'leave', label: 'Leave Request' },
                { key: 'ppe', label: 'Safety PPE / Boots' },
                { key: 'helpdesk', label: 'HR Helpdesk' },
              ].map((c) => {
                const isSelected = requestType === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setRequestType(c.key)}
                    style={[
                      styles.catBtn,
                      {
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.hairlineSoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? theme.colors.link : theme.colors.mute, fontSize: 12, fontWeight: '600' }}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {requestType === 'leave' && (
              <View style={styles.row}>
                <Input
                  label="Start Date"
                  value={startDate}
                  onChangeText={setStartDate}
                  containerStyle={{ flex: 1, marginRight: 6 }}
                />
                <Input
                  label="End Date"
                  value={endDate}
                  onChangeText={setEndDate}
                  containerStyle={{ flex: 1, marginLeft: 6 }}
                />
              </View>
            )}

            <Input
              label="Request Details & Reason"
              placeholder="State reason for leave or PPE specifications needed..."
              value={reason}
              onChangeText={setReason}
              multiline
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="md" />
            <Button label="Submit Request" onPress={handleSubmit} isLoading={isSubmitting} variant="primary" size="md" />
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
    marginBottom: spacingNumeric.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
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
  catRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
  },
  catBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
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
