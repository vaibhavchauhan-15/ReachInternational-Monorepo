/**
 * ServiceCentric Mobile — Employee Detail Modal (Phase 23)
 * Displays staff profile, designation, branch, assigned machine, onboarding status, and documents vault.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Badge, Button, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { X, User, Phone, Mail, ShieldCheck, FileText, Wrench } from 'lucide-react-native';

export interface EmployeeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  employeeData?: {
    id: string;
    full_name: string;
    designation: string;
    role: string;
    phone: string;
    email: string;
    branch_name: string;
    joining_date: string;
    onboarding_status: string;
    assigned_machine?: string;
    license_status: string;
  };
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  visible,
  onClose,
  employeeData = {
    id: 'emp-104',
    full_name: 'Rahul Sharma',
    designation: 'Senior Field Service Engineer',
    role: 'service_engineer',
    phone: '+91 98765 43210',
    email: 'rahul.sharma@reachinternation.com',
    branch_name: 'Delhi Branch',
    joining_date: '2024-03-15',
    onboarding_status: 'completed',
    assigned_machine: 'Toyota 8FG (MCH-004)',
    license_status: 'Verified (Heavy Forklift Cert #HFC-9912)',
  },
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.name, { color: theme.colors.ink }]}>{employeeData.full_name}</Text>
              <Text style={[styles.desig, { color: theme.colors.mute }]}>{employeeData.designation}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <View style={[styles.banner, { backgroundColor: theme.colors.hairlineSoft }]}>
            <Badge status={employeeData.role} customLabel={employeeData.role.replace('_', ' ')} />
            <Badge status={employeeData.onboarding_status} />
          </View>

          <ScrollView style={styles.bodyScroll}>
            {/* Contact Details */}
            <View style={styles.section}>
              <Text style={[styles.secTitle, { color: theme.colors.link }]}>Contact & Branch Info</Text>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Phone Number:</Text>
                <Text style={[styles.val, { color: theme.colors.link }]}>{employeeData.phone}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Corporate Email:</Text>
                <Text style={[styles.val, { color: theme.colors.ink }]}>{employeeData.email}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Assigned Branch:</Text>
                <Text style={[styles.val, { color: theme.colors.ink }]}>{employeeData.branch_name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Joining Date:</Text>
                <Text style={[styles.val, { color: theme.colors.ink }]}>{formatDate(employeeData.joining_date)}</Text>
              </View>
            </View>

            {/* Assignments & Certifications */}
            <View style={styles.section}>
              <Text style={[styles.secTitle, { color: theme.colors.link }]}>Active Field Assignment & Vault</Text>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Assigned Equipment:</Text>
                <Text style={[styles.val, { color: theme.colors.ink }]}>{employeeData.assigned_machine}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.mute }]}>Operator License:</Text>
                <Text style={[styles.val, { color: theme.colors.success }]}>{employeeData.license_status}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button label="Close" onPress={onClose} variant="primary" fullWidth />
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
    alignItems: 'flex-start',
    marginBottom: spacingNumeric.xs,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
  },
  desig: {
    fontSize: 13,
  },
  closeBtn: {
    padding: 4,
  },
  banner: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    alignItems: 'center',
    marginBottom: spacingNumeric.md,
  },
  bodyScroll: {
    marginBottom: spacingNumeric.md,
  },
  section: {
    marginBottom: spacingNumeric.md,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacingNumeric.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  label: {
    fontSize: 13,
  },
  val: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacingNumeric.xs,
  },
});
