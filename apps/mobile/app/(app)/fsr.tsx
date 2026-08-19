/**
 * ServiceCentric Mobile — Field Service Reports (FSR) Suite (Phase 17)
 * FSR list feed, draft management, component checklist, digital signature, and manager review state.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { CreateFsrModal } from '../../components/fsr/CreateFsrModal';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { formatDate, formatMachineCode } from '@servicecentric/utils';
import { FileText, CheckCircle, Edit3, AlertCircle } from 'lucide-react-native';

export type FsrFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'revision_requested';

const FSR_DATA = [
  {
    id: 'fsr-032',
    fsr_number: 'FSR-032',
    machine_code: 'MCH-004',
    service_date: '2026-08-19',
    work_done: 'Replaced hydraulic cylinder seals and pressure tested system up to 200 bar.',
    pending_work: 'None. Machine tested and cleared for regular shift operation.',
    parts_used: 'Hydraulic Seal Kit (Qty: 1)',
    customer_signature: 'Vikram Singh (Site Supervisor)',
    status: 'submitted',
  },
  {
    id: 'fsr-029',
    fsr_number: 'FSR-029',
    machine_code: 'MCH-012',
    service_date: '2026-08-18',
    work_done: 'Inspected brake drums & replaced front brake shoes.',
    pending_work: 'Rear brake shoe replacement pending part arrival.',
    parts_used: 'Brake Shoe Set (Qty: 2)',
    customer_signature: 'Amit Kumar',
    status: 'approved',
  },
  {
    id: 'fsr-025',
    fsr_number: 'FSR-025',
    machine_code: 'MCH-009',
    service_date: '2026-08-15',
    work_done: '1000h service checklist completed.',
    pending_work: 'Need manager re-check on transmission fluid level.',
    parts_used: 'Engine Oil Filter (Qty: 1)',
    customer_signature: 'Ramesh Verma',
    status: 'revision_requested',
  },
];

export default function FsrScreen() {
  const { theme } = useTheme();

  const [activeFilter, setActiveFilter] = useState<FsrFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const filteredFsrs = FSR_DATA.filter((item) => {
    return activeFilter === 'all' || item.status === activeFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.colors.ink }]}>Field Service Reports</Text>
            <Text style={[styles.screenSubtitle, { color: theme.colors.mute }]}>
              FSR checklists, digital signatures & manager reviews
            </Text>
          </View>

          <Button
            label="+ New FSR"
            onPress={() => setCreateModalVisible(true)}
            variant="primary"
            size="sm"
          />
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: 'All Reports' },
            { key: 'submitted', label: 'Submitted' },
            { key: 'approved', label: 'Approved' },
            { key: 'revision_requested', label: 'Needs Revision' },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as FsrFilter)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: isActive ? '#ffffff' : theme.colors.body }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* FSR Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {filteredFsrs.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.fsrNo, { color: theme.colors.link }]}>{item.fsr_number}</Text>
              <Badge status={item.status} />
            </View>

            <Text style={[styles.machineCode, { color: theme.colors.ink }]}>
              Machine: {formatMachineCode(item.machine_code)} • Service Date: {formatDate(item.service_date)}
            </Text>

            <Text style={[styles.workDoneText, { color: theme.colors.body }]}>
              <Text style={{ fontWeight: '700' }}>Work Done: </Text>{item.work_done}
            </Text>

            {item.pending_work ? (
              <Text style={[styles.pendingText, { color: theme.colors.mute }]}>
                <Text style={{ fontWeight: '600' }}>Pending: </Text>{item.pending_work}
              </Text>
            ) : null}

            <View style={styles.sigRow}>
              <CheckCircle size={14} color={theme.colors.success} />
              <Text style={[styles.sigText, { color: theme.colors.mute }]}>
                Customer Sign-Off: {item.customer_signature}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <Button label="View Details" onPress={() => {}} size="sm" variant="outline" />
              {item.status === 'revision_requested' ? (
                <Button label="Edit & Revise" onPress={() => setCreateModalVisible(true)} size="sm" variant="danger" />
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Create FSR Modal */}
      <CreateFsrModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 50,
    paddingBottom: spacingNumeric.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  screenSubtitle: {
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: spacingNumeric.xs,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    marginRight: spacingNumeric.xs,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 40,
  },
  card: {
    marginVertical: spacingNumeric.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  fsrNo: {
    fontSize: 15,
    fontWeight: '700',
  },
  machineCode: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  workDoneText: {
    fontSize: 13,
    marginBottom: 4,
  },
  pendingText: {
    fontSize: 12,
    marginBottom: spacingNumeric.xs,
  },
  sigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  sigText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
});
