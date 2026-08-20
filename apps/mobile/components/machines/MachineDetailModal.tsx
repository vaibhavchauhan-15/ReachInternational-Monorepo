/**
 * ServiceCentric Mobile — Machine Detail Modal (Phase 15)
 * Native detail modal showing technical specs, site/customer assignment,
 * compliance & insurance, hour meter, and service history for a machine.
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Badge, Button, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatMachineCode, formatDate, formatINR } from '@reachinternational/utils';
import { X, Truck, ShieldCheck, Wrench, Calendar, MapPin, UserCheck } from 'lucide-react-native';

export interface MachineDetailModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  machineData?: {
    id: string;
    machine_code: string;
    machine_name: string;
    model: string;
    serial_number: string;
    category: string;
    status: string;
    hour_meter: number;
    customer_name: string;
    customer_mobile: string;
    city: string;
    state: string;
    insurance_policy_no: string;
    insurance_expiry_date: string;
    third_party_certificate: string;
    next_service_due_date: string;
    operator_name?: string;
  };
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  visible,
  onClose,
  machineData = {
    id: 'mch-004',
    machine_code: 'MCH-004',
    machine_name: 'Toyota 8FG 3.0T Forklift',
    model: '8FG30',
    serial_number: 'TY8FG-99214',
    category: 'Forklift Counterbalance',
    status: 'active',
    hour_meter: 1420,
    customer_name: 'Delhi Logistics Private Limited',
    customer_mobile: '+91 98765 43210',
    city: 'Delhi',
    state: 'Delhi',
    insurance_policy_no: 'POL-ICICI-883219',
    insurance_expiry_date: '2026-12-31',
    third_party_certificate: 'TPC-2026-4412',
    next_service_due_date: '2026-09-15',
    operator_name: 'Vikram Singh',
  },
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'specs' | 'site' | 'compliance' | 'history'>('specs');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.code, { color: theme.colors.link }]}>
                {formatMachineCode(machineData.machine_code)}
              </Text>
              <Text style={[styles.title, { color: theme.colors.ink }]}>{machineData.machine_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Status & Meter Banner */}
          <View style={[styles.banner, { backgroundColor: theme.colors.hairlineSoft }]}>
            <Badge status={machineData.status} />
            <Text style={[styles.meterText, { color: theme.colors.ink }]}>
              Hour Meter: <Text style={{ color: theme.colors.link, fontWeight: '700' }}>{machineData.hour_meter} hrs</Text>
            </Text>
          </View>

          {/* Detail Tabs */}
          <View style={styles.tabRow}>
            {[
              { key: 'specs', label: 'Technical Specs' },
              { key: 'site', label: 'Customer & Site' },
              { key: 'compliance', label: 'Compliance' },
              { key: 'history', label: 'Service History' },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as any)}
                  style={[
                    styles.tabItem,
                    { borderBottomColor: isActive ? theme.colors.link : 'transparent' },
                  ]}
                >
                  <Text style={[styles.tabText, { color: isActive ? theme.colors.link : theme.colors.mute }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.bodyScroll}>
            {activeTab === 'specs' && (
              <View style={styles.section}>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Category:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.category}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Model Number:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.model}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Serial Number:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.serial_number}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Next Service Due:</Text>
                  <Text style={[styles.val, { color: theme.colors.warning }]}>
                    {formatDate(machineData.next_service_due_date)}
                  </Text>
                </View>
              </View>
            )}

            {activeTab === 'site' && (
              <View style={styles.section}>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Customer Name:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.customer_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Contact Mobile:</Text>
                  <Text style={[styles.val, { color: theme.colors.link }]}>{machineData.customer_mobile}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Location Site:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>
                    {machineData.city}, {machineData.state}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Assigned Operator:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.operator_name}</Text>
                </View>
              </View>
            )}

            {activeTab === 'compliance' && (
              <View style={styles.section}>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Insurance Policy #:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.insurance_policy_no}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>Insurance Expiry:</Text>
                  <Text style={[styles.val, { color: theme.colors.success }]}>
                    {formatDate(machineData.insurance_expiry_date)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: theme.colors.mute }]}>3rd Party Cert #:</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.third_party_certificate}</Text>
                </View>
              </View>
            )}

            {activeTab === 'history' && (
              <View style={styles.section}>
                <View style={[styles.historyItem, { borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.historyTitle, { color: theme.colors.ink }]}>
                    1000 Hours Periodic Service
                  </Text>
                  <Text style={[styles.historyMeta, { color: theme.colors.mute }]}>
                    Completed on 12/07/2026 • Meter: 1,000 hrs
                  </Text>
                </View>
                <View style={[styles.historyItem, { borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.historyTitle, { color: theme.colors.ink }]}>
                    Breakdown Repair — Hydraulic Hose
                  </Text>
                  <Text style={[styles.historyMeta, { color: theme.colors.mute }]}>
                    Resolved on 04/05/2026 • Meter: 840 hrs
                  </Text>
                </View>
              </View>
            )}
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
  code: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  banner: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.md,
  },
  meterText: {
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: spacingNumeric.sm,
  },
  tabItem: {
    paddingVertical: spacingNumeric.xs,
    marginRight: spacingNumeric.md,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bodyScroll: {
    marginBottom: spacingNumeric.md,
  },
  section: {
    paddingVertical: spacingNumeric.xs,
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
  historyItem: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginVertical: 4,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    marginTop: spacingNumeric.xs,
  },
});
